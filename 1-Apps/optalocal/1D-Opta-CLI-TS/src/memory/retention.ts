import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { getSessionsDir } from '../platform/paths.js';
import {
  deleteSession,
  listSessions,
  tagSession,
  type SessionSummary,
  untagSession,
} from './store.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_POLICY_FILE = 'retention-policy.json';

export const PIN_TAG = 'pinned';

export interface SessionRetentionPolicy {
  days: number;
  preservePinned: boolean;
}

export const DEFAULT_SESSION_RETENTION_POLICY: Readonly<SessionRetentionPolicy> = Object.freeze({
  days: 30,
  preservePinned: true,
});

export interface SessionPinResult {
  id: string;
  pinned: boolean;
  alreadyPinned: boolean;
  tags: string[];
}

export interface SessionPrunePlan {
  policy: SessionRetentionPolicy;
  scanned: number;
  cutoff: string;
  preservedPinned: number;
  candidates: SessionSummary[];
  kept: SessionSummary[];
}

export interface SessionPruneApplyResult extends SessionPrunePlan {
  pruned: SessionSummary[];
}

interface SessionPruneOptions {
  now?: () => Date;
}

const SessionRetentionPolicySchema = z
  .object({
    days: z.number().int().min(1),
    preservePinned: z.boolean(),
  })
  .strict();

function retentionPolicyPath(): string {
  return join(getSessionsDir(), RETENTION_POLICY_FILE);
}

function compareByCreatedAsc(left: SessionSummary, right: SessionSummary): number {
  const leftMs = Date.parse(left.created);
  const rightMs = Date.parse(right.created);
  const leftValid = Number.isFinite(leftMs);
  const rightValid = Number.isFinite(rightMs);

  if (leftValid && rightValid && leftMs !== rightMs) return leftMs - rightMs;
  if (leftValid !== rightValid) return leftValid ? -1 : 1;
  return left.id.localeCompare(right.id);
}

function normalizePolicy(
  input: Partial<SessionRetentionPolicy> | undefined
): SessionRetentionPolicy {
  return SessionRetentionPolicySchema.parse({
    days: input?.days ?? DEFAULT_SESSION_RETENTION_POLICY.days,
    preservePinned: input?.preservePinned ?? DEFAULT_SESSION_RETENTION_POLICY.preservePinned,
  });
}

async function getSessionSummaryOrThrow(id: string): Promise<SessionSummary> {
  const sessions = await listSessions();
  const summary = sessions.find((session) => session.id === id);
  if (!summary) {
    throw new Error(`Session not found: ${id}`);
  }
  return summary;
}

export async function getRetentionPolicy(): Promise<SessionRetentionPolicy> {
  try {
    const raw = await readFile(retentionPolicyPath(), 'utf-8');
    const parsed = SessionRetentionPolicySchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // Fall back to defaults when file is missing or malformed.
  }
  return { ...DEFAULT_SESSION_RETENTION_POLICY };
}

export async function setRetentionPolicy(
  policy: Partial<SessionRetentionPolicy> & Pick<SessionRetentionPolicy, 'days'>
): Promise<SessionRetentionPolicy> {
  const current = await getRetentionPolicy();
  const next = normalizePolicy({
    days: policy.days,
    preservePinned: policy.preservePinned ?? current.preservePinned,
  });
  await mkdir(getSessionsDir(), { recursive: true });
  await writeFile(retentionPolicyPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export async function listPinnedSessions(): Promise<SessionSummary[]> {
  const sessions = await listSessions();
  return sessions.filter((session) => session.tags.includes(PIN_TAG));
}

export async function pinSession(id: string): Promise<SessionPinResult> {
  const session = await getSessionSummaryOrThrow(id);
  const alreadyPinned = session.tags.includes(PIN_TAG);
  if (!alreadyPinned) {
    await tagSession(id, [PIN_TAG]);
  }
  const nextTags = alreadyPinned ? session.tags : [...new Set([...session.tags, PIN_TAG])];
  return {
    id,
    pinned: true,
    alreadyPinned,
    tags: nextTags,
  };
}

export async function unpinSession(id: string): Promise<SessionPinResult> {
  const session = await getSessionSummaryOrThrow(id);
  const alreadyPinned = session.tags.includes(PIN_TAG);
  if (alreadyPinned) {
    await untagSession(id, [PIN_TAG]);
  }
  const nextTags = session.tags.filter((tag) => tag !== PIN_TAG);
  return {
    id,
    pinned: false,
    alreadyPinned,
    tags: nextTags,
  };
}

export async function planSessionPrune(options?: SessionPruneOptions): Promise<SessionPrunePlan> {
  const policy = await getRetentionPolicy();
  const now = options?.now ?? (() => new Date());
  const cutoffMs = now().getTime() - policy.days * DAY_MS;
  const sessions = [...(await listSessions())].sort(compareByCreatedAsc);

  const candidates: SessionSummary[] = [];
  const kept: SessionSummary[] = [];
  let preservedPinned = 0;

  for (const session of sessions) {
    const isPinned = session.tags.includes(PIN_TAG);
    if (policy.preservePinned && isPinned) {
      preservedPinned += 1;
      kept.push(session);
      continue;
    }

    const createdMs = Date.parse(session.created);
    if (!Number.isFinite(createdMs)) {
      kept.push(session);
      continue;
    }

    if (createdMs < cutoffMs) {
      candidates.push(session);
      continue;
    }

    kept.push(session);
  }

  return {
    policy,
    scanned: sessions.length,
    cutoff: new Date(cutoffMs).toISOString(),
    preservedPinned,
    candidates,
    kept,
  };
}

export async function applySessionPrune(options?: SessionPruneOptions): Promise<SessionPruneApplyResult> {
  const plan = await planSessionPrune(options);
  for (const session of plan.candidates) {
    await deleteSession(session.id);
  }
  return {
    ...plan,
    pruned: plan.candidates,
  };
}
