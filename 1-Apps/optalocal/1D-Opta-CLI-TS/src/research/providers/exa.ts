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

const DEFAULT_EXA_BASE_URL = 'https://api.exa.ai';

export class ExaResearchProvider implements ResearchProvider {
  readonly id = 'exa' as const;
  readonly enabled: boolean;
  readonly timeoutMs: number;

  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(config: ResearchProviderConfig = {}) {
    this.enabled = config.enabled === true;
    this.timeoutMs = sanitizeTimeoutMs(config.timeoutMs);
    this.apiKey = asString(config.apiKey);
    this.baseUrl = (asString(config.baseUrl) ?? DEFAULT_EXA_BASE_URL).replace(/\/+$/, '');
  }

  async search(query: ResearchQuery): Promise<ResearchProviderResult> {
    if (!this.enabled) {
      return makeProviderFailure(this.id, 'PROVIDER_DISABLED', 'Exa provider is disabled.', { retryable: false });
    }

    if (!this.apiKey) {
      return makeProviderFailure(this.id, 'MISSING_API_KEY', 'Exa API key is missing.', { retryable: false });
    }

    const response = await fetchJsonWithErrors(
      this.id,
      `${this.baseUrl}/search`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          query: query.query,
          numResults: query.maxResults ?? 5,
          useAutoprompt: true,
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
      return makeProviderFailure(this.id, 'INVALID_RESPONSE', 'Exa payload is not an object.', { retryable: false });
    }

    const rawResults = Array.isArray(payload['results']) ? payload['results'] : [];
    const citations = rawResults
      .map((item) => {
        if (!isRecord(item)) return null;
        return normalizeCitation({
          title: item['title'],
          url: item['url'],
          snippet: item['text'] ?? item['snippet'],
          score: item['score'],
          publishedAt: item['publishedDate'],
          source: 'exa',
        });
      })
      .filter((citation): citation is NonNullable<typeof citation> => citation !== null);

    const summary = asString(payload['answer']) ?? asString(payload['summary']) ?? '';
    const fallbackSummary = citations.map((citation) => citation.snippet ?? '').filter(Boolean).join(' ').trim();

    return makeProviderSuccess(
      this.id,
      query,
      summary || fallbackSummary || 'No summary returned by Exa.',
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
