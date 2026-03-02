import type {
  BackgroundSignal,
  ClientSubmitTurn,
  CreateSessionRequest,
  PermissionDecision,
  SessionSnapshot,
} from '@opta/protocol-shared';
import type {
  DaemonBackgroundKillResponse,
  DaemonBackgroundListResponse,
  DaemonLmxAvailableModel,
  DaemonLmxDiscoveryResponse,
  DaemonLmxDownloadResponse,
  DaemonLmxDownloadProgressResponse,
  DaemonLmxLoadOptions,
  DaemonLmxLoadResponse,
  DaemonLmxMemoryResponse,
  DaemonLmxModelDetail,
  DaemonLmxStatusResponse,
  DaemonListOperationsResponse,
  DaemonOperationRequestPayload,
  DaemonOperationPayload,
  DaemonRunOperationResponse,
  DaemonBackgroundOutputOptions,
  DaemonBackgroundOutputResponse,
  DaemonBackgroundStartRequest,
  DaemonBackgroundStatusResponse,
  DaemonCancelResponse,
  DaemonConnectionOptions,
  DaemonEventsResponse,
  DaemonHealthResponse,
  DaemonHttpApi,
  DaemonMetricsResponse,
  DaemonPermissionResponse,
  DaemonSessionDetail,
  DaemonSubmitTurnResponse,
} from './types.js';

function baseUrl(connection: DaemonConnectionOptions): string {
  const protocol = connection.protocol ?? 'http';
  return `${protocol}://${connection.host}:${connection.port}`;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;
const BACKGROUND_OUTPUT_TIMEOUT_MS = 20_000;
const LMX_READ_TIMEOUT_MS = 30_000;
const LMX_MUTATION_TIMEOUT_MS = 120_000;

interface RequestOptions {
  timeoutMs?: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function normalizeCancelResponse(raw: unknown): DaemonCancelResponse {
  const parsed = asRecord(raw);
  if (!parsed) {
    return { cancelled: 0 };
  }

  const cancelled = typeof parsed.cancelled === 'number' ? parsed.cancelled : undefined;
  const cancelledQueued =
    typeof parsed.cancelledQueued === 'number' ? parsed.cancelledQueued : undefined;
  const cancelledActive =
    typeof parsed.cancelledActive === 'boolean' ? parsed.cancelledActive : undefined;

  return {
    cancelled: cancelled ?? (cancelledQueued ?? 0) + (cancelledActive ? 1 : 0),
    ok: typeof parsed.ok === 'boolean' ? parsed.ok : undefined,
    cancelledQueued,
    cancelledActive,
  };
}

function normalizeAvailableModel(raw: unknown): DaemonLmxAvailableModel | null {
  const parsed = asRecord(raw);
  if (!parsed) return null;

  const modelId =
    typeof parsed.model_id === 'string'
      ? parsed.model_id
      : typeof parsed.repo_id === 'string'
        ? parsed.repo_id
        : null;
  if (!modelId) return null;

  const repoId = typeof parsed.repo_id === 'string' ? parsed.repo_id : modelId;

  return {
    model_id: modelId,
    repo_id: repoId,
    size_bytes: typeof parsed.size_bytes === 'number' ? parsed.size_bytes : undefined,
    quantization: typeof parsed.quantization === 'string' ? parsed.quantization : undefined,
    modified_at: typeof parsed.modified_at === 'string' ? parsed.modified_at : undefined,
    local_path: typeof parsed.local_path === 'string' ? parsed.local_path : undefined,
    downloaded_at: typeof parsed.downloaded_at === 'number' ? parsed.downloaded_at : undefined,
  };
}

export class DaemonHttpClient implements DaemonHttpApi {
  constructor(
    private readonly connection: DaemonConnectionOptions,
    // Call through globalThis each time to avoid "Illegal invocation" from detached window.fetch.
    private readonly fetchImpl: typeof fetch = (input, init) =>
      globalThis.fetch(input, init)
  ) {}

  private async request<T>(
    path: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.connection.token}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

    const controller = new AbortController();
    const upstreamSignal = init.signal;
    let timedOut = false;
    let onAbort: (() => void) | undefined;
    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        controller.abort();
      } else {
        onAbort = () => controller.abort();
        upstreamSignal.addEventListener('abort', onAbort, { once: true });
      }
    }
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${baseUrl(this.connection)}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) {
        throw new Error(`Daemon request timed out (${timeoutMs}ms): ${path}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (upstreamSignal && onAbort) {
        upstreamSignal.removeEventListener('abort', onAbort);
      }
    }

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(
        `Daemon request failed (${response.status}): ${message || response.statusText}`
      );
    }

    return response.json() as Promise<T>;
  }

  health(): Promise<DaemonHealthResponse> {
    return this.request('/v3/health');
  }

  metrics(): Promise<DaemonMetricsResponse> {
    return this.request('/v3/metrics');
  }

  createSession(req: CreateSessionRequest): Promise<SessionSnapshot> {
    return this.request('/v3/sessions', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  getSession(sessionId: string): Promise<DaemonSessionDetail> {
    return this.request(`/v3/sessions/${encodeURIComponent(sessionId)}`);
  }

  submitTurn(sessionId: string, payload: ClientSubmitTurn): Promise<DaemonSubmitTurnResponse> {
    return this.request(`/v3/sessions/${encodeURIComponent(sessionId)}/turns`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  cancel(
    sessionId: string,
    payload: { turnId?: string; writerId?: string } = {}
  ): Promise<DaemonCancelResponse> {
    return this.request<unknown>(`/v3/sessions/${encodeURIComponent(sessionId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(normalizeCancelResponse);
  }

  resolvePermission(
    sessionId: string,
    payload: PermissionDecision
  ): Promise<DaemonPermissionResponse> {
    const safeSessionId = encodeURIComponent(sessionId);
    const safeRequestId = encodeURIComponent(payload.requestId);
    return this.request(`/v3/sessions/${safeSessionId}/permissions/${safeRequestId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  events(sessionId: string, afterSeq = 0): Promise<DaemonEventsResponse> {
    const query = new URLSearchParams({ afterSeq: String(afterSeq) });
    return this.request(`/v3/sessions/${encodeURIComponent(sessionId)}/events?${query.toString()}`);
  }

  listOperations(): Promise<DaemonListOperationsResponse> {
    return this.request('/v3/operations');
  }

  runOperation<TPayload extends DaemonOperationPayload = DaemonOperationPayload, TResult = unknown>(
    id: string,
    payload?: DaemonOperationRequestPayload<TPayload>
  ): Promise<DaemonRunOperationResponse<TResult>> {
    return this.request(`/v3/operations/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    });
  }

  listBackground(sessionId?: string): Promise<DaemonBackgroundListResponse> {
    const query = new URLSearchParams();
    if (sessionId) query.set('sessionId', sessionId);
    const suffix = query.toString();
    return this.request(`/v3/background${suffix ? `?${suffix}` : ''}`);
  }

  startBackground(payload: DaemonBackgroundStartRequest): Promise<DaemonBackgroundStatusResponse> {
    return this.request('/v3/background/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  backgroundStatus(processId: string, sessionId?: string): Promise<DaemonBackgroundStatusResponse> {
    const query = new URLSearchParams();
    if (sessionId) query.set('sessionId', sessionId);
    const suffix = query.toString();
    return this.request(
      `/v3/background/${encodeURIComponent(processId)}/status${suffix ? `?${suffix}` : ''}`
    );
  }

  backgroundOutput(
    processId: string,
    options: DaemonBackgroundOutputOptions = {}
  ): Promise<DaemonBackgroundOutputResponse> {
    const query = new URLSearchParams();
    if (options.afterSeq !== undefined) query.set('afterSeq', String(options.afterSeq));
    if (options.limit !== undefined) query.set('limit', String(options.limit));
    if (options.stream !== undefined) query.set('stream', options.stream);
    const suffix = query.toString();
    return this.request(
      `/v3/background/${encodeURIComponent(processId)}/output${suffix ? `?${suffix}` : ''}`,
      {},
      { timeoutMs: BACKGROUND_OUTPUT_TIMEOUT_MS },
    );
  }

  killBackground(
    processId: string,
    signal?: BackgroundSignal
  ): Promise<DaemonBackgroundKillResponse> {
    return this.request(`/v3/background/${encodeURIComponent(processId)}/kill`, {
      method: 'POST',
      body: JSON.stringify(signal ? { signal } : {}),
    });
  }

  lmxStatus(): Promise<DaemonLmxStatusResponse> {
    return this.request('/v3/lmx/status', {}, { timeoutMs: LMX_READ_TIMEOUT_MS });
  }

  lmxDiscovery(): Promise<DaemonLmxDiscoveryResponse> {
    return this.request('/v3/lmx/discovery', {}, { timeoutMs: LMX_READ_TIMEOUT_MS });
  }

  lmxModels(): Promise<{ models: DaemonLmxModelDetail[] }> {
    return this.request('/v3/lmx/models', {}, { timeoutMs: LMX_READ_TIMEOUT_MS });
  }

  lmxMemory(): Promise<DaemonLmxMemoryResponse> {
    return this.request('/v3/lmx/memory', {}, { timeoutMs: LMX_READ_TIMEOUT_MS });
  }

  lmxAvailable(): Promise<DaemonLmxAvailableModel[]> {
    return this.request<unknown[]>('/v3/lmx/models/available', {}, { timeoutMs: LMX_READ_TIMEOUT_MS })
      .then((available) => available.map(normalizeAvailableModel).filter(Boolean) as DaemonLmxAvailableModel[]);
  }

  lmxLoad(modelId: string, opts?: DaemonLmxLoadOptions): Promise<DaemonLmxLoadResponse> {
    return this.request('/v3/lmx/models/load', {
      method: 'POST',
      body: JSON.stringify({ modelId, ...opts }),
    }, { timeoutMs: LMX_MUTATION_TIMEOUT_MS });
  }

  lmxConfirmLoad(confirmationToken: string): Promise<DaemonLmxLoadResponse> {
    return this.request('/v3/lmx/models/load/confirm', {
      method: 'POST',
      body: JSON.stringify({ confirmationToken }),
    }, { timeoutMs: LMX_MUTATION_TIMEOUT_MS });
  }

  lmxDownloadProgress(downloadId: string): Promise<DaemonLmxDownloadProgressResponse> {
    return this.request(
      `/v3/lmx/models/download/${encodeURIComponent(downloadId)}/progress`,
      {},
      { timeoutMs: LMX_READ_TIMEOUT_MS },
    );
  }

  lmxUnload(modelId: string): Promise<unknown> {
    return this.request('/v3/lmx/models/unload', {
      method: 'POST',
      body: JSON.stringify({ modelId }),
    }, { timeoutMs: LMX_MUTATION_TIMEOUT_MS });
  }

  lmxDelete(modelId: string): Promise<unknown> {
    return this.request(`/v3/lmx/models/${encodeURIComponent(modelId)}`, {
      method: 'DELETE',
    }, { timeoutMs: LMX_MUTATION_TIMEOUT_MS });
  }

  lmxDownload(repoId: string): Promise<DaemonLmxDownloadResponse> {
    return this.request('/v3/lmx/models/download', {
      method: 'POST',
      body: JSON.stringify({ repoId }),
    }, { timeoutMs: LMX_MUTATION_TIMEOUT_MS });
  }
}
