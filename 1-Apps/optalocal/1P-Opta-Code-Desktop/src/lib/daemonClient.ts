import type {
  DaemonConnectionOptions,
  DaemonLmxAvailableModel,
  DaemonLmxMemoryResponse,
  DaemonLmxModelDetail,
  DaemonLmxStatusResponse,
} from "../types";

export interface V3Envelope {
  seq: number;
  kind: string;
  payload: Record<string, unknown>;
  sessionId?: string;
  turnId?: string;
  clientId?: string;
}

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

function baseUrl(connection: DaemonConnectionOptions): string {
  const protocol = connection.protocol ?? "http";
  return `${protocol}://${connection.host}:${connection.port}`;
}

async function request<T>(
  connection: DaemonConnectionOptions,
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${connection.token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl(connection)}${endpoint}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Daemon request failed (${response.status}) ${message || response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

export const daemonClient = {
  async health(
    connection: DaemonConnectionOptions,
  ): Promise<{ status: string }> {
    return request(connection, "/v3/health");
  },

  async metrics(
    connection: DaemonConnectionOptions,
  ): Promise<RuntimeMetricsResponse> {
    return request(connection, "/v3/metrics");
  },

  async createSession(
    connection: DaemonConnectionOptions,
    payload: { workspace: string; title?: string },
  ): Promise<SessionSnapshot> {
    return request(connection, "/v3/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async submitTurn(
    connection: DaemonConnectionOptions,
    sessionId: string,
    payload: { content: string; clientId?: string; writerId?: string },
  ): Promise<{ turnId?: string }> {
    return request(
      connection,
      `/v3/sessions/${encodeURIComponent(sessionId)}/turns`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  async sessionEvents(
    connection: DaemonConnectionOptions,
    sessionId: string,
    afterSeq = 0,
  ): Promise<{ events: Array<Record<string, unknown>> }> {
    return request(
      connection,
      `/v3/sessions/${encodeURIComponent(sessionId)}/events?afterSeq=${afterSeq}`,
    );
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
    return request(
      connection,
      `/v3/sessions/${encodeURIComponent(sessionId)}/permissions/${encodeURIComponent(requestId)}`,
      {
        method: "POST",
        body: JSON.stringify({ decision, decidedBy }),
      },
    );
  },

  async cancel(
    connection: DaemonConnectionOptions,
    sessionId: string,
    payload: { turnId?: string; writerId?: string },
  ): Promise<{ cancelled: number }> {
    return request(
      connection,
      `/v3/sessions/${encodeURIComponent(sessionId)}/cancel`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  async lmxStatus(
    connection: DaemonConnectionOptions,
  ): Promise<DaemonLmxStatusResponse> {
    return request(connection, "/v3/lmx/status");
  },

  async lmxModels(
    connection: DaemonConnectionOptions,
  ): Promise<{ models: DaemonLmxModelDetail[] }> {
    return request(connection, "/v3/lmx/models");
  },

  async lmxMemory(
    connection: DaemonConnectionOptions,
  ): Promise<DaemonLmxMemoryResponse> {
    return request(connection, "/v3/lmx/memory");
  },

  async lmxAvailable(
    connection: DaemonConnectionOptions,
  ): Promise<DaemonLmxAvailableModel[]> {
    return request(connection, "/v3/lmx/models/available");
  },

  async lmxLoad(
    connection: DaemonConnectionOptions,
    modelId: string,
    opts?: { backend?: string; autoDownload?: boolean },
  ): Promise<unknown> {
    return request(connection, "/v3/lmx/models/load", {
      method: "POST",
      body: JSON.stringify({ modelId, ...opts }),
    });
  },

  async lmxUnload(
    connection: DaemonConnectionOptions,
    modelId: string,
  ): Promise<unknown> {
    return request(connection, "/v3/lmx/models/unload", {
      method: "POST",
      body: JSON.stringify({ modelId }),
    });
  },

  async lmxDelete(
    connection: DaemonConnectionOptions,
    modelId: string,
  ): Promise<unknown> {
    return request(
      connection,
      `/v3/lmx/models/${encodeURIComponent(modelId)}`,
      {
        method: "DELETE",
      },
    );
  },

  async lmxDownload(
    connection: DaemonConnectionOptions,
    repoId: string,
  ): Promise<{ download_id: string }> {
    return request(connection, "/v3/lmx/models/download", {
      method: "POST",
      body: JSON.stringify({ repoId }),
    });
  },
};
