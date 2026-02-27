import { LmxApiError, type LmxClient, type LmxLoadModelOptions } from './client.js';
import { sleep, clamp } from '../utils/common.js';

const DEFAULT_LOAD_TIMEOUT_MS = 60_000;
const DEFAULT_UNLOAD_TIMEOUT_MS = 20_000;
const DEFAULT_POLL_MS = 300;
const DEFAULT_MODEL_POLL_REQUEST_TIMEOUT_MS = 2_500;
const DEFAULT_LOAD_REQUEST_TIMEOUT_MS = 10_000;
const LONG_BUDGET_LOAD_REQUEST_TIMEOUT_MS = 15_000;
const LONG_BUDGET_THRESHOLD_MS = 120_000;
const ADAPTIVE_POLL_MAX_MS = 5_000;
const ADAPTIVE_POLL_BACKOFF = 1.35;
const ADAPTIVE_POLL_ERROR_BACKOFF = 1.75;
const PLACEHOLDER_MODEL_IDS = new Set([
  '',
  'off',
  'none',
  'null',
  'false',
  'disabled',
  'no',
  'nil',
  'n/a',
  'na',
  '0',
]);

/**
 * Normalize model IDs so matching stays stable across punctuation/case variants.
 */
export function normalizeModelIdKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Returns true when a model ID is effectively "unset" and should not be used
 * for load/unload/chat routing.
 */
export function isPlaceholderModelId(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return true;
  const normalized = value.trim().toLowerCase();
  return PLACEHOLDER_MODEL_IDS.has(normalized);
}

/**
 * Normalizes configured model IDs and strips placeholder values like "off".
 */
export function normalizeConfiguredModelId(value: string | null | undefined): string {
  if (isPlaceholderModelId(value)) return '';
  return (value ?? '').trim();
}

/**
 * Compare two model IDs using normalized keys.
 */
export function modelIdsEqual(a: string, b: string): boolean {
  return normalizeModelIdKey(a) === normalizeModelIdKey(b);
}

/**
 * Find the best matching model ID from a candidate list.
 * Prefers exact string equality, then normalized equality.
 */
export function findMatchingModelId(target: string, candidates: readonly string[]): string | undefined {
  const exact = candidates.find((candidate) => candidate === target);
  if (exact) return exact;
  const key = normalizeModelIdKey(target);
  const byFullKey = candidates.find((candidate) => normalizeModelIdKey(candidate) === key);
  if (byFullKey) return byFullKey;

  // Common shorthand omits org prefix: match on repo tail.
  return candidates.find((candidate) => {
    const tail = candidate.split('/').pop() ?? candidate;
    const tailKey = normalizeModelIdKey(tail);
    return tailKey === key || tailKey.includes(key) || key.includes(tailKey);
  });
}

function pollRequestTimeout(timeoutMs: number, pollMs: number): number {
  return Math.max(
    1_000,
    Math.min(
      DEFAULT_MODEL_POLL_REQUEST_TIMEOUT_MS,
      timeoutMs,
      Math.max(1_000, pollMs * 8),
    ),
  );
}

/**
 * Compute a POST /admin/models/load timeout that keeps long load budgets
 * resilient while still reserving the majority of time for readiness polling.
 */
export function computeLoadRequestTimeoutMs(totalBudgetMs: number): number {
  const safeBudgetMs = Math.max(1_000, Math.floor(totalBudgetMs));
  if (safeBudgetMs <= 15_000) return safeBudgetMs;

  const capMs = safeBudgetMs >= LONG_BUDGET_THRESHOLD_MS
    ? LONG_BUDGET_LOAD_REQUEST_TIMEOUT_MS
    : DEFAULT_LOAD_REQUEST_TIMEOUT_MS;
  const proportionalMs = Math.floor(safeBudgetMs * 0.2);
  const maxRequestMs = Math.max(1_000, safeBudgetMs - Math.floor(safeBudgetMs * 0.7));
  return Math.max(1_000, Math.min(capMs, proportionalMs, maxRequestMs));
}

interface AdaptivePollDelayOptions {
  attempt: number;
  basePollMs: number;
  timeoutMs: number;
  elapsedMs: number;
  hadError?: boolean;
}

/**
 * Back off polling on longer waits or transient errors to reduce admin/API
 * pressure, then tighten near the deadline to improve final-state detection.
 */
export function computeAdaptivePollDelayMs(opts: AdaptivePollDelayOptions): number {
  const basePollMs = Math.max(1, Math.floor(opts.basePollMs));
  const timeoutMs = Math.max(1_000, Math.floor(opts.timeoutMs));
  const elapsedMs = Math.max(0, Math.floor(opts.elapsedMs));
  const attempt = Math.max(1, Math.floor(opts.attempt));
  const multiplier = opts.hadError ? ADAPTIVE_POLL_ERROR_BACKOFF : ADAPTIVE_POLL_BACKOFF;

  const maxDelayMs = Math.max(basePollMs, Math.min(ADAPTIVE_POLL_MAX_MS, Math.floor(timeoutMs * 0.08)));
  const remainingMs = Math.max(0, timeoutMs - elapsedMs);
  const nearDeadline = remainingMs <= Math.max(2_000, Math.floor(timeoutMs * 0.1));
  const deadlineCapMs = nearDeadline
    ? Math.max(basePollMs, Math.floor(maxDelayMs * 0.5))
    : maxDelayMs;
  const rawDelayMs = Math.floor(basePollMs * Math.pow(multiplier, Math.max(0, attempt - 1)));
  const tightenedRawDelayMs = nearDeadline
    ? Math.floor(rawDelayMs * 0.65)
    : rawDelayMs;
  return clamp(tightenedRawDelayMs, basePollMs, deadlineCapMs);
}

interface WaitOptions {
  timeoutMs?: number;
  pollMs?: number;
}

export interface ModelLoadProgress {
  elapsedMs: number;
  timeoutMs: number;
  attempt: number;
  status: 'waiting' | 'ready';
}

interface WaitForLoadedOptions extends WaitOptions {
  onProgress?: (progress: ModelLoadProgress) => void;
}

interface WaitForUnloadedOptions extends WaitOptions {
  onProgress?: (progress: ModelLoadProgress) => void;
}

/**
 * Poll LMX until target model is visible in /admin/models.
 */
export async function waitForModelLoaded(
  client: LmxClient,
  targetModelId: string,
  opts?: WaitForLoadedOptions,
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS;
  const pollMs = opts?.pollMs ?? DEFAULT_POLL_MS;
  const deadline = Date.now() + timeoutMs;
  const startedAt = Date.now();
  const requestTimeoutMs = pollRequestTimeout(timeoutMs, pollMs);
  let attempt = 0;
  let lastError: unknown;

  while (Date.now() < deadline) {
    attempt += 1;
    opts?.onProgress?.({
      elapsedMs: Date.now() - startedAt,
      timeoutMs,
      attempt,
      status: 'waiting',
    });
    try {
      const loaded = await client.models({
        timeoutMs: requestTimeoutMs,
        maxRetries: 0,
      });
      const resolved = findMatchingModelId(
        targetModelId,
        loaded.models.map((model) => model.model_id),
      );
      if (resolved) {
        opts?.onProgress?.({
          elapsedMs: Date.now() - startedAt,
          timeoutMs,
          attempt,
          status: 'ready',
        });
        return resolved;
      }
      lastError = undefined;
    } catch (err) {
      lastError = err;
    }
    const now = Date.now();
    const elapsedMs = now - startedAt;
    const remainingMs = deadline - now;
    if (remainingMs <= 0) break;
    await sleep(Math.min(
      remainingMs,
      computeAdaptivePollDelayMs({
        attempt,
        basePollMs: pollMs,
        timeoutMs,
        elapsedMs,
        hadError: lastError !== undefined,
      }),
    ));
  }

  if (lastError instanceof LmxApiError) {
    throw lastError;
  }
  throw new LmxApiError(
    408,
    'timeout',
    `Model "${targetModelId}" did not become loaded within ${Math.round(timeoutMs / 1000)}s`,
  );
}

/**
 * Poll LMX until target model disappears from /admin/models.
 */
export async function waitForModelUnloaded(
  client: LmxClient,
  targetModelId: string,
  opts?: WaitForUnloadedOptions,
): Promise<void> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_UNLOAD_TIMEOUT_MS;
  const pollMs = opts?.pollMs ?? DEFAULT_POLL_MS;
  const deadline = Date.now() + timeoutMs;
  const startedAt = Date.now();
  const requestTimeoutMs = pollRequestTimeout(timeoutMs, pollMs);
  let attempt = 0;
  let lastError: unknown;

  while (Date.now() < deadline) {
    attempt += 1;
    opts?.onProgress?.({
      elapsedMs: Date.now() - startedAt,
      timeoutMs,
      attempt,
      status: 'waiting',
    });
    try {
      const loaded = await client.models({
        timeoutMs: requestTimeoutMs,
        maxRetries: 0,
      });
      const stillLoaded = findMatchingModelId(
        targetModelId,
        loaded.models.map((model) => model.model_id),
      );
      if (!stillLoaded) {
        opts?.onProgress?.({
          elapsedMs: Date.now() - startedAt,
          timeoutMs,
          attempt,
          status: 'ready',
        });
        return;
      }
      lastError = undefined;
    } catch (err) {
      lastError = err;
    }
    const now = Date.now();
    const elapsedMs = now - startedAt;
    const remainingMs = deadline - now;
    if (remainingMs <= 0) break;
    await sleep(Math.min(
      remainingMs,
      computeAdaptivePollDelayMs({
        attempt,
        basePollMs: pollMs,
        timeoutMs,
        elapsedMs,
        hadError: lastError !== undefined,
      }),
    ));
  }

  if (lastError instanceof LmxApiError) {
    throw lastError;
  }
  throw new LmxApiError(
    408,
    'timeout',
    `Model "${targetModelId}" did not unload within ${Math.round(timeoutMs / 1000)}s`,
  );
}

interface EnsureLoadedOptions extends WaitForLoadedOptions {
  /**
   * Skip POST /load when the model is already loaded.
   */
  preloadedModelId?: string;
  /**
   * Override POST /admin/models/load request timeout.
   * Defaults to the overall load timeout when provided.
   */
  loadRequestTimeoutMs?: number;
  /**
   * Extra POST /admin/models/load options (backend/perf/autodownload knobs).
   */
  loadOptions?: Omit<LmxLoadModelOptions, 'timeoutMs' | 'maxRetries'>;
}

interface WaitForDownloadOptions {
  timeoutMs: number;
  pollMs: number;
}

async function waitForDownloadCompleted(
  client: LmxClient,
  downloadId: string,
  opts: WaitForDownloadOptions,
): Promise<void> {
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    const progress = await client.downloadProgress(downloadId);
    if (progress.status === 'completed') return;
    if (progress.status === 'failed') {
      throw new LmxApiError(
        409,
        'download_failed',
        progress.error ? `Download failed: ${progress.error}` : 'Download failed',
      );
    }
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await sleep(Math.min(remainingMs, opts.pollMs));
  }

  throw new LmxApiError(
    408,
    'timeout',
    `Model download did not complete within ${Math.round(opts.timeoutMs / 1000)}s`,
  );
}

/**
 * Ensure a model is loaded and ready before use.
 * Returns the canonical ID reported by LMX once loaded.
 */
export async function ensureModelLoaded(
  client: LmxClient,
  targetModelId: string,
  opts?: EnsureLoadedOptions,
): Promise<string> {
  const preloaded = opts?.preloadedModelId;
  if (!preloaded) {
    const totalBudgetMs = Math.max(1_000, opts?.timeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS);
    const autoRequestTimeoutMs = computeLoadRequestTimeoutMs(totalBudgetMs);
    const requestTimeoutMs = Math.max(1_000, opts?.loadRequestTimeoutMs ?? autoRequestTimeoutMs);
    const requestStartedAt = Date.now();
    const reportDispatchProgress = opts?.onProgress;
    const dispatchTicker = reportDispatchProgress
      ? setInterval(() => {
          reportDispatchProgress({
            elapsedMs: Date.now() - requestStartedAt,
            timeoutMs: totalBudgetMs,
            attempt: 0,
            status: 'waiting',
          });
        }, 1_000)
      : undefined;

    try {
      reportDispatchProgress?.({
        elapsedMs: 0,
        timeoutMs: totalBudgetMs,
        attempt: 0,
        status: 'waiting',
      });
      const loadResult = await client.loadModel(targetModelId, {
        timeoutMs: requestTimeoutMs,
        maxRetries: 0,
        ...(opts?.loadOptions ?? {}),
      });
      let downloadId = loadResult.download_id;

      if (loadResult.status === 'download_required' && loadResult.confirmation_token) {
        const confirmResult = await client.confirmLoad(loadResult.confirmation_token, {
          timeoutMs: requestTimeoutMs,
          maxRetries: 0,
        });
        downloadId = confirmResult.download_id;
      }

      if (downloadId) {
        const downloadBudgetMs = Math.max(1_000, Math.floor(totalBudgetMs * 0.9));
        const downloadPollMs = Math.max(
          1_000,
          Math.min(
            5_000,
            Math.floor((opts?.pollMs ?? DEFAULT_POLL_MS) * 6),
          ),
        );
        await waitForDownloadCompleted(client, downloadId, {
          timeoutMs: downloadBudgetMs,
          pollMs: downloadPollMs,
        });
      }
    } catch (err) {
      // Model load requests can keep running server-side even if the client
      // times out waiting for the POST response. Continue with readiness
      // polling so we don't fail fast on large/slow loads.
      const isLoadRequestTimeout = err instanceof LmxApiError
        && err.code === 'connection_error'
        && /timed out/i.test(err.message);
      if (!isLoadRequestTimeout) {
        throw err;
      }
    } finally {
      if (dispatchTicker) {
        clearInterval(dispatchTicker);
      }
    }
  }
  return waitForModelLoaded(client, preloaded ?? targetModelId, opts);
}
