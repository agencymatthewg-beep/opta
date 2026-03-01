import { debug } from '../core/debug.js';
import { errorMessage } from '../utils/errors.js';
import { sleep } from '../utils/common.js';
import type { ZodType } from 'zod';

import type {
  LmxAnthropicMessagesRequest,
  LmxAnthropicMessagesResponse,
  LmxAgentRunCreatePayload,
  LmxAgentRunListResult,
  LmxAgentRunResult,
  LmxAvailableModel,
  LmxBenchmarkPersistRequest,
  LmxBenchmarkPersistResult,
  LmxBenchmarkResult,
  LmxBenchmarkResultsOptions,
  LmxConfigReloadResult,
  LmxDeleteResponse,
  LmxDownloadProgress,
  LmxDownloadResponse,
  LmxEmbeddingsRequest,
  LmxEmbeddingsResponse,
  LmxHealthResponse,
  LmxHelpersHealth,
  LmxLoadModelOptions,
  LmxLoadResponse,
  LmxMemoryResponse,
  LmxMetricsSummary,
  LmxModelCompatibilityOptions,
  LmxModelCompatibilityResult,
  LmxModelPerformance,
  LmxModelsResponse,
  LmxAutotuneModelOptions,
  LmxAutotuneModelResult,
  LmxAutotuneRecordOptions,
  LmxAutotuneRecordResult,
  LmxPredictorStats,
  LmxPresetDetailResponse,
  LmxPresetReloadResult,
  LmxPresetsResponse,
  LmxProbeModelOptions,
  LmxProbeModelResult,
  LmxQuantizeJobResult,
  LmxQuantizeJobsResult,
  LmxQuantizeRequest,
  LmxQuantizeStartResult,
  LmxRagCollectionsResult,
  LmxRagContextRequest,
  LmxRagContextResult,
  LmxRagIngestRequest,
  LmxRagIngestResult,
  LmxRagQueryRequest,
  LmxRagQueryResult,
  LmxRequestOptions,
  LmxRerankRequest,
  LmxRerankResponse,
  LmxSessionDeleteResult,
  LmxSessionFull,
  LmxSessionListOptions,
  LmxSessionListResult,
  LmxSessionSearchOptions,
  LmxSessionSummary,
  LmxSkillExecuteRequest,
  LmxSkillExecuteResponse,
  LmxSkillListResult,
  LmxSkillMcpCallRequest,
  LmxSkillMcpCallResponse,
  LmxSkillMcpToolsResult,
  LmxSkillOpenClawInvokeRequest,
  LmxSkillOpenClawInvokeResponse,
  LmxSkillSummary,
  LmxStackResponse,
  LmxStatusResponse,
  LmxDeviceIdentity,
  LmxUnloadResponse,
} from './types.js';

import { LmxApiError } from './types.js';

import type {
  HostAttemptFailure,
  HostCircuitState,
  RawAdminLoadResponse,
  RawAdminModelsResponse,
  RawAdminStatusResponse,
  RawAdminUnloadResponse,
  RawBenchmarkResponse,
  RawDeleteResponse,
  RawDownloadProgressResponse,
  RawDownloadResponse,
  RawModelPerformanceResponse,
} from './helpers.js';

import {
  buildQueryString,
  DEFAULT_BACKOFF_MULTIPLIER,
  DEFAULT_BACKOFF_MS,
  DEFAULT_HOST_FAILURE_COOLDOWN_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  GB_TO_BYTES,
  isAbortFailure,
  lookupContextLimit,
  mapHttpErrorCode,
  parseApiErrorMessage,
  RETRYABLE_HTTP_STATUS,
} from './helpers.js';

// Re-export everything from submodules for backward compatibility.
export * from './types.js';
export { lookupContextLimit } from './helpers.js';

// --- LMX Admin Client ---

export class LmxClient {
  private readonly port: number;
  private readonly hosts: string[];
  private activeHostIndex: number;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly backoffMs: number;
  private readonly backoffMultiplier: number;
  private readonly hostFailureCooldownMs: number;
  private readonly hostCooldownUntilMs: Map<string, number>;

  constructor(opts: {
    host: string;
    fallbackHosts?: string[];
    port: number;
    adminKey?: string;
    apiKey?: string;
    timeoutMs?: number;
    maxRetries?: number;
    backoffMs?: number;
    backoffMultiplier?: number;
  }) {
    this.port = opts.port;
    const hosts = [opts.host, ...(opts.fallbackHosts ?? [])]
      .map((host) => host.trim())
      .filter((host) => host.length > 0);
    const seen = new Set<string>();
    this.hosts = [];
    for (const host of hosts) {
      const key = host.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      this.hosts.push(host);
    }
    if (this.hosts.length === 0) {
      this.hosts.push('localhost');
    }
    this.activeHostIndex = 0;
    this.headers = { 'Content-Type': 'application/json' };
    this.timeoutMs = Math.max(1000, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.maxRetries = Math.max(0, opts.maxRetries ?? DEFAULT_MAX_RETRIES);
    this.backoffMs = Math.max(1, opts.backoffMs ?? DEFAULT_BACKOFF_MS);
    this.backoffMultiplier = Math.max(1, opts.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER);
    this.hostFailureCooldownMs = DEFAULT_HOST_FAILURE_COOLDOWN_MS;
    this.hostCooldownUntilMs = new Map();
    const resolvedApiKey = opts.apiKey?.trim() || process.env['OPTA_API_KEY']?.trim();
    if (resolvedApiKey) {
      this.headers['Authorization'] = `Bearer ${resolvedApiKey}`;
      this.headers['X-Api-Key'] = resolvedApiKey;
    }
    if (opts.adminKey) {
      this.headers['X-Admin-Key'] = opts.adminKey;
    }
  }

  private retryDelayMs(attempt: number): number {
    return Math.round(this.backoffMs * Math.pow(this.backoffMultiplier, attempt));
  }

  private hostKey(host: string): string {
    return host.toLowerCase();
  }

  private clearHostCooldown(host: string): void {
    this.hostCooldownUntilMs.delete(this.hostKey(host));
  }

  private markHostFailure(host: string): void {
    this.hostCooldownUntilMs.set(this.hostKey(host), Date.now() + this.hostFailureCooldownMs);
  }

  private hostIndex(host: string): number {
    return this.hosts.findIndex((candidate) => this.hostKey(candidate) === this.hostKey(host));
  }

  private hostCooldownUntil(host: string): number | undefined {
    return this.hostCooldownUntilMs.get(this.hostKey(host));
  }

  private hostState(host: string, nowMs: number): HostCircuitState {
    const cooldownUntilMs = this.hostCooldownUntil(host);
    if (cooldownUntilMs === undefined) return 'closed';
    if (cooldownUntilMs > nowMs) return 'open';
    return 'half_open';
  }

  private pushUniqueHost(hosts: string[], host: string): void {
    if (!hosts.some((candidate) => this.hostKey(candidate) === this.hostKey(host))) {
      hosts.push(host);
    }
  }

  private hostCandidates(): string[] {
    const nowMs = Date.now();
    const activeHost = this.getActiveHost();
    const activeHostIndex = this.hostIndex(activeHost);
    const states = new Map<string, HostCircuitState>();
    for (const host of this.hosts) {
      states.set(host, this.hostState(host, nowMs));
    }

    const closedHosts = this.hosts.filter((host) => states.get(host) === 'closed');
    const halfOpenHosts = this.hosts.filter((host) => states.get(host) === 'half_open');
    const openHosts = this.hosts.filter((host) => states.get(host) === 'open');

    const candidates: string[] = [];

    // If a more-preferred host has cooled down, probe it first (half-open).
    const preferredProbeHost = halfOpenHosts.find((host) => {
      const index = this.hostIndex(host);
      return index >= 0 && index < activeHostIndex;
    });
    if (preferredProbeHost) {
      this.pushUniqueHost(candidates, preferredProbeHost);
    }

    if (states.get(activeHost) !== 'open') {
      this.pushUniqueHost(candidates, activeHost);
    }

    for (const host of closedHosts) {
      this.pushUniqueHost(candidates, host);
    }

    for (const host of halfOpenHosts) {
      this.pushUniqueHost(candidates, host);
    }

    if (candidates.length > 0) return candidates;

    // All hosts are cooling down: probe the one closest to leaving cooldown first.
    const coolingHostsByExpiry = [...openHosts].sort((a, b) => {
      const aCooldownUntil = this.hostCooldownUntil(a) ?? Number.MAX_SAFE_INTEGER;
      const bCooldownUntil = this.hostCooldownUntil(b) ?? Number.MAX_SAFE_INTEGER;
      if (aCooldownUntil !== bCooldownUntil) {
        return aCooldownUntil - bCooldownUntil;
      }
      return this.hostIndex(a) - this.hostIndex(b);
    });
    return coolingHostsByExpiry.length > 0 ? coolingHostsByExpiry : [...this.hosts];
  }

  private setActiveHost(host: string): void {
    const index = this.hostIndex(host);
    if (index >= 0) {
      this.activeHostIndex = index;
    }
  }

  getActiveHost(): string {
    return this.hosts[this.activeHostIndex] ?? this.hosts[0]!;
  }

  getConfiguredHosts(): readonly string[] {
    return [...this.hosts];
  }

  private async fetch<T>(
    path: string,
    init?: RequestInit,
    validator?: ZodType<T>,
    requestOptions?: LmxRequestOptions
  ): Promise<T> {
    const timeoutMs = Math.max(1000, requestOptions?.timeoutMs ?? this.timeoutMs);
    const maxRetries = Math.max(0, requestOptions?.maxRetries ?? this.maxRetries);
    const attempts = maxRetries + 1;
    const initHeaders: Record<string, string> =
      init?.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : Array.isArray(init?.headers)
          ? Object.fromEntries(init.headers)
          : ((init?.headers as Record<string, string> | undefined) ?? {});
    const headers = { ...this.headers, ...initHeaders };
    const hostFailures: HostAttemptFailure[] = [];

    for (const host of this.hostCandidates()) {
      const url = `http://${host}:${this.port}${path}`;
      debug(`LMX ${init?.method ?? 'GET'} ${url}`);
      let hostFailure: string | null = null;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        let response: Response;
        const timeoutSignal = AbortSignal.timeout(timeoutMs);
        const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
        try {
          response = await fetch(url, {
            ...init,
            headers,
            signal,
          });
        } catch (err) {
          const method = (init?.method ?? 'GET').toUpperCase();
          const idempotentMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
          const timedOut = isAbortFailure(err);
          const retryable = timedOut ? idempotentMethod : true;
          if (retryable && attempt < attempts - 1) {
            await sleep(this.retryDelayMs(attempt));
            continue;
          }
          const message = timedOut
            ? `request timed out after ${Math.round(timeoutMs / 1000)}s`
            : errorMessage(err);
          hostFailure = message;
          break;
        }

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          const code = mapHttpErrorCode(response.status);
          const message = parseApiErrorMessage(body, response.statusText);
          if (RETRYABLE_HTTP_STATUS.has(response.status) && attempt < attempts - 1) {
            await sleep(this.retryDelayMs(attempt));
            continue;
          }
          if (RETRYABLE_HTTP_STATUS.has(response.status)) {
            hostFailure = `HTTP ${response.status} ${message}`;
            break;
          }
          throw new LmxApiError(response.status, code, `${host}: ${message}`);
        }

        const data: unknown = await response.json();
        this.clearHostCooldown(host);
        this.setActiveHost(host);
        if (validator) return validator.parse(data);
        return data as T;
      }

      if (hostFailure) {
        this.markHostFailure(host);
        hostFailures.push({ host, detail: hostFailure });
      }
    }

    if (hostFailures.length > 0) {
      const summary = hostFailures.map((entry) => `${entry.host} -> ${entry.detail}`).join('; ');
      throw new LmxApiError(
        0,
        'connection_error',
        `LMX request failed across ${hostFailures.length} host${hostFailures.length === 1 ? '' : 's'}: ${summary}`
      );
    }
    throw new LmxApiError(0, 'connection_error', 'request failed after retries');
  }

  async health(opts?: LmxRequestOptions): Promise<LmxHealthResponse> {
    return this.fetch<LmxHealthResponse>('/healthz', undefined, undefined, opts);
  }

  async status(opts?: LmxRequestOptions): Promise<LmxStatusResponse> {
    const raw = await this.fetch<RawAdminStatusResponse>(
      '/admin/status',
      undefined,
      undefined,
      opts
    );
    return {
      status: 'ok',
      version: raw.version,
      uptime_seconds: raw.uptime_seconds,
      models: raw.models.map((id) => ({
        model_id: id,
        status: 'loaded' as const,
      })),
      memory: raw.memory
        ? {
            used_bytes: raw.memory.used_gb * GB_TO_BYTES,
            total_bytes: raw.memory.total_gb * GB_TO_BYTES,
            threshold: raw.memory.threshold_percent,
          }
        : undefined,
    };
  }

  async models(opts?: LmxRequestOptions): Promise<LmxModelsResponse> {
    const raw = await this.fetch<RawAdminModelsResponse>(
      '/admin/models',
      undefined,
      undefined,
      opts
    );
    return {
      models: raw.loaded.map((m) => ({
        model_id: m.id,
        status: 'loaded' as const,
        memory_bytes: m.memory_gb ? m.memory_gb * GB_TO_BYTES : undefined,
        context_length: m.context_length ?? lookupContextLimit(m.id),
        loaded_at: m.loaded_at ? new Date(m.loaded_at * 1000).toISOString() : undefined,
        request_count: m.request_count,
      })),
    };
  }

  private normalizeLoadResponse(raw: RawAdminLoadResponse): LmxLoadResponse {
    const status =
      raw.status === 'download_required' || raw.status === 'downloading' ? raw.status : 'loaded';
    return {
      model_id: raw.model_id,
      status,
      memory_bytes: raw.memory_after_load_gb ? raw.memory_after_load_gb * GB_TO_BYTES : undefined,
      load_time_seconds: raw.time_to_load_ms ? raw.time_to_load_ms / 1000 : undefined,
      estimated_size_bytes: raw.estimated_size_bytes,
      estimated_size_human: raw.estimated_size_human,
      confirmation_token: raw.confirmation_token,
      download_id: raw.download_id,
      message: raw.message,
      confirm_url: raw.confirm_url,
      progress_url: raw.progress_url,
    };
  }

  async loadModel(modelId: string, opts?: LmxLoadModelOptions): Promise<LmxLoadResponse> {
    const raw = await this.fetch<RawAdminLoadResponse>(
      '/admin/models/load',
      {
        method: 'POST',
        body: JSON.stringify({
          model_id: modelId,
          backend: opts?.backend,
          auto_download: opts?.autoDownload,
          performance_overrides: opts?.performanceOverrides,
          keep_alive_sec: opts?.keepAliveSec,
          allow_unsupported_runtime: opts?.allowUnsupportedRuntime,
        }),
      },
      undefined,
      {
        timeoutMs: opts?.timeoutMs,
        maxRetries: opts?.maxRetries,
      }
    );
    return this.normalizeLoadResponse(raw);
  }

  async confirmLoad(confirmationToken: string, opts?: LmxRequestOptions): Promise<LmxLoadResponse> {
    const raw = await this.fetch<RawAdminLoadResponse>(
      '/admin/models/load/confirm',
      {
        method: 'POST',
        body: JSON.stringify({
          confirmation_token: confirmationToken,
        }),
      },
      undefined,
      opts
    );
    return this.normalizeLoadResponse(raw);
  }

  async unloadModel(
    modelId: string,
    opts?: { timeoutMs?: number; maxRetries?: number }
  ): Promise<LmxUnloadResponse> {
    const raw = await this.fetch<RawAdminUnloadResponse>(
      '/admin/models/unload',
      {
        method: 'POST',
        body: JSON.stringify({ model_id: modelId }),
      },
      undefined,
      {
        timeoutMs: opts?.timeoutMs,
        maxRetries: opts?.maxRetries,
      }
    );
    return {
      model_id: raw.model_id,
      status: 'unloaded',
      freed_bytes: raw.memory_freed_gb ? raw.memory_freed_gb * GB_TO_BYTES : undefined,
    };
  }

  async available(opts?: LmxRequestOptions): Promise<LmxAvailableModel[]> {
    return this.fetch<LmxAvailableModel[]>('/admin/models/available', undefined, undefined, opts);
  }

  async presets(opts?: LmxRequestOptions): Promise<LmxPresetsResponse> {
    return this.fetch<LmxPresetsResponse>('/admin/presets', undefined, undefined, opts);
  }

  async presetDetail(
    name: string,
    requestOptions?: LmxRequestOptions
  ): Promise<LmxPresetDetailResponse> {
    return this.fetch<LmxPresetDetailResponse>(
      `/admin/presets/${encodeURIComponent(name)}`,
      undefined,
      undefined,
      requestOptions
    );
  }

  async reloadPresets(requestOptions?: LmxRequestOptions): Promise<LmxPresetReloadResult> {
    return this.fetch<LmxPresetReloadResult>(
      '/admin/presets/reload',
      { method: 'POST' },
      undefined,
      requestOptions
    );
  }

  async stack(opts?: LmxRequestOptions): Promise<LmxStackResponse> {
    return this.fetch<LmxStackResponse>('/admin/stack', undefined, undefined, opts);
  }

  async memory(opts?: LmxRequestOptions): Promise<LmxMemoryResponse> {
    return this.fetch<LmxMemoryResponse>('/admin/memory', undefined, undefined, opts);
  }

  async downloadModel(
    repoId: string,
    opts?: { revision?: string; allowPatterns?: string[]; ignorePatterns?: string[] }
  ): Promise<LmxDownloadResponse> {
    const raw = await this.fetch<RawDownloadResponse>('/admin/models/download', {
      method: 'POST',
      body: JSON.stringify({
        repo_id: repoId,
        revision: opts?.revision,
        allow_patterns: opts?.allowPatterns,
        ignore_patterns: opts?.ignorePatterns,
      }),
    });
    return {
      downloadId: raw.download_id,
      repoId: raw.repo_id,
      estimatedSizeBytes: raw.estimated_size_bytes,
      status: raw.status,
    };
  }

  async downloadProgress(downloadId: string): Promise<LmxDownloadProgress> {
    const raw = await this.fetch<RawDownloadProgressResponse>(
      `/admin/models/download/${encodeURIComponent(downloadId)}/progress`
    );
    return {
      downloadId: raw.download_id,
      repoId: raw.repo_id,
      status: raw.status as LmxDownloadProgress['status'],
      progressPercent: raw.progress_percent,
      downloadedBytes: raw.downloaded_bytes,
      totalBytes: raw.total_bytes,
      filesCompleted: raw.files_completed,
      filesTotal: raw.files_total,
      error: raw.error,
    };
  }

  async deleteModel(modelId: string): Promise<LmxDeleteResponse> {
    const raw = await this.fetch<RawDeleteResponse>(
      `/admin/models/${encodeURIComponent(modelId)}`,
      { method: 'DELETE' }
    );
    return {
      modelId: raw.model_id,
      freedBytes: raw.freed_bytes,
    };
  }

  async modelPerformance(modelId: string): Promise<LmxModelPerformance> {
    const raw = await this.fetch<RawModelPerformanceResponse>(
      `/admin/models/${encodeURIComponent(modelId)}/performance`
    );
    return {
      modelId: raw.model_id,
      backendType: raw.backend_type,
      loadedAt: new Date(raw.loaded_at * 1000).toISOString(),
      requestCount: raw.request_count,
      lastUsedAt: raw.last_used_at ? new Date(raw.last_used_at * 1000).toISOString() : undefined,
      memoryGb: raw.memory_gb,
      contextLength: raw.context_length,
      useBatching: raw.use_batching,
      performanceOverrides: raw.performance ?? {},
      globalDefaults: raw.global_defaults ?? {},
    };
  }

  async probeModel(
    opts: LmxProbeModelOptions,
    requestOptions?: LmxRequestOptions
  ): Promise<LmxProbeModelResult> {
    return this.fetch<LmxProbeModelResult>(
      '/admin/models/probe',
      {
        method: 'POST',
        body: JSON.stringify({
          model_id: opts.modelId,
          timeout_sec: opts.timeoutSec,
          allow_unsupported_runtime: opts.allowUnsupportedRuntime,
        }),
      },
      undefined,
      requestOptions
    );
  }

  async modelCompatibility(
    opts: LmxModelCompatibilityOptions = {},
    requestOptions?: LmxRequestOptions
  ): Promise<LmxModelCompatibilityResult> {
    return this.fetch<LmxModelCompatibilityResult>(
      `/admin/models/compatibility${buildQueryString({
        model_id: opts.modelId,
        backend: opts.backend,
        outcome: opts.outcome,
        since_ts: opts.sinceTs,
        limit: opts.limit,
        include_summary: opts.includeSummary,
      })}`,
      undefined,
      undefined,
      requestOptions
    );
  }

  async autotuneModel(
    opts: LmxAutotuneModelOptions,
    requestOptions?: LmxRequestOptions
  ): Promise<LmxAutotuneModelResult> {
    return this.fetch<LmxAutotuneModelResult>(
      '/admin/models/autotune',
      {
        method: 'POST',
        body: JSON.stringify({
          model_id: opts.modelId,
          prompt: opts.prompt,
          max_tokens: opts.maxTokens,
          temperature: opts.temperature,
          runs: opts.runs,
          profiles: opts.profiles,
          allow_unsupported_runtime: opts.allowUnsupportedRuntime,
        }),
      },
      undefined,
      requestOptions
    );
  }

  async autotuneRecord(
    modelId: string,
    opts?: LmxAutotuneRecordOptions,
    requestOptions?: LmxRequestOptions
  ): Promise<LmxAutotuneRecordResult> {
    return this.fetch<LmxAutotuneRecordResult>(
      `/admin/models/${encodeURIComponent(modelId)}/autotune${buildQueryString({
        backend: opts?.backend,
        backend_version: opts?.backendVersion,
      })}`,
      undefined,
      undefined,
      requestOptions
    );
  }

  async metricsJson(opts?: LmxRequestOptions): Promise<LmxMetricsSummary> {
    return this.fetch<LmxMetricsSummary>('/admin/metrics/json', undefined, undefined, opts);
  }

  async reloadConfig(opts?: LmxRequestOptions): Promise<LmxConfigReloadResult> {
    return this.fetch<LmxConfigReloadResult>(
      '/admin/config/reload',
      { method: 'POST' },
      undefined,
      opts
    );
  }

  async quantizeStart(
    request: LmxQuantizeRequest,
    opts?: LmxRequestOptions
  ): Promise<LmxQuantizeStartResult> {
    return this.fetch<LmxQuantizeStartResult>(
      '/admin/quantize',
      {
        method: 'POST',
        body: JSON.stringify({
          source_model: request.sourceModel,
          output_path: request.outputPath,
          bits: request.bits,
          group_size: request.groupSize,
          mode: request.mode,
        }),
      },
      undefined,
      opts
    );
  }

  async quantizeStatus(jobId: string, opts?: LmxRequestOptions): Promise<LmxQuantizeJobResult> {
    return this.fetch<LmxQuantizeJobResult>(
      `/admin/quantize/${encodeURIComponent(jobId)}`,
      undefined,
      undefined,
      opts
    );
  }

  async quantizeJobs(opts?: LmxRequestOptions): Promise<LmxQuantizeJobsResult> {
    return this.fetch<LmxQuantizeJobsResult>('/admin/quantize', undefined, undefined, opts);
  }

  async predictorStats(opts?: LmxRequestOptions): Promise<LmxPredictorStats> {
    return this.fetch<LmxPredictorStats>('/admin/predictor', undefined, undefined, opts);
  }

  async helpersHealth(opts?: LmxRequestOptions): Promise<LmxHelpersHealth> {
    return this.fetch<LmxHelpersHealth>('/admin/helpers', undefined, undefined, opts);
  }

  async listSessions(
    opts: LmxSessionListOptions = {},
    requestOptions?: LmxRequestOptions
  ): Promise<LmxSessionListResult> {
    return this.fetch<LmxSessionListResult>(
      `/admin/sessions${buildQueryString({
        limit: opts.limit,
        offset: opts.offset,
        model: opts.model,
        tag: opts.tag,
        since: opts.since,
      })}`,
      undefined,
      undefined,
      requestOptions
    );
  }

  async searchSessions(
    opts: LmxSessionSearchOptions,
    requestOptions?: LmxRequestOptions
  ): Promise<LmxSessionSummary[]> {
    return this.fetch<LmxSessionSummary[]>(
      `/admin/sessions/search${buildQueryString({
        q: opts.query,
        limit: opts.limit,
      })}`,
      undefined,
      undefined,
      requestOptions
    );
  }

  async getSession(sessionId: string, opts?: LmxRequestOptions): Promise<LmxSessionFull> {
    return this.fetch<LmxSessionFull>(
      `/admin/sessions/${encodeURIComponent(sessionId)}`,
      undefined,
      undefined,
      opts
    );
  }

  async deleteSession(
    sessionId: string,
    opts?: LmxRequestOptions
  ): Promise<LmxSessionDeleteResult> {
    return this.fetch<LmxSessionDeleteResult>(
      `/admin/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'DELETE' },
      undefined,
      opts
    );
  }

  async createEmbeddings(
    request: LmxEmbeddingsRequest,
    opts?: LmxRequestOptions
  ): Promise<LmxEmbeddingsResponse> {
    return this.fetch<LmxEmbeddingsResponse>(
      '/v1/embeddings',
      {
        method: 'POST',
        body: JSON.stringify({
          input: request.input,
          model: request.model,
          encoding_format: request.encodingFormat,
        }),
      },
      undefined,
      opts
    );
  }

  async rerankDocuments(
    request: LmxRerankRequest,
    opts?: LmxRequestOptions
  ): Promise<LmxRerankResponse> {
    return this.fetch<LmxRerankResponse>(
      '/v1/rerank',
      {
        method: 'POST',
        body: JSON.stringify({
          model: request.model,
          query: request.query,
          documents: request.documents,
          top_n: request.topN,
        }),
      },
      undefined,
      opts
    );
  }

  async runBenchmarkAndPersist(
    request: LmxBenchmarkPersistRequest,
    opts?: LmxRequestOptions
  ): Promise<LmxBenchmarkPersistResult> {
    return this.fetch<LmxBenchmarkPersistResult>(
      '/admin/benchmark/run',
      {
        method: 'POST',
        body: JSON.stringify({
          model_id: request.modelId,
          prompt: request.prompt,
          num_output_tokens: request.numOutputTokens,
          runs: request.runs,
          temperature: request.temperature,
          warmup_runs: request.warmupRuns,
        }),
      },
      undefined,
      {
        timeoutMs: opts?.timeoutMs ?? 180_000,
        maxRetries: opts?.maxRetries ?? 0,
      }
    );
  }

  async listBenchmarkResults(
    opts: LmxBenchmarkResultsOptions = {},
    requestOptions?: LmxRequestOptions
  ): Promise<LmxBenchmarkPersistResult[]> {
    return this.fetch<LmxBenchmarkPersistResult[]>(
      `/admin/benchmark/results${buildQueryString({
        model_id: opts.modelId,
      })}`,
      undefined,
      undefined,
      requestOptions
    );
  }

  async anthropicMessages(
    request: LmxAnthropicMessagesRequest,
    opts?: LmxRequestOptions
  ): Promise<LmxAnthropicMessagesResponse> {
    return this.fetch<LmxAnthropicMessagesResponse>(
      '/v1/messages',
      {
        method: 'POST',
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          max_tokens: request.maxTokens,
          system: request.system,
          temperature: request.temperature,
          top_p: request.topP,
          stream: request.stream,
          stop_sequences: request.stopSequences,
        }),
      },
      undefined,
      opts
    );
  }

  async agentRuns(
    opts: { limit?: number; offset?: number; status?: string } = {},
    requestOptions?: LmxRequestOptions
  ): Promise<LmxAgentRunListResult> {
    return this.fetch<LmxAgentRunListResult>(
      `/v1/agents/runs${buildQueryString({
        limit: opts.limit,
        offset: opts.offset,
        status: opts.status,
      })}`,
      undefined,
      undefined,
      requestOptions
    );
  }

  async createAgentRun(
    payload: LmxAgentRunCreatePayload,
    requestOptions?: LmxRequestOptions & { idempotencyKey?: string }
  ): Promise<LmxAgentRunResult> {
    const idempotencyKey = requestOptions?.idempotencyKey?.trim();
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined;
    const opts: LmxRequestOptions | undefined = requestOptions
      ? { timeoutMs: requestOptions.timeoutMs, maxRetries: requestOptions.maxRetries }
      : undefined;
    return this.fetch<LmxAgentRunResult>(
      '/v1/agents/runs',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          request: payload.request,
          agent: payload.agent,
          input: payload.input,
          metadata: payload.metadata,
        }),
      },
      undefined,
      opts
    );
  }

  async agentRun(runId: string, opts?: LmxRequestOptions): Promise<LmxAgentRunResult> {
    return this.fetch<LmxAgentRunResult>(
      `/v1/agents/runs/${encodeURIComponent(runId)}`,
      undefined,
      undefined,
      opts
    );
  }

  async cancelAgentRun(runId: string, opts?: LmxRequestOptions): Promise<LmxAgentRunResult> {
    return this.fetch<LmxAgentRunResult>(
      `/v1/agents/runs/${encodeURIComponent(runId)}/cancel`,
      { method: 'POST' },
      undefined,
      opts
    );
  }

  async skillsList(
    opts: { latestOnly?: boolean } = {},
    requestOptions?: LmxRequestOptions
  ): Promise<LmxSkillListResult> {
    return this.fetch<LmxSkillListResult>(
      `/v1/skills${buildQueryString({
        latest_only: opts.latestOnly,
      })}`,
      undefined,
      undefined,
      requestOptions
    );
  }

  async skillDetail(skillName: string, opts?: LmxRequestOptions): Promise<LmxSkillSummary> {
    return this.fetch<LmxSkillSummary>(
      `/v1/skills/${encodeURIComponent(skillName)}`,
      undefined,
      undefined,
      opts
    );
  }

  async skillMcpTools(opts?: LmxRequestOptions): Promise<LmxSkillMcpToolsResult> {
    return this.fetch<LmxSkillMcpToolsResult>('/v1/skills/mcp/tools', undefined, undefined, opts);
  }

  async skillExecute(
    skillName: string,
    request: LmxSkillExecuteRequest,
    opts?: LmxRequestOptions
  ): Promise<LmxSkillExecuteResponse> {
    return this.fetch<LmxSkillExecuteResponse>(
      `/v1/skills/${encodeURIComponent(skillName)}/execute`,
      {
        method: 'POST',
        body: JSON.stringify({
          arguments: request.arguments,
          approved: request.approved,
          timeout_sec: request.timeoutSec,
        }),
      },
      undefined,
      opts
    );
  }

  async skillMcpCall(
    request: LmxSkillMcpCallRequest,
    opts?: LmxRequestOptions
  ): Promise<LmxSkillMcpCallResponse> {
    return this.fetch<LmxSkillMcpCallResponse>(
      '/v1/skills/mcp/call',
      {
        method: 'POST',
        body: JSON.stringify({
          name: request.name,
          arguments: request.arguments,
          approved: request.approved,
        }),
      },
      undefined,
      opts
    );
  }

  async skillOpenClawInvoke(
    request: LmxSkillOpenClawInvokeRequest,
    opts?: LmxRequestOptions
  ): Promise<LmxSkillOpenClawInvokeResponse> {
    return this.fetch<LmxSkillOpenClawInvokeResponse>(
      '/v1/skills/openclaw/invoke',
      {
        method: 'POST',
        body: JSON.stringify({
          name: request.name,
          tool: request.tool,
          tool_name: request.toolName,
          arguments: request.arguments,
          input: request.input,
          params: request.params,
          approved: request.approved,
          timeout_sec: request.timeoutSec,
        }),
      },
      undefined,
      opts
    );
  }

  async ragCollections(opts?: LmxRequestOptions): Promise<LmxRagCollectionsResult> {
    return this.fetch<LmxRagCollectionsResult>('/v1/rag/collections', undefined, undefined, opts);
  }

  async ragDeleteCollection(
    collection: string,
    opts?: LmxRequestOptions
  ): Promise<Record<string, never>> {
    return this.fetch<Record<string, never>>(
      `/v1/rag/collections/${encodeURIComponent(collection)}`,
      { method: 'DELETE' },
      undefined,
      opts
    );
  }

  async ragQuery(
    request: LmxRagQueryRequest,
    opts?: LmxRequestOptions
  ): Promise<LmxRagQueryResult> {
    return this.fetch<LmxRagQueryResult>(
      '/v1/rag/query',
      {
        method: 'POST',
        body: JSON.stringify({
          collection: request.collection,
          query: request.query,
          top_k: request.topK,
          min_score: request.minScore,
          model: request.model,
          include_embeddings: request.includeEmbeddings,
          search_mode: request.searchMode,
          rerank: request.rerank,
          rerank_top_k: request.rerankTopK,
        }),
      },
      undefined,
      opts
    );
  }

  async ragIngest(
    request: LmxRagIngestRequest,
    opts?: LmxRequestOptions
  ): Promise<LmxRagIngestResult> {
    return this.fetch<LmxRagIngestResult>(
      '/v1/rag/ingest',
      {
        method: 'POST',
        body: JSON.stringify({
          collection: request.collection,
          documents: request.documents,
          metadata: request.metadata,
          chunk_size: request.chunkSize,
          chunk_overlap: request.chunkOverlap,
          chunking: request.chunking,
          model: request.model,
        }),
      },
      undefined,
      opts
    );
  }

  async ragContext(
    request: LmxRagContextRequest,
    opts?: LmxRequestOptions
  ): Promise<LmxRagContextResult> {
    return this.fetch<LmxRagContextResult>(
      '/v1/rag/context',
      {
        method: 'POST',
        body: JSON.stringify({
          query: request.query,
          collections: request.collections,
          top_k_per_collection: request.topKPerCollection,
          min_score: request.minScore,
          max_context_tokens: request.maxContextTokens,
          model: request.model,
          rerank: request.rerank,
        }),
      },
      undefined,
      opts
    );
  }


  async device(opts?: LmxRequestOptions): Promise<LmxDeviceIdentity | null> {
    try {
      return await this.fetch<LmxDeviceIdentity>('/admin/device', undefined, undefined, opts);
    } catch {
      return null;
    }
  }

  async benchmarkModel(
    modelId: string,
    opts?: { prompt?: string; maxTokens?: number; runs?: number; temperature?: number }
  ): Promise<LmxBenchmarkResult> {
    const raw = await this.fetch<RawBenchmarkResponse>(
      '/admin/benchmark',
      {
        method: 'POST',
        body: JSON.stringify({
          model_id: modelId,
          prompt: opts?.prompt ?? 'Hello! Please write a short paragraph about the nature of time.',
          max_tokens: opts?.maxTokens ?? 128,
          runs: opts?.runs ?? 3,
          temperature: opts?.temperature ?? 0.0,
        }),
      },
      undefined,
      {
        // Benchmarks can legitimately run much longer than normal admin requests.
        timeoutMs: 180_000,
        maxRetries: 0,
      }
    );
    return {
      modelId: raw.model_id,
      backendType: raw.backend_type,
      prompt: raw.prompt,
      maxTokens: raw.max_tokens,
      runs: raw.runs,
      results: raw.results.map((r) => ({
        run: r.run,
        tokensGenerated: r.tokens_generated,
        timeToFirstTokenMs: r.time_to_first_token_ms,
        totalTimeMs: r.total_time_ms,
        tokensPerSecond: r.tokens_per_second,
      })),
      avgTokensPerSecond: raw.avg_tokens_per_second,
      avgTimeToFirstTokenMs: raw.avg_time_to_first_token_ms,
      avgTotalTimeMs: raw.avg_total_time_ms,
    };
  }
}
