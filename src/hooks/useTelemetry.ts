/**
 * React hook for hardware telemetry.
 *
 * Provides polling-based access to system telemetry data via Tauri commands.
 * Handles loading states, errors, and automatic refresh.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SystemSnapshot } from '../types/telemetry';

/**
 * Return type for useTelemetry hook.
 */
export interface UseTelemetryResult {
  /** Current telemetry data, null if not yet loaded */
  telemetry: SystemSnapshot | null;
  /** Error message if telemetry fetch failed */
  error: string | null;
  /** Whether initial load is in progress */
  loading: boolean;
  /** Last successful update timestamp */
  lastUpdated: Date | null;
  /** Manually refresh telemetry data */
  refetch: () => Promise<void>;
  /** Whether a refresh is currently in progress */
  refreshing: boolean;
}

/**
 * Hook to fetch and poll hardware telemetry data.
 *
 * @param pollingIntervalMs - Polling interval in milliseconds (default: 2000ms)
 * @returns Telemetry data, loading state, error, and refresh function
 *
 * @example
 * ```tsx
 * const { telemetry, loading, error } = useTelemetry();
 *
 * if (loading) return <Spinner />;
 * if (error) return <Error message={error} />;
 *
 * return (
 *   <div>
 *     <span>CPU: {telemetry.cpu.percent}%</span>
 *     <span>RAM: {telemetry.memory.percent}%</span>
 *   </div>
 * );
 * ```
 */
export function useTelemetry(pollingIntervalMs: number = 2000): UseTelemetryResult {
  const [telemetry, setTelemetry] = useState<SystemSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Track if component is mounted to avoid state updates after unmount
  const mountedRef = useRef(true);

  const fetchTelemetry = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await invoke<SystemSnapshot>('get_system_telemetry');

      if (mountedRef.current) {
        setTelemetry(data);
        setError(null);
        setLastUpdated(new Date());
      }
    } catch (e) {
      if (mountedRef.current) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(errorMessage);
        console.error('Telemetry fetch error:', errorMessage);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    fetchTelemetry();

    // Set up polling interval if positive
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (pollingIntervalMs > 0) {
      intervalId = setInterval(fetchTelemetry, pollingIntervalMs);
    }

    return () => {
      mountedRef.current = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchTelemetry, pollingIntervalMs]);

  return {
    telemetry,
    error,
    loading,
    lastUpdated,
    refetch: fetchTelemetry,
    refreshing,
  };
}

export default useTelemetry;
