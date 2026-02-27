import type {
  ResearchProvider,
  ResearchProviderConfig,
  ResearchProviderHealth,
  ResearchProviderResult,
  ResearchQuery,
} from '../types.js';
import {
  asString,
  extractUrlsFromText,
  fetchJsonWithErrors,
  isRecord,
  lightweightHealthPing,
  makeProviderFailure,
  makeProviderSuccess,
  normalizeCitation,
  sanitizeTimeoutMs,
} from './shared.js';

const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

function intentSystemPrompt(intent: ResearchQuery['intent']): string {
  switch (intent) {
    case 'coding':
      return 'Provide technically accurate and concise developer-focused research answers with source links.';
    case 'news':
      return 'Summarize timely information with clear, current source references.';
    case 'academic':
      return 'Provide evidence-focused synthesis and include relevant source links.';
    case 'general':
    default:
      return 'Provide a concise research summary and include relevant source links.';
  }
}

export class GroqResearchProvider implements ResearchProvider {
  readonly id = 'groq' as const;
  readonly enabled: boolean;
  readonly timeoutMs: number;

  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(config: ResearchProviderConfig = {}) {
    this.enabled = config.enabled === true;
    this.timeoutMs = sanitizeTimeoutMs(config.timeoutMs);
    this.apiKey = asString(config.apiKey);
    this.baseUrl = (asString(config.baseUrl) ?? DEFAULT_GROQ_BASE_URL).replace(/\/+$/, '');
    this.model = asString(config.model) ?? DEFAULT_GROQ_MODEL;
  }

  async search(query: ResearchQuery): Promise<ResearchProviderResult> {
    if (!this.enabled) {
      return makeProviderFailure(this.id, 'PROVIDER_DISABLED', 'Groq provider is disabled.', { retryable: false });
    }

    if (!this.apiKey) {
      return makeProviderFailure(this.id, 'MISSING_API_KEY', 'Groq API key is missing.', { retryable: false });
    }

    const response = await fetchJsonWithErrors(
      this.id,
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: intentSystemPrompt(query.intent),
            },
            {
              role: 'user',
              content: query.query,
            },
          ],
          temperature: 0.2,
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
      return makeProviderFailure(this.id, 'INVALID_RESPONSE', 'Groq payload is not an object.', { retryable: false });
    }

    const choices = Array.isArray(payload['choices']) ? payload['choices'] : [];
    const firstChoice = choices[0];

    let answer = '';
    if (isRecord(firstChoice)) {
      const message = isRecord(firstChoice['message']) ? firstChoice['message'] : {};
      answer = asString(message['content']) ?? '';
    }

    const citationsFromPayload = Array.isArray(payload['citations']) ? payload['citations'] : [];
    const mappedPayloadCitations = citationsFromPayload
      .map((citation) => {
        if (!isRecord(citation)) return null;
        return normalizeCitation({
          title: citation['title'],
          url: citation['url'],
          snippet: citation['snippet'],
          source: 'groq',
        });
      })
      .filter((citation): citation is NonNullable<typeof citation> => citation !== null);

    const fallbackCitations = mappedPayloadCitations.length > 0
      ? mappedPayloadCitations
      : extractUrlsFromText(answer).map((url) => ({ url, source: 'groq' as const }));

    return makeProviderSuccess(
      this.id,
      query,
      answer || 'No summary returned by Groq.',
      fallbackCitations,
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
