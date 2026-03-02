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

export type DaemonLmxEndpointSource =
  | "preferred_base_url"
  | "openai_base_url"
  | "base_urls";

export interface DaemonLmxEndpointCandidate {
  id: string;
  source: DaemonLmxEndpointSource;
  url: string;
  protocol: "http" | "https";
  host: string;
  port: number;
}

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

function normalizeLmxDownloadsList(raw: unknown): DaemonLmxDownloadProgress[] {
  const parsed = asRecord(raw);
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(parsed?.downloads)
      ? parsed.downloads
      : Array.isArray(parsed?.active_downloads)
        ? parsed.active_downloads
        : [];

  return list
    .map((item) => {
      const record = asRecord(item);
      const downloadId =
        typeof record?.download_id === "string"
          ? record.download_id
          : typeof record?.downloadId === "string"
            ? record.downloadId
            : "";
      if (!downloadId) return null;
      return normalizeLmxDownloadProgress(item, downloadId);
    })
    .filter(
      (item): item is DaemonLmxDownloadProgress =>
        Boolean(item && item.download_id),
    );
}

function normalizeConfigValue(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

function operationError(
  operationId: string,
  response: DaemonRunOperationResponse,
): Error {
  if (response.ok) {
    return new Error(`[${operationId}] unexpected success response`);
  }
  return new Error(
    `[${response.error.code}] ${response.error.message}`,
  );
}

function parseEndpointCandidate(
  source: DaemonLmxEndpointSource,
  rawUrl: string,
  index = 0,
): DaemonLmxEndpointCandidate | null {
  const url = rawUrl.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    const protocol = parsed.protocol === "https:" ? "https" : "http";
    const port =
      parsed.port.length > 0
        ? Number.parseInt(parsed.port, 10)
        : protocol === "https"
          ? 443
          : 80;
    if (!Number.isFinite(port) || port <= 0) return null;
    return {
      id: `${source}:${index}:${parsed.host}`,
      source,
      url,
      protocol,
      host: parsed.hostname,
      port,
    };
  } catch {
    return null;
  }
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

  async configGet(
    connection: DaemonConnectionOptions,
    key: string,
  ): Promise<unknown> {
    const response = await daemonClient.runOperation(connection, "config.get", {
      input: { key },
    });
    if (!response.ok) throw operationError("config.get", response);
    const result = asRecord(response.result);
    const rawValue = result && "value" in result ? result.value : response.result;
    return normalizeConfigValue(rawValue);
  },

  async configSet(
    connection: DaemonConnectionOptions,
    key: string,
    value: unknown,
  ): Promise<void> {
    const response = await daemonClient.runOperation(connection, "config.set", {
      input: { key, value },
    });
    if (!response.ok) throw operationError("config.set", response);
  },

  async configList(
    connection: DaemonConnectionOptions,
  ): Promise<Record<string, unknown>> {
    const response = await daemonClient.runOperation(connection, "config.list", {
      input: {},
    });
    if (!response.ok) throw operationError("config.list", response);
    const result = asRecord(response.result);
    if (!result) return {};
    const nestedConfig = asRecord(result.config);
    return nestedConfig ?? result;
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

  extractLmxEndpointCandidates(
    discovery: DaemonLmxDiscoveryResponse | null,
  ): DaemonLmxEndpointCandidate[] {
    if (!discovery) return [];
    const root = asRecord(discovery);
    const endpoints = asRecord(root?.endpoints);
    if (!endpoints) return [];

    const candidates: DaemonLmxEndpointCandidate[] = [];
    const pushIfValid = (
      source: DaemonLmxEndpointSource,
      value: unknown,
    ) => {
      if (typeof value !== "string") return;
      const parsed = parseEndpointCandidate(source, value, candidates.length);
      if (parsed) candidates.push(parsed);
    };

    pushIfValid("preferred_base_url", endpoints.preferred_base_url);
    pushIfValid("openai_base_url", endpoints.openai_base_url);

    const baseUrls = Array.isArray(endpoints.base_urls) ? endpoints.base_urls : [];
    for (let i = 0; i < baseUrls.length; i += 1) {
      const value = baseUrls[i];
      if (typeof value !== "string") continue;
      const parsed = parseEndpointCandidate("base_urls", value, i);
      if (parsed) candidates.push(parsed);
    }

    const deduped = new Map<string, DaemonLmxEndpointCandidate>();
    for (const candidate of candidates) {
      if (!deduped.has(candidate.url)) {
        deduped.set(candidate.url, candidate);
      }
    }
    return Array.from(deduped.values());
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

  async lmxDownloads(
    connection: DaemonConnectionOptions,
  ): Promise<DaemonLmxDownloadProgress[]> {
    const raw = await daemonRequest<unknown>(
      connection,
      "/v3/lmx/models/downloads",
      {},
      LMX_READ_TIMEOUT_MS,
    );
    return normalizeLmxDownloadsList(raw);
  },
};
