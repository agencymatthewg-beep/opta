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

const DEFAULT_BRAVE_BASE_URL = 'https://api.search.brave.com';

export class BraveResearchProvider implements ResearchProvider {
  readonly id = 'brave' as const;
  readonly enabled: boolean;
  readonly timeoutMs: number;

  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(config: ResearchProviderConfig = {}) {
    this.enabled = config.enabled === true;
    this.timeoutMs = sanitizeTimeoutMs(config.timeoutMs);
    this.apiKey = asString(config.apiKey);
    this.baseUrl = (asString(config.baseUrl) ?? DEFAULT_BRAVE_BASE_URL).replace(/\/+$/, '');
  }

  async search(query: ResearchQuery): Promise<ResearchProviderResult> {
    if (!this.enabled) {
      return makeProviderFailure(this.id, 'PROVIDER_DISABLED', 'Brave provider is disabled.', { retryable: false });
    }

    if (!this.apiKey) {
      return makeProviderFailure(this.id, 'MISSING_API_KEY', 'Brave API key is missing.', { retryable: false });
    }

    const url = new URL(`${this.baseUrl}/res/v1/web/search`);
    url.searchParams.set('q', query.query);
    url.searchParams.set('count', String(query.maxResults ?? 5));

    const response = await fetchJsonWithErrors(
      this.id,
      url.toString(),
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-subscription-token': this.apiKey,
        },
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
      return makeProviderFailure(this.id, 'INVALID_RESPONSE', 'Brave payload is not an object.', { retryable: false });
    }

    const web = isRecord(payload['web']) ? payload['web'] : {};
    const rawResults = Array.isArray(web['results']) ? web['results'] : [];

    const citations = rawResults
      .map((item) => {
        if (!isRecord(item)) return null;
        return normalizeCitation({
          title: item['title'],
          url: item['url'],
          snippet: item['description'] ?? item['snippet'],
          publishedAt: item['age'],
          source: 'brave',
        });
      })
      .filter((citation): citation is NonNullable<typeof citation> => citation !== null);

    const fallbackSummary = citations
      .map((citation) => citation.snippet ?? '')
      .filter(Boolean)
      .slice(0, 3)
      .join(' ')
      .trim();

    return makeProviderSuccess(
      this.id,
      query,
      fallbackSummary || 'No summary returned by Brave.',
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
