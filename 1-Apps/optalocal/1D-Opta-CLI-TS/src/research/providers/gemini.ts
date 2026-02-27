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

const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

function extractGeminiAnswer(payload: Record<string, unknown>): string {
  const candidates = Array.isArray(payload['candidates']) ? payload['candidates'] : [];
  const firstCandidate = candidates[0];
  if (!isRecord(firstCandidate)) return '';

  const content = isRecord(firstCandidate['content']) ? firstCandidate['content'] : {};
  const parts = Array.isArray(content['parts']) ? content['parts'] : [];

  const segments: string[] = [];
  for (const part of parts) {
    if (!isRecord(part)) continue;
    const text = asString(part['text']);
    if (text) segments.push(text);
  }

  return segments.join(' ').trim();
}

function extractGeminiCitations(payload: Record<string, unknown>) {
  const candidates = Array.isArray(payload['candidates']) ? payload['candidates'] : [];

  const citations = [];
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;

    const metadata = isRecord(candidate['groundingMetadata']) ? candidate['groundingMetadata'] : {};
    const chunks = Array.isArray(metadata['groundingChunks']) ? metadata['groundingChunks'] : [];

    for (const chunk of chunks) {
      if (!isRecord(chunk)) continue;
      const web = isRecord(chunk['web']) ? chunk['web'] : {};
      const citation = normalizeCitation({
        title: web['title'],
        url: web['uri'],
        source: 'gemini',
      });
      if (citation) citations.push(citation);
    }
  }

  return citations;
}

export class GeminiResearchProvider implements ResearchProvider {
  readonly id = 'gemini' as const;
  readonly enabled: boolean;
  readonly timeoutMs: number;

  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(config: ResearchProviderConfig = {}) {
    this.enabled = config.enabled === true;
    this.timeoutMs = sanitizeTimeoutMs(config.timeoutMs);
    this.apiKey = asString(config.apiKey);
    this.baseUrl = (asString(config.baseUrl) ?? DEFAULT_GEMINI_BASE_URL).replace(/\/+$/, '');
    this.model = asString(config.model) ?? DEFAULT_GEMINI_MODEL;
  }

  async search(query: ResearchQuery): Promise<ResearchProviderResult> {
    if (!this.enabled) {
      return makeProviderFailure(this.id, 'PROVIDER_DISABLED', 'Gemini provider is disabled.', { retryable: false });
    }

    if (!this.apiKey) {
      return makeProviderFailure(this.id, 'MISSING_API_KEY', 'Gemini API key is missing.', { retryable: false });
    }

    const endpoint = `${this.baseUrl}/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetchJsonWithErrors(
      this.id,
      endpoint,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: query.query }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
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
      return makeProviderFailure(this.id, 'INVALID_RESPONSE', 'Gemini payload is not an object.', { retryable: false });
    }

    const answer = extractGeminiAnswer(payload);
    const citations = extractGeminiCitations(payload);

    return makeProviderSuccess(
      this.id,
      query,
      answer || 'No summary returned by Gemini.',
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
