import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { markCliReplayNonceConsumed } from './replay-store.ts';

const CLI_TOKEN_RELAY_TTL_MS = 2 * 60 * 1000;
const CLI_TOKEN_RELAY_MAX_ENTRIES = 2048;
const CLI_TOKEN_RELAY_CODE_MAX_LENGTH = 8192;
const CLI_TOKEN_RELAY_CODE_PATTERN = /^[A-Za-z0-9._-]{24,8192}$/;
const CLI_TOKEN_RELAY_VERSION = 'v1';
const CLI_STATE_PATTERN = /^[a-zA-Z0-9_-]{16,256}$/;
const CLI_HANDOFF_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
const CLI_RELAY_NONCE_PATTERN = /^[A-Za-z0-9_-]{8,256}$/;

export interface CliTokenRelayExchange {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  expiresIn: number | null;
  tokenType: string | null;
  providerToken: string | null;
  providerRefreshToken: string | null;
  returnTo: string | null;
}

interface CliTokenRelayRecord extends CliTokenRelayExchange {
  code: string;
  state: string;
  port: number;
  handoff: string | null;
  nonce: string;
  createdAt: number;
  expiresAtMs: number;
  consumed: boolean;
}

export interface CliTokenRelayRegistration {
  code: string;
  expiresAt: number;
  strategy: 'signed' | 'memory';
}

interface CliTokenRelaySignedPayload extends CliTokenRelayExchange {
  state: string;
  port: number;
  handoff: string | null;
  nonce: string;
  createdAt: number;
  expiresAtMs: number;
}

declare global {
  var __optaCliTokenRelayStore: Map<string, CliTokenRelayRecord> | undefined;
}

function relayStore(): Map<string, CliTokenRelayRecord> {
  if (!globalThis.__optaCliTokenRelayStore) {
    globalThis.__optaCliTokenRelayStore = new Map<string, CliTokenRelayRecord>();
  }
  return globalThis.__optaCliTokenRelayStore;
}

function nowMs(): number {
  return Date.now();
}

function isTruthyEnvFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function resolveRelaySigningSecret(): string | null {
  const candidates = [
    process.env['OPTA_CLI_TOKEN_RELAY_SECRET'],
    process.env['OPTA_ACCOUNTS_CLI_TOKEN_RELAY_SECRET'],
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

function shouldAllowStatelessRelay(secret: string | null): boolean {
  if (!secret) return false;
  const disabled = isTruthyEnvFlag(
    process.env['OPTA_CLI_TOKEN_RELAY_DISABLE_STATELESS'] ??
      process.env['OPTA_ACCOUNTS_CLI_TOKEN_RELAY_DISABLE_STATELESS'],
  );
  return !disabled;
}

function isValidState(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  return CLI_STATE_PATTERN.test(raw);
}

function isValidHandoff(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  return CLI_HANDOFF_PATTERN.test(raw);
}

function isValidNonce(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  return CLI_RELAY_NONCE_PATTERN.test(raw);
}

function isValidPort(raw: number): boolean {
  return Number.isInteger(raw) && raw >= 1024 && raw <= 65535;
}

function toBase64Url(input: Buffer): string {
  return input
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

function deriveRelayKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function buildSignedRelayCode(record: CliTokenRelayRecord, secret: string): string {
  const payload: CliTokenRelaySignedPayload = {
    state: record.state,
    port: record.port,
    handoff: record.handoff,
    returnTo: record.returnTo,
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
    expiresAt: record.expiresAt,
    expiresIn: record.expiresIn,
    tokenType: record.tokenType,
    providerToken: record.providerToken,
    providerRefreshToken: record.providerRefreshToken,
    nonce: record.nonce,
    createdAt: record.createdAt,
    expiresAtMs: record.expiresAtMs,
  };
  const payloadJson = JSON.stringify(payload);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveRelayKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(payloadJson, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${CLI_TOKEN_RELAY_VERSION}.${toBase64Url(iv)}.${toBase64Url(ciphertext)}.${toBase64Url(tag)}`;
}

function parseSignedRelayCode(code: string, secret: string): CliTokenRelayRecord | null {
  if (code.length > CLI_TOKEN_RELAY_CODE_MAX_LENGTH) return null;
  const parts = code.split('.');
  if (parts.length !== 4 || parts[0] !== CLI_TOKEN_RELAY_VERSION) return null;
  const iv = fromBase64Url(parts[1] ?? '');
  const ciphertext = fromBase64Url(parts[2] ?? '');
  const tag = fromBase64Url(parts[3] ?? '');
  if (!iv || !ciphertext || !tag) return null;
  if (iv.length !== 12 || tag.length !== 16) return null;

  let decrypted: Buffer;
  try {
    const decipher = createDecipheriv('aes-256-gcm', deriveRelayKey(secret), iv);
    decipher.setAuthTag(tag);
    decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decrypted.toString('utf8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const payload = parsed as Partial<CliTokenRelaySignedPayload>;
  if (!isValidState(payload.state)) return null;
  if (typeof payload.port !== 'number' || !isValidPort(payload.port)) return null;
  if (payload.handoff && !isValidHandoff(payload.handoff)) return null;
  if (!isValidNonce(payload.nonce)) return null;
  if (typeof payload.accessToken !== 'string' || payload.accessToken.trim().length === 0) return null;
  if (typeof payload.refreshToken !== 'string' || payload.refreshToken.trim().length === 0) return null;
  if (payload.expiresIn !== null && payload.expiresIn !== undefined) {
    if (typeof payload.expiresIn !== 'number' || !Number.isFinite(payload.expiresIn)) return null;
  }
  if (payload.tokenType !== null && payload.tokenType !== undefined && typeof payload.tokenType !== 'string') {
    return null;
  }
  if (
    payload.providerToken !== null &&
    payload.providerToken !== undefined &&
    typeof payload.providerToken !== 'string'
  ) {
    return null;
  }
  if (
    payload.providerRefreshToken !== null &&
    payload.providerRefreshToken !== undefined &&
    typeof payload.providerRefreshToken !== 'string'
  ) {
    return null;
  }
  if (payload.returnTo !== null && payload.returnTo !== undefined && typeof payload.returnTo !== 'string') {
    return null;
  }
  if (
    payload.expiresAt !== null &&
    payload.expiresAt !== undefined &&
    (typeof payload.expiresAt !== 'number' || !Number.isFinite(payload.expiresAt))
  ) {
    return null;
  }
  if (typeof payload.createdAt !== 'number' || !Number.isFinite(payload.createdAt)) return null;
  if (typeof payload.expiresAtMs !== 'number' || !Number.isFinite(payload.expiresAtMs)) return null;
  if (payload.expiresAtMs <= nowMs()) return null;

  return {
    code,
    state: payload.state,
    port: payload.port,
    handoff: payload.handoff ?? null,
    returnTo: payload.returnTo ?? null,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresAt: payload.expiresAt ?? null,
    expiresIn: payload.expiresIn ?? null,
    tokenType: payload.tokenType ?? null,
    providerToken: payload.providerToken ?? null,
    providerRefreshToken: payload.providerRefreshToken ?? null,
    nonce: payload.nonce,
    createdAt: payload.createdAt,
    expiresAtMs: payload.expiresAtMs,
    consumed: false,
  };
}

function sweepExpiredEntries(current: number): void {
  const store = relayStore();
  for (const [code, record] of store.entries()) {
    if (record.expiresAtMs <= current || record.consumed) {
      store.delete(code);
    }
  }

  if (store.size <= CLI_TOKEN_RELAY_MAX_ENTRIES) return;
  const ordered = Array.from(store.values()).sort((a, b) => a.createdAt - b.createdAt);
  const deleteCount = store.size - CLI_TOKEN_RELAY_MAX_ENTRIES;
  for (let index = 0; index < deleteCount; index += 1) {
    const record = ordered[index];
    if (!record) continue;
    store.delete(record.code);
  }
}

function generateRelayCode(): string {
  return randomBytes(24).toString('base64url');
}

function generateRelayNonce(): string {
  return randomBytes(12).toString('base64url');
}

export function isValidCliRelayCode(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  if (raw.length > CLI_TOKEN_RELAY_CODE_MAX_LENGTH) return false;
  return CLI_TOKEN_RELAY_CODE_PATTERN.test(raw);
}

export function registerCliTokenRelay(input: {
  state: string;
  port: number;
  handoff?: string | null;
  returnTo?: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt?: number | null;
  expiresIn?: number | null;
  tokenType?: string | null;
  providerToken?: string | null;
  providerRefreshToken?: string | null;
}): CliTokenRelayRegistration {
  const current = nowMs();
  sweepExpiredEntries(current);

  const secret = resolveRelaySigningSecret();
  const useStateless = shouldAllowStatelessRelay(secret);

  const fallbackCode = generateRelayCode();
  const nonce = generateRelayNonce();
  const record: CliTokenRelayRecord = {
    code: fallbackCode,
    state: input.state,
    port: input.port,
    handoff: input.handoff ?? null,
    returnTo: input.returnTo ?? null,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    expiresAt: input.expiresAt ?? null,
    expiresIn: input.expiresIn ?? null,
    tokenType: input.tokenType ?? null,
    providerToken: input.providerToken ?? null,
    providerRefreshToken: input.providerRefreshToken ?? null,
    nonce,
    createdAt: current,
    expiresAtMs: current + CLI_TOKEN_RELAY_TTL_MS,
    consumed: false,
  };

  let strategy: 'signed' | 'memory' = 'memory';
  if (useStateless && secret) {
    const signedCode = buildSignedRelayCode(record, secret);
    if (signedCode.length <= CLI_TOKEN_RELAY_CODE_MAX_LENGTH) {
      record.code = signedCode;
      strategy = 'signed';
    }
  }

  relayStore().set(record.code, record);
  return {
    code: record.code,
    expiresAt: record.expiresAtMs,
    strategy,
  };
}

export async function consumeCliTokenRelay(input: {
  code: string;
  state: string;
  port: number;
  handoff?: string | null;
}): Promise<CliTokenRelayExchange | null> {
  if (!isValidCliRelayCode(input.code)) return null;
  const current = nowMs();
  sweepExpiredEntries(current);

  const record = relayStore().get(input.code);
  if (record) {
    if (record.consumed || record.expiresAtMs <= current) {
      relayStore().delete(input.code);
      return null;
    }
    if (record.state !== input.state || record.port !== input.port) return null;

    const providedHandoff = input.handoff ?? null;
    if (record.handoff !== providedHandoff) return null;
    if (
      !(await markCliReplayNonceConsumed({
        kind: 'relay',
        nonce: record.nonce,
        expiresAtMs: record.expiresAtMs,
      }))
    ) {
      return null;
    }

    record.consumed = true;
    relayStore().delete(input.code);
    return {
      accessToken: record.accessToken,
      refreshToken: record.refreshToken,
      expiresAt: record.expiresAt,
      expiresIn: record.expiresIn,
      tokenType: record.tokenType,
      providerToken: record.providerToken,
      providerRefreshToken: record.providerRefreshToken,
      returnTo: record.returnTo,
    };
  }

  const secret = resolveRelaySigningSecret();
  if (!shouldAllowStatelessRelay(secret) || !secret) return null;
  const signed = parseSignedRelayCode(input.code, secret);
  if (!signed) return null;
  if (signed.state !== input.state || signed.port !== input.port) return null;
  const providedHandoff = input.handoff ?? null;
  if (signed.handoff !== providedHandoff) return null;
  if (
    !(await markCliReplayNonceConsumed({
      kind: 'relay',
      nonce: signed.nonce,
      expiresAtMs: signed.expiresAtMs,
    }))
  ) {
    return null;
  }
  return {
    accessToken: signed.accessToken,
    refreshToken: signed.refreshToken,
    expiresAt: signed.expiresAt,
    expiresIn: signed.expiresIn,
    tokenType: signed.tokenType,
    providerToken: signed.providerToken,
    providerRefreshToken: signed.providerRefreshToken,
    returnTo: signed.returnTo,
  };
}
