import { useCallback, useEffect, useRef, useState } from "react";
import { daemonClient } from "../lib/daemonClient";
import type { BrowserRuntimeStatus, DaemonConnectionOptions } from "../types";

const POLL_INTERVAL_MS = 4_000;

export interface UseBrowserRuntimeState {
  status: BrowserRuntimeStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

export function useBrowserRuntime(connection: DaemonConnectionOptions): UseBrowserRuntimeState {
  const [status, setStatus] = useState<BrowserRuntimeStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await daemonClient.browserRuntimeStatus(connection);
      setStatus(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = globalThis.setInterval(() => void refresh(), POLL_INTERVAL_MS);
  }, [refresh]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      globalThis.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { status, loading, error, refresh, startPolling, stopPolling };
}
