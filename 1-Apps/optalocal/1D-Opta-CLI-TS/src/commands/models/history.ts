/**
 * Model history CRUD — read, write, normalize, merge, display.
 */

import chalk from 'chalk';
import { getConfigStore } from '../../core/config.js';
import {
  MODEL_HISTORY_KEY,
  MODEL_HISTORY_LIMIT,
  normalizeTimestamp,
  formatRelativeTime,
  type ModelHistoryAction,
  type ModelHistoryEntry,
  type ModelsOptions,
} from './types.js';

function normalizeHistoryAction(value: unknown): ModelHistoryAction {
  if (value === 'downloaded') return 'downloaded';
  if (value === 'loaded') return 'loaded';
  if (value === 'deleted') return 'deleted';
  if (value === 'chat') return 'chat';
  return 'detected';
}

export function normalizeModelHistoryEntries(raw: unknown): ModelHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  const byId = new Map<string, ModelHistoryEntry>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const idRaw = (item as { id?: unknown }).id;
    if (typeof idRaw !== 'string') continue;
    const id = idRaw.trim();
    if (!id) continue;
    const firstSeenAt = normalizeTimestamp((item as { firstSeenAt?: unknown }).firstSeenAt, now);
    const lastSeenAt = normalizeTimestamp((item as { lastSeenAt?: unknown }).lastSeenAt, firstSeenAt);
    const entry: ModelHistoryEntry = {
      id,
      firstSeenAt,
      lastSeenAt: Math.max(lastSeenAt, firstSeenAt),
      lastAction: normalizeHistoryAction((item as { lastAction?: unknown }).lastAction),
    };

    const existing = byId.get(id);
    if (!existing || existing.lastSeenAt < entry.lastSeenAt) {
      byId.set(id, entry);
    }
  }

  return Array.from(byId.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export function mergeModelHistoryEntries(
  existing: ModelHistoryEntry[],
  modelIds: string[],
  action: ModelHistoryAction,
  now = Date.now(),
): ModelHistoryEntry[] {
  const byId = new Map(existing.map((entry) => [entry.id, entry] as const));

  for (const rawId of modelIds) {
    const id = rawId.trim();
    if (!id) continue;
    const current = byId.get(id);
    if (current) {
      byId.set(id, {
        ...current,
        lastSeenAt: Math.max(now, current.lastSeenAt),
        lastAction: action,
      });
      continue;
    }
    byId.set(id, {
      id,
      firstSeenAt: now,
      lastSeenAt: now,
      lastAction: action,
    });
  }

  return Array.from(byId.values())
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, MODEL_HISTORY_LIMIT);
}

export async function readModelHistory(): Promise<ModelHistoryEntry[]> {
  const store = await getConfigStore();
  const raw = store.get(MODEL_HISTORY_KEY);
  return normalizeModelHistoryEntries(raw);
}

export async function writeModelHistory(entries: ModelHistoryEntry[]): Promise<void> {
  const store = await getConfigStore();
  store.set(MODEL_HISTORY_KEY, entries.slice(0, MODEL_HISTORY_LIMIT));
}

export async function recordModelHistory(modelIds: string[], action: ModelHistoryAction): Promise<void> {
  if (modelIds.length === 0) return;
  const current = await readModelHistory();
  const merged = mergeModelHistoryEntries(current, modelIds, action);
  await writeModelHistory(merged);
}

export async function showModelHistory(opts?: ModelsOptions): Promise<void> {
  const history = await readModelHistory();
  if (opts?.json) {
    console.log(JSON.stringify({ history }, null, 2));
    return;
  }

  console.log(chalk.bold('\nModel History'));
  if (history.length === 0) {
    console.log(chalk.dim('  No recorded model activity yet.'));
    return;
  }

  const actionLabels: Record<ModelHistoryAction, string> = {
    detected: 'Detected',
    downloaded: 'Downloaded',
    loaded: 'Loaded',
    deleted: 'Deleted',
    chat: 'Chat activity',
  };

  const displayEntries = history.slice(0, 12);
  for (const entry of displayEntries) {
    const label = actionLabels[entry.lastAction] ?? entry.lastAction;
    console.log(
      `  ${chalk.bold(label.padEnd(13))} ${entry.id}  ${chalk.dim(formatRelativeTime(entry.lastSeenAt))}`
    );
  }

  if (history.length > displayEntries.length) {
    console.log(chalk.dim(`  … ${history.length - displayEntries.length} more entries`));
  }
}
