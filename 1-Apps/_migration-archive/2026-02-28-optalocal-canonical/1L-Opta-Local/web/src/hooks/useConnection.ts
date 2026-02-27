'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { LMXClient } from '@/lib/lmx-client';
import type { ConnectionSettings } from '@/lib/connection';

export interface UseConnectionReturn {
  connectionType: 'lan' | 'tunnel' | 'probing';
  baseUrl: string;
  isConnected: boolean;
  latencyMs: number | null;
  error: string | null;
  recheckNow: () => Promise<void>;
  client: LMXClient | null;
  adminKey: string;
}

function resolveBaseUrl(settings: ConnectionSettings): string {
  if (settings.useTunnel && settings.tunnelUrl.trim()) {
    return settings.tunnelUrl.trim().replace(/\/+$/, '');
  }

  return `http://${settings.host}:${settings.port}`;
}

export function useConnection(settings: ConnectionSettings): UseConnectionReturn {
  const baseUrl = useMemo(() => resolveBaseUrl(settings), [settings]);

  const client = useMemo(
    () => new LMXClient(baseUrl, settings.adminKey),
    [baseUrl, settings.adminKey],
  );

  const [isConnected, setIsConnected] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recheckNow = useCallback(async () => {
    const start = performance.now();
    try {
      await client.getStatus();
      setIsConnected(true);
      setLatencyMs(Math.max(0, Math.round(performance.now() - start)));
      setError(null);
    } catch (nextError) {
      setIsConnected(false);
      setLatencyMs(null);
      setError(nextError instanceof Error ? nextError.message : 'Connection failed');
    }
  }, [client]);

  useEffect(() => {
    void recheckNow();
  }, [recheckNow]);

  return {
    connectionType: settings.useTunnel && settings.tunnelUrl ? 'tunnel' : 'lan',
    baseUrl,
    isConnected,
    latencyMs,
    error,
    recheckNow,
    client,
    adminKey: settings.adminKey,
  };
}
