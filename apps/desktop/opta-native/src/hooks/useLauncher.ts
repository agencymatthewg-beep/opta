/**
 * React hook for game launching via Opta.
 *
 * Provides game launch functionality with pre-launch optimization options.
 */

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  LaunchConfig,
  LaunchResult,
  GameRunningStatus,
} from '../types/launcher';
import type { DetectedGame } from '../types/games';
import type { StealthModeResult } from '../types/processes';

/**
 * Optional callbacks for pre-launch action results.
 */
export interface LaunchCallbacks {
  /** Called when stealth mode completes successfully */
  onStealthModeComplete?: (result: StealthModeResult) => void;
  /** Called when optimizations are applied with the count */
  onOptimizationsApplied?: (count: number) => void;
}

/**
 * Return type for useLauncher hook.
 */
export interface UseLauncherResult {
  /** Launch a game with optional pre-launch actions and callbacks */
  launchGame: (game: DetectedGame, config: LaunchConfig, callbacks?: LaunchCallbacks) => Promise<LaunchResult>;
  /** Check if a game is currently running */
  checkGameRunning: (gameId: string) => Promise<GameRunningStatus>;
  /** Get process names to look for a game */
  getGameProcessNames: (gameId: string) => Promise<string[]>;
  /** Whether a launch is currently in progress */
  launching: boolean;
  /** Currently launching game (if any) */
  launchingGame: DetectedGame | null;
  /** Last launch result */
  lastResult: LaunchResult | null;
  /** Error message if launch failed */
  error: string | null;
  /** Clear error state */
  clearError: () => void;
  /** Last stealth mode result (if stealth mode was run) */
  lastStealthModeResult: StealthModeResult | null;
}

/**
 * Hook to launch games via Opta.
 *
 * Supports pre-launch actions like applying optimizations and running Stealth Mode.
 *
 * @example
 * ```tsx
 * const { launchGame, launching, error } = useLauncher();
 *
 * const handleLaunch = async () => {
 *   const result = await launchGame(game, {
 *     applyOptimizations: true,
 *     runStealthMode: true,
 *     trackSession: false,
 *   });
 *
 *   if (result.success) {
 *     console.log('Game launched at', result.launchedAt);
 *   }
 * };
 * ```
 */
export function useLauncher(): UseLauncherResult {
  const [launching, setLaunching] = useState(false);
  const [launchingGame, setLaunchingGame] = useState<DetectedGame | null>(null);
  const [lastResult, setLastResult] = useState<LaunchResult | null>(null);
  const [lastStealthModeResult, setLastStealthModeResult] = useState<StealthModeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getGameProcessNames = useCallback(async (gameId: string): Promise<string[]> => {
    try {
      const names = await invoke<string[]>('get_game_process_names', { gameId });
      return names;
    } catch (e) {
      console.error('Failed to get process names:', e);
      return [];
    }
  }, []);

  const checkGameRunning = useCallback(async (gameId: string): Promise<GameRunningStatus> => {
    try {
      const processNames = await getGameProcessNames(gameId);
      if (processNames.length === 0) {
        return {
          running: false,
          pid: null,
          processName: null,
          cpuPercent: null,
          memoryMb: null,
        };
      }

      const status = await invoke<GameRunningStatus>('check_game_running', { processNames });
      return status;
    } catch (e) {
      console.error('Failed to check game running:', e);
      return {
        running: false,
        pid: null,
        processName: null,
        cpuPercent: null,
        memoryMb: null,
      };
    }
  }, [getGameProcessNames]);

  const launchGame = useCallback(async (
    game: DetectedGame,
    config: LaunchConfig,
    callbacks?: LaunchCallbacks
  ): Promise<LaunchResult> => {
    setLaunching(true);
    setLaunchingGame(game);
    setError(null);
    setLastStealthModeResult(null);

    try {
      // Step 1: Apply optimizations if requested
      if (config.applyOptimizations) {
        try {
          await invoke('apply_optimization', { gameId: game.id });
          // Notify about optimizations applied (count of 1 for now - could be expanded)
          callbacks?.onOptimizationsApplied?.(1);
        } catch (e) {
          console.warn('Failed to apply optimizations:', e);
          // Continue with launch even if optimizations fail
        }
      }

      // Step 2: Run Stealth Mode if requested
      if (config.runStealthMode) {
        try {
          const stealthResult = await invoke<StealthModeResult>('stealth_mode');
          setLastStealthModeResult(stealthResult);
          // Notify callback with the stealth mode result
          callbacks?.onStealthModeComplete?.(stealthResult);
        } catch (e) {
          console.warn('Failed to run stealth mode:', e);
          // Continue with launch even if stealth mode fails
        }
      }

      // Step 3: Launch the game
      const result = await invoke<LaunchResult>('launch_game', {
        launcher: game.launcher,
        gameId: game.id,
      });

      setLastResult(result);

      if (!result.success && result.error) {
        setError(result.error);
      }

      return result;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      console.error('Launch error:', errorMessage);

      const failedResult: LaunchResult = {
        success: false,
        launchedAt: null,
        error: errorMessage,
        launchUrl: '',
      };
      setLastResult(failedResult);
      return failedResult;
    } finally {
      setLaunching(false);
      setLaunchingGame(null);
    }
  }, []);

  return {
    launchGame,
    checkGameRunning,
    getGameProcessNames,
    launching,
    launchingGame,
    lastResult,
    error,
    clearError,
    lastStealthModeResult,
  };
}

export default useLauncher;
