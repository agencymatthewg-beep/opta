import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import type { ActionEvent } from './activity.js';
import { MAX_ACTION_HISTORY } from './activity.js';
import { sleep } from '../utils/common.js';

const ActionEventSchema = z.object({
  id: z.string(),
  at: z.number(),
  sessionId: z.string(),
  kind: z.enum(['turn', 'tool', 'thinking', 'slash', 'model', 'permission', 'error', 'info']),
  status: z.enum(['running', 'ok', 'error', 'info']),
  icon: z.string(),
  label: z.string(),
  detail: z.string().optional(),
});

export const DEFAULT_ACTION_HISTORY_PATH = join(homedir(), '.config', 'opta', 'tui-action-history.jsonl');

export interface ActionHistoryStoreOptions {
  filePath?: string;
  maxEntries?: number;
  lockTimeoutMs?: number;
  lockRetryMs?: number;
  staleLockMs?: number;
}

function resolvePath(options: ActionHistoryStoreOptions): string {
  return options.filePath ?? DEFAULT_ACTION_HISTORY_PATH;
}

function resolveMaxEntries(options: ActionHistoryStoreOptions): number {
  const requested = options.maxEntries ?? MAX_ACTION_HISTORY;
  return Math.max(1, requested);
}

function lockPath(filePath: string): string {
  return `${filePath}.lock`;
}

async function acquireLock(path: string, timeoutMs: number, retryMs: number, staleLockMs: number) {
  const started = Date.now();
  while (true) {
    try {
      return await open(path, 'wx');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'EEXIST') throw err;
      try {
        const info = await stat(path);
        if (Date.now() - info.mtimeMs >= staleLockMs) {
          await unlink(path).catch(() => {});
          continue;
        }
      } catch (statError) {
        const statErr = statError as NodeJS.ErrnoException;
        if (statErr.code !== 'ENOENT') {
          // Keep retrying through transient stat/unlink issues.
        }
      }
      if (Date.now() - started >= timeoutMs) {
        throw new Error(`Timed out waiting for action history lock: ${path}`);
      }
      await sleep(retryMs);
    }
  }
}

async function readHistoryFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return '';
    throw err;
  }
}

function parseHistory(raw: string, maxEntries: number): ActionEvent[] {
  if (!raw.trim()) return [];
  const parsed: ActionEvent[] = [];
  const lines = raw.split('\n').filter((line) => line.trim().length > 0);
  for (const line of lines) {
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      continue;
    }
    const result = ActionEventSchema.safeParse(json);
    if (!result.success) continue;
    parsed.push(result.data);
  }
  parsed.sort((a, b) => b.at - a.at);
  return parsed.slice(0, maxEntries);
}

function serializeHistory(entries: ActionEvent[]): string {
  if (entries.length === 0) return '';
  return `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`;
}

async function writeHistoryAtomically(filePath: string, entries: ActionEvent[]): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, serializeHistory(entries), 'utf-8');
  await rename(tempPath, filePath);
  await unlink(tempPath).catch(() => {});
}

export async function loadActionHistory(options: ActionHistoryStoreOptions = {}): Promise<ActionEvent[]> {
  const filePath = resolvePath(options);
  const maxEntries = resolveMaxEntries(options);
  const raw = await readHistoryFile(filePath);
  return parseHistory(raw, maxEntries);
}

export async function appendActionHistory(
  entry: ActionEvent,
  options: ActionHistoryStoreOptions = {},
): Promise<void> {
  const filePath = resolvePath(options);
  const maxEntries = resolveMaxEntries(options);
  const lockTimeoutMs = options.lockTimeoutMs ?? 5000;
  const lockRetryMs = options.lockRetryMs ?? 20;
  const staleLockMs = options.staleLockMs ?? 15_000;
  const parsed = ActionEventSchema.parse(entry);

  await mkdir(dirname(filePath), { recursive: true });
  const lockHandle = await acquireLock(lockPath(filePath), lockTimeoutMs, lockRetryMs, staleLockMs);
  try {
    const raw = await readHistoryFile(filePath);
    const existing = parseHistory(raw, maxEntries);
    const next = [parsed, ...existing.filter((item) => item.id !== parsed.id)].slice(0, maxEntries);
    await writeHistoryAtomically(filePath, next);
  } finally {
    await lockHandle.close().catch(() => {});
    await unlink(lockPath(filePath)).catch(() => {});
  }
}

export async function clearActionHistory(options: ActionHistoryStoreOptions = {}): Promise<void> {
  const filePath = resolvePath(options);
  const lockTimeoutMs = options.lockTimeoutMs ?? 5000;
  const lockRetryMs = options.lockRetryMs ?? 20;
  const staleLockMs = options.staleLockMs ?? 15_000;

  await mkdir(dirname(filePath), { recursive: true });
  const lockHandle = await acquireLock(lockPath(filePath), lockTimeoutMs, lockRetryMs, staleLockMs);
  try {
    await writeHistoryAtomically(filePath, []);
  } finally {
    await lockHandle.close().catch(() => {});
    await unlink(lockPath(filePath)).catch(() => {});
  }
}
