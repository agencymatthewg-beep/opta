/**
 * Persistent command history stored on disk.
 *
 * Unlike src/ui/history.ts (in-memory REPL history), this module persists
 * user commands across sessions to ~/.config/opta/history.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const HISTORY_PATH = join(homedir(), '.config', 'opta', 'history');
const MAX_HISTORY = 1000;

export async function loadHistory(): Promise<string[]> {
  try {
    const data = await readFile(HISTORY_PATH, 'utf-8');
    return data.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export async function appendHistory(line: string): Promise<void> {
  const lines = await loadHistory();
  lines.push(line);
  // Keep only last MAX_HISTORY entries
  const trimmed = lines.slice(-MAX_HISTORY);
  await mkdir(join(homedir(), '.config', 'opta'), { recursive: true });
  await writeFile(HISTORY_PATH, trimmed.join('\n') + '\n', 'utf-8');
}

export async function searchHistory(query: string): Promise<string[]> {
  const lines = await loadHistory();
  const q = query.toLowerCase();
  return lines.filter(l => l.toLowerCase().includes(q)).reverse();
}

export async function clearHistory(): Promise<void> {
  await mkdir(join(homedir(), '.config', 'opta'), { recursive: true });
  await writeFile(HISTORY_PATH, '', 'utf-8');
}
