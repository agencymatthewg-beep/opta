import { useCallback, useEffect, useRef, useState } from "react";
import { daemonClient } from "../lib/daemonClient";
import type { DaemonConnectionOptions, LanDiscoveryTarget } from "../types";

const SCAN_COOLDOWN_MS = 10_000;

export interface UseConnectionDiscoveryState {
  targets: LanDiscoveryTarget[];
  loading: boolean;
  scanning: boolean;
  error: string | null;
  lastScannedAt: number | null;
  scan: () => Promise<void>;
  connect: (target: LanDiscoveryTarget) => void;
}

export function useConnectionDiscovery(
  connection: DaemonConnectionOptions,
  onConnect?: (target: LanDiscoveryTarget) => void,
): UseConnectionDiscoveryState {
  const [targets, setTargets] = useState<LanDiscoveryTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScannedAt, setLastScannedAt] = useState<number | null>(null);
  const lastScanRef = useRef<number>(0);

  const scan = useCallback(async () => {
    const now = Date.now();
    if (now - lastScanRef.current < SCAN_COOLDOWN_MS) return;
    lastScanRef.current = now;

    setScanning(true);
    setError(null);
    try {
      const list = await daemonClient.discoveryList(connection);
      setTargets(list);
      setLastScannedAt(now);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }, [connection]);

  useEffect(() => {
    setLoading(true);
    void scan().finally(() => setLoading(false));
  }, [scan]);

  const connect = useCallback(
    (target: LanDiscoveryTarget) => {
      onConnect?.(target);
    },
    [onConnect],
  );

  return { targets, loading, scanning, error, lastScannedAt, scan, connect };
}
