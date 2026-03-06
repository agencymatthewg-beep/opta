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
import type {
  AccountStatus,
  AudioTranscribeResult,
  AudioTtsResult,
  BrowserRuntimeStatus,
  DaemonConnectionOptions,
  DaemonControlStatus,
  DaemonLogEntry,
  DaemonProcessState,
  DaemonSessionSummary,
  EnvProfile,
  KeychainStatus,
  LanDiscoveryTarget,
  ModelAlias,
  ModelHealthCheck,
  ModelLibraryEntry,
  SessionDetail,
  SessionExportResult,
  SessionSearchResult,
  SessionSubmitMode,
  SessionTurnOverrides,
  SystemInfo,
  VaultStatus,
} from "../types";
import { sanitizeDaemonConnection } from "./daemonConnectionGuard";
import {
  bootstrapDaemonConnection,
  isSecureConnectionStoreAvailable,
  loadToken,
} from "./secureConnectionStore";

export type V3Envelope = SharedV3Envelope;

const GB_TO_BYTES = 1024 * 1024 * 1024;
const LMX_READ_TIMEOUT_MS = 30_000;
const LMX_MUTATION_TIMEOUT_MS = 120_000;
const DAEMON_AUTH_REPAIR_COOLDOWN_MS = 15_000;
const repairedTokenCache = new Map<string, string>();
const authRepairAttemptByEndpoint = new Map<string, number>();

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

export type DaemonLmxLoadStatus =
  | "loaded"
  | "download_required"
  | "downloading";

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
  const guarded = sanitizeDaemonConnection(connection).connection;
  const protocol = guarded.protocol ?? "http";
  return `${protocol}://${guarded.host}:${guarded.port}`;
}

function endpointKey(host: string, port: number): string {
  return `${host.trim().toLowerCase()}:${port}`;
}

function isLocalDaemonHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized === "0.0.0.0"
  );
}

async function tryRepairDaemonAuthToken(
  guarded: ReturnType<typeof sanitizeDaemonConnection>["connection"],
  attemptedToken: string,
): Promise<string | null> {
  if (!isSecureConnectionStoreAvailable()) return null;
  if (!isLocalDaemonHost(guarded.host)) return null;

  const key = endpointKey(guarded.host, guarded.port);
  const now = Date.now();
  const lastAttempt = authRepairAttemptByEndpoint.get(key) ?? 0;
  if (now - lastAttempt >= DAEMON_AUTH_REPAIR_COOLDOWN_MS) {
    authRepairAttemptByEndpoint.set(key, now);
    try {
      await bootstrapDaemonConnection(true);
    } catch {
      // Best-effort daemon bootstrap. Token load below is still attempted.
    }
  }

  try {
    const repaired = (await loadToken(guarded.host, guarded.port)).trim();
    if (!repaired || repaired === attemptedToken) return null;
    repairedTokenCache.set(key, repaired);
    return repaired;
  } catch {
    return null;
  }
}

async function daemonRequest<T>(
  connection: DaemonConnectionOptions,
  path: string,
  init: RequestInit = {},
  timeoutMs = LMX_READ_TIMEOUT_MS,
): Promise<T> {
  const guarded = sanitizeDaemonConnection(connection).connection;
  const endpoint = endpointKey(guarded.host, guarded.port);
  const initialToken = repairedTokenCache.get(endpoint) ?? guarded.token;

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const sendWithToken = async (token: string) => {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);
      if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      return fetch(`${baseUrl(connection)}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
    };

    let response = await sendWithToken(initialToken);
    if (response.status === 401 || response.status === 403) {
      const repairedToken = await tryRepairDaemonAuthToken(guarded, initialToken);
      if (repairedToken) {
        response = await sendWithToken(repairedToken);
      }
    }

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(
        `Daemon request failed (${response.status}): ${message || response.statusText}`,
      );
    }
    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Daemon request timed out (${timeoutMs}ms): ${path}`);
    }
    if (err instanceof TypeError && err.message.includes("fetch failed")) {
      throw new Error(
        `Connection refused: Cannot reach daemon at ${guarded.host}:${guarded.port}. Run 'opta daemon start' and check with 'opta daemon status'.`,
      );
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
    typeof parsed?.model_id === "string" ? parsed.model_id : fallbackModelId;

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
      typeof parsed?.download_id === "string" ? parsed.download_id : undefined,
    message: typeof parsed?.message === "string" ? parsed.message : undefined,
    confirm_url:
      typeof parsed?.confirm_url === "string" ? parsed.confirm_url : undefined,
    progress_url:
      typeof parsed?.progress_url === "string"
        ? parsed.progress_url
        : undefined,
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
    .filter((item): item is DaemonLmxDownloadProgress =>
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
  return new Error(`[${response.error.code}] ${response.error.message}`);
}

function normalizeSessionSummary(raw: unknown): DaemonSessionSummary | null {
  const record = asRecord(raw);
  if (!record) return null;
  const sessionId =
    typeof record.sessionId === "string"
      ? record.sessionId
      : typeof record.id === "string"
        ? record.id
        : "";
  if (!sessionId) return null;
  const title =
    typeof record.title === "string" && record.title.trim()
      ? record.title
      : `Session ${sessionId.slice(0, 7)}`;
  const workspace =
    typeof record.workspace === "string" && record.workspace.trim()
      ? record.workspace
      : "Workspace";
  const updatedAt =
    typeof record.updatedAt === "string"
      ? record.updatedAt
      : typeof record.updated_at === "string"
        ? record.updated_at
        : undefined;
  return {
    sessionId,
    title,
    workspace,
    updatedAt,
  };
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

function withPreferredToken(
  connection: DaemonConnectionOptions,
): DaemonConnectionOptions {
  const guarded = sanitizeDaemonConnection(connection).connection;
  const cachedToken = repairedTokenCache.get(
    endpointKey(guarded.host, guarded.port),
  );
  return {
    ...guarded,
    token: cachedToken ?? guarded.token,
  };
}

function isUnauthorizedDaemonError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized")
  );
}

function httpClient(connection: DaemonConnectionOptions): DaemonHttpClient {
  return new DaemonHttpClient(withPreferredToken(connection));
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
      mode?: SessionSubmitMode;
      overrides?: SessionTurnOverrides;
    },
  ): Promise<{ turnId?: string }> {
    return httpClient(connection).submitTurn(sessionId, {
      content: payload.content,
      clientId: payload.clientId ?? "opta-code-desktop",
      writerId: payload.writerId ?? "opta-code-desktop",
      mode: payload.mode ?? "chat",
      overrides: payload.overrides,
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
    const guarded = sanitizeDaemonConnection(connection).connection;
    const wsProtocol =
      (guarded.protocol ?? "http") === "https" ? "wss" : "ws";
    const url =
      `${wsProtocol}://${guarded.host}:${guarded.port}/v3/ws` +
      `?sessionId=${encodeURIComponent(sessionId)}` +
      `&afterSeq=${afterSeq}` +
      `&token=${encodeURIComponent(guarded.token)}`;

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
    const preferred = withPreferredToken(connection);
    try {
      return await httpClient(preferred).runOperation(id, payload);
    } catch (error) {
      if (!isUnauthorizedDaemonError(error)) throw error;
      const repairedToken = await tryRepairDaemonAuthToken(
        preferred,
        preferred.token,
      );
      if (!repairedToken) throw error;
      return httpClient({ ...preferred, token: repairedToken }).runOperation(
        id,
        payload,
      );
    }
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
    const rawValue =
      result && "value" in result ? result.value : response.result;
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
    const response = await daemonClient.runOperation(
      connection,
      "config.list",
      {
        input: {},
      },
    );
    if (!response.ok) throw operationError("config.list", response);
    const result = asRecord(response.result);
    if (!result) return {};
    const nestedConfig = asRecord(result.config);
    return nestedConfig ?? result;
  },

  async sessionsList(
    connection: DaemonConnectionOptions,
    input?: {
      model?: string;
      since?: string;
      tag?: string;
      limit?: number;
    },
  ): Promise<DaemonSessionSummary[]> {
    const response = await daemonClient.runOperation(
      connection,
      "sessions.list",
      {
        input: {
          model: input?.model,
          since: input?.since,
          tag: input?.tag,
          limit: input?.limit,
        },
      },
    );
    if (!response.ok) throw operationError("sessions.list", response);
    const rawList = Array.isArray(response.result)
      ? response.result
      : asRecord(response.result)?.sessions;
    if (!Array.isArray(rawList)) return [];
    return rawList
      .map((entry) => normalizeSessionSummary(entry))
      .filter((entry): entry is DaemonSessionSummary => Boolean(entry));
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
    const pushIfValid = (source: DaemonLmxEndpointSource, value: unknown) => {
      if (typeof value !== "string") return;
      const parsed = parseEndpointCandidate(source, value, candidates.length);
      if (parsed) candidates.push(parsed);
    };

    pushIfValid("preferred_base_url", endpoints.preferred_base_url);
    pushIfValid("openai_base_url", endpoints.openai_base_url);

    const baseUrls = Array.isArray(endpoints.base_urls)
      ? endpoints.base_urls
      : [];
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

  // ─── Environment Profiles ────────────────────────────────────────────────

  async envList(connection: DaemonConnectionOptions): Promise<EnvProfile[]> {
    const response = await daemonClient.runOperation(connection, "env.list", { input: {} });
    if (!response.ok) throw operationError("env.list", response);
    const result = asRecord(response.result);
    const list = Array.isArray(result?.profiles) ? result.profiles : Array.isArray(response.result) ? response.result : [];
    return list as EnvProfile[];
  },

  async envShow(connection: DaemonConnectionOptions, name: string): Promise<EnvProfile | null> {
    const response = await daemonClient.runOperation(connection, "env.show", { input: { name } });
    if (!response.ok) throw operationError("env.show", response);
    const record = asRecord(response.result);
    if (!record) return null;
    return {
      name: typeof record.name === "string" ? record.name : name,
      vars: typeof record.vars === "object" && record.vars !== null ? (record.vars as Record<string, string>) : {},
      description: typeof record.description === "string" ? record.description : undefined,
      isActive: typeof record.isActive === "boolean" ? record.isActive : false,
      createdAt: typeof record.createdAt === "string" ? record.createdAt : undefined,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
    };
  },

  async envSave(connection: DaemonConnectionOptions, profile: Pick<EnvProfile, "name" | "vars" | "description">): Promise<void> {
    const response = await daemonClient.runOperation(connection, "env.save", { input: profile });
    if (!response.ok) throw operationError("env.save", response);
  },

  async envUse(connection: DaemonConnectionOptions, name: string): Promise<void> {
    const response = await daemonClient.runOperation(connection, "env.use", { input: { name } });
    if (!response.ok) throw operationError("env.use", response);
  },

  async envDelete(connection: DaemonConnectionOptions, name: string): Promise<void> {
    const response = await daemonClient.runOperation(connection, "env.delete", { input: { name } });
    if (!response.ok) throw operationError("env.delete", response);
  },

  // ─── Session Manager (search / export / delete) ───────────────────────────

  async sessionSearch(
    connection: DaemonConnectionOptions,
    query: string,
    limit = 50,
  ): Promise<SessionSearchResult> {
    const response = await daemonClient.runOperation(connection, "sessions.search", { input: { query, limit } });
    if (!response.ok) throw operationError("sessions.search", response);
    const result = asRecord(response.result);
    const rawSessions = Array.isArray(result?.sessions) ? result.sessions : [];
    const sessions = rawSessions
      .map((s) => normalizeSessionSummary(s))
      .filter((s): s is DaemonSessionSummary => Boolean(s)) as SessionDetail[];
    return {
      sessions,
      total: typeof result?.total === "number" ? result.total : sessions.length,
      query,
    };
  },

  async sessionExport(
    connection: DaemonConnectionOptions,
    sessionId: string,
    format: "json" | "markdown" | "text" = "json",
    outputPath?: string,
  ): Promise<SessionExportResult> {
    const response = await daemonClient.runOperation(connection, "sessions.export", { input: { sessionId, format, outputPath } });
    if (!response.ok) throw operationError("sessions.export", response);
    const result = asRecord(response.result);
    return {
      sessionId,
      path: typeof result?.path === "string" ? result.path : "",
      format,
      sizeBytes: typeof result?.sizeBytes === "number" ? result.sizeBytes : undefined,
    };
  },

  async sessionDelete(connection: DaemonConnectionOptions, sessionId: string): Promise<void> {
    const response = await daemonClient.runOperation(connection, "sessions.delete", { input: { sessionId } });
    if (!response.ok) throw operationError("sessions.delete", response);
  },

  async sessionGet(connection: DaemonConnectionOptions, sessionId: string): Promise<SessionDetail | null> {
    // sessions.get is not a registered operation — find via sessions.search
    const results = await daemonClient.sessionSearch(connection, sessionId, 10);
    const match = results.sessions.find((s) => s.sessionId === sessionId);
    return match ?? null;
  },

  // ─── Daemon Process Control ───────────────────────────────────────────────

  async daemonControlStatus(connection: DaemonConnectionOptions): Promise<DaemonControlStatus> {
    const response = await daemonClient.runOperation(connection, "daemon.status", { input: {} });
    if (!response.ok) throw operationError("daemon.status", response);
    const result = asRecord(response.result);
    const stateRaw = result?.state;
    const validStates: DaemonProcessState[] = ["running", "stopped", "starting", "stopping", "unknown"];
    const state: DaemonProcessState = validStates.includes(stateRaw as DaemonProcessState) ? (stateRaw as DaemonProcessState) : "unknown";
    return {
      state,
      pid: typeof result?.pid === "number" ? result.pid : undefined,
      uptime: typeof result?.uptime === "number" ? result.uptime : undefined,
      version: typeof result?.version === "string" ? result.version : undefined,
      port: typeof result?.port === "number" ? result.port : undefined,
      logPath: typeof result?.logPath === "string" ? result.logPath : undefined,
      installedAs: ["launchd", "systemd", "schtasks", "manual"].includes(result?.installedAs as string)
        ? (result?.installedAs as "launchd" | "systemd" | "schtasks" | "manual")
        : null,
    };
  },

  async daemonControlLogs(
    connection: DaemonConnectionOptions,
    lines = 100,
  ): Promise<DaemonLogEntry[]> {
    const response = await daemonClient.runOperation(connection, "daemon.logs", { input: { lines } });
    if (!response.ok) throw operationError("daemon.logs", response);
    const result = asRecord(response.result);
    const rawLogs = Array.isArray(result?.logs) ? result.logs : Array.isArray(response.result) ? response.result : [];
    return rawLogs.map((entry) => {
      const r = asRecord(entry);
      return {
        timestamp: typeof r?.timestamp === "string" ? r.timestamp : undefined,
        level: (["info", "warn", "error", "debug"] as const).includes(r?.level as "info") ? (r?.level as "info" | "warn" | "error" | "debug") : undefined,
        message: typeof r?.message === "string" ? r.message : String(entry ?? ""),
        raw: typeof r?.raw === "string" ? r.raw : JSON.stringify(entry),
      };
    });
  },

  async daemonControlStart(connection: DaemonConnectionOptions): Promise<void> {
    const response = await daemonClient.runOperation(connection, "daemon.start", { input: {} });
    if (!response.ok) throw operationError("daemon.start", response);
  },

  async daemonControlStop(connection: DaemonConnectionOptions): Promise<void> {
    const response = await daemonClient.runOperation(connection, "daemon.stop", { input: {} });
    if (!response.ok) throw operationError("daemon.stop", response);
  },

  async daemonControlInstall(
    connection: DaemonConnectionOptions,
    serviceManager?: "launchd" | "systemd" | "schtasks",
  ): Promise<void> {
    const response = await daemonClient.runOperation(connection, "daemon.install", { input: { serviceManager } });
    if (!response.ok) throw operationError("daemon.install", response);
  },

  async daemonControlUninstall(connection: DaemonConnectionOptions): Promise<void> {
    const response = await daemonClient.runOperation(connection, "daemon.uninstall", { input: {} });
    if (!response.ok) throw operationError("daemon.uninstall", response);
  },

  // ─── System Info (version, doctor, updates) ───────────────────────────────

  async versionCheck(connection: DaemonConnectionOptions): Promise<{ current: string; latest: string | null; upToDate: boolean }> {
    const response = await daemonClient.runOperation(connection, "version.check", { input: {} });
    if (!response.ok) throw operationError("version.check", response);
    const result = asRecord(response.result);
    const current = typeof result?.current === "string" ? result.current : typeof result?.version === "string" ? result.version : "unknown";
    const latest = typeof result?.latest === "string" ? result.latest : null;
    return {
      current,
      latest,
      upToDate: latest ? current === latest : true,
    };
  },

  async doctorRun(connection: DaemonConnectionOptions, fix = false): Promise<SystemInfo> {
    const response = await daemonClient.runOperation(connection, "doctor", { input: { fix } });
    if (!response.ok) throw operationError("doctor", response);
    const result = asRecord(response.result);
    const rawChecks = Array.isArray(result?.checks) ? result.checks : [];
    const checks = rawChecks.map((c) => {
      const r = asRecord(c);
      const validStatus = ["pass", "warn", "fail", "skip"] as const;
      return {
        name: typeof r?.name === "string" ? r.name : "unknown",
        status: validStatus.includes(r?.status as "pass") ? (r?.status as "pass" | "warn" | "fail" | "skip") : "skip" as const,
        message: typeof r?.message === "string" ? r.message : undefined,
        fix: typeof r?.fix === "string" ? r.fix : undefined,
      };
    });
    const passed = checks.filter((c) => c.status === "pass").length;
    const warnings = checks.filter((c) => c.status === "warn").length;
    const failures = checks.filter((c) => c.status === "fail").length;
    const currentVersion = typeof result?.version === "string" ? result.version : "unknown";
    const latestVersion = typeof result?.latestVersion === "string" ? result.latestVersion : null;
    return {
      currentVersion,
      latestVersion,
      upToDate: latestVersion ? currentVersion === latestVersion : null,
      updateAvailable: latestVersion ? currentVersion !== latestVersion : null,
      checks,
      doctorSummary: { passed, warnings, failures },
    };
  },

  async updateRun(connection: DaemonConnectionOptions): Promise<{ started: boolean; message?: string }> {
    const response = await daemonClient.runOperation(connection, "update.run", { input: {} });
    if (!response.ok) throw operationError("update.run", response);
    const result = asRecord(response.result);
    return {
      started: true,
      message: typeof result?.message === "string" ? result.message : undefined,
    };
  },

  // ─── Model Aliases ────────────────────────────────────────────────────────

  async modelAliasesList(connection: DaemonConnectionOptions): Promise<ModelAlias[]> {
    const response = await daemonClient.runOperation(connection, "models.aliases.list", { input: {} });
    if (!response.ok) throw operationError("models.aliases.list", response);
    const result = asRecord(response.result);
    const rawList = Array.isArray(result?.aliases) ? result.aliases : Array.isArray(response.result) ? response.result : [];
    return rawList.map((a) => {
      const r = asRecord(a);
      return {
        alias: typeof r?.alias === "string" ? r.alias : String(a),
        target: typeof r?.target === "string" ? r.target : "",
        provider: typeof r?.provider === "string" ? r.provider : undefined,
        description: typeof r?.description === "string" ? r.description : undefined,
      };
    });
  },

  async modelAliasSet(
    connection: DaemonConnectionOptions,
    alias: string,
    target: string,
    provider?: string,
  ): Promise<void> {
    const response = await daemonClient.runOperation(connection, "models.aliases.set", { input: { alias, target, provider } });
    if (!response.ok) throw operationError("models.aliases.set", response);
  },

  async modelAliasDelete(connection: DaemonConnectionOptions, alias: string): Promise<void> {
    const response = await daemonClient.runOperation(connection, "models.aliases.delete", { input: { alias } });
    if (!response.ok) throw operationError("models.aliases.delete", response);
  },

  async modelsBrowseLibrary(
    connection: DaemonConnectionOptions,
    query?: string,
    limit = 20,
  ): Promise<ModelLibraryEntry[]> {
    const response = await daemonClient.runOperation(connection, "models.browse.library", { input: { query, limit } });
    if (!response.ok) throw operationError("models.browse.library", response);
    const result = asRecord(response.result);
    const rawList = Array.isArray(result?.models) ? result.models : Array.isArray(response.result) ? response.result : [];
    return rawList.map((m) => {
      const r = asRecord(m);
      return {
        repoId: typeof r?.repoId === "string" ? r.repoId : typeof r?.repo_id === "string" ? r.repo_id : String(m),
        name: typeof r?.name === "string" ? r.name : "",
        description: typeof r?.description === "string" ? r.description : undefined,
        tags: Array.isArray(r?.tags) ? r.tags.filter((t): t is string => typeof t === "string") : undefined,
        sizeBytes: typeof r?.sizeBytes === "number" ? r.sizeBytes : undefined,
        sizeHuman: typeof r?.sizeHuman === "string" ? r.sizeHuman : undefined,
        quantization: typeof r?.quantization === "string" ? r.quantization : undefined,
        downloads: typeof r?.downloads === "number" ? r.downloads : undefined,
        isLocal: typeof r?.isLocal === "boolean" ? r.isLocal : false,
        isLoaded: typeof r?.isLoaded === "boolean" ? r.isLoaded : false,
      };
    });
  },

  async modelsHealth(connection: DaemonConnectionOptions): Promise<ModelHealthCheck[]> {
    const response = await daemonClient.runOperation(connection, "models.health", { input: {} });
    if (!response.ok) throw operationError("models.health", response);
    const result = asRecord(response.result);
    const rawList = Array.isArray(result?.models) ? result.models : Array.isArray(response.result) ? response.result : [];
    return rawList.map((m) => {
      const r = asRecord(m);
      const validStatus = ["healthy", "degraded", "unavailable"] as const;
      return {
        modelId: typeof r?.modelId === "string" ? r.modelId : typeof r?.model_id === "string" ? r.model_id : "",
        status: validStatus.includes(r?.status as "healthy") ? (r?.status as "healthy" | "degraded" | "unavailable") : "unavailable",
        latencyMs: typeof r?.latencyMs === "number" ? r.latencyMs : undefined,
        error: typeof r?.error === "string" ? r.error : undefined,
      };
    });
  },

  // ─── Audio ────────────────────────────────────────────────────────────────

  async audioTranscribe(
    connection: DaemonConnectionOptions,
    audioPath: string,
    options?: { language?: string; model?: string },
  ): Promise<AudioTranscribeResult> {
    const response = await daemonClient.runOperation(connection, "audio.transcribe", { input: { audioPath, ...options } });
    if (!response.ok) throw operationError("audio.transcribe", response);
    const result = asRecord(response.result);
    return {
      text: typeof result?.text === "string" ? result.text : "",
      language: typeof result?.language === "string" ? result.language : undefined,
      durationMs: typeof result?.durationMs === "number" ? result.durationMs : undefined,
      confidence: typeof result?.confidence === "number" ? result.confidence : undefined,
    };
  },

  async audioTts(
    connection: DaemonConnectionOptions,
    text: string,
    options?: { voice?: string; format?: string; model?: string },
  ): Promise<AudioTtsResult> {
    const response = await daemonClient.runOperation(connection, "audio.tts", { input: { text, ...options } });
    if (!response.ok) throw operationError("audio.tts", response);
    const result = asRecord(response.result);
    return {
      audioPath: typeof result?.audioPath === "string" ? result.audioPath : undefined,
      audioUrl: typeof result?.audioUrl === "string" ? result.audioUrl : undefined,
      durationMs: typeof result?.durationMs === "number" ? result.durationMs : undefined,
      format: typeof result?.format === "string" ? result.format : undefined,
    };
  },

  // ─── Account & Vault ─────────────────────────────────────────────────────

  async accountStatus(connection: DaemonConnectionOptions): Promise<AccountStatus> {
    const response = await daemonClient.runOperation(connection, "account.status", { input: {} });
    if (!response.ok) throw operationError("account.status", response);
    const result = asRecord(response.result);
    return {
      loggedIn: typeof result?.loggedIn === "boolean" ? result.loggedIn : false,
      email: typeof result?.email === "string" ? result.email : undefined,
      userId: typeof result?.userId === "string" ? result.userId : undefined,
      tier: typeof result?.tier === "string" ? result.tier : undefined,
      plan: typeof result?.plan === "string" ? result.plan : undefined,
    };
  },

  async accountLogin(
    connection: DaemonConnectionOptions,
    options?: { provider?: string; token?: string },
  ): Promise<{ url?: string; success: boolean }> {
    const response = await daemonClient.runOperation(connection, "account.login", { input: options ?? {} });
    if (!response.ok) throw operationError("account.login", response);
    const result = asRecord(response.result);
    return {
      url: typeof result?.url === "string" ? result.url : undefined,
      success: typeof result?.success === "boolean" ? result.success : true,
    };
  },

  async accountLogout(connection: DaemonConnectionOptions): Promise<void> {
    const response = await daemonClient.runOperation(connection, "account.logout", { input: {} });
    if (!response.ok) throw operationError("account.logout", response);
  },

  async vaultStatus(connection: DaemonConnectionOptions): Promise<VaultStatus> {
    const response = await daemonClient.runOperation(connection, "vault.status", { input: {} });
    if (!response.ok) throw operationError("vault.status", response);
    const result = asRecord(response.result);
    const validSyncStatus = ["synced", "behind", "ahead", "conflict", "offline", "unknown"] as const;
    const rawSync = result?.syncStatus;
    return {
      syncStatus: validSyncStatus.includes(rawSync as "synced") ? (rawSync as typeof validSyncStatus[number]) : "unknown",
      keyCount: typeof result?.keyCount === "number" ? result.keyCount : 0,
      ruleCount: typeof result?.ruleCount === "number" ? result.ruleCount : 0,
      lastSync: typeof result?.lastSync === "string" ? result.lastSync : undefined,
      remoteVersion: typeof result?.remoteVersion === "number" ? result.remoteVersion : undefined,
      localVersion: typeof result?.localVersion === "number" ? result.localVersion : undefined,
    };
  },

  async vaultPull(connection: DaemonConnectionOptions): Promise<{ applied: number }> {
    const response = await daemonClient.runOperation(connection, "vault.pull", { input: {} });
    if (!response.ok) throw operationError("vault.pull", response);
    const result = asRecord(response.result);
    return { applied: typeof result?.applied === "number" ? result.applied : 0 };
  },

  async vaultPushRules(connection: DaemonConnectionOptions): Promise<{ pushed: number }> {
    const response = await daemonClient.runOperation(connection, "vault.push-rules", { input: {} });
    if (!response.ok) throw operationError("vault.push", response);
    const result = asRecord(response.result);
    return { pushed: typeof result?.pushed === "number" ? result.pushed : 0 };
  },

  async keychainStatus(connection: DaemonConnectionOptions): Promise<KeychainStatus> {
    const response = await daemonClient.runOperation(connection, "keychain.status", { input: {} });
    if (!response.ok) throw operationError("keychain.status", response);
    const result = asRecord(response.result);
    const rawProviders = asRecord(result?.providers) ?? {};
    const validProviders = ["anthropic", "lmx", "gemini", "openai", "opencode-zen"] as const;
    const providers = Object.fromEntries(
      validProviders.map((p) => {
        const entry = asRecord(rawProviders[p]);
        return [p, { stored: typeof entry?.stored === "boolean" ? entry.stored : false, lastSet: typeof entry?.lastSet === "string" ? entry.lastSet : undefined }];
      }),
    ) as KeychainStatus["providers"];
    return { providers };
  },

  // ─── Browser Runtime ─────────────────────────────────────────────────────

  async browserRuntimeStatus(connection: DaemonConnectionOptions): Promise<BrowserRuntimeStatus> {
    const response = await daemonClient.runOperation(connection, "browser.runtime", { input: {} });
    if (!response.ok) throw operationError("browser.status", response);
    const result = asRecord(response.result);
    const rawSlots = Array.isArray(result?.slots) ? result.slots : [];
    const slots = rawSlots.map((s) => {
      const r = asRecord(s);
      const validState = ["idle", "active", "closing"] as const;
      return {
        slotId: typeof r?.slotId === "string" ? r.slotId : "",
        state: validState.includes(r?.state as "idle") ? (r?.state as "idle" | "active" | "closing") : "idle" as const,
        url: typeof r?.url === "string" ? r.url : undefined,
        title: typeof r?.title === "string" ? r.title : undefined,
        createdAt: typeof r?.createdAt === "string" ? r.createdAt : undefined,
      };
    });
    return {
      enabled: typeof result?.enabled === "boolean" ? result.enabled : false,
      slots,
      activeSessions: typeof result?.activeSessions === "number" ? result.activeSessions : slots.filter((s) => s.state === "active").length,
      maxSessions: typeof result?.maxSessions === "number" ? result.maxSessions : 5,
    };
  },

  // ─── LAN Discovery ───────────────────────────────────────────────────────
  // LAN discovery is surfaced via lmxDiscovery endpoint candidates rather than
  // a dedicated daemon operation (no 'discovery.list' in the registry).

  async discoveryList(connection: DaemonConnectionOptions): Promise<LanDiscoveryTarget[]> {
    try {
      const discovery = await daemonClient.lmxDiscovery(connection);
      const candidates = daemonClient.extractLmxEndpointCandidates(discovery);
      return candidates.map((c) => ({
        host: c.host,
        port: c.port,
        name: `LMX (${c.source})`,
        source: "mdns" as const,
        reachable: true,
      }));
    } catch {
      return [];
    }
  },
};
