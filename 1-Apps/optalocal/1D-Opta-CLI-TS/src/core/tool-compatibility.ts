import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const TOOL_COMPATIBILITY_RELATIVE_PATH = join('.opta', 'browser', 'tool-compatibility.json');

export type ToolProtocolStatus = 'success' | 'pseudo_failure';

export interface ToolCompatibilityEntry {
  model: string;
  provider: string;
  firstSeenAt: string;
  lastSeenAt: string;
  successCount: number;
  pseudoFailureCount: number;
  lastStatus: ToolProtocolStatus;
  lastPseudoTags: string[];
}

interface ToolCompatibilityStore {
  schemaVersion: 1;
  updatedAt: string;
  entries: Record<string, ToolCompatibilityEntry>;
}

export interface ToolCompatibilityEventInput {
  model: string;
  provider: string;
  status: ToolProtocolStatus;
  pseudoTags?: string[];
  timestamp?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeIdPart(value: string): string {
  return value.trim().toLowerCase();
}

function compatibilityKey(model: string, provider: string): string {
  return `${normalizeIdPart(provider)}::${normalizeIdPart(model)}`;
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags || tags.length === 0) return [];
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
}

export function toolCompatibilityPath(cwd = process.cwd()): string {
  return join(cwd, TOOL_COMPATIBILITY_RELATIVE_PATH);
}

async function readStore(cwd = process.cwd()): Promise<ToolCompatibilityStore> {
  const path = toolCompatibilityPath(cwd);
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ToolCompatibilityStore> | null;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid compatibility telemetry payload');
    }
    const entriesInput = parsed.entries;
    const entries: Record<string, ToolCompatibilityEntry> = {};
    if (entriesInput && typeof entriesInput === 'object' && !Array.isArray(entriesInput)) {
      for (const [key, value] of Object.entries(entriesInput as Record<string, unknown>)) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        const entry = value as Partial<ToolCompatibilityEntry>;
        if (!entry.model || !entry.provider || !entry.firstSeenAt || !entry.lastSeenAt) continue;
        if (entry.lastStatus !== 'success' && entry.lastStatus !== 'pseudo_failure') continue;
        entries[key] = {
          model: entry.model,
          provider: entry.provider,
          firstSeenAt: entry.firstSeenAt,
          lastSeenAt: entry.lastSeenAt,
          successCount: Math.max(0, Math.floor(entry.successCount ?? 0)),
          pseudoFailureCount: Math.max(0, Math.floor(entry.pseudoFailureCount ?? 0)),
          lastStatus: entry.lastStatus,
          lastPseudoTags: normalizeTags(entry.lastPseudoTags),
        };
      }
    }
    return {
      schemaVersion: 1,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso(),
      entries,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return {
        schemaVersion: 1,
        updatedAt: nowIso(),
        entries: {},
      };
    }
    // Corrupt telemetry is reset deterministically.
    return {
      schemaVersion: 1,
      updatedAt: nowIso(),
      entries: {},
    };
  }
}

async function writeStore(store: ToolCompatibilityStore, cwd = process.cwd()): Promise<void> {
  const path = toolCompatibilityPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, 'utf-8');
}

export async function readToolCompatibilityEntry(
  cwd: string,
  input: { model: string; provider: string }
): Promise<ToolCompatibilityEntry | null> {
  const key = compatibilityKey(input.model, input.provider);
  const store = await readStore(cwd);
  return store.entries[key] ?? null;
}

export async function recordToolCompatibilityEvent(
  cwd: string,
  event: ToolCompatibilityEventInput
): Promise<ToolCompatibilityEntry> {
  const timestamp = event.timestamp ?? nowIso();
  const store = await readStore(cwd);
  const key = compatibilityKey(event.model, event.provider);
  const existing = store.entries[key];
  const next: ToolCompatibilityEntry = existing
    ? { ...existing }
    : {
        model: event.model,
        provider: event.provider,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
        successCount: 0,
        pseudoFailureCount: 0,
        lastStatus: event.status,
        lastPseudoTags: [],
      };

  next.lastSeenAt = timestamp;
  next.lastStatus = event.status;
  if (event.status === 'success') {
    next.successCount += 1;
    next.lastPseudoTags = [];
  } else {
    next.pseudoFailureCount += 1;
    next.lastPseudoTags = normalizeTags(event.pseudoTags);
  }

  store.entries[key] = next;
  store.updatedAt = timestamp;
  await writeStore(store, cwd);
  return next;
}

export function buildToolCompatibilityInstruction(entry: ToolCompatibilityEntry | null): string {
  if (!entry || entry.pseudoFailureCount <= 0) return '';

  const total = entry.successCount + entry.pseudoFailureCount;
  const failureRate = total > 0 ? entry.pseudoFailureCount / total : 1;
  const tags =
    entry.lastPseudoTags.length > 0
      ? `Last pseudo tags: ${entry.lastPseudoTags.join(', ')}.`
      : 'Last pseudo tags: unknown.';

  const severity =
    entry.successCount === 0 || failureRate >= 0.5
      ? 'high'
      : failureRate >= 0.25
        ? 'medium'
        : 'low';

  return [
    '### Tool-Call Compatibility',
    `Model telemetry (${entry.provider}/${entry.model}) indicates ${severity} protocol risk: ${entry.pseudoFailureCount}/${total} prior turns returned pseudo tool markup.`,
    tags,
    'Emit native JSON tool calls only (no XML/plain-text pseudo directives).',
  ].join('\n');
}
