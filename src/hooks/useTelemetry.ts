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
 * Check if we're running inside Tauri (vs browser-only mode)
 */
const isTauriAvailable = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

/**
 * Generate mock telemetry data for browser development mode
 */
const generateMockTelemetry = (): SystemSnapshot => {
  // Add some randomness to simulate real telemetry changes
  const cpuBase = 25 + Math.random() * 30;
  const memBase = 45 + Math.random() * 20;
  const gpuBase = 15 + Math.random() * 25;
  const usedGb = Math.round((32 * memBase / 100) * 10) / 10;
  const diskUsedGb = Math.round(450 + Math.random() * 50);

  return {
    timestamp: new Date().toISOString(),
    cpu: {
      percent: Math.round(cpuBase * 10) / 10,
      cores: 8,
      threads: 16,
      per_core_percent: Array.from({ length: 8 }, () => Math.round((cpuBase + (Math.random() - 0.5) * 20) * 10) / 10),
      frequency_mhz: 3200 + Math.round(Math.random() * 800),
    },
    memory: {
      total_gb: 32,
      used_gb: usedGb,
      available_gb: 32 - usedGb,
      percent: Math.round(memBase * 10) / 10,
    },
    gpu: {
      available: true,
      name: 'Apple M2 Max (Mock)',
      utilization_percent: Math.round(gpuBase * 10) / 10,
      memory_used_gb: Math.round((2 + Math.random()) * 10) / 10,
      memory_total_gb: 32,
      memory_percent: Math.round(gpuBase * 10) / 10,
      temperature_c: Math.round(45 + Math.random() * 15),
    },
    disk: {
      total_gb: 1000,
      used_gb: diskUsedGb,
      free_gb: 1000 - diskUsedGb,
      percent: Math.round(diskUsedGb / 10),
    },
  };
};

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
  // Track if we've logged mock mode message
  const hasLoggedMockModeRef = useRef(false);

  const fetchTelemetry = useCallback(async () => {
    try {
      setRefreshing(true);

      // Use mock data in browser development mode (no Tauri runtime)
      if (!isTauriAvailable()) {
        if (mountedRef.current) {
          const mockData = generateMockTelemetry();
          setTelemetry(mockData);
          setError(null);
          setLastUpdated(new Date());
          // Log once to indicate mock mode
          if (!hasLoggedMockModeRef.current) {
            console.info('[useTelemetry] Running in browser mode - using mock data');
            hasLoggedMockModeRef.current = true;
          }
        }
        return;
      }

      const data = await invoke<SystemSnapshot>('get_system_telemetry');

      if (mountedRef.current) {
        // Check if Python returned an error in the response (fallback path)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorInData = (data as any)?.error;
        if (errorInData) {
          // Don't clear existing telemetry - keep last known good data
          setError(String(errorInData));
          console.warn('Telemetry returned with error:', errorInData);
        } else {
          // Valid data - update state
          setTelemetry(data);
          setError(null);
          setLastUpdated(new Date());
        }
      }
    } catch (e) {
      // Network/invoke error - keep last known telemetry data
      if (mountedRef.current) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(errorMessage);
        console.error('Telemetry fetch error:', errorMessage);
        // Note: We intentionally don't clear telemetry here to preserve last good data
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
