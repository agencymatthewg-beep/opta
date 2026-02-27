import type { LearningLedgerEntry } from './types.js';

export interface ScoredLedgerEntry {
  entry: LearningLedgerEntry;
  score: number;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export function scoreLedgerEntryLexical(
  query: string,
  entry: LearningLedgerEntry,
): number {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return 0;

  const queryTokens = Array.from(new Set(tokenize(trimmed)));
  if (queryTokens.length === 0) return 0;

  const topic = entry.topic.toLowerCase();
  const content = entry.content.toLowerCase();
  const tags = entry.tags.map((tag) => tag.toLowerCase());
  const evidence = entry.evidence
    .map((item) => `${item.label} ${item.uri}`.toLowerCase())
    .join(' ');
  const kind = entry.kind.toLowerCase();
  const full = `${topic} ${content} ${tags.join(' ')} ${evidence} ${kind}`;

  let score = 0;
  if (topic.includes(trimmed)) score += 6;
  if (content.includes(trimmed)) score += 4;

  let matchedTokens = 0;
  for (const token of queryTokens) {
    let tokenMatched = false;
    if (topic.includes(token)) {
      score += 3;
      tokenMatched = true;
    }
    if (tags.some((tag) => tag.includes(token))) {
      score += 2;
      tokenMatched = true;
    }
    if (content.includes(token)) {
      score += 1;
      tokenMatched = true;
    }
    if (evidence.includes(token)) {
      score += 0.75;
      tokenMatched = true;
    }
    if (kind === token) {
      score += 1.5;
      tokenMatched = true;
    }
    if (tokenMatched || full.includes(token)) {
      matchedTokens += 1;
    }
  }

  score += (matchedTokens / queryTokens.length) * 2;
  return Number(score.toFixed(4));
}

export function retrieveTopLedgerEntries(
  query: string,
  entries: LearningLedgerEntry[],
  limit = 5,
): ScoredLedgerEntry[] {
  if (limit <= 0) return [];

  const ranked = entries
    .map((entry) => ({ entry, score: scoreLedgerEntryLexical(query, entry) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.entry.ts.localeCompare(a.entry.ts);
    });

  const relevant = ranked.filter((item) => item.score > 0);
  if (relevant.length >= limit) {
    return relevant.slice(0, limit);
  }

  const remaining = ranked
    .filter((item) => item.score <= 0)
    .slice(0, limit - relevant.length);
  return [...relevant, ...remaining];
}

export function buildRetrievalPromptBlock(
  query: string,
  entries: LearningLedgerEntry[],
  limit = 5,
): string {
  const ranked = retrieveTopLedgerEntries(query, entries, limit).filter(
    (item) => item.score > 0,
  );
  if (ranked.length === 0) {
    return '### Relevant learning context\nNo matching prior learning found.';
  }

  const lines: string[] = ['### Relevant learning context'];
  for (const item of ranked) {
    lines.push(
      `- [${item.entry.kind}] ${item.entry.topic} (${item.entry.ts})`,
      `  ${item.entry.content}`,
    );
  }
  return lines.join('\n');
}
