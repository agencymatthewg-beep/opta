import { getContextLimit } from '../core/models.js';
import { errorMessage } from '../utils/errors.js';

// --- Context Limit Lookup ---
// Delegates to the canonical MODEL_PROFILES in core/models.ts.

export function lookupContextLimit(modelId: string): number {
  return getContextLimit(modelId);
}

// --- Constants ---

export const GB_TO_BYTES = 1e9;
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_BACKOFF_MS = 250;
export const DEFAULT_BACKOFF_MULTIPLIER = 1.8;
export const DEFAULT_HOST_FAILURE_COOLDOWN_MS = 20_000;
export const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

// --- Raw LMX Server Response Types (what the API actually returns) ---

export interface RawAdminModelDetail {
  id: string;
  loaded: boolean;
  memory_gb: number;
  loaded_at: number;
  use_batching: boolean;
  request_count: number;
  last_used_at: number;
  context_length?: number | null;
}

export interface RawAdminModelsResponse {
  loaded: RawAdminModelDetail[];
  count: number;
}

export interface RawAdminStatusResponse {
  version: string;
  uptime_seconds: number;
  loaded_models: number;
  models: string[];
  memory: {
    total_gb: number;
    used_gb: number;
    available_gb: number;
    usage_percent: number;
    threshold_percent: number;
  };
}

export interface RawAdminLoadResponse {
  success?: boolean;
  status?: string;
  model_id: string;
  memory_after_load_gb?: number;
  time_to_load_ms?: number;
  estimated_size_bytes?: number;
  estimated_size_human?: string;
  confirmation_token?: string;
  download_id?: string;
  message?: string;
  confirm_url?: string;
  progress_url?: string;
}

export interface RawAdminUnloadResponse {
  success: boolean;
  model_id: string;
  memory_freed_gb?: number;
}

export interface RawDownloadResponse {
  download_id: string;
  repo_id: string;
  estimated_size_bytes?: number;
  status: string;
}

export interface RawDownloadProgressResponse {
  download_id: string;
  repo_id: string;
  status: string;
  progress_percent: number;
  downloaded_bytes: number;
  total_bytes: number;
  files_completed: number;
  files_total: number;
  error?: string;
}

export interface RawDeleteResponse {
  success: boolean;
  model_id: string;
  freed_bytes: number;
}

export interface RawModelPerformanceResponse {
  model_id: string;
  backend_type: string;
  loaded_at: number;
  request_count: number;
  last_used_at?: number;
  memory_gb: number;
  context_length: number;
  use_batching: boolean;
  performance: Record<string, unknown>;
  global_defaults: Record<string, unknown>;
}

export interface RawBenchmarkResult {
  run: number;
  tokens_generated: number;
  time_to_first_token_ms: number;
  total_time_ms: number;
  tokens_per_second: number;
}

export interface RawBenchmarkResponse {
  model_id: string;
  backend_type: string;
  prompt: string;
  max_tokens: number;
  runs: number;
  results: RawBenchmarkResult[];
  avg_tokens_per_second: number;
  avg_time_to_first_token_ms: number;
  avg_total_time_ms: number;
}

// --- Internal Types ---

export interface HostAttemptFailure {
  host: string;
  detail: string;
}

export type HostCircuitState = 'closed' | 'open' | 'half_open';

// --- Helper Functions ---

export function mapHttpErrorCode(status: number): string {
  if (status === 403) return 'unauthorized';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 507) return 'out_of_memory';
  if (status === 408 || status === 504) return 'timeout';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server_error';
  return `http_${status}`;
}

export function parseApiErrorMessage(body: string, statusText: string): string {
  const fallback = statusText || 'request failed';
  const trimmedBody = body.trim();
  if (!trimmedBody) return fallback;

  try {
    const parsed = JSON.parse(trimmedBody) as unknown;
    const extracted = errorMessage(parsed).trim();
    if (extracted && extracted !== '[object Object]' && extracted !== '{}') {
      return extracted;
    }
  } catch {
    // Not JSON — return raw text below.
  }

  return trimmedBody || fallback;
}

export function isAbortFailure(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === 'AbortError' || err.name === 'TimeoutError'
    : err instanceof Error && /abort|timeout/i.test(err.message);
}

export function buildQueryString(
  query: Record<string, string | number | boolean | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}
