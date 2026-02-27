import type {
  ResearchCitation,
  ResearchErrorCode,
  ResearchProviderError,
  ResearchProviderFailure,
  ResearchProviderHealth,
  ResearchProviderId,
  ResearchProviderResult,
  ResearchProviderSuccess,
  ResearchQuery,
} from '../types.js';

export const DEFAULT_PROVIDER_TIMEOUT_MS = 12_000;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function sanitizeTimeoutMs(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value <= 0) return DEFAULT_PROVIDER_TIMEOUT_MS;
  return Math.max(250, Math.floor(value));
}

export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return fallback;
}

export function isAbortLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return true;
  const message = error.message.toLowerCase();
  return message.includes('aborted') || message.includes('timeout') || message.includes('timed out');
}

export function makeProviderError(
  provider: ResearchProviderId | 'router',
  code: ResearchErrorCode,
  message: string,
  extras: { statusCode?: number; retryable?: boolean } = {},
): ResearchProviderError {
  return {
    provider,
    code,
    message,
    retryable: extras.retryable ?? !['PROVIDER_DISABLED', 'MISSING_API_KEY', 'INVALID_RESPONSE'].includes(code),
    statusCode: extras.statusCode,
  };
}

export function makeProviderFailure(
  provider: ResearchProviderId,
  code: ResearchErrorCode,
  message: string,
  extras: { statusCode?: number; retryable?: boolean } = {},
): ResearchProviderFailure {
  return {
    ok: false,
    provider,
    error: makeProviderError(provider, code, message, extras),
  };
}

export function makeProviderSuccess(
  provider: ResearchProviderId,
  query: ResearchQuery,
  answer: string,
  citations: ResearchCitation[],
  raw?: unknown,
): ResearchProviderSuccess {
  return {
    ok: true,
    provider,
    result: {
      provider,
      query: query.query,
      intent: query.intent,
      answer,
      citations,
      raw,
    },
  };
}

export type FetchJsonResult =
  | {
      ok: true;
      data: unknown;
      status: number;
    }
  | {
      ok: false;
      error: ResearchProviderError;
    };

export async function fetchJsonWithErrors(
  provider: ResearchProviderId,
  url: string,
  init: RequestInit,
): Promise<FetchJsonResult> {
  try {
    const response = await fetch(url, init);

    if (!response.ok) {
      let bodyText = '';
      try {
        bodyText = await response.text();
      } catch {
        bodyText = '';
      }

      const suffix = bodyText.trim().length > 0 ? `: ${bodyText.trim().slice(0, 180)}` : '';
      const retryable = response.status >= 500 || response.status === 429;

      return {
        ok: false,
        error: makeProviderError(
          provider,
          'HTTP_ERROR',
          `HTTP ${response.status}${suffix}`,
          { statusCode: response.status, retryable },
        ),
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        ok: false,
        error: makeProviderError(
          provider,
          'INVALID_RESPONSE',
          'Provider returned a non-JSON response payload.',
          { retryable: false },
        ),
      };
    }

    return {
      ok: true,
      data: payload,
      status: response.status,
    };
  } catch (error) {
    if (isAbortLikeError(error)) {
      return {
        ok: false,
        error: makeProviderError(provider, 'TIMEOUT', `Request timed out: ${toErrorMessage(error, 'timeout')}`),
      };
    }

    return {
      ok: false,
      error: makeProviderError(
        provider,
        'NETWORK_ERROR',
        `Network failure: ${toErrorMessage(error, 'unknown network error')}`,
      ),
    };
  }
}

export function normalizeCitation(raw: {
  url?: unknown;
  title?: unknown;
  snippet?: unknown;
  source?: unknown;
  publishedAt?: unknown;
  score?: unknown;
}): ResearchCitation | null {
  const url = asString(raw.url);
  if (!url) return null;

  const citation: ResearchCitation = { url };
  const title = asString(raw.title);
  const snippet = asString(raw.snippet);
  const source = asString(raw.source);
  const publishedAt = asString(raw.publishedAt);
  const score = asFiniteNumber(raw.score);

  if (title) citation.title = title;
  if (snippet) citation.snippet = snippet;
  if (source) citation.source = source;
  if (publishedAt) citation.publishedAt = publishedAt;
  if (score !== undefined) citation.score = score;

  return citation;
}

export function pickAnswer(candidate: unknown, fallback = ''): string {
  const answer = asString(candidate);
  return answer ?? fallback;
}

export async function lightweightHealthPing(input: {
  provider: ResearchProviderId;
  enabled: boolean;
  timeoutMs: number;
  url: string;
  headers?: Record<string, string>;
}): Promise<ResearchProviderHealth> {
  const started = Date.now();
  const checkedAt = new Date().toISOString();

  if (!input.enabled) {
    return {
      provider: input.provider,
      status: 'disabled',
      latencyMs: 0,
      checkedAt,
      error: makeProviderError(input.provider, 'PROVIDER_DISABLED', 'Provider is disabled.', { retryable: false }),
    };
  }

  try {
    const response = await fetch(input.url, {
      method: 'GET',
      headers: input.headers,
      signal: AbortSignal.timeout(input.timeoutMs),
    });

    const latencyMs = Date.now() - started;

    if (response.ok) {
      return {
        provider: input.provider,
        status: 'healthy',
        latencyMs,
        checkedAt,
      };
    }

    if (response.status >= 500) {
      return {
        provider: input.provider,
        status: 'unhealthy',
        latencyMs,
        checkedAt,
        error: makeProviderError(input.provider, 'HTTP_ERROR', `Health probe failed: HTTP ${response.status}`, {
          statusCode: response.status,
        }),
      };
    }

    return {
      provider: input.provider,
      status: 'degraded',
      latencyMs,
      checkedAt,
      error: makeProviderError(input.provider, 'HTTP_ERROR', `Health probe degraded: HTTP ${response.status}`, {
        statusCode: response.status,
        retryable: true,
      }),
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const code = isAbortLikeError(error) ? 'TIMEOUT' : 'NETWORK_ERROR';

    return {
      provider: input.provider,
      status: 'unhealthy',
      latencyMs,
      checkedAt,
      error: makeProviderError(input.provider, code, toErrorMessage(error, 'health probe failed')),
    };
  }
}

export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)\]}>"']+/g) ?? [];
  const unique = new Set<string>();

  for (const candidate of matches) {
    unique.add(candidate);
  }

  return [...unique];
}

export function toProviderFailure(result: ResearchProviderResult): ResearchProviderFailure | null {
  if (result.ok) return null;
  return result;
}
