/**
 * Hook for game optimization operations with pattern learning.
 */

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  OptimizationResult,
  OptimizedGame,
  OptimizationHistoryEntry,
  RecordChoiceArgs,
  DetectedPattern,
  ChoiceStats
} from '../types/optimizer';

export interface UseOptimizerResult {
  /** Apply optimization to a game */
  applyOptimization: (gameId: string, gameName?: string) => Promise<OptimizationResult>;
  /** Revert optimization for a game */
  revertOptimization: (gameId: string, gameName?: string) => Promise<OptimizationResult>;
  /** Get optimization history */
  getHistory: (gameId?: string) => Promise<OptimizationHistoryEntry[] | OptimizedGame[]>;
  /** Record a choice for pattern learning (fire and forget) */
  recordChoice: (args: RecordChoiceArgs) => Promise<void>;
  /** Get detected patterns from user choices */
  getPatterns: () => Promise<DetectedPattern[]>;
  /** Get statistics about recorded choices */
  getChoiceStats: () => Promise<ChoiceStats>;
  /** Whether an operation is in progress */
  loading: boolean;
  /** Last error message */
  error: string | null;
  /** Last result */
  lastResult: OptimizationResult | null;
}

export function useOptimizer(): UseOptimizerResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<OptimizationResult | null>(null);

  /**
   * Record a user's optimization choice for pattern learning.
   * Fire-and-forget: failures are logged but don't block the main flow.
   */
  const recordChoice = useCallback(async (args: RecordChoiceArgs): Promise<void> => {
    try {
      await invoke('record_optimization_choice', { args });
    } catch (e) {
      // Non-blocking - just log errors, don't throw
      console.error('Failed to record choice:', e);
    }
  }, []);

  /**
   * Record choices for all settings in an optimization result.
   */
  const recordChoicesForResult = useCallback(async (
    gameId: string,
    gameName: string,
    result: OptimizationResult,
    action: 'accepted' | 'reverted'
  ) => {
    // Record a choice for each detail in the result
    for (const detail of result.details) {
      try {
        await recordChoice({
          gameId,
          gameName,
          settingCategory: detail.action, // 'graphics_setting', 'launch_options', 'priority'
          settingKey: detail.key || detail.action,
          originalValue: undefined, // Not tracked in current result
          newValue: detail.value,
          action
        });
      } catch {
        // Ignore individual recording failures
      }
    }
  }, [recordChoice]);

  const applyOptimization = useCallback(async (
    gameId: string,
    gameName: string = 'Unknown Game'
  ): Promise<OptimizationResult> => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<OptimizationResult>('apply_optimization', { gameId });
      setLastResult(result);

      // Record 'accepted' choices for all applied settings (fire and forget)
      if (result.success && result.details.length > 0) {
        recordChoicesForResult(gameId, gameName, result, 'accepted');
      }

      return result;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [recordChoicesForResult]);

  const revertOptimization = useCallback(async (
    gameId: string,
    gameName: string = 'Unknown Game'
  ): Promise<OptimizationResult> => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<OptimizationResult>('revert_optimization', { gameId });
      setLastResult(result);

      // Record 'reverted' choice (single action for the entire revert)
      if (result.success) {
        recordChoice({
          gameId,
          gameName,
          settingCategory: 'revert',
          settingKey: 'full_revert',
          action: 'reverted'
        });
      }

      return result;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [recordChoice]);

  const getHistory = useCallback(async (gameId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<OptimizationHistoryEntry[] | OptimizedGame[]>(
        'get_optimization_history',
        { gameId: gameId || null }
      );
      return result;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const getPatterns = useCallback(async (): Promise<DetectedPattern[]> => {
    try {
      return await invoke<DetectedPattern[]>('get_user_patterns');
    } catch (e) {
      console.error('Failed to get patterns:', e);
      return [];
    }
  }, []);

  const getChoiceStats = useCallback(async (): Promise<ChoiceStats> => {
    try {
      return await invoke<ChoiceStats>('get_choice_stats');
    } catch (e) {
      console.error('Failed to get choice stats:', e);
      return {
        totalChoices: 0,
        accepted: 0,
        reverted: 0,
        modified: 0,
        uniqueSettings: 0,
        gamesTracked: 0
      };
    }
  }, []);

  return {
    applyOptimization,
    revertOptimization,
    getHistory,
    recordChoice,
    getPatterns,
    getChoiceStats,
    loading,
    error,
    lastResult,
  };
}

export default useOptimizer;
