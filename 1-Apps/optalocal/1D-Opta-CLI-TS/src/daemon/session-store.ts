import { mkdir, readFile, writeFile, appendFile, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
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
  return join(homedir(), '.config', 'opta', 'daemon');
}

function sessionsDir(): string {
  return join(daemonRootDir(), 'sessions');
}

function sessionDir(sessionId: string): string {
  return join(sessionsDir(), sessionId);
}

function snapshotPath(sessionId: string): string {
  return join(sessionDir(sessionId), 'snapshot.json');
}

function eventLogPath(sessionId: string): string {
  return join(sessionDir(sessionId), 'events.jsonl');
}

export async function ensureDaemonStore(): Promise<void> {
  await mkdir(sessionsDir(), { recursive: true });
}

export async function ensureSessionStore(sessionId: string): Promise<void> {
  await ensureDaemonStore();
  await mkdir(sessionDir(sessionId), { recursive: true });
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
