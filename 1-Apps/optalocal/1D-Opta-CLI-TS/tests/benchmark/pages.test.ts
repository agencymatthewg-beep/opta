import { describe, expect, it } from 'vitest';
import { renderBenchmarkHomePage, renderChessPage } from '../../src/benchmark/pages.js';
import type { BenchmarkNewsReport } from '../../src/benchmark/news.js';

describe('benchmark pages', () => {
  it('renders interactive benchmark suite controls and prompt previews', () => {
    const newsReport: BenchmarkNewsReport = {
      generatedAtIso: '2026-02-25T00:00:00.000Z',
      query: 'latest ai news',
      provider: 'tavily',
      attemptedProviders: ['exa', 'tavily'],
      citations: [],
      summary: 'Sample summary text for testing.',
      wordCount: 501,
    };

    const html = renderBenchmarkHomePage({
      generatedAt: new Date('2026-02-25T00:00:00.000Z'),
      newsReport,
    });

    expect(html).toContain('Run Suite');
    expect(html).toContain('Benchmarking');
    expect(html).toContain('Prompt Preview (hover a benchmark card)');
    expect(html).toContain('runSingleBenchmark');
    expect(html).toContain('data-run-one="landing"');
    expect(html).toContain('data-run-one="chess"');
    expect(html).toContain('data-run-one="ai-news"');
    expect(html).toContain('Create an Opta-branded landing page');
    expect(html).toContain('Build a premium chess web app inspired by chess.com');
    expect(html).toContain('Produce a 500+ word strategic summary of the most recent AI news');
  });

  it('renders chess script with escaped newline literals', () => {
    const newsReport: BenchmarkNewsReport = {
      generatedAtIso: '2026-02-25T00:00:00.000Z',
      query: 'latest ai news',
      provider: 'fallback',
      attemptedProviders: [],
      providerFailure: 'test',
      citations: [],
      summary: 'Sample summary text for testing.',
      wordCount: 501,
    };

    const html = renderChessPage({
      generatedAt: new Date('2026-02-25T00:00:00.000Z'),
      newsReport,
    });

    expect(html).toContain("lines.join('\\n')");
    expect(html).toContain("split('\\n').pop()");
  });
});
