import { describe, expect, it } from 'vitest';
import {
  buildBenchmarkNewsReport,
  countWords,
  normalizeProviderOrder,
} from '../../src/benchmark/news.js';

describe('benchmark news helpers', () => {
  it('normalizes provider order with dedupe and filtering', () => {
    expect(normalizeProviderOrder('tavily,exa,exa,invalid,groq')).toEqual(['tavily', 'exa', 'groq']);
    expect(normalizeProviderOrder('')).toBeUndefined();
    expect(normalizeProviderOrder(undefined)).toBeUndefined();
  });

  it('builds a long-form success report with deduplicated citations', () => {
    const report = buildBenchmarkNewsReport({
      generatedAt: new Date('2026-02-24T00:00:00.000Z'),
      query: 'latest AI news',
      wordTarget: 550,
      routeResult: {
        ok: true,
        provider: 'tavily',
        attempts: [{ provider: 'exa', error: { provider: 'exa', code: 'HTTP_ERROR', message: 'rate limit', retryable: true } }],
        result: {
          provider: 'tavily',
          query: 'latest AI news',
          intent: 'news',
          answer: 'Major labs shipped faster coding models and assistants integrated more deeply into IDE and terminal workflows.',
          citations: [
            { url: 'https://example.com/a', title: 'A', snippet: 'Snippet A', source: 'exa' },
            { url: 'https://example.com/a', title: 'A dup', snippet: 'Snippet A dup', source: 'exa' },
            { url: 'https://example.com/b', title: 'B', snippet: 'Snippet B', source: 'tavily' },
          ],
        },
      },
    });

    expect(report.provider).toBe('tavily');
    expect(report.citations).toHaveLength(2);
    expect(report.wordCount).toBeGreaterThanOrEqual(550);
    expect(countWords(report.summary)).toBe(report.wordCount);
  });

  it('builds fallback report when all providers fail', () => {
    const report = buildBenchmarkNewsReport({
      generatedAt: new Date('2026-02-24T00:00:00.000Z'),
      query: 'latest AI news',
      wordTarget: 500,
      routeResult: {
        ok: false,
        error: {
          provider: 'router',
          code: 'ALL_PROVIDERS_FAILED',
          message: 'all providers failed',
          retryable: true,
        },
        attempts: [
          { provider: 'tavily', error: { provider: 'tavily', code: 'MISSING_API_KEY', message: 'missing', retryable: false } },
        ],
      },
    });

    expect(report.provider).toBe('fallback');
    expect(report.providerFailure).toContain('all providers failed');
    expect(report.wordCount).toBeGreaterThanOrEqual(500);
    expect(report.summary.toLowerCase()).toContain('fallback');
  });
});
