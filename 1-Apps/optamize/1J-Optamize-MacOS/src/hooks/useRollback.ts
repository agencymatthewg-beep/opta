/**
 * useRollback - Hook for managing optimization rollback states.
 *
 * Provides:
 * - Create rollback points before applying optimizations
 * - Restore previous settings via one-click undo
 * - Persist rollback history to localStorage (last 10 entries)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { DetectedGame } from '../types/games';
import type { OptimizationDetail } from '../types/optimizer';

/**
 * Applied optimization with details for rollback tracking.
 */
export interface AppliedOptimization {
  /** Unique ID for this optimization */
  id: string;
  /** Setting key that was changed */
  settingKey: string;
  /** Previous value before optimization */
  previousValue: unknown;
  /** New value after optimization */
  newValue: unknown;
  /** Category: graphics, launch_options, priority */
  category: 'graphics' | 'launch_options' | 'priority';
  /** File path where setting was changed (if applicable) */
  filePath?: string;
}

/**
 * Rollback state capturing a point in time before optimizations.
 */
export interface RollbackState {
  /** Unique rollback point ID */
  id: string;
  /** Timestamp when rollback point was created */
  timestamp: number;
  /** List of optimizations that were applied */
  optimizations: AppliedOptimization[];
  /** Snapshot of previous settings keyed by setting ID */
  previousSettings: Record<string, unknown>;
  /** Game that was optimized (if applicable) */
  game?: {
    id: string;
    name: string;
  };
}

/**
 * Capture current settings from a list of optimizations.
 * Extracts the previous values to enable rollback.
 */
function captureCurrentSettings(
  optimizations: AppliedOptimization[]
): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  for (const opt of optimizations) {
    settings[opt.id] = opt.previousValue;
  }
  return settings;
}

/**
 * Convert optimization details from the optimizer result to applied optimizations.
 */
export function detailsToAppliedOptimizations(
  details: OptimizationDetail[],
  gameId: string
): AppliedOptimization[] {
  return details
    .filter((d) => d.status === 'applied')
    .map((detail, index) => ({
      id: `${gameId}-${detail.key || detail.action}-${index}`,
      settingKey: detail.key || detail.action,
      previousValue: null, // We don't have previous value from result
      newValue: detail.value,
      category: detail.action === 'graphics_setting' ? 'graphics' as const :
                detail.action === 'launch_option' ? 'launch_options' as const : 'priority' as const,
    }));
}

const STORAGE_KEY = 'opta-rollback-states';
const MAX_ROLLBACK_STATES = 10;

/**
 * Hook for managing rollback states.
 */
export function useRollback() {
  const [rollbackStates, setRollbackStates] = useState<RollbackState[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isRestoring, setIsRestoring] = useState(false);
  const mountedRef = useRef(true);

  // Persist to localStorage whenever states change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rollbackStates));
    } catch {
      // Silently fail if localStorage unavailable
    }
  }, [rollbackStates]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Create a rollback point before applying optimizations.
   */
  const createRollbackPoint = useCallback(
    (optimizations: AppliedOptimization[], game?: DetectedGame): string => {
      const state: RollbackState = {
        id: `rb-${Date.now()}`,
        timestamp: Date.now(),
        optimizations,
        previousSettings: captureCurrentSettings(optimizations),
        game: game
          ? {
              id: game.id,
              name: game.name,
            }
          : undefined,
      };

      setRollbackStates((prev) => {
        const updated = [state, ...prev].slice(0, MAX_ROLLBACK_STATES);
        return updated;
      });

      return state.id;
    },
    []
  );

  /**
   * Restore settings from a rollback point.
   * In a real implementation, this would call backend to restore file settings.
   */
  const rollback = useCallback(
    async (stateId: string): Promise<boolean> => {
      const state = rollbackStates.find((s) => s.id === stateId);
      if (!state) {
        console.error('Rollback state not found:', stateId);
        return false;
      }

      setIsRestoring(true);

      try {
        // TODO: In production, call Tauri command to restore settings
        // await invoke('restore_optimization_settings', {
        //   previousSettings: state.previousSettings
        // });

        // Simulate async restoration
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (!mountedRef.current) return false;

        // Remove this and newer states after successful rollback
        const index = rollbackStates.findIndex((s) => s.id === stateId);
        const updated = rollbackStates.slice(index + 1);
        setRollbackStates(updated);

        return true;
      } catch (error) {
        console.error('Failed to restore settings:', error);
        return false;
      } finally {
        if (mountedRef.current) {
          setIsRestoring(false);
        }
      }
    },
    [rollbackStates]
  );

  /**
   * Get the most recent rollback point (if any).
   */
  const getMostRecentRollback = useCallback((): RollbackState | null => {
    return rollbackStates.length > 0 ? rollbackStates[0] : null;
  }, [rollbackStates]);

  /**
   * Clear all rollback states.
   */
  const clearRollbackHistory = useCallback(() => {
    setRollbackStates([]);
  }, []);

  /**
   * Get rollback points for a specific game.
   */
  const getRollbacksForGame = useCallback(
    (gameId: string): RollbackState[] => {
      return rollbackStates.filter((s) => s.game?.id === gameId);
    },
    [rollbackStates]
  );

  return {
    /** All rollback states */
    rollbackStates,
    /** Create a new rollback point */
    createRollbackPoint,
    /** Restore settings from a rollback point */
    rollback,
    /** Whether a restore is in progress */
    isRestoring,
    /** Get the most recent rollback point */
    getMostRecentRollback,
    /** Clear all rollback history */
    clearRollbackHistory,
    /** Get rollbacks for a specific game */
    getRollbacksForGame,
  };
}

export default useRollback;
