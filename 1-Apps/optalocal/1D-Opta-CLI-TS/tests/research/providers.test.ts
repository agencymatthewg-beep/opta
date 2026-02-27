import { afterEach, describe, expect, it, vi } from 'vitest';
import { BraveResearchProvider } from '../../src/research/providers/brave.js';
import { ExaResearchProvider } from '../../src/research/providers/exa.js';
import { GeminiResearchProvider } from '../../src/research/providers/gemini.js';
import { GroqResearchProvider } from '../../src/research/providers/groq.js';
import { TavilyResearchProvider } from '../../src/research/providers/tavily.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): unknown {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('research providers', () => {
  it('normalizes Tavily responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        answer: 'Tavily summary',
        results: [
          {
            title: 'Tavily source',
            url: 'https://example.com/tavily',
            content: 'Snippet from tavily',
            score: 0.91,
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const provider = new TavilyResearchProvider({ enabled: true, apiKey: 'tvly-key' });
    const result = await provider.search({ query: 'latest AI updates', intent: 'news' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.result.provider).toBe('tavily');
    expect(result.result.answer).toContain('Tavily summary');
    expect(result.result.citations).toHaveLength(1);
    expect(result.result.citations[0]).toMatchObject({
      title: 'Tavily source',
      url: 'https://example.com/tavily',
      snippet: 'Snippet from tavily',
    });
  });

  it('normalizes Gemini responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [{ text: 'Gemini summary' }],
            },
            groundingMetadata: {
              groundingChunks: [
                {
                  web: {
                    title: 'Gemini source',
                    uri: 'https://example.com/gemini',
                  },
                },
              ],
            },
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const provider = new GeminiResearchProvider({ enabled: true, apiKey: 'gem-key' });
    const result = await provider.search({ query: 'query', intent: 'general' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.result.provider).toBe('gemini');
    expect(result.result.answer).toContain('Gemini summary');
    expect(result.result.citations[0]).toMatchObject({
      title: 'Gemini source',
      url: 'https://example.com/gemini',
    });
  });

  it('normalizes Exa responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        answer: 'Exa summary',
        results: [
          {
            title: 'Exa source',
            url: 'https://example.com/exa',
            text: 'Exa snippet',
            score: 0.8,
            publishedDate: '2026-01-20',
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const provider = new ExaResearchProvider({ enabled: true, apiKey: 'exa-key' });
    const result = await provider.search({ query: 'query', intent: 'general' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.result.provider).toBe('exa');
    expect(result.result.answer).toContain('Exa summary');
    expect(result.result.citations[0]).toMatchObject({
      title: 'Exa source',
      url: 'https://example.com/exa',
      snippet: 'Exa snippet',
      publishedAt: '2026-01-20',
    });
  });

  it('normalizes Brave responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        web: {
          results: [
            {
              title: 'Brave source',
              url: 'https://example.com/brave',
              description: 'Brave snippet',
            },
          ],
        },
      }),
    ) as unknown as typeof fetch;

    const provider = new BraveResearchProvider({ enabled: true, apiKey: 'brave-key' });
    const result = await provider.search({ query: 'query', intent: 'news' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.result.provider).toBe('brave');
    expect(result.result.citations[0]).toMatchObject({
      title: 'Brave source',
      url: 'https://example.com/brave',
      snippet: 'Brave snippet',
    });
  });

  it('normalizes Groq responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: 'Groq summary',
            },
          },
        ],
        citations: [
          {
            title: 'Groq source',
            url: 'https://example.com/groq',
            snippet: 'Groq snippet',
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const provider = new GroqResearchProvider({ enabled: true, apiKey: 'groq-key', model: 'llama-3.3-70b' });
    const result = await provider.search({ query: 'query', intent: 'coding' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.result.provider).toBe('groq');
    expect(result.result.answer).toContain('Groq summary');
    expect(result.result.citations[0]).toMatchObject({
      title: 'Groq source',
      url: 'https://example.com/groq',
      snippet: 'Groq snippet',
    });
  });

  it('returns typed disabled-provider errors without calling fetch', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const provider = new GeminiResearchProvider({ enabled: false, apiKey: 'gem-key' });
    const result = await provider.search({ query: 'query', intent: 'general' });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('PROVIDER_DISABLED');
    expect(result.error.provider).toBe('gemini');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns typed HTTP errors for non-2xx responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    }) as unknown as typeof fetch;

    const provider = new BraveResearchProvider({ enabled: true, apiKey: 'brave-key' });
    const result = await provider.search({ query: 'query', intent: 'news' });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('HTTP_ERROR');
    expect(result.error.provider).toBe('brave');
    expect(result.error.statusCode).toBe(429);
  });

  it('returns typed network errors for fetch failures', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;

    const provider = new GroqResearchProvider({ enabled: true, apiKey: 'groq-key' });
    const result = await provider.search({ query: 'query', intent: 'general' });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('NETWORK_ERROR');
    expect(result.error.provider).toBe('groq');
    expect(result.error.message).toContain('ECONNRESET');
  });
});
