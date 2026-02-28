/**
 * Opta daemon v3 client for web/browser — self-contained, no cross-package imports.
 */

// ─── Inlined protocol types ───────────────────────────────────────────────

export type V3Event =
  | 'session.snapshot' | 'turn.queued' | 'turn.start' | 'turn.token'
  | 'turn.thinking' | 'tool.start' | 'tool.end' | 'permission.request'
  | 'permission.resolved' | 'turn.progress' | 'turn.done' | 'turn.error'
  | 'session.updated' | 'session.cancelled' | 'background.output' | 'background.status';

export interface V3Envelope<T extends V3Event = V3Event, P = unknown> {
  v: '3'; event: T; daemonId: string; sessionId?: string; seq: number; ts: string; payload: P;
}

export interface ClientSubmitTurn {
  clientId: string; writerId: string; content: string; mode: 'chat' | 'do'; metadata?: Record<string, unknown>;
}

export interface PermissionDecision {
  requestId: string; decision: 'allow' | 'deny'; decidedBy: string;
}

export interface SessionSnapshot {
  sessionId: string; model?: string; title?: string; status?: string;
  createdAt?: string; updatedAt?: string; metadata?: Record<string, unknown>;
}

export interface CreateSessionRequest {
  sessionId?: string; model?: string; title?: string; messages?: unknown[]; metadata?: Record<string, unknown>;
}

// ─── Daemon types ─────────────────────────────────────────────────────────

export type DaemonProtocol = 'http' | 'https';

export interface DaemonConnectionOptions {
  host: string; port: number; token: string; protocol?: DaemonProtocol;
}

export interface SessionDetail extends SessionSnapshot { messages: unknown[]; }

export type DaemonOperationSafetyClass = 'read' | 'write' | 'dangerous';

export interface DaemonOperationDefinition {
  id: string; title: string; description: string; safety: DaemonOperationSafetyClass; [key: string]: unknown;
}

export type DaemonOperationPayload = Record<string, unknown>;

export interface DaemonOperationError {
  code: string; message: string; details?: unknown;
}

export type DaemonRunOperationResponse<TResult = unknown> =
  | { ok: true; id: string; safety: DaemonOperationSafetyClass; result: TResult }
  | { ok: false; id: string; safety: DaemonOperationSafetyClass; error: DaemonOperationError };

export interface DaemonListOperationsResponse {
  operations: DaemonOperationDefinition[];
}

export type OperationDefinition = DaemonOperationDefinition;
export type OperationPayload = DaemonOperationPayload;
export type OperationResponse<TResult = unknown> = DaemonRunOperationResponse<TResult>;

// ─── HTTP client ──────────────────────────────────────────────────────────

class DaemonHttpClient {
  private readonly base: string;
  private readonly token: string;

  constructor(opts: DaemonConnectionOptions) {
    const proto = opts.protocol ?? 'http';
    this.base = `${proto}://${opts.host}:${opts.port}`;
    this.token = opts.token;
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await globalThis.fetch(`${this.base}${path}`, {
      method, headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`Daemon ${method} ${path} → ${res.status}: ${t}`); }
    return res.json() as Promise<T>;
  }

  health() { return this.request<{ status: string; version?: string; daemonId?: string }>('GET', '/v3/health'); }
  createSession(req: CreateSessionRequest) { return this.request<SessionSnapshot>('POST', '/v3/sessions', req); }
  getSession(id: string) { return this.request<SessionDetail>('GET', `/v3/sessions/${id}`); }
  submitTurn(id: string, turn: ClientSubmitTurn) { return this.request<{ turnId: string; queued: number }>('POST', `/v3/sessions/${id}/turns`, turn); }
  cancel(id: string, opts: { turnId?: string; writerId?: string }) { return this.request<{ cancelled: number }>('POST', `/v3/sessions/${id}/cancel`, opts); }
  resolvePermission(id: string, dec: PermissionDecision) { return this.request<{ ok: boolean; conflict: boolean; message?: string }>('POST', `/v3/sessions/${id}/permission`, dec); }
  events(id: string, afterSeq = 0) { return this.request<{ events: V3Envelope[] }>('GET', `/v3/sessions/${id}/events?afterSeq=${afterSeq}`); }
  listOperations() { return this.request<DaemonListOperationsResponse>('GET', '/v3/operations'); }
  runOperation<TPayload extends DaemonOperationPayload = DaemonOperationPayload, TResult = unknown>(opId: string, payload?: TPayload) {
    return this.request<DaemonRunOperationResponse<TResult>>('POST', `/v3/operations/${opId}`, payload);
  }
}

// ─── Public client ────────────────────────────────────────────────────────

export interface DaemonClientOptions { baseUrl: string; token: string; }

export class OptaDaemonClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly http: DaemonHttpClient;

  constructor(opts: DaemonClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.token = opts.token;
    const parsed = new URL(this.baseUrl);
    const protocol: DaemonProtocol = parsed.protocol === 'https:' ? 'https' : 'http';
    this.http = new DaemonHttpClient({
      host: parsed.hostname,
      port: Number(parsed.port || (protocol === 'https' ? 443 : 80)),
      token: this.token, protocol,
    });
  }

  private wsBaseUrl(): string {
    const parsed = new URL(this.baseUrl);
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return parsed.toString().replace(/\/+$/, '');
  }

  health() { return this.http.health(); }
  createSession(req?: Partial<CreateSessionRequest>) { return this.http.createSession(req ?? {}); }
  getSession(id: string) { return this.http.getSession(id); }
  submitTurn(id: string, turn: ClientSubmitTurn) { return this.http.submitTurn(id, turn); }
  cancel(id: string, opts: { turnId?: string; writerId?: string }) { return this.http.cancel(id, opts); }
  resolvePermission(id: string, dec: PermissionDecision) { return this.http.resolvePermission(id, dec); }
  events(id: string, afterSeq = 0) { return this.http.events(id, afterSeq); }
  listOperations() { return this.http.listOperations(); }
  runOperation<TPayload extends DaemonOperationPayload = DaemonOperationPayload, TResult = unknown>(id: string, payload?: TPayload) {
    return this.http.runOperation<TPayload, TResult>(id, payload);
  }

  connectWebSocket(sessionId: string, afterSeq: number, handlers: {
    onEvent: (event: V3Envelope) => void; onOpen?: () => void; onClose?: () => void; onError?: (err: Event | Error) => void;
  }): { socket: WebSocket; close: () => void } {
    const wsUrl = `${this.wsBaseUrl()}/v3/ws?sessionId=${encodeURIComponent(sessionId)}&afterSeq=${afterSeq}&token=${encodeURIComponent(this.token)}`;
    const socket = new WebSocket(wsUrl);
    socket.addEventListener('open', () => handlers.onOpen?.());
    socket.addEventListener('close', () => handlers.onClose?.());
    socket.addEventListener('error', (e) => handlers.onError?.(e));
    socket.addEventListener('message', (event) => {
      try {
        const p = JSON.parse(String(event.data)) as unknown;
        if (!p || typeof p !== 'object') return;
        if ('error' in p) { handlers.onError?.(new Error((p as Record<string, unknown>).error as string)); socket.close(); return; }
        if (!('event' in p)) return;
        handlers.onEvent(p as V3Envelope);
      } catch { /* ignore */ }
    });
    return { socket, close: () => { if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close(); } };
  }

  connectSse(sessionId: string, afterSeq: number, handlers: {
    onEvent: (event: V3Envelope) => void; onOpen?: () => void; onError?: (err: Event) => void;
  }): { source: EventSource; close: () => void } {
    const url = `${this.baseUrl}/v3/sse/events?sessionId=${encodeURIComponent(sessionId)}&afterSeq=${afterSeq}&token=${encodeURIComponent(this.token)}`;
    const source = new EventSource(url);
    source.addEventListener('open', () => handlers.onOpen?.());
    source.addEventListener('error', (e) => handlers.onError?.(e));
    source.onmessage = (e) => { try { handlers.onEvent(JSON.parse(e.data) as V3Envelope); } catch { /* ignore */ } };
    return { source, close: () => source.close() };
  }
}
