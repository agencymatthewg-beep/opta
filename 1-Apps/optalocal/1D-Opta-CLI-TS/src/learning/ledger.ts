import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  LearningLedgerEntrySchema,
  type CaptureLevel,
  type LearningEntryKind,
  type LearningLedgerEntry,
} from './types.js';
import { sleep } from '../utils/common.js';

const LEDGER_RELATIVE_PATH = join('.opta', 'learning', 'ledger.jsonl');

export interface LedgerStoreOptions {
  cwd?: string;
  lockTimeoutMs?: number;
  lockRetryMs?: number;
}

export interface LedgerReadOptions {
  cwd?: string;
}

export interface LedgerQuery {
  kinds?: LearningEntryKind[];
  captureLevels?: CaptureLevel[];
  tags?: string[];
  text?: string;
  from?: string | Date;
  to?: string | Date;
  limit?: number;
}

export function learningLedgerPath(cwd = process.cwd()): string {
  return join(cwd, LEDGER_RELATIVE_PATH);
}

function learningLedgerDir(cwd = process.cwd()): string {
  return dirname(learningLedgerPath(cwd));
}

function learningLedgerLockPath(cwd = process.cwd()): string {
  return `${learningLedgerPath(cwd)}.lock`;
}

async function acquireLock(lockPath: string, timeoutMs: number, retryMs: number) {
  const start = Date.now();
  while (true) {
    try {
      return await open(lockPath, 'wx');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'EEXIST') {
        throw err;
      }
      if (Date.now() - start >= timeoutMs) {
        throw new Error(`Timed out waiting for ledger lock: ${lockPath}`);
      }
      await sleep(retryMs);
    }
  }
}

function parseDate(value?: string | Date): number | undefined {
  if (value === undefined) return undefined;
  const millis = new Date(value).getTime();
  return Number.isNaN(millis) ? undefined : millis;
}

function matchesFreeText(entry: LearningLedgerEntry, rawText: string): boolean {
  const text = rawText.trim().toLowerCase();
  if (!text) return true;

  const haystack = [
    entry.id,
    entry.kind,
    entry.captureLevel,
    entry.topic,
    entry.content,
    entry.tags.join(' '),
    entry.evidence.map((item) => `${item.label} ${item.uri}`).join(' '),
  ]
    .join(' ')
    .toLowerCase();

  return text
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

async function readLedgerFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return '';
    }
    throw err;
  }
}

export async function appendLedgerEntry(
  entry: LearningLedgerEntry,
  options: LedgerStoreOptions = {},
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const lockTimeoutMs = options.lockTimeoutMs ?? 5000;
  const lockRetryMs = options.lockRetryMs ?? 20;
  const ledgerPath = learningLedgerPath(cwd);
  const ledgerDir = learningLedgerDir(cwd);
  const lockPath = learningLedgerLockPath(cwd);
  const parsed = LearningLedgerEntrySchema.parse(entry);

  await mkdir(ledgerDir, { recursive: true });
  const lockHandle = await acquireLock(lockPath, lockTimeoutMs, lockRetryMs);
  let tempPath = '';

  try {
    const current = await readLedgerFile(ledgerPath);
    tempPath = `${ledgerPath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${current}${JSON.stringify(parsed)}\n`, 'utf-8');
    await rename(tempPath, ledgerPath);
  } finally {
    if (tempPath) {
      await unlink(tempPath).catch(() => {});
    }
    await lockHandle.close().catch(() => {});
    await unlink(lockPath).catch(() => {});
  }
}

export async function readLedgerEntries(
  options: LedgerReadOptions = {},
): Promise<LearningLedgerEntry[]> {
  const cwd = options.cwd ?? process.cwd();
  const raw = await readLedgerFile(learningLedgerPath(cwd));
  if (!raw.trim()) return [];

  const lines = raw.split('\n').filter((line) => line.trim().length > 0);
  const parsed: LearningLedgerEntry[] = [];

  for (const [index, line] of lines.entries()) {
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      throw new Error(`Invalid ledger entry at line ${index + 1}: malformed JSON`);
    }

    const result = LearningLedgerEntrySchema.safeParse(json);
    if (!result.success) {
      const issue = result.error.issues[0]?.message ?? 'schema mismatch';
      throw new Error(`Invalid ledger entry at line ${index + 1}: ${issue}`);
    }
    parsed.push(result.data);
  }

  return parsed;
}

export async function queryLedgerEntries(
  query: LedgerQuery = {},
  options: LedgerReadOptions = {},
): Promise<LearningLedgerEntry[]> {
  const entries = await readLedgerEntries(options);
  const fromMs = parseDate(query.from);
  const toMs = parseDate(query.to);
  const tags = query.tags ?? [];
  const kinds = query.kinds ?? [];
  const captureLevels = query.captureLevels ?? [];

  let filtered = entries.filter((entry) => {
    if (kinds.length > 0 && !kinds.includes(entry.kind)) {
      return false;
    }
    if (captureLevels.length > 0 && !captureLevels.includes(entry.captureLevel)) {
      return false;
    }
    if (tags.length > 0 && !tags.every((tag) => entry.tags.includes(tag))) {
      return false;
    }

    const ts = new Date(entry.ts).getTime();
    if (fromMs !== undefined && ts < fromMs) {
      return false;
    }
    if (toMs !== undefined && ts > toMs) {
      return false;
    }

    if (query.text && !matchesFreeText(entry, query.text)) {
      return false;
    }

    return true;
  });

  filtered = filtered.sort((a, b) => b.ts.localeCompare(a.ts));
  if (query.limit !== undefined && query.limit > 0) {
    filtered = filtered.slice(0, query.limit);
  }

  return filtered;
}
