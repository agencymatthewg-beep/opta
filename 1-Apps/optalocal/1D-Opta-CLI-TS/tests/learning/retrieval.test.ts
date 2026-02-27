import { describe, expect, it } from 'vitest';
import {
  buildRetrievalPromptBlock,
  retrieveTopLedgerEntries,
  scoreLedgerEntryLexical,
} from '../../src/learning/retrieval.js';
import type { LearningLedgerEntry } from '../../src/learning/types.js';

function entry(
  id: string,
  overrides: Partial<LearningLedgerEntry> = {},
): LearningLedgerEntry {
  return {
    id,
    ts: '2026-02-22T00:00:00.000Z',
    kind: 'research',
    captureLevel: 'balanced',
    topic: `topic-${id}`,
    content: `content-${id}`,
    tags: [],
    evidence: [],
    metadata: {},
    ...overrides,
  };
}

describe('learning retrieval', () => {
  it('scores topic and content lexical overlap', () => {
    const strong = entry('strong', {
      topic: 'policy gate all autonomy mode',
      content: 'Fail closed behavior for policy engine.',
      tags: ['policy'],
    });
    const weak = entry('weak', {
      topic: 'terminal colors',
      content: 'Unrelated rendering details.',
      tags: ['ui'],
    });

    const strongScore = scoreLedgerEntryLexical('policy gate autonomy', strong);
    const weakScore = scoreLedgerEntryLexical('policy gate autonomy', weak);

    expect(strongScore).toBeGreaterThan(weakScore);
    expect(strongScore).toBeGreaterThan(0);
  });

  it('returns top-N entries by lexical relevance', () => {
    const entries = [
      entry('a', {
        topic: 'policy gating and fail-closed',
        content: 'autonomous execution requires a gate decision',
      }),
      entry('b', {
        topic: 'learning ledger retrieval',
        content: 'lexical relevance for prompt injection context',
      }),
      entry('c', {
        topic: 'release notes',
        content: 'formatting and markdown output',
      }),
    ];

    const ranked = retrieveTopLedgerEntries(
      'policy autonomous gate decision',
      entries,
      2,
    );

    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.entry.id).toBe('a');
    expect(ranked[0]!.score).toBeGreaterThanOrEqual(ranked[1]!.score);
  });

  it('builds a prompt block from the ranked top-N entries', () => {
    const entries = [
      entry('a', {
        kind: 'solution',
        topic: 'policy engine gate',
        content: 'Gate autonomous actions and log audits.',
      }),
      entry('b', {
        kind: 'reflection',
        topic: 'summary notes',
        content: 'Group by date in markdown.',
      }),
    ];

    const prompt = buildRetrievalPromptBlock(
      'policy audit gate autonomous',
      entries,
      1,
    );

    expect(prompt).toContain('Relevant learning context');
    expect(prompt).toContain('policy engine gate');
    expect(prompt).not.toContain('summary notes');
  });
});
