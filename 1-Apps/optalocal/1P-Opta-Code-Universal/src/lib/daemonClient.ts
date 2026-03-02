import { DaemonHttpClient } from "@opta/daemon-client/http-client";
import type {
  DaemonBackgroundListResponse,
  DaemonBackgroundOutputResponse,
  DaemonBackgroundOutputOptions,
  DaemonBackgroundStartRequest,
  DaemonBackgroundStatusResponse,
  DaemonLmxLoadOptions,
  DaemonLmxDiscoveryResponse,
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

const GB_TO_BYTES = 1024 * 1024 * 1024;
const LMX_READ_TIMEOUT_MS = 30_000;
const LMX_MUTATION_TIMEOUT_MS = 120_000;

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

export type DaemonLmxLoadStatus = "loaded" | "download_required" | "downloading";

export interface DaemonLmxLoadResponse {
  model_id: string;
  status: DaemonLmxLoadStatus;
  memory_bytes?: number;
  load_time_seconds?: number;
  estimated_size_bytes?: number;
  estimated_size_human?: string;
  confirmation_token?: string;
  download_id?: string;
  message?: string;
  confirm_url?: string;
  progress_url?: string;
}

export type DaemonLmxDownloadProgressStatus =
  | "pending"
  | "downloading"
  | "completed"
  | "failed"
  | "unknown";

export interface DaemonLmxDownloadProgress {
  download_id: string;
  repo_id: string;
  status: DaemonLmxDownloadProgressStatus;
  progress_percent: number;
  downloaded_bytes: number;
  total_bytes: number;
  files_completed: number;
  files_total: number;
  error?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function baseUrl(connection: DaemonConnectionOptions): string {
  const protocol = connection.protocol ?? "http";
  return `${protocol}://${connection.host}:${connection.port}`;
}

async function daemonRequest<T>(
  connection: DaemonConnectionOptions,
  path: string,
  init: RequestInit = {},
  timeoutMs = LMX_READ_TIMEOUT_MS,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${connection.token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl(connection)}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(
        `Daemon request failed (${response.status}): ${message || response.statusText}`,
      );
    }
    return (await response.json()) as T;
  } catch (err) {
    if (
      err instanceof DOMException &&
      err.name === "AbortError"
    ) {
      throw new Error(`Daemon request timed out (${timeoutMs}ms): ${path}`);
    }
    throw err;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function normalizeLmxLoadResponse(
  raw: unknown,
  fallbackModelId: string,
): DaemonLmxLoadResponse {
  const parsed = asRecord(raw);
  const model_id =
    typeof parsed?.model_id === "string"
      ? parsed.model_id
      : fallbackModelId;

  const rawStatus = parsed?.status;
  const status: DaemonLmxLoadStatus =
    rawStatus === "download_required" || rawStatus === "downloading"
      ? rawStatus
      : "loaded";

  const memory_bytes =
    typeof parsed?.memory_bytes === "number"
      ? parsed.memory_bytes
      : typeof parsed?.memory_after_load_gb === "number"
        ? parsed.memory_after_load_gb * GB_TO_BYTES
        : undefined;

  const load_time_seconds =
    typeof parsed?.load_time_seconds === "number"
      ? parsed.load_time_seconds
      : typeof parsed?.time_to_load_ms === "number"
        ? parsed.time_to_load_ms / 1000
        : undefined;

  return {
    model_id,
    status,
    memory_bytes,
    load_time_seconds,
    estimated_size_bytes:
      typeof parsed?.estimated_size_bytes === "number"
        ? parsed.estimated_size_bytes
        : undefined,
    estimated_size_human:
      typeof parsed?.estimated_size_human === "string"
        ? parsed.estimated_size_human
        : undefined,
    confirmation_token:
      typeof parsed?.confirmation_token === "string"
        ? parsed.confirmation_token
        : undefined,
    download_id:
      typeof parsed?.download_id === "string"
        ? parsed.download_id
        : undefined,
    message: typeof parsed?.message === "string" ? parsed.message : undefined,
    confirm_url:
      typeof parsed?.confirm_url === "string" ? parsed.confirm_url : undefined,
    progress_url:
      typeof parsed?.progress_url === "string" ? parsed.progress_url : undefined,
  };
}

function normalizeLmxDownloadProgress(
  raw: unknown,
  fallbackDownloadId: string,
): DaemonLmxDownloadProgress {
  const parsed = asRecord(raw);
  const statusValue = parsed?.status;
  const status: DaemonLmxDownloadProgressStatus =
    statusValue === "pending" ||
    statusValue === "downloading" ||
    statusValue === "completed" ||
    statusValue === "failed"
      ? statusValue
      : "unknown";

  return {
    download_id:
      typeof parsed?.download_id === "string"
        ? parsed.download_id
        : typeof parsed?.downloadId === "string"
          ? parsed.downloadId
          : fallbackDownloadId,
    repo_id:
      typeof parsed?.repo_id === "string"
        ? parsed.repo_id
        : typeof parsed?.repoId === "string"
          ? parsed.repoId
          : "",
    status,
    progress_percent:
      typeof parsed?.progress_percent === "number"
        ? parsed.progress_percent
        : typeof parsed?.progressPercent === "number"
          ? parsed.progressPercent
          : 0,
    downloaded_bytes:
      typeof parsed?.downloaded_bytes === "number"
        ? parsed.downloaded_bytes
        : typeof parsed?.downloadedBytes === "number"
          ? parsed.downloadedBytes
          : 0,
    total_bytes:
      typeof parsed?.total_bytes === "number"
        ? parsed.total_bytes
        : typeof parsed?.totalBytes === "number"
          ? parsed.totalBytes
          : 0,
    files_completed:
      typeof parsed?.files_completed === "number"
        ? parsed.files_completed
        : typeof parsed?.filesCompleted === "number"
          ? parsed.filesCompleted
          : 0,
    files_total:
      typeof parsed?.files_total === "number"
        ? parsed.files_total
        : typeof parsed?.filesTotal === "number"
          ? parsed.filesTotal
          : 0,
    error: typeof parsed?.error === "string" ? parsed.error : undefined,
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
  ): Promise<{ events: V3Envelope[] }> {
    const response = await httpClient(connection).events(sessionId, afterSeq);
    return { events: response.events };
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
  ): Promise<{
    cancelled: number;
    ok?: boolean;
    cancelledQueued?: number;
    cancelledActive?: boolean;
  }> {
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

  async backgroundStatus(
    connection: DaemonConnectionOptions,
    processId: string,
    sessionId?: string,
  ): Promise<DaemonBackgroundStatusResponse> {
    return httpClient(connection).backgroundStatus(processId, sessionId);
  },

  async backgroundOutput(
    connection: DaemonConnectionOptions,
    processId: string,
    options?: DaemonBackgroundOutputOptions,
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

  async lmxDiscovery(
    connection: DaemonConnectionOptions,
  ): Promise<DaemonLmxDiscoveryResponse> {
    return httpClient(connection).lmxDiscovery();
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
    opts?: DaemonLmxLoadOptions,
  ): Promise<DaemonLmxLoadResponse> {
    const raw = await httpClient(connection).lmxLoad(modelId, opts);
    return normalizeLmxLoadResponse(raw, modelId);
  },

  async lmxConfirmLoad(
    connection: DaemonConnectionOptions,
    confirmationToken: string,
  ): Promise<DaemonLmxLoadResponse> {
    const raw = await httpClient(connection).lmxConfirmLoad(confirmationToken);
    return normalizeLmxLoadResponse(raw, "");
  },

  async lmxDownloadProgress(
    connection: DaemonConnectionOptions,
    downloadId: string,
  ): Promise<DaemonLmxDownloadProgress> {
    const raw = await httpClient(connection).lmxDownloadProgress(downloadId);
    return normalizeLmxDownloadProgress(raw, downloadId);
  },

  async lmxUnload(
    connection: DaemonConnectionOptions,
    modelId: string,
  ): Promise<void> {
    await httpClient(connection).lmxUnload(modelId);
  },

  async lmxDelete(
    connection: DaemonConnectionOptions,
    modelId: string,
  ): Promise<void> {
    await httpClient(connection).lmxDelete(modelId);
  },

  async lmxDownload(
    connection: DaemonConnectionOptions,
    repoId: string,
  ): Promise<{ download_id: string }> {
    return httpClient(connection).lmxDownload(repoId);
  },
};
