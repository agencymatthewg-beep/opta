/**
 * Hook for getting Stealth Mode estimates.
 *
 * Fetches safe-to-kill processes and calculates estimated memory savings
 * without actually running Stealth Mode.
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ProcessInfo } from '../types/processes';

/** Assumed total system memory for calculations (16GB) */
const ASSUMED_TOTAL_MEMORY_MB = 16384;

/**
 * Return type for useStealthModeEstimate hook.
 */
export interface UseStealthModeEstimateResult {
  /** Number of processes that can be safely killed */
  safeToKillCount: number;
  /** Estimated memory savings in MB */
  estimatedMemorySavingsMb: number;
  /** Whether the estimate is loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Refresh the estimates */
  refresh: () => Promise<void>;
}

/**
 * Hook to get Stealth Mode estimates.
 *
 * @param autoFetch - Whether to auto-fetch on mount (default: true)
 *
 * @example
 * ```tsx
 * const { safeToKillCount, estimatedMemorySavingsMb } = useStealthModeEstimate();
 * ```
 */
export function useStealthModeEstimate(autoFetch = true): UseStealthModeEstimateResult {
  const [safeToKillCount, setSafeToKillCount] = useState(0);
  const [estimatedMemorySavingsMb, setEstimatedMemorySavingsMb] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const processes = await invoke<ProcessInfo[]>('get_processes');
      const safeToKill = processes.filter((p) => p.category === 'safe-to-kill');

      setSafeToKillCount(safeToKill.length);

      // Estimate memory based on process memory percentages
      const estimated = safeToKill.reduce(
        (sum, p) => sum + (p.memory_percent / 100) * ASSUMED_TOTAL_MEMORY_MB,
        0
      );
      setEstimatedMemorySavingsMb(Math.round(estimated));
    } catch (err) {
      console.error('Failed to fetch stealth mode estimate:', err);
      setError(err instanceof Error ? err.message : String(err));
      // Set fallback values
      setSafeToKillCount(0);
      setEstimatedMemorySavingsMb(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [autoFetch, refresh]);

  return {
    safeToKillCount,
    estimatedMemorySavingsMb,
    loading,
    error,
    refresh,
  };
}

export default useStealthModeEstimate;
