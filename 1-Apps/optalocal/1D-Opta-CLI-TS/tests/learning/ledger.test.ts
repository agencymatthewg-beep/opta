import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  appendLedgerEntry,
  learningLedgerPath,
  queryLedgerEntries,
  readLedgerEntries,
} from '../../src/learning/ledger.js';
import type { LearningLedgerEntry } from '../../src/learning/types.js';

function makeEntry(
  id: string,
  overrides: Partial<LearningLedgerEntry> = {},
): LearningLedgerEntry {
  return {
    id,
    ts: '2026-02-22T00:00:00.000Z',
    kind: 'plan',
    captureLevel: 'balanced',
    topic: `topic-${id}`,
    content: `content-${id}`,
    tags: [],
    evidence: [],
    metadata: {},
    ...overrides,
  };
}

describe('learning ledger', () => {
  let testCwd = '';

  beforeEach(async () => {
    testCwd = await mkdtemp(join(tmpdir(), 'opta-learning-ledger-'));
  });

  afterEach(async () => {
    await rm(testCwd, { recursive: true, force: true });
  });

  it('appends and reads entries from JSONL', async () => {
    const entry = makeEntry('entry-1', {
      kind: 'solution',
      topic: 'atomic append',
      content: 'Use lock + rename for append writes.',
      tags: ['ledger'],
      evidence: [{ label: 'spec', uri: 'https://example.com/spec' }],
    });

    await appendLedgerEntry(entry, { cwd: testCwd });
    const entries = await readLedgerEntries({ cwd: testCwd });

    expect(entries).toEqual([entry]);
  });

  it('filters entries by query constraints', async () => {
    await appendLedgerEntry(
      makeEntry('a', {
        kind: 'plan',
        tags: ['cli', 'policy'],
        content: 'Plan policy hooks for CLI.',
      }),
      { cwd: testCwd },
    );
    await appendLedgerEntry(
      makeEntry('b', {
        kind: 'solution',
        tags: ['cli', 'learning'],
        content: 'Implemented lexical retrieval scoring.',
      }),
      { cwd: testCwd },
    );
    await appendLedgerEntry(
      makeEntry('c', {
        kind: 'reflection',
        tags: ['ui'],
        content: 'Prompt injection context needed tighter ranking.',
      }),
      { cwd: testCwd },
    );

    const results = await queryLedgerEntries(
      {
        kinds: ['solution'],
        tags: ['cli'],
        text: 'lexical retrieval',
      },
      { cwd: testCwd },
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('b');
  });

  it('preserves all entries under concurrent append (atomic append behavior)', async () => {
    const entries = Array.from({ length: 25 }, (_, index) =>
      makeEntry(`entry-${index}`),
    );

    await Promise.all(
      entries.map((entry) => appendLedgerEntry(entry, { cwd: testCwd })),
    );

    const loaded = await readLedgerEntries({ cwd: testCwd });
    const loadedIds = new Set(loaded.map((entry) => entry.id));

    expect(loaded).toHaveLength(entries.length);
    expect(loadedIds.size).toBe(entries.length);
    for (const entry of entries) {
      expect(loadedIds.has(entry.id)).toBe(true);
    }
  });

  it('validates schema when reading and rejects invalid lines', async () => {
    const ledgerPath = learningLedgerPath(testCwd);
    await mkdir(join(testCwd, '.opta', 'learning'), { recursive: true });
    await writeFile(
      ledgerPath,
      `${JSON.stringify({ id: 'broken-only-id' })}\n`,
      'utf-8',
    );

    await expect(readLedgerEntries({ cwd: testCwd })).rejects.toThrow(
      /Invalid ledger entry/,
    );

    const raw = await readFile(ledgerPath, 'utf-8');
    expect(raw.trim().length).toBeGreaterThan(0);
  });
});
