import { useCallback, useEffect, useState } from "react";
import { daemonClient } from "../lib/daemonClient";
import type { DaemonConnectionOptions, SystemInfo } from "../types";

export interface UseSystemInfoState {
  info: SystemInfo | null;
  loading: boolean;
  updating: boolean;
  error: string | null;
  updateMessage: string | null;
  refresh: () => Promise<void>;
  runDoctor: (fix?: boolean) => Promise<void>;
  runUpdate: () => Promise<void>;
}

export function useSystemInfo(connection: DaemonConnectionOptions): UseSystemInfoState {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Run doctor (without --fix) to get full system info including checks + version
      const systemInfo = await daemonClient.doctorRun(connection, false);
      setInfo(systemInfo);
    } catch (err) {
      // Fallback: if doctor fails, try version check only
      try {
        const v = await daemonClient.versionCheck(connection);
        setInfo({
          currentVersion: v.current,
          latestVersion: v.latest,
          upToDate: v.upToDate,
          updateAvailable: !v.upToDate,
          checks: [],
          doctorSummary: { passed: 0, warnings: 0, failures: 0 },
        });
      } catch {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runDoctor = useCallback(
    async (fix = false) => {
      setLoading(true);
      setError(null);
      try {
        const systemInfo = await daemonClient.doctorRun(connection, fix);
        setInfo(systemInfo);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [connection],
  );

  const runUpdate = useCallback(async () => {
    setUpdating(true);
    setError(null);
    setUpdateMessage(null);
    try {
      const result = await daemonClient.updateRun(connection);
      setUpdateMessage(result.message ?? "Update started. Check daemon logs for progress.");
      // Refresh version info after a short delay
      await new Promise((resolve) => globalThis.setTimeout(resolve, 3000));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdating(false);
    }
  }, [connection, refresh]);

  return { info, loading, updating, error, updateMessage, refresh, runDoctor, runUpdate };
}
