import type {
  ResearchProvider,
  ResearchProviderConfig,
  ResearchProviderHealth,
  ResearchProviderResult,
  ResearchQuery,
} from '../types.js';
import {
  asString,
  fetchJsonWithErrors,
  isRecord,
  lightweightHealthPing,
  makeProviderFailure,
  makeProviderSuccess,
  normalizeCitation,
  sanitizeTimeoutMs,
} from './shared.js';

const DEFAULT_TAVILY_BASE_URL = 'https://api.tavily.com';

export class TavilyResearchProvider implements ResearchProvider {
  readonly id = 'tavily' as const;
  readonly enabled: boolean;
  readonly timeoutMs: number;

  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(config: ResearchProviderConfig = {}) {
    this.enabled = config.enabled === true;
    this.timeoutMs = sanitizeTimeoutMs(config.timeoutMs);
    this.apiKey = asString(config.apiKey);
    this.baseUrl = (asString(config.baseUrl) ?? DEFAULT_TAVILY_BASE_URL).replace(/\/+$/, '');
  }

  async search(query: ResearchQuery): Promise<ResearchProviderResult> {
    if (!this.enabled) {
      return makeProviderFailure(this.id, 'PROVIDER_DISABLED', 'Tavily provider is disabled.', { retryable: false });
    }

    if (!this.apiKey) {
      return makeProviderFailure(this.id, 'MISSING_API_KEY', 'Tavily API key is missing.', { retryable: false });
    }

    const response = await fetchJsonWithErrors(
      this.id,
      `${this.baseUrl}/search`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query: query.query,
          max_results: query.maxResults ?? 5,
          search_depth: query.intent === 'news' ? 'advanced' : 'basic',
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        provider: this.id,
        error: response.error,
      };
    }

    const payload = response.data;
    if (!isRecord(payload)) {
      return makeProviderFailure(this.id, 'INVALID_RESPONSE', 'Tavily payload is not an object.', { retryable: false });
    }

    const rawResults = Array.isArray(payload['results']) ? payload['results'] : [];
    const citations = rawResults
      .map((item) => {
        if (!isRecord(item)) return null;
        return normalizeCitation({
          title: item['title'],
          url: item['url'],
          snippet: item['content'] ?? item['snippet'],
          score: item['score'],
          source: 'tavily',
        });
      })
      .filter((citation): citation is NonNullable<typeof citation> => citation !== null);

    const summary = asString(payload['answer']) ?? asString(payload['summary']) ?? '';
    const fallbackSummary = citations.map((citation) => citation.snippet ?? '').filter(Boolean).join(' ').trim();

    return makeProviderSuccess(
      this.id,
      query,
      summary || fallbackSummary || 'No summary returned by Tavily.',
      citations,
      payload,
    );
  }

  async healthCheck(): Promise<ResearchProviderHealth> {
    return lightweightHealthPing({
      provider: this.id,
      enabled: this.enabled,
      timeoutMs: Math.min(this.timeoutMs, 5_000),
      url: this.baseUrl,
    });
  }
}
