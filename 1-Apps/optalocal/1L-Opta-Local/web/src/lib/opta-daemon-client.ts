import { DaemonHttpClient } from "@opta/daemon-client/http-client";
import type {
  DaemonListOperationsResponse,
  DaemonConnectionOptions,
  DaemonOperationDefinition,
  DaemonOperationPayload,
  DaemonRunOperationResponse,
  DaemonSessionDetail,
} from "@opta/daemon-client/types";
import type {
  ClientSubmitTurn,
  CreateSessionRequest,
  PermissionDecision,
  SessionSnapshot,
  V3Envelope,
} from "@opta/protocol-shared";

/**
 * Opta daemon v3 client for web/browser attach flows.
 *
 * Control plane: HTTP (/v3/*)
 * Event plane: WebSocket (/v3/ws), with optional SSE fallback.
 */

export type {
  V3Envelope,
  ClientSubmitTurn,
  PermissionDecision,
  SessionSnapshot,
};
export type SessionDetail = DaemonSessionDetail;
export type OperationDefinition = DaemonOperationDefinition;
export type OperationPayload = DaemonOperationPayload;
export type OperationResponse<TResult = unknown> = DaemonRunOperationResponse<TResult>;

export interface DaemonClientOptions {
  baseUrl: string;
  token: string;
}

export class OptaDaemonClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly http: DaemonHttpClient;

  constructor(opts: DaemonClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.token = opts.token;
    const parsed = new URL(this.baseUrl);
    const protocol: DaemonConnectionOptions["protocol"] =
      parsed.protocol === "https:" ? "https" : "http";
    this.http = new DaemonHttpClient({
      host: parsed.hostname,
      port: Number(parsed.port || (protocol === "https" ? 443 : 80)),
      token: this.token,
      protocol,
    });
  }

  private wsBaseUrl(): string {
    const parsed = new URL(this.baseUrl);
    parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    return parsed.toString().replace(/\/+$/, "");
  }

  health(): Promise<{ status: string; version?: string; daemonId?: string }> {
    return this.http.health();
  }

  createSession(req?: {
    sessionId?: string;
    model?: string;
    title?: string;
    messages?: unknown[];
    metadata?: Record<string, unknown>;
  }): Promise<SessionSnapshot> {
    return this.http.createSession((req ?? {}) as CreateSessionRequest);
  }

  getSession(sessionId: string): Promise<SessionDetail> {
    return this.http.getSession(sessionId);
  }

  submitTurn(
    sessionId: string,
    turn: ClientSubmitTurn,
  ): Promise<{ turnId: string; queued: number }> {
    return this.http.submitTurn(sessionId, turn);
  }

  cancel(
    sessionId: string,
    opts: { turnId?: string; writerId?: string },
  ): Promise<{ cancelled: number }> {
    return this.http.cancel(sessionId, opts);
  }

  resolvePermission(
    sessionId: string,
    decision: PermissionDecision,
  ): Promise<{ ok: boolean; conflict: boolean; message?: string }> {
    return this.http.resolvePermission(sessionId, decision);
  }

  events(sessionId: string, afterSeq = 0): Promise<{ events: V3Envelope[] }> {
    return this.http.events(sessionId, afterSeq);
  }

  listOperations(): Promise<DaemonListOperationsResponse> {
    return this.http.listOperations();
  }

  runOperation<
    TPayload extends DaemonOperationPayload = DaemonOperationPayload,
    TResult = unknown,
  >(
    id: string,
    payload?: TPayload,
  ): Promise<DaemonRunOperationResponse<TResult>> {
    return this.http.runOperation<TPayload, TResult>(id, payload);
  }

  connectWebSocket(
    sessionId: string,
    afterSeq: number,
    handlers: {
      onEvent: (event: V3Envelope) => void;
      onOpen?: () => void;
      onClose?: () => void;
      onError?: (err: Event | Error) => void;
    },
  ): { socket: WebSocket; close: () => void } {
    const wsUrl = `${this.wsBaseUrl()}/v3/ws?sessionId=${encodeURIComponent(sessionId)}&afterSeq=${afterSeq}&token=${encodeURIComponent(this.token)}`;
    const socket = new WebSocket(wsUrl);

    socket.addEventListener("open", () => {
      handlers.onOpen?.();
    });
    socket.addEventListener("close", () => handlers.onClose?.());
    socket.addEventListener("error", (event) => handlers.onError?.(event));
    socket.addEventListener("message", (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as unknown;
        if (!parsed || typeof parsed !== "object") return;

        if ("error" in parsed && typeof parsed.error === "string") {
          handlers.onError?.(new Error(parsed.error));
          socket.close();
          return;
        }

        if (!("event" in parsed)) return;
        handlers.onEvent(parsed as V3Envelope);
      } catch {
        // Ignore malformed messages.
      }
    });

    return {
      socket,
      close: () => {
        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
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
    },
  ): { source: EventSource; close: () => void } {
    // NOTE: EventSource does not support custom request headers, so the token
    // cannot be moved to an Authorization header the way WebSocket auth is
    // handled above. The SSE fallback is only used when WebSocket is
    // unavailable. If the token must be removed from the URL entirely, replace
    // this path with a one-time-token exchange endpoint (HTTP POST → opaque
    // short-lived token → append that to the SSE URL instead).
    const url = `${this.baseUrl}/v3/sse/events?sessionId=${encodeURIComponent(sessionId)}&afterSeq=${afterSeq}&token=${encodeURIComponent(this.token)}`;
    const source = new EventSource(url);

    source.addEventListener("open", () => handlers.onOpen?.());
    source.addEventListener("error", (event) => handlers.onError?.(event));
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
