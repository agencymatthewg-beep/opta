/**
 * Opta daemon v3 client for web/browser attach flows.
 *
 * Control plane: HTTP (/v3/*)
 * Event plane: WebSocket (/v3/ws), with optional SSE fallback.
 */

export interface V3Envelope<T extends string = string, P = unknown> {
  v: '3';
  event: T;
  daemonId: string;
  sessionId?: string;
  seq: number;
  ts: string;
  payload: P;
}

export interface ClientSubmitTurn {
  clientId: string;
  writerId: string;
  content: string;
  mode: 'chat' | 'do';
  metadata?: Record<string, unknown>;
}

export interface PermissionDecision {
  requestId: string;
  decision: 'allow' | 'deny';
  decidedBy: string;
}

export interface SessionSnapshot {
  sessionId: string;
  model: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  activeTurnId?: string;
  queuedTurns: number;
  toolCallCount: number;
  writerCount: number;
}

export interface SessionDetail extends SessionSnapshot {
  messages: unknown[];
}

export interface DaemonClientOptions {
  baseUrl: string;
  token: string;
}

export class OptaDaemonClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(opts: DaemonClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.token = opts.token;
  }

  private wsBaseUrl(): string {
    const parsed = new URL(this.baseUrl);
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return parsed.toString().replace(/\/+$/, '');
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${this.token}`);
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(url, {
      ...init,
      headers,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Daemon request failed (${res.status}): ${body || res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  health(): Promise<{ status: string; version?: string; daemonId?: string }> {
    return this.request('/v3/health');
  }

  createSession(req?: {
    sessionId?: string;
    model?: string;
    title?: string;
    messages?: unknown[];
    metadata?: Record<string, unknown>;
  }): Promise<SessionSnapshot> {
    return this.request('/v3/sessions', {
      method: 'POST',
      body: JSON.stringify(req ?? {}),
    });
  }

  getSession(sessionId: string): Promise<SessionDetail> {
    return this.request(`/v3/sessions/${encodeURIComponent(sessionId)}`);
  }

  submitTurn(sessionId: string, turn: ClientSubmitTurn): Promise<{ turnId: string; queued: number }> {
    return this.request(`/v3/sessions/${encodeURIComponent(sessionId)}/turns`, {
      method: 'POST',
      body: JSON.stringify(turn),
    });
  }

  cancel(sessionId: string, opts: { turnId?: string; writerId?: string }): Promise<{ cancelled: number }> {
    return this.request(`/v3/sessions/${encodeURIComponent(sessionId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify(opts),
    });
  }

  resolvePermission(sessionId: string, decision: PermissionDecision): Promise<{ ok: boolean; conflict: boolean; message?: string }> {
    return this.request(`/v3/sessions/${encodeURIComponent(sessionId)}/permissions/${encodeURIComponent(decision.requestId)}`, {
      method: 'POST',
      body: JSON.stringify(decision),
    });
  }

  events(sessionId: string, afterSeq = 0): Promise<{ events: V3Envelope[] }> {
    return this.request(`/v3/sessions/${encodeURIComponent(sessionId)}/events?afterSeq=${afterSeq}`);
  }

  connectWebSocket(
    sessionId: string,
    afterSeq: number,
    handlers: {
      onEvent: (event: V3Envelope) => void;
      onOpen?: () => void;
      onClose?: () => void;
      onError?: (err: Event) => void;
    }
  ): { socket: WebSocket; close: () => void } {
    const wsUrl = `${this.wsBaseUrl()}/v3/ws?sessionId=${encodeURIComponent(sessionId)}&afterSeq=${afterSeq}`;
    const socket = new WebSocket(wsUrl);

    socket.addEventListener('open', () => {
      // Authenticate first before any other messages — token sent as a
      // message payload to avoid it appearing in server logs / proxy access
      // logs that record WebSocket handshake URLs.
      socket.send(JSON.stringify({ type: 'auth', token: this.token }));
      handlers.onOpen?.();
    });
    socket.addEventListener('close', () => handlers.onClose?.());
    socket.addEventListener('error', (event) => handlers.onError?.(event));
    socket.addEventListener('message', (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as V3Envelope;
        if (!parsed || typeof parsed !== 'object' || !('event' in parsed)) return;
        handlers.onEvent(parsed);
      } catch {
        // Ignore malformed messages.
      }
    });

    return {
      socket,
      close: () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      },
    };
  }

  connectSse(
    sessionId: string,
    afterSeq: number,
    handlers: {
      onEvent: (event: V3Envelope) => void;
      onOpen?: () => void;
      onError?: (err: Event) => void;
    }
  ): { source: EventSource; close: () => void } {
    // NOTE: EventSource does not support custom request headers, so the token
    // cannot be moved to an Authorization header the way WebSocket auth is
    // handled above. The SSE fallback is only used when WebSocket is
    // unavailable. If the token must be removed from the URL entirely, replace
    // this path with a one-time-token exchange endpoint (HTTP POST → opaque
    // short-lived token → append that to the SSE URL instead).
    const url = `${this.baseUrl}/v3/sse/events?sessionId=${encodeURIComponent(sessionId)}&afterSeq=${afterSeq}&token=${encodeURIComponent(this.token)}`;
    const source = new EventSource(url);

    source.addEventListener('open', () => handlers.onOpen?.());
    source.addEventListener('error', (event) => handlers.onError?.(event));
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as V3Envelope;
        handlers.onEvent(parsed);
      } catch {
        // Ignore malformed events.
      }
    };

    return {
      source,
      close: () => source.close(),
    };
  }
}
