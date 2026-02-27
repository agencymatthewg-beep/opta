import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  appendActionHistory,
  clearActionHistory,
  loadActionHistory,
} from '../../src/tui/actionHistoryStore.js';
import type { ActionEvent } from '../../src/tui/activity.js';

function makeEvent(id: string, overrides: Partial<ActionEvent> = {}): ActionEvent {
  return {
    id,
    at: Date.now(),
    sessionId: 'session-a',
    kind: 'info',
    status: 'info',
    icon: 'ℹ️',
    label: `event-${id}`,
    ...overrides,
  };
}

describe('actionHistoryStore', () => {
  let dir = '';
  let filePath = '';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'opta-action-history-'));
    filePath = join(dir, 'tui-action-history.jsonl');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('persists entries and loads newest first', async () => {
    const a = makeEvent('a', { label: 'first', at: 100 });
    const b = makeEvent('b', { label: 'second', at: 200 });

    await appendActionHistory(a, { filePath });
    await appendActionHistory(b, { filePath });

    const loaded = await loadActionHistory({ filePath });
    expect(loaded).toHaveLength(2);
    expect(loaded[0]!.id).toBe('b');
    expect(loaded[1]!.id).toBe('a');
  });

  it('ignores malformed JSON lines instead of crashing', async () => {
    await mkdir(dir, { recursive: true });
    const validA = JSON.stringify(makeEvent('a', { at: 100 }));
    const validB = JSON.stringify(makeEvent('b', { at: 200 }));
    await writeFile(filePath, `${validA}\nnot-json\n{"broken":\n${validB}\n`, 'utf-8');

    const loaded = await loadActionHistory({ filePath });
    expect(loaded.map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('enforces retention limit on disk', async () => {
    for (let i = 0; i < 8; i += 1) {
      await appendActionHistory(
        makeEvent(`e${i}`, { at: i + 1 }),
        { filePath, maxEntries: 5 },
      );
    }

    const loaded = await loadActionHistory({ filePath, maxEntries: 5 });
    expect(loaded).toHaveLength(5);
    expect(loaded[0]!.id).toBe('e7');
    expect(loaded[4]!.id).toBe('e3');

    const raw = await readFile(filePath, 'utf-8');
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    expect(lines).toHaveLength(5);
  });

  it('clears persisted history', async () => {
    await appendActionHistory(makeEvent('a'), { filePath });
    await clearActionHistory({ filePath });
    const loaded = await loadActionHistory({ filePath });
    expect(loaded).toEqual([]);
  });

  it('recovers from stale lock files after abrupt closes', async () => {
    await mkdir(dir, { recursive: true });
    const lockPath = `${filePath}.lock`;
    await writeFile(lockPath, 'stale', 'utf-8');
    const old = new Date(Date.now() - 60_000);
    await utimes(lockPath, old, old);

    await appendActionHistory(makeEvent('a'), {
      filePath,
      staleLockMs: 1,
      lockTimeoutMs: 250,
      lockRetryMs: 5,
    });

    const loaded = await loadActionHistory({ filePath });
    expect(loaded.map((entry) => entry.id)).toEqual(['a']);
  });
});
