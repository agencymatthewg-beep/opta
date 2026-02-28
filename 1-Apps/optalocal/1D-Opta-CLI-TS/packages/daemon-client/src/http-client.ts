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
  DaemonLmxDownloadResponse,
  DaemonLmxLoadOptions,
  DaemonLmxMemoryResponse,
  DaemonLmxModelDetail,
  DaemonLmxStatusResponse,
  DaemonListOperationsResponse,
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

export class DaemonHttpClient implements DaemonHttpApi {
  constructor(
    private readonly connection: DaemonConnectionOptions,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.connection.token}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await this.fetchImpl(`${baseUrl(this.connection)}${path}`, {
      ...init,
      headers,
    });

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
    return this.request(`/v3/sessions/${encodeURIComponent(sessionId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
    payload?: TPayload
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
      `/v3/background/${encodeURIComponent(processId)}/output${suffix ? `?${suffix}` : ''}`
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
    return this.request('/v3/lmx/status');
  }

  lmxModels(): Promise<{ models: DaemonLmxModelDetail[] }> {
    return this.request('/v3/lmx/models');
  }

  lmxMemory(): Promise<DaemonLmxMemoryResponse> {
    return this.request('/v3/lmx/memory');
  }

  lmxAvailable(): Promise<DaemonLmxAvailableModel[]> {
    return this.request('/v3/lmx/models/available');
  }

  lmxLoad(modelId: string, opts?: DaemonLmxLoadOptions): Promise<unknown> {
    return this.request('/v3/lmx/models/load', {
      method: 'POST',
      body: JSON.stringify({ modelId, ...opts }),
    });
  }

  lmxUnload(modelId: string): Promise<unknown> {
    return this.request('/v3/lmx/models/unload', {
      method: 'POST',
      body: JSON.stringify({ modelId }),
    });
  }

  lmxDelete(modelId: string): Promise<unknown> {
    return this.request(`/v3/lmx/models/${encodeURIComponent(modelId)}`, {
      method: 'DELETE',
    });
  }

  lmxDownload(repoId: string): Promise<DaemonLmxDownloadResponse> {
    return this.request('/v3/lmx/models/download', {
      method: 'POST',
      body: JSON.stringify({ repoId }),
    });
  }
}
