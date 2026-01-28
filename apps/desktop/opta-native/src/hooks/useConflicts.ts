/**
 * React hook for conflict detection.
 *
 * Provides polling-based access to conflict detection data via Tauri commands.
 * Uses a 10-second polling interval since conflicts change infrequently.
 * Handles loading states, errors, and automatic refresh.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ConflictInfo, ConflictSummary } from '../types/conflicts';

/**
 * Return type for useConflicts hook.
 */
export interface UseConflictsResult {
  /** Current list of detected conflicts */
  conflicts: ConflictInfo[];
  /** Summary with severity counts for UI badges */
  summary: ConflictSummary | null;
  /** Whether initial load is in progress */
  loading: boolean;
  /** Error message if conflict detection failed */
  error: string | null;
  /** Manually refresh conflict data */
  refresh: () => Promise<void>;
  /** Whether a refresh is currently in progress */
  refreshing: boolean;
  /** Last successful update timestamp */
  lastUpdated: Date | null;
}

/**
 * Hook to fetch and poll conflict detection data.
 *
 * Uses a longer polling interval (10 seconds) since competitor tools
 * don't frequently start/stop during normal operation.
 *
 * @param pollingIntervalMs - Polling interval in milliseconds (default: 10000ms)
 * @returns Conflict data, loading state, error, and refresh function
 *
 * @example
 * ```tsx
 * const { conflicts, summary, loading, error } = useConflicts();
 *
 * if (loading) return <Spinner />;
 * if (error) return <Error message={error} />;
 *
 * return (
 *   <div>
 *     {summary && summary.high_count > 0 && (
 *       <Badge variant="destructive">{summary.high_count} high</Badge>
 *     )}
 *     {conflicts.map(c => (
 *       <Alert key={c.tool_id}>
 *         <p>{c.name}: {c.recommendation}</p>
 *       </Alert>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useConflicts(pollingIntervalMs: number = 10000): UseConflictsResult {
  const [summary, setSummary] = useState<ConflictSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Track if component is mounted to avoid state updates after unmount
  const mountedRef = useRef(true);

  const fetchConflicts = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await invoke<ConflictSummary>('detect_conflicts');

      if (mountedRef.current) {
        setSummary(data);
        setError(null);
        setLastUpdated(new Date());
      }
    } catch (e) {
      if (mountedRef.current) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(errorMessage);
        console.error('Conflict detection error:', errorMessage);
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
    fetchConflicts();

    // Set up polling interval if positive
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (pollingIntervalMs > 0) {
      intervalId = setInterval(fetchConflicts, pollingIntervalMs);
    }

    return () => {
      mountedRef.current = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchConflicts, pollingIntervalMs]);

  return {
    conflicts: summary?.conflicts ?? [],
    summary,
    loading,
    error,
    refresh: fetchConflicts,
    refreshing,
    lastUpdated,
  };
}

export default useConflicts;
