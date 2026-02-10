/**
 * React hook for process listing.
 *
 * Provides polling-based access to process data via Tauri commands.
 * Handles loading states, errors, and automatic refresh.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ProcessInfo } from '../types/processes';

/**
 * Return type for useProcesses hook.
 */
export interface UseProcessesResult {
  /** Current process list, null if not yet loaded */
  processes: ProcessInfo[] | null;
  /** Error message if process fetch failed */
  error: string | null;
  /** Whether initial load is in progress */
  loading: boolean;
  /** Last successful update timestamp */
  lastUpdated: Date | null;
  /** Manually refresh process data */
  refresh: () => Promise<void>;
  /** Whether a refresh is currently in progress */
  refreshing: boolean;
}

/**
 * Hook to fetch and poll process data.
 *
 * @param pollingIntervalMs - Polling interval in milliseconds (default: 3000ms)
 * @returns Process data, loading state, error, and refresh function
 *
 * @example
 * ```tsx
 * const { processes, loading, error } = useProcesses();
 *
 * if (loading) return <Spinner />;
 * if (error) return <Error message={error} />;
 *
 * return (
 *   <ul>
 *     {processes.map(p => (
 *       <li key={p.pid}>{p.name}: {p.cpu_percent}%</li>
 *     ))}
 *   </ul>
 * );
 * ```
 */
export function useProcesses(pollingIntervalMs: number = 3000): UseProcessesResult {
  const [processes, setProcesses] = useState<ProcessInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Track if component is mounted to avoid state updates after unmount
  const mountedRef = useRef(true);

  const fetchProcesses = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await invoke<ProcessInfo[]>('get_processes');

      if (mountedRef.current) {
        setProcesses(data);
        setError(null);
        setLastUpdated(new Date());
      }
    } catch (e) {
      if (mountedRef.current) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(errorMessage);
        console.error('Process fetch error:', errorMessage);
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
    fetchProcesses();

    // Set up polling interval if positive
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (pollingIntervalMs > 0) {
      intervalId = setInterval(fetchProcesses, pollingIntervalMs);
    }

    return () => {
      mountedRef.current = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchProcesses, pollingIntervalMs]);

  return {
    processes,
    error,
    loading,
    lastUpdated,
    refresh: fetchProcesses,
    refreshing,
  };
}

export default useProcesses;
