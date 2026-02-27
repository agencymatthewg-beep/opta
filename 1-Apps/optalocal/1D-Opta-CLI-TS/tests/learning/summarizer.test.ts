import { describe, expect, it } from 'vitest';
import { summarizeLedgerByDate } from '../../src/learning/summarizer.js';
import type { LearningLedgerEntry } from '../../src/learning/types.js';

function makeEntry(
  id: string,
  overrides: Partial<LearningLedgerEntry> = {},
): LearningLedgerEntry {
  return {
    id,
    ts: '2026-02-22T10:00:00.000Z',
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

describe('learning summarizer', () => {
  it('groups entries by date and emits markdown headings', () => {
    const markdown = summarizeLedgerByDate([
      makeEntry('a', {
        ts: '2026-02-21T09:00:00.000Z',
        kind: 'problem',
        topic: 'race condition',
      }),
      makeEntry('b', {
        ts: '2026-02-22T12:30:00.000Z',
        kind: 'solution',
        topic: 'atomic append',
      }),
    ]);

    expect(markdown).toContain('# Learning Ledger Summary');
    expect(markdown).toContain('## 2026-02-22');
    expect(markdown).toContain('## 2026-02-21');
    expect(markdown).toContain('**solution**');
    expect(markdown).toContain('atomic append');
  });

  it('filters by date bounds', () => {
    const markdown = summarizeLedgerByDate(
      [
        makeEntry('old', { ts: '2026-02-20T01:00:00.000Z' }),
        makeEntry('keep', { ts: '2026-02-21T01:00:00.000Z', topic: 'keep me' }),
        makeEntry('new', { ts: '2026-02-22T01:00:00.000Z' }),
      ],
      {
        from: '2026-02-21T00:00:00.000Z',
        to: '2026-02-21T23:59:59.999Z',
      },
    );

    expect(markdown).toContain('keep me');
    expect(markdown).not.toContain('topic-old');
    expect(markdown).not.toContain('topic-new');
  });

  it('includes evidence links in markdown output', () => {
    const markdown = summarizeLedgerByDate([
      makeEntry('e', {
        kind: 'research',
        topic: 'retrieval references',
        evidence: [
          { label: 'RFC', uri: 'https://example.com/rfc' },
          { label: 'Design', uri: 'https://example.com/design' },
        ],
      }),
    ]);

    expect(markdown).toContain('[RFC](https://example.com/rfc)');
    expect(markdown).toContain('[Design](https://example.com/design)');
  });
});
