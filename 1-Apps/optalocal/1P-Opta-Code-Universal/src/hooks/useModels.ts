import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DaemonConnectionOptions,
  DaemonLmxAvailableModel,
  DaemonLmxLoadOptions,
  DaemonLmxMemoryResponse,
  DaemonLmxModelDetail,
  DaemonLmxStatusResponse,
} from "../types";
import type {
  DaemonLmxDownloadProgress,
  DaemonLmxLoadResponse,
} from "../lib/daemonClient";
import { daemonClient } from "../lib/daemonClient";

const LMX_POLL_MS = 5_000;

export interface UseModelsResult {
  lmxStatus: DaemonLmxStatusResponse | null;
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
  refreshLmx: () => Promise<void>;
}

export function useModels(
  connection: DaemonConnectionOptions | null,
): UseModelsResult {
  const [lmxStatus, setLmxStatus] = useState<DaemonLmxStatusResponse | null>(
    null,
  );
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
      const [statusRes, modelsRes, memoryRes, availableRes] = await Promise.all(
        [
          daemonClient.lmxStatus(connection).catch(() => null),
          daemonClient.lmxModels(connection).catch(() => null),
          daemonClient.lmxMemory(connection).catch(() => null),
          daemonClient.lmxAvailable(connection).catch(() => null),
        ],
      );

      if (!mountedRef.current || epoch !== refreshEpochRef.current) {
        return;
      }

      const anyReachable = Boolean(
        statusRes || modelsRes || memoryRes || availableRes,
      );

      if (statusRes) {
        setLmxStatus(statusRes);
      }
      setLmxReachable(anyReachable);
      setError(anyReachable ? null : "LMX server unreachable");

      if (modelsRes) setLoadedModels(modelsRes.models);
      if (memoryRes) setMemory(memoryRes);
      if (availableRes) setAvailableModels(availableRes);
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
    async (confirmationToken: string): Promise<DaemonLmxLoadResponse | null> => {
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

  useEffect(() => {
    if (!connection) return;
    void refreshLmx();
    const timer = window.setInterval(() => void refreshLmx(), LMX_POLL_MS);
    return () => window.clearInterval(timer);
  }, [connection, refreshLmx]);

  return {
    lmxStatus,
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
    refreshLmx,
  };
}
