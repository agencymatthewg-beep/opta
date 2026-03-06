import { useCallback, useEffect, useRef, useState } from "react";
import { daemonClient } from "../lib/daemonClient";
import type { DaemonConnectionOptions, DaemonControlStatus, DaemonLogEntry } from "../types";

const POLL_INTERVAL_MS = 5_000;

export interface UseDaemonControlState {
  status: DaemonControlStatus | null;
  logs: DaemonLogEntry[];
  loading: boolean;
  actionRunning: boolean;
  logsLoading: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
  refreshLogs: (lines?: number) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  install: (serviceManager?: "launchd" | "systemd" | "schtasks") => Promise<void>;
  uninstall: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

export function useDaemonControl(connection: DaemonConnectionOptions): UseDaemonControlState {
  const [status, setStatus] = useState<DaemonControlStatus | null>(null);
  const [logs, setLogs] = useState<DaemonLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionRunning, setActionRunning] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await daemonClient.daemonControlStatus(connection);
      setStatus(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connection]);

  const refreshLogs = useCallback(
    async (lines = 200) => {
      setLogsLoading(true);
      try {
        const entries = await daemonClient.daemonControlLogs(connection, lines);
        setLogs(entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLogsLoading(false);
      }
    },
    [connection],
  );

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const runAction = useCallback(
    async (fn: () => Promise<void>) => {
      setActionRunning(true);
      setError(null);
      try {
        await fn();
        // Wait briefly so the daemon state can settle before refreshing
        await new Promise((resolve) => globalThis.setTimeout(resolve, 1000));
        await refreshStatus();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setActionRunning(false);
      }
    },
    [refreshStatus],
  );

  const start = useCallback(() => runAction(() => daemonClient.daemonControlStart(connection)), [connection, runAction]);
  const stop = useCallback(() => runAction(() => daemonClient.daemonControlStop(connection)), [connection, runAction]);
  const install = useCallback(
    (serviceManager?: "launchd" | "systemd" | "schtasks") =>
      runAction(() => daemonClient.daemonControlInstall(connection, serviceManager)),
    [connection, runAction],
  );
  const uninstall = useCallback(() => runAction(() => daemonClient.daemonControlUninstall(connection)), [connection, runAction]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = globalThis.setInterval(() => void refreshStatus(), POLL_INTERVAL_MS);
  }, [refreshStatus]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      globalThis.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { status, logs, loading, actionRunning, logsLoading, error, refreshStatus, refreshLogs, start, stop, install, uninstall, startPolling, stopPolling };
}
