import { DaemonHttpClient } from "@opta/daemon-client/http-client";
import type {
  DaemonBackgroundListResponse,
  DaemonBackgroundOutputResponse,
  DaemonBackgroundStartRequest,
  DaemonBackgroundStatusResponse,
  DaemonListOperationsResponse,
  DaemonLmxAvailableModel,
  DaemonLmxMemoryResponse,
  DaemonLmxModelDetail,
  DaemonLmxStatusResponse,
  DaemonRunOperationResponse,
} from "@opta/daemon-client/types";
import type { V3Envelope as SharedV3Envelope } from "@opta/protocol-shared";
import type { DaemonConnectionOptions } from "../types";

export type V3Envelope = SharedV3Envelope;

interface SessionSnapshot {
  sessionId: string;
  title?: string;
  workspace?: string;
  updatedAt?: string;
}

interface RuntimeMetricsResponse {
  runtime?: {
    sessionCount?: number;
    activeTurnCount?: number;
    queuedTurnCount?: number;
    subscriberCount?: number;
  };
}

function httpClient(connection: DaemonConnectionOptions): DaemonHttpClient {
  return new DaemonHttpClient(connection);
}

export const daemonClient = {
  async health(
    connection: DaemonConnectionOptions,
  ): Promise<{ status: string }> {
    return httpClient(connection).health();
  },

  async metrics(
    connection: DaemonConnectionOptions,
  ): Promise<RuntimeMetricsResponse> {
    const response = await httpClient(connection).metrics();
    const runtime =
      response.runtime && typeof response.runtime === "object"
        ? (response.runtime as Record<string, unknown>)
        : undefined;

    return {
      runtime: {
        sessionCount:
          typeof runtime?.sessionCount === "number"
            ? runtime.sessionCount
            : undefined,
        activeTurnCount:
          typeof runtime?.activeTurnCount === "number"
            ? runtime.activeTurnCount
            : undefined,
        queuedTurnCount:
          typeof runtime?.queuedTurnCount === "number"
            ? runtime.queuedTurnCount
            : undefined,
        subscriberCount:
          typeof runtime?.subscriberCount === "number"
            ? runtime.subscriberCount
            : undefined,
      },
    };
  },

  async createSession(
    connection: DaemonConnectionOptions,
    payload: { workspace: string; title?: string },
  ): Promise<SessionSnapshot> {
    return httpClient(connection).createSession({
      title: payload.title,
      metadata: payload.workspace
        ? { workspace: payload.workspace }
        : undefined,
    }) as Promise<SessionSnapshot>;
  },

  async submitTurn(
    connection: DaemonConnectionOptions,
    sessionId: string,
    payload: {
      content: string;
      clientId?: string;
      writerId?: string;
      mode?: "chat" | "do";
    },
  ): Promise<{ turnId?: string }> {
    return httpClient(connection).submitTurn(sessionId, {
      content: payload.content,
      clientId: payload.clientId ?? "opta-code-desktop",
      writerId: payload.writerId ?? "opta-code-desktop",
      mode: payload.mode ?? "chat",
    });
  },

  async sessionEvents(
    connection: DaemonConnectionOptions,
    sessionId: string,
    afterSeq = 0,
  ): Promise<{ events: Array<Record<string, unknown>> }> {
    const response = await httpClient(connection).events(sessionId, afterSeq);
    return {
      events: response.events as unknown as Array<Record<string, unknown>>,
    };
  },

  connectWebSocket(
    connection: DaemonConnectionOptions,
    sessionId: string,
    afterSeq: number,
    handlers: {
      onEvent: (envelope: V3Envelope) => void;
      onOpen?: () => void;
      onClose?: (code: number) => void;
      onError?: (event: Event) => void;
    },
  ): { close: () => void; send: (msg: object) => void } {
    const wsProtocol =
      (connection.protocol ?? "http") === "https" ? "wss" : "ws";
    const url =
      `${wsProtocol}://${connection.host}:${connection.port}/v3/ws` +
      `?sessionId=${encodeURIComponent(sessionId)}` +
      `&afterSeq=${afterSeq}` +
      `&token=${encodeURIComponent(connection.token)}`;

    const ws = new globalThis.WebSocket(url);

    ws.onopen = () => handlers.onOpen?.();
    ws.onerror = (event) => handlers.onError?.(event as Event);
    ws.onclose = (event) => handlers.onClose?.(event.code);
    ws.onmessage = (msgEvent) => {
      try {
        const envelope = JSON.parse(String(msgEvent.data)) as V3Envelope;
        handlers.onEvent(envelope);
      } catch {
        // ignore malformed messages
      }
    };

    return {
      close: () => ws.close(1000),
      send: (msg: object) => ws.send(JSON.stringify(msg)),
    };
  },

  async resolvePermission(
    connection: DaemonConnectionOptions,
    sessionId: string,
    requestId: string,
    decision: "allow" | "deny",
    decidedBy: string,
  ): Promise<{ ok: boolean; conflict: boolean }> {
    return httpClient(connection).resolvePermission(sessionId, {
      requestId,
      decision,
      decidedBy,
    });
  },

  async cancel(
    connection: DaemonConnectionOptions,
    sessionId: string,
    payload: { turnId?: string; writerId?: string },
  ): Promise<{ cancelled: number }> {
    return httpClient(connection).cancel(sessionId, payload);
  },

  async listOperations(
    connection: DaemonConnectionOptions,
  ): Promise<DaemonListOperationsResponse> {
    return httpClient(connection).listOperations();
  },

  async runOperation(
    connection: DaemonConnectionOptions,
    id: string,
    payload?: Record<string, unknown>,
  ): Promise<DaemonRunOperationResponse> {
    return httpClient(connection).runOperation(id, payload);
  },

  async listBackground(
    connection: DaemonConnectionOptions,
    sessionId?: string,
  ): Promise<DaemonBackgroundListResponse> {
    return httpClient(connection).listBackground(sessionId);
  },

  async startBackground(
    connection: DaemonConnectionOptions,
    payload: DaemonBackgroundStartRequest,
  ): Promise<DaemonBackgroundStatusResponse> {
    return httpClient(connection).startBackground(payload);
  },

  async backgroundOutput(
    connection: DaemonConnectionOptions,
    processId: string,
    options?: { afterSeq?: number; limit?: number },
  ): Promise<DaemonBackgroundOutputResponse> {
    return httpClient(connection).backgroundOutput(processId, options);
  },

  async killBackground(
    connection: DaemonConnectionOptions,
    processId: string,
  ): Promise<void> {
    await httpClient(connection).killBackground(processId);
  },

  async lmxStatus(
    connection: DaemonConnectionOptions,
  ): Promise<DaemonLmxStatusResponse> {
    return httpClient(connection).lmxStatus();
  },

  async lmxModels(
    connection: DaemonConnectionOptions,
  ): Promise<{ models: DaemonLmxModelDetail[] }> {
    return httpClient(connection).lmxModels();
  },

  async lmxMemory(
    connection: DaemonConnectionOptions,
  ): Promise<DaemonLmxMemoryResponse> {
    return httpClient(connection).lmxMemory();
  },

  async lmxAvailable(
    connection: DaemonConnectionOptions,
  ): Promise<DaemonLmxAvailableModel[]> {
    return httpClient(connection).lmxAvailable();
  },

  async lmxLoad(
    connection: DaemonConnectionOptions,
    modelId: string,
    opts?: { backend?: string; autoDownload?: boolean },
  ): Promise<unknown> {
    return httpClient(connection).lmxLoad(modelId, opts);
  },

  async lmxUnload(
    connection: DaemonConnectionOptions,
    modelId: string,
  ): Promise<unknown> {
    return httpClient(connection).lmxUnload(modelId);
  },

  async lmxDelete(
    connection: DaemonConnectionOptions,
    modelId: string,
  ): Promise<unknown> {
    return httpClient(connection).lmxDelete(modelId);
  },

  async lmxDownload(
    connection: DaemonConnectionOptions,
    repoId: string,
  ): Promise<{ download_id: string }> {
    return httpClient(connection).lmxDownload(repoId);
  },
};
