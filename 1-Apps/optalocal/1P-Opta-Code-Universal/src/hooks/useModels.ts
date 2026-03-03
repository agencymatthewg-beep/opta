import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DaemonConnectionOptions,
  DaemonLmxAvailableModel,
  DaemonLmxDiscoveryResponse,
  DaemonLmxLoadOptions,
  DaemonLmxMemoryResponse,
  DaemonLmxModelDetail,
  DaemonLmxStatusResponse,
} from "../types";
import type {
  DaemonLmxEndpointCandidate,
  DaemonLmxDownloadProgress,
  DaemonLmxLoadResponse,
} from "../lib/daemonClient";
import { daemonClient } from "../lib/daemonClient";

const LMX_POLL_MS = 5_000;

export interface LmxTargetConfig {
  host: string;
  port: number;
  fallbackHosts: string[];
  autoDiscover: boolean;
}

function parseHostList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => String(entry).trim())
      .filter(
        (entry, index, list) =>
          entry.length > 0 && list.indexOf(entry) === index,
      );
  }
  if (typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => String(entry).trim())
          .filter(
            (entry, index, list) =>
              entry.length > 0 && list.indexOf(entry) === index,
          );
      }
    } catch {
      // Fall through to CSV parsing.
    }
  }
  return trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter(
      (entry, index, list) => entry.length > 0 && list.indexOf(entry) === index,
    );
}

function parsePort(raw: unknown, fallback: number): number {
  const candidate =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : Number.NaN;
  if (!Number.isFinite(candidate) || candidate <= 0 || candidate > 65_535) {
    return fallback;
  }
  return candidate;
}

function parseBoolean(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

export interface UseModelsResult {
  lmxStatus: DaemonLmxStatusResponse | null;
  lmxDiscovery: DaemonLmxDiscoveryResponse | null;
  lmxEndpointCandidates: DaemonLmxEndpointCandidate[];
  lmxTarget: LmxTargetConfig | null;
  loadedModels: DaemonLmxModelDetail[];
  availableModels: DaemonLmxAvailableModel[];
  memory: DaemonLmxMemoryResponse | null;
  lmxReachable: boolean;
  loading: boolean;
  error: string | null;
  loadModel: (
    modelId: string,
    opts?: DaemonLmxLoadOptions,
  ) => Promise<DaemonLmxLoadResponse | null>;
  confirmLoad: (
    confirmationToken: string,
  ) => Promise<DaemonLmxLoadResponse | null>;
  downloadProgress: (
    downloadId: string,
  ) => Promise<DaemonLmxDownloadProgress | null>;
  listDownloads: () => Promise<DaemonLmxDownloadProgress[]>;
  unloadModel: (modelId: string) => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  downloadModel: (repoId: string) => Promise<string | null>;
  runModelHistory: () => Promise<unknown | null>;
  runModelHealth: (args?: string) => Promise<unknown | null>;
  runModelScan: (opts?: { full?: boolean }) => Promise<unknown | null>;
  saveLmxTarget: (next: Partial<LmxTargetConfig>) => Promise<boolean>;
  refreshLmx: () => Promise<void>;
}

export function useModels(
  connection: DaemonConnectionOptions | null,
): UseModelsResult {
  const [lmxStatus, setLmxStatus] = useState<DaemonLmxStatusResponse | null>(
    null,
  );
  const [lmxDiscovery, setLmxDiscovery] =
    useState<DaemonLmxDiscoveryResponse | null>(null);
  const [lmxEndpointCandidates, setLmxEndpointCandidates] = useState<
    DaemonLmxEndpointCandidate[]
  >([]);
  const [lmxTarget, setLmxTarget] = useState<LmxTargetConfig | null>(null);
  const [loadedModels, setLoadedModels] = useState<DaemonLmxModelDetail[]>([]);
  const [availableModels, setAvailableModels] = useState<
    DaemonLmxAvailableModel[]
  >([]);
  const [memory, setMemory] = useState<DaemonLmxMemoryResponse | null>(null);
  const [lmxReachable, setLmxReachable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshLockRef = useRef(false);
  const mountedRef = useRef(true);
  const refreshEpochRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshLmx = useCallback(async () => {
    if (!connection || refreshLockRef.current) return;
    refreshLockRef.current = true;
    const epoch = ++refreshEpochRef.current;
    setLoading(true);

    try {
      const [
        statusRes,
        discoveryRes,
        modelsRes,
        memoryRes,
        availableRes,
        hostRaw,
        portRaw,
        fallbackHostsRaw,
        autoDiscoverRaw,
      ] = await Promise.all([
        daemonClient.lmxStatus(connection).catch(() => null),
        daemonClient.lmxDiscovery(connection).catch(() => null),
        daemonClient.lmxModels(connection).catch(() => null),
        daemonClient.lmxMemory(connection).catch(() => null),
        daemonClient.lmxAvailable(connection).catch(() => null),
        daemonClient.configGet(connection, "connection.host").catch(() => null),
        daemonClient.configGet(connection, "connection.port").catch(() => null),
        daemonClient
          .configGet(connection, "connection.fallbackHosts")
          .catch(() => []),
        daemonClient
          .configGet(connection, "connection.autoDiscover")
          .catch(() => true),
      ]);

      if (!mountedRef.current || epoch !== refreshEpochRef.current) {
        return;
      }

      const anyReachable = Boolean(
        statusRes || discoveryRes || modelsRes || memoryRes || availableRes,
      );
      const loadedFromStatus = statusRes?.models ?? [];
      const nextLoadedModels = modelsRes?.models ?? loadedFromStatus;

      if (statusRes) {
        setLmxStatus(statusRes);
      }
      if (discoveryRes) {
        setLmxDiscovery(discoveryRes);
        setLmxEndpointCandidates(
          daemonClient.extractLmxEndpointCandidates(discoveryRes),
        );
      } else {
        setLmxDiscovery(null);
        setLmxEndpointCandidates([]);
      }
      const nextTarget: LmxTargetConfig = {
        host:
          typeof hostRaw === "string" && hostRaw.trim().length > 0
            ? hostRaw.trim()
            : connection.host,
        port: parsePort(portRaw, connection.port),
        fallbackHosts: parseHostList(fallbackHostsRaw),
        autoDiscover: parseBoolean(autoDiscoverRaw, true),
      };
      setLmxTarget(nextTarget);
      setLmxReachable(anyReachable);
      if (!anyReachable) {
        setError("LMX server unreachable");
      } else if (!modelsRes) {
        setError("LMX reachable, but model inventory endpoint is unavailable");
      } else {
        setError(null);
      }

      setLoadedModels(nextLoadedModels);
      setMemory(memoryRes ?? null);
      setAvailableModels(availableRes ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!mountedRef.current || epoch !== refreshEpochRef.current) {
        return;
      }
      setLmxReachable(false);
      setError(message);
    } finally {
      if (mountedRef.current && epoch === refreshEpochRef.current) {
        setLoading(false);
      }
      refreshLockRef.current = false;
    }
  }, [connection]);

  const loadModel = useCallback(
    async (
      modelId: string,
      opts?: DaemonLmxLoadOptions,
    ): Promise<DaemonLmxLoadResponse | null> => {
      if (!connection) return null;
      try {
        const result = await daemonClient.lmxLoad(connection, modelId, opts);
        setError(null);
        await refreshLmx();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [connection, refreshLmx],
  );

  const confirmLoad = useCallback(
    async (
      confirmationToken: string,
    ): Promise<DaemonLmxLoadResponse | null> => {
      if (!connection) return null;
      try {
        const result = await daemonClient.lmxConfirmLoad(
          connection,
          confirmationToken,
        );
        setError(null);
        await refreshLmx();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [connection, refreshLmx],
  );

  const downloadProgress = useCallback(
    async (downloadId: string): Promise<DaemonLmxDownloadProgress | null> => {
      if (!connection) return null;
      try {
        return await daemonClient.lmxDownloadProgress(connection, downloadId);
      } catch {
        return null;
      }
    },
    [connection],
  );

  const listDownloads = useCallback(async (): Promise<
    DaemonLmxDownloadProgress[]
  > => {
    if (!connection) return [];
    try {
      return await daemonClient.lmxDownloads(connection);
    } catch {
      return [];
    }
  }, [connection]);

  const unloadModel = useCallback(
    async (modelId: string) => {
      if (!connection) return;
      try {
        await daemonClient.lmxUnload(connection, modelId);
        await refreshLmx();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [connection, refreshLmx],
  );

  const deleteModel = useCallback(
    async (modelId: string) => {
      if (!connection) return;
      try {
        await daemonClient.lmxDelete(connection, modelId);
        await refreshLmx();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [connection, refreshLmx],
  );

  const downloadModel = useCallback(
    async (repoId: string): Promise<string | null> => {
      if (!connection) return null;
      try {
        const res = await daemonClient.lmxDownload(connection, repoId);
        return res.download_id;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [connection],
  );

  const runModelOperation = useCallback(
    async (
      operationId: string,
      input: Record<string, unknown>,
      refreshAfter = false,
    ): Promise<unknown | null> => {
      if (!connection) return null;
      try {
        const response = await daemonClient.runOperation(
          connection,
          operationId,
          {
            input,
          },
        );
        if (!response.ok) {
          throw new Error(`[${response.error.code}] ${response.error.message}`);
        }
        setError(null);
        if (refreshAfter) {
          await refreshLmx();
        }
        return response.result ?? null;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [connection, refreshLmx],
  );

  const runModelHistory = useCallback(async (): Promise<unknown | null> => {
    return runModelOperation("models.history", {});
  }, [runModelOperation]);

  const runModelHealth = useCallback(
    async (args?: string): Promise<unknown | null> => {
      const trimmed = args?.trim();
      return runModelOperation("models.health", {
        args: trimmed ? trimmed : undefined,
      });
    },
    [runModelOperation],
  );

  const runModelScan = useCallback(
    async (opts?: { full?: boolean }): Promise<unknown | null> => {
      return runModelOperation(
        "models.scan",
        { full: opts?.full ?? false },
        true,
      );
    },
    [runModelOperation],
  );

  const saveLmxTarget = useCallback(
    async (next: Partial<LmxTargetConfig>): Promise<boolean> => {
      if (!connection) return false;
      const current: LmxTargetConfig = lmxTarget ?? {
        host: connection.host,
        port: connection.port,
        fallbackHosts: [],
        autoDiscover: true,
      };
      const nextHost =
        typeof next.host === "string" && next.host.trim().length > 0
          ? next.host.trim()
          : current.host;
      const nextPort = parsePort(next.port, current.port);
      const nextFallbackHosts =
        next.fallbackHosts !== undefined
          ? parseHostList(next.fallbackHosts)
          : current.fallbackHosts;
      const nextAutoDiscover =
        next.autoDiscover !== undefined
          ? Boolean(next.autoDiscover)
          : current.autoDiscover;

      try {
        await Promise.all([
          daemonClient.configSet(connection, "connection.host", nextHost),
          daemonClient.configSet(connection, "connection.port", nextPort),
          daemonClient.configSet(
            connection,
            "connection.fallbackHosts",
            nextFallbackHosts,
          ),
          daemonClient.configSet(
            connection,
            "connection.autoDiscover",
            nextAutoDiscover,
          ),
        ]);
        setError(null);
        await refreshLmx();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      }
    },
    [connection, lmxTarget, refreshLmx],
  );

  useEffect(() => {
    if (!connection) return;
    void refreshLmx();
    const timer = window.setInterval(() => void refreshLmx(), LMX_POLL_MS);
    return () => window.clearInterval(timer);
  }, [connection, refreshLmx]);

  return {
    lmxStatus,
    lmxDiscovery,
    lmxEndpointCandidates,
    lmxTarget,
    loadedModels,
    availableModels,
    memory,
    lmxReachable,
    loading,
    error,
    loadModel,
    confirmLoad,
    downloadProgress,
    listDownloads,
    unloadModel,
    deleteModel,
    downloadModel,
    runModelHistory,
    runModelHealth,
    runModelScan,
    saveLmxTarget,
    refreshLmx,
  };
}
