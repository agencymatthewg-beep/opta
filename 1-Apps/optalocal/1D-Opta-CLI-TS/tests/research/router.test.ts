import { describe, expect, it } from 'vitest';
import { createResearchRegistry } from '../../src/research/registry.js';
import { routeResearchQuery } from '../../src/research/router.js';
import type {
  NormalizedResearchResult,
  ResearchProvider,
  ResearchProviderError,
  ResearchProviderId,
  ResearchProviderResult,
  ResearchQuery,
  ResearchQueryIntent,
} from '../../src/research/types.js';

function makeSuccess(provider: ResearchProviderId, query: ResearchQuery): ResearchProviderResult {
  const result: NormalizedResearchResult = {
    provider,
    query: query.query,
    intent: query.intent,
    answer: `${provider} answer`,
    citations: [
      {
        title: `${provider} citation`,
        url: `https://example.com/${provider}`,
      },
    ],
  };

  return {
    ok: true,
    provider,
    result,
  };
}

function makeError(provider: ResearchProviderId, code: ResearchProviderError['code'], message: string): ResearchProviderResult {
  return {
    ok: false,
    provider,
    error: {
      provider,
      code,
      message,
      retryable: code !== 'PROVIDER_DISABLED' && code !== 'MISSING_API_KEY',
    },
  };
}

function stubProvider(
  provider: ResearchProviderId,
  opts: {
    enabled?: boolean;
    timeoutMs?: number;
    search: (query: ResearchQuery) => Promise<ResearchProviderResult>;
  },
): ResearchProvider {
  return {
    id: provider,
    enabled: opts.enabled ?? true,
    timeoutMs: opts.timeoutMs ?? 3000,
    search: opts.search,
    healthCheck: async () => ({
      provider,
      status: (opts.enabled ?? true) ? 'healthy' : 'disabled',
      latencyMs: 1,
      checkedAt: new Date(0).toISOString(),
    }),
  };
}

describe('research registry', () => {
  it('handles missing provider config gracefully', () => {
    expect(createResearchRegistry({})).toEqual([]);
    expect(createResearchRegistry({ research: {} })).toEqual([]);
    expect(createResearchRegistry({ research: { providers: {} } })).toEqual([]);
  });

  it('builds enabled providers only', () => {
    const providers = createResearchRegistry({
      research: {
        providers: {
          tavily: { enabled: true, apiKey: 'tvly' },
          exa: { enabled: false, apiKey: 'exa' },
        },
      },
    });

    expect(providers.map((provider) => provider.id)).toEqual(['tavily']);
  });
});

describe('research router', () => {
  it('routes by intent preference before declaration order', async () => {
    const callOrder: ResearchProviderId[] = [];

    const providers: ResearchProvider[] = [
      stubProvider('exa', {
        search: async (query) => {
          callOrder.push('exa');
          return makeSuccess('exa', query);
        },
      }),
      stubProvider('tavily', {
        search: async (query) => {
          callOrder.push('tavily');
          return makeSuccess('tavily', query);
        },
      }),
    ];

    const result = await routeResearchQuery(
      {
        query: 'latest AI product launches',
        intent: 'news',
      },
      {
        providers,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.provider).toBe('tavily');
    expect(callOrder).toEqual(['tavily']);
  });

  it('falls back to later providers when earlier providers fail', async () => {
    const callOrder: ResearchProviderId[] = [];

    const providers: ResearchProvider[] = [
      stubProvider('tavily', {
        search: async () => {
          callOrder.push('tavily');
          return makeError('tavily', 'HTTP_ERROR', '429 from tavily');
        },
      }),
      stubProvider('exa', {
        search: async (query) => {
          callOrder.push('exa');
          return makeSuccess('exa', query);
        },
      }),
    ];

    const result = await routeResearchQuery(
      {
        query: 'best static analysis tools',
        intent: 'general',
      },
      { providers },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.provider).toBe('exa');
    expect(callOrder).toEqual(['tavily', 'exa']);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]?.provider).toBe('tavily');
    expect(result.attempts[0]?.error.code).toBe('HTTP_ERROR');
  });

  it('skips disabled providers and uses next available provider', async () => {
    const callOrder: ResearchProviderId[] = [];

    const providers: ResearchProvider[] = [
      stubProvider('tavily', {
        enabled: false,
        search: async (query) => {
          callOrder.push('tavily');
          return makeSuccess('tavily', query);
        },
      }),
      stubProvider('brave', {
        search: async (query) => {
          callOrder.push('brave');
          return makeSuccess('brave', query);
        },
      }),
    ];

    const result = await routeResearchQuery(
      {
        query: 'today cloud security headlines',
        intent: 'news',
      },
      { providers },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.provider).toBe('brave');
    expect(callOrder).toEqual(['brave']);
  });

  it('applies per-provider timeouts and continues fallback sequence', async () => {
    const callOrder: ResearchProviderId[] = [];

    const providers: ResearchProvider[] = [
      stubProvider('tavily', {
        timeoutMs: 15,
        search: async (query) => {
          callOrder.push('tavily');
          await new Promise((resolve) => setTimeout(resolve, 60));
          return makeSuccess('tavily', query);
        },
      }),
      stubProvider('groq', {
        search: async (query) => {
          callOrder.push('groq');
          return makeSuccess('groq', query);
        },
      }),
    ];

    const result = await routeResearchQuery(
      {
        query: 'explain model distillation simply',
        intent: 'coding',
      },
      {
        providers,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.provider).toBe('groq');
    expect(callOrder).toEqual(['tavily', 'groq']);
    expect(result.attempts[0]?.provider).toBe('tavily');
    expect(result.attempts[0]?.error.code).toBe('TIMEOUT');
  });

  it('returns typed error when no enabled providers are available', async () => {
    const result = await routeResearchQuery(
      {
        query: 'query',
        intent: 'general',
      },
      {
        providers: [],
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('NO_PROVIDERS_ENABLED');
  });

  it('supports missing config keys without throwing', async () => {
    const result = await routeResearchQuery(
      {
        query: 'query',
        intent: 'general',
      },
      {
        config: {
          research: {
            providers: {
              tavily: {},
            },
          },
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('NO_PROVIDERS_ENABLED');
  });

  it('allows explicit provider override order', async () => {
    const callOrder: ResearchProviderId[] = [];

    const providers: ResearchProvider[] = [
      stubProvider('tavily', {
        search: async (query) => {
          callOrder.push('tavily');
          return makeSuccess('tavily', query);
        },
      }),
      stubProvider('exa', {
        search: async (query) => {
          callOrder.push('exa');
          return makeSuccess('exa', query);
        },
      }),
    ];

    const result = await routeResearchQuery(
      {
        query: 'query',
        intent: 'general',
      },
      {
        providers,
        providerOrder: ['exa', 'tavily'],
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.provider).toBe('exa');
    expect(callOrder).toEqual(['exa']);
  });

  it('returns aggregated failure when all providers fail', async () => {
    const providers: ResearchProvider[] = [
      stubProvider('tavily', {
        search: async () => makeError('tavily', 'HTTP_ERROR', '429'),
      }),
      stubProvider('exa', {
        search: async () => makeError('exa', 'NETWORK_ERROR', 'connection reset'),
      }),
    ];

    const result = await routeResearchQuery(
      {
        query: 'query',
        intent: 'general',
      },
      { providers },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('ALL_PROVIDERS_FAILED');
    expect(result.attempts).toHaveLength(2);
  });
});
