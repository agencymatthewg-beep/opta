/**
 * Hook for benchmarking operations.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { BenchmarkSession, BenchmarkComparison } from '../types/benchmark';

export interface UseBenchmarkResult {
  /** Start a benchmark session */
  startBenchmark: (gameId: string, gameName: string, phase: 'before' | 'after') => Promise<BenchmarkSession>;
  /** End the current benchmark and get metrics */
  endBenchmark: () => Promise<void>;
  /** Get benchmark comparison for a game */
  getComparison: (gameId: string) => Promise<BenchmarkComparison | null>;
  /** Get all benchmark results */
  getAllResults: () => Promise<BenchmarkComparison[]>;
  /** Current active benchmark session */
  activeSession: BenchmarkSession | null;
  /** Whether benchmarking is in progress */
  isRunning: boolean;
  /** Sample count for current benchmark */
  sampleCount: number;
  /** Error message */
  error: string | null;
}

export function useBenchmark(): UseBenchmarkResult {
  const [activeSession, setActiveSession] = useState<BenchmarkSession | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const samplingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up sampling interval on unmount
  useEffect(() => {
    return () => {
      if (samplingIntervalRef.current) {
        clearInterval(samplingIntervalRef.current);
      }
    };
  }, []);

  const startBenchmark = useCallback(async (
    gameId: string,
    gameName: string,
    phase: 'before' | 'after'
  ): Promise<BenchmarkSession> => {
    setError(null);
    try {
      const session = await invoke<BenchmarkSession>('start_benchmark', {
        gameId,
        gameName,
        phase,
      });

      setActiveSession(session);
      setIsRunning(true);
      setSampleCount(0);

      // Start sampling every second
      samplingIntervalRef.current = setInterval(async () => {
        try {
          await invoke('capture_benchmark_sample', {
            benchmarkId: session.benchmark_id,
          });
          setSampleCount(prev => prev + 1);
        } catch (e) {
          console.error('Sample capture failed:', e);
        }
      }, 1000);

      return session;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const endBenchmark = useCallback(async (): Promise<void> => {
    if (!activeSession) {
      throw new Error('No active benchmark session');
    }

    // Stop sampling
    if (samplingIntervalRef.current) {
      clearInterval(samplingIntervalRef.current);
      samplingIntervalRef.current = null;
    }

    try {
      await invoke('end_benchmark', {
        benchmarkId: activeSession.benchmark_id,
      });

      setActiveSession(null);
      setIsRunning(false);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [activeSession]);

  const getComparison = useCallback(async (gameId: string): Promise<BenchmarkComparison | null> => {
    try {
      const result = await invoke<BenchmarkComparison | null>('get_benchmark_results', {
        gameId,
      });
      return result;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      return null;
    }
  }, []);

  const getAllResults = useCallback(async (): Promise<BenchmarkComparison[]> => {
    try {
      const result = await invoke<BenchmarkComparison[]>('get_benchmark_results', {
        gameId: null,
      });
      return result || [];
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      return [];
    }
  }, []);

  return {
    startBenchmark,
    endBenchmark,
    getComparison,
    getAllResults,
    activeSession,
    isRunning,
    sampleCount,
    error,
  };
}

export default useBenchmark;
