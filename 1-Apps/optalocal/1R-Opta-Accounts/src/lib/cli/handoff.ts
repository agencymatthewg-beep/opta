import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { markCliReplayNonceConsumed } from './replay-store.ts';

const CLI_HANDOFF_TTL_MS = 5 * 60 * 1000;
const CLI_HANDOFF_MAX_ENTRIES = 2048;
const CLI_HANDOFF_PROOF_MAX_LENGTH = 4096;

const CLI_STATE_PATTERN = /^[a-zA-Z0-9_-]{16,256}$/;
const CLI_HANDOFF_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
const CLI_HANDOFF_NONCE_PATTERN = /^[A-Za-z0-9_-]{8,256}$/;

export interface CliHandoffRecord {
  state: string;
  port: number;
  handoff: string | null;
  returnTo: string | null;
  nonce: string;
  createdAt: number;
  expiresAt: number;
}

export interface CliHandoffRegistration extends CliHandoffRecord {
  proof: string | null;
  strategy: 'signed' | 'memory';
}

interface CliHandoffStoreRecord extends CliHandoffRecord {
  consumed: boolean;
}

declare global {
  var __optaCliHandoffStore: Map<string, CliHandoffStoreRecord> | undefined;
}

function handoffStore(): Map<string, CliHandoffStoreRecord> {
  if (!globalThis.__optaCliHandoffStore) {
    globalThis.__optaCliHandoffStore = new Map<string, CliHandoffStoreRecord>();
  }
  return globalThis.__optaCliHandoffStore;
}

function handoffKey(state: string, port: number): string {
  return `${state.toLowerCase()}::${port}`;
}

function nowMs(): number {
  return Date.now();
}

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer | null {
  try {
    const normalized = input
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(input.length / 4) * 4, '=');
    return Buffer.from(normalized, 'base64');
  } catch {
    return null;
  }
}

function generateHandoffNonce(): string {
  return randomBytes(12).toString('base64url');
}

function isValidHandoffNonce(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  return CLI_HANDOFF_NONCE_PATTERN.test(raw);
}

function resolveHandoffSigningSecret(): string | null {
  const candidates = [
    process.env['OPTA_CLI_HANDOFF_SECRET'],
    process.env['OPTA_ACCOUNTS_CLI_HANDOFF_SECRET'],
    process.env['SUPABASE_SERVICE_ROLE_KEY'],
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed && trimmed.length >= 16) return trimmed;
  }
  return null;
}

function signHandoffProofPayload(payloadEncoded: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadEncoded).digest('base64url');
}

function buildHandoffProof(record: CliHandoffRecord, secret: string): string {
  const payloadEncoded = toBase64Url(JSON.stringify(record));
  const signature = signHandoffProofPayload(payloadEncoded, secret);
  return `${payloadEncoded}.${signature}`;
}

function parseHandoffProof(proof: string, secret: string): CliHandoffRecord | null {
  const parts = proof.split('.');
  if (parts.length !== 2) return null;
  const [payloadEncoded, signature] = parts;
  if (!payloadEncoded || !signature) return null;

  const expected = signHandoffProofPayload(payloadEncoded, secret);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(signature, 'utf8');
  if (
    expectedBuf.length !== providedBuf.length ||
    !timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return null;
  }

  const payloadBuf = fromBase64Url(payloadEncoded);
  if (!payloadBuf) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBuf.toString('utf8'));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Partial<CliHandoffRecord>;
  if (!isValidCliState(record.state)) return null;
  if (parseCliCallbackPort(String(record.port ?? '')) !== record.port) return null;
  if (record.handoff && !isValidCliHandoff(record.handoff)) return null;
  if (!isValidHandoffNonce(record.nonce)) return null;
  if (
    typeof record.createdAt !== 'number' ||
    !Number.isFinite(record.createdAt) ||
    typeof record.expiresAt !== 'number' ||
    !Number.isFinite(record.expiresAt)
  ) {
    return null;
  }
  if (record.expiresAt <= nowMs()) return null;

  return {
    state: record.state,
    port: record.port,
    handoff: record.handoff ?? null,
    returnTo: record.returnTo ?? null,
    nonce: record.nonce,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}

function resolveRecordFromProof(input: {
  state: string;
  port: number;
  handoff?: string | null;
  proof?: string | null;
}): CliHandoffRecord | null {
  const proof = input.proof?.trim() ?? '';
  if (!proof || proof.length > CLI_HANDOFF_PROOF_MAX_LENGTH) return null;
  const secret = resolveHandoffSigningSecret();
  if (!secret) return null;
  const record = parseHandoffProof(proof, secret);
  if (!record) return null;
  if (record.state !== input.state || record.port !== input.port) return null;
  const expectedHandoff = record.handoff ?? null;
  const providedHandoff = input.handoff ?? null;
  if (expectedHandoff !== providedHandoff) return null;
  return record;
}

function clonePublicRecord(record: CliHandoffStoreRecord): CliHandoffRecord {
  return {
    state: record.state,
    port: record.port,
    handoff: record.handoff,
    returnTo: record.returnTo,
    nonce: record.nonce,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}

function sweepExpiredEntries(current: number): void {
  const store = handoffStore();
  for (const [key, record] of store.entries()) {
    if (record.expiresAt <= current || record.consumed) {
      store.delete(key);
    }
  }

  if (store.size <= CLI_HANDOFF_MAX_ENTRIES) return;
  const ordered = Array.from(store.entries()).sort((a, b) => a[1].createdAt - b[1].createdAt);
  const deleteCount = store.size - CLI_HANDOFF_MAX_ENTRIES;
  for (let index = 0; index < deleteCount; index += 1) {
    const entry = ordered[index];
    if (!entry) continue;
    store.delete(entry[0]);
  }
}

export function parseCliCallbackPort(raw: string | null | undefined): number | null {
  if (!raw) return null;
  if (!/^\d{2,5}$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1024 || parsed > 65535) return null;
  return parsed;
}

export function isValidCliState(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  return CLI_STATE_PATTERN.test(raw);
}

export function isValidCliHandoff(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  return CLI_HANDOFF_PATTERN.test(raw);
}

export function registerCliHandoff(input: {
  state: string;
  port: number;
  handoff?: string | null;
  returnTo?: string | null;
}): CliHandoffRegistration {
  const current = nowMs();
  sweepExpiredEntries(current);

  const record: CliHandoffStoreRecord = {
    state: input.state,
    port: input.port,
    handoff: input.handoff ?? null,
    returnTo: input.returnTo ?? null,
    nonce: generateHandoffNonce(),
    createdAt: current,
    expiresAt: current + CLI_HANDOFF_TTL_MS,
    consumed: false,
  };
  handoffStore().set(handoffKey(record.state, record.port), record);
  const publicRecord = clonePublicRecord(record);
  const secret = resolveHandoffSigningSecret();
  const proof = secret ? buildHandoffProof(publicRecord, secret) : null;
  return {
    ...publicRecord,
    proof,
    strategy: proof ? 'signed' : 'memory',
  };
}

export function peekCliHandoff(input: {
  state: string;
  port: number;
  handoff?: string | null;
  proof?: string | null;
}): CliHandoffRecord | null {
  const signed = resolveRecordFromProof(input);
  if (signed) return signed;

  const current = nowMs();
  sweepExpiredEntries(current);

  const record = handoffStore().get(handoffKey(input.state, input.port));
  if (!record) return null;
  if (record.consumed) return null;
  if (record.expiresAt <= current) return null;

  const expectedHandoff = record.handoff;
  const providedHandoff = input.handoff ?? null;
  if (expectedHandoff && expectedHandoff !== providedHandoff) {
    return null;
  }
  if (!expectedHandoff && providedHandoff) {
    return null;
  }

  return clonePublicRecord(record);
}

export async function consumeCliHandoff(input: {
  state: string;
  port: number;
  handoff?: string | null;
  proof?: string | null;
}): Promise<CliHandoffRecord | null> {
  const signed = resolveRecordFromProof(input);
  if (signed) {
    if (
      !(await markCliReplayNonceConsumed({
        kind: 'handoff',
        nonce: signed.nonce,
        expiresAtMs: signed.expiresAt,
      }))
    ) {
      return null;
    }
    handoffStore().delete(handoffKey(input.state, input.port));
    return signed;
  }

  const key = handoffKey(input.state, input.port);
  const record = peekCliHandoff(input);
  if (!record) return null;
  const storeRecord = handoffStore().get(key);
  if (!storeRecord) return null;
  if (
    !(await markCliReplayNonceConsumed({
      kind: 'handoff',
      nonce: storeRecord.nonce,
      expiresAtMs: storeRecord.expiresAt,
    }))
  ) {
    return null;
  }
  storeRecord.consumed = true;
  handoffStore().delete(key);
  return record;
}
