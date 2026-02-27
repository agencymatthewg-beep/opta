export const RESEARCH_PROVIDER_IDS = ['tavily', 'gemini', 'exa', 'brave', 'groq'] as const;

export type ResearchProviderId = (typeof RESEARCH_PROVIDER_IDS)[number];

export const RESEARCH_QUERY_INTENTS = ['general', 'news', 'academic', 'coding'] as const;

export type ResearchQueryIntent = (typeof RESEARCH_QUERY_INTENTS)[number];

export interface ResearchQuery {
  query: string;
  intent: ResearchQueryIntent;
  maxResults?: number;
}

export interface ResearchCitation {
  url: string;
  title?: string;
  snippet?: string;
  source?: string;
  publishedAt?: string;
  score?: number;
}

export interface NormalizedResearchResult {
  provider: ResearchProviderId;
  query: string;
  intent: ResearchQueryIntent;
  answer: string;
  citations: ResearchCitation[];
  raw?: unknown;
}

export type ResearchErrorCode =
  | 'PROVIDER_DISABLED'
  | 'MISSING_API_KEY'
  | 'HTTP_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'NO_PROVIDERS_ENABLED'
  | 'ALL_PROVIDERS_FAILED'
  | 'UNKNOWN_ERROR';

export interface ResearchProviderError {
  provider: ResearchProviderId | 'router';
  code: ResearchErrorCode;
  message: string;
  retryable: boolean;
  statusCode?: number;
}

export interface ResearchProviderSuccess {
  ok: true;
  provider: ResearchProviderId;
  result: NormalizedResearchResult;
}

export interface ResearchProviderFailure {
  ok: false;
  provider: ResearchProviderId;
  error: ResearchProviderError;
}

export type ResearchProviderResult = ResearchProviderSuccess | ResearchProviderFailure;

export type ResearchHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'disabled';

export interface ResearchProviderHealth {
  provider: ResearchProviderId;
  status: ResearchHealthStatus;
  latencyMs: number;
  checkedAt: string;
  error?: ResearchProviderError;
}

export interface ResearchProviderConfig {
  enabled?: boolean;
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  model?: string;
}

export type ResearchProvidersConfig = Partial<Record<ResearchProviderId, ResearchProviderConfig>>;

export interface ResearchConfigInput {
  research?: {
    providers?: ResearchProvidersConfig;
  };
}

export interface ResearchProvider {
  readonly id: ResearchProviderId;
  readonly enabled: boolean;
  readonly timeoutMs: number;

  search(query: ResearchQuery): Promise<ResearchProviderResult>;
  healthCheck(): Promise<ResearchProviderHealth>;
}

export interface ResearchRouteAttempt {
  provider: ResearchProviderId;
  error: ResearchProviderError;
}

export interface ResearchRouteSuccess {
  ok: true;
  provider: ResearchProviderId;
  result: NormalizedResearchResult;
  attempts: ResearchRouteAttempt[];
}

export interface ResearchRouteFailure {
  ok: false;
  error: ResearchProviderError;
  attempts: ResearchRouteAttempt[];
}

export type ResearchRouteResult = ResearchRouteSuccess | ResearchRouteFailure;
