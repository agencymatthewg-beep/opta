import { mkdir, readFile, writeFile, appendFile, stat, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { getDaemonDir } from '../platform/paths.js';
import type { AgentMessage } from '../core/agent.js';
import type { V3Envelope } from '../protocol/v3/types.js';

export interface StoredSessionSnapshot {
  sessionId: string;
  model: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messages: AgentMessage[];
  toolCallCount: number;
  seq: number;
}

function daemonRootDir(): string {
  return getDaemonDir();
}

function sessionsDir(): string {
  return join(daemonRootDir(), 'sessions');
}

// Allowlist: alphanumeric, hyphen, underscore only; max 64 chars.
// This prevents path traversal attacks via user-controlled sessionId values.
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function assertSafeSessionId(sessionId: string): void {
  if (!SESSION_ID_RE.test(sessionId)) {
    throw new Error(`Invalid sessionId: "${sessionId}"`);
  }
  // Secondary guard: resolved path must remain within sessionsDir.
  const base = sessionsDir();
  const resolved = resolve(base, sessionId);
  if (!resolved.startsWith(base + '/') && resolved !== base) {
    throw new Error(`Session path escapes sessions directory: "${sessionId}"`);
  }
}

function sessionDir(sessionId: string): string {
  assertSafeSessionId(sessionId);
  return join(sessionsDir(), sessionId);
}

function snapshotPath(sessionId: string): string {
  return join(sessionDir(sessionId), 'snapshot.json');
}

function eventLogPath(sessionId: string): string {
  return join(sessionDir(sessionId), 'events.jsonl');
}

// In-flight mkdir Promises keyed by sessionId.
// Replaces the plain Set so concurrent callers with the same sessionId await
// the same mkdir rather than each racing past the guard and independently
// issuing mkdir (which is idempotent but would hide failures: if the first
// mkdir threw, the Set would not be populated, yet a concurrent second caller
// might have already written to the Set and silently skipped the mkdir on all
// future calls — leaving the directory absent).
const pendingSessionDirCreations = new Map<string, Promise<void>>();

export async function ensureDaemonStore(): Promise<void> {
  await mkdir(sessionsDir(), { recursive: true });
}

export async function ensureSessionStore(sessionId: string): Promise<void> {
  assertSafeSessionId(sessionId);

  const existing = pendingSessionDirCreations.get(sessionId);
  if (existing) {
    await existing;
    return;
  }

  const creation = (async () => {
    await ensureDaemonStore();
    await mkdir(sessionDir(sessionId), { recursive: true });
  })();

  pendingSessionDirCreations.set(sessionId, creation);
  try {
    await creation;
  } finally {
    // Only remove from map if the stored Promise is still ours, preventing
    // a race where a new caller overwrote the map entry while we were awaiting.
    if (pendingSessionDirCreations.get(sessionId) === creation) {
      pendingSessionDirCreations.delete(sessionId);
    }
  }
}

/** Clear the session-dir creation cache. Intended for use in tests that wipe
 *  session directories between runs within the same process. */
export function clearSessionDirCache(): void {
  pendingSessionDirCreations.clear();
}

export async function writeSessionSnapshot(snapshot: StoredSessionSnapshot): Promise<void> {
  await ensureSessionStore(snapshot.sessionId);
  await writeFile(snapshotPath(snapshot.sessionId), JSON.stringify(snapshot, null, 2), 'utf-8');
}

export async function readSessionSnapshot(sessionId: string): Promise<StoredSessionSnapshot | null> {
  try {
    const raw = await readFile(snapshotPath(sessionId), 'utf-8');
    return JSON.parse(raw) as StoredSessionSnapshot;
  } catch {
    return null;
  }
}

export async function appendSessionEvent(sessionId: string, event: V3Envelope): Promise<void> {
  await ensureSessionStore(sessionId);
  await appendFile(eventLogPath(sessionId), JSON.stringify(event) + '\n', 'utf-8');
}

export async function readSessionEventsAfter(sessionId: string, afterSeq: number): Promise<V3Envelope[]> {
  try {
    const raw = await readFile(eventLogPath(sessionId), 'utf-8');
    const lines = raw.split('\n').filter(Boolean);
    const events = lines
      .map((line) => {
        try {
          return JSON.parse(line) as V3Envelope;
        } catch {
          return null;
        }
      })
      .filter((e): e is V3Envelope => e !== null);
    return events.filter(e => e.seq > afterSeq).sort((a, b) => a.seq - b.seq);
  } catch {
    return [];
  }
}

export async function hasSessionStore(sessionId: string): Promise<boolean> {
  try {
    await stat(sessionDir(sessionId));
    return true;
  } catch {
    return false;
  }
}

export async function listStoredSessions(): Promise<string[]> {
  await ensureDaemonStore();
  const entries = await readdir(sessionsDir(), { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => e.name);
}
