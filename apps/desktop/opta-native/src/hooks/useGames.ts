/**
 * React hook for game detection.
 *
 * Provides access to game detection data via Tauri commands.
 * Handles loading states, errors, and manual refresh.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { DetectedGame, GameDetectionResult, LauncherInfo, GameInfoResult, GameOptimization } from '../types/games';

/**
 * Return type for useGames hook.
 */
export interface UseGamesResult {
  /** Current list of detected games */
  games: DetectedGame[];
  /** Information about detected launchers */
  launchers: LauncherInfo[];
  /** Total number of detected games */
  totalGames: number;
  /** Full detection result */
  result: GameDetectionResult | null;
  /** Whether initial load is in progress */
  loading: boolean;
  /** Error message if game detection failed */
  error: string | null;
  /** Manually refresh game data */
  refresh: () => Promise<void>;
  /** Whether a refresh is currently in progress */
  refreshing: boolean;
  /** Last successful update timestamp */
  lastUpdated: Date | null;
  /** Get info for a specific game */
  getGameInfo: (gameId: string) => Promise<GameInfoResult>;
  /** Get optimization settings for a game */
  getGameOptimization: (gameId: string) => Promise<GameOptimization>;
}

/**
 * Hook to fetch game detection data.
 *
 * Unlike telemetry hooks, this doesn't poll automatically since
 * installed games don't change frequently. Use the refresh function
 * to manually re-scan for games.
 *
 * @returns Game data, loading state, error, and refresh function
 *
 * @example
 * ```tsx
 * const { games, launchers, loading, error, refresh } = useGames();
 *
 * if (loading) return <Spinner />;
 * if (error) return <Error message={error} />;
 *
 * return (
 *   <div>
 *     <h2>Found {games.length} games</h2>
 *     {launchers.map(launcher => (
 *       <div key={launcher.id}>
 *         {launcher.name}: {launcher.game_count} games
 *       </div>
 *     ))}
 *     {games.map(game => (
 *       <GameCard key={game.id} game={game} />
 *     ))}
 *     <button onClick={refresh}>Rescan</button>
 *   </div>
 * );
 * ```
 */
export function useGames(): UseGamesResult {
  const [result, setResult] = useState<GameDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Track if component is mounted to avoid state updates after unmount
  const mountedRef = useRef(true);

  const detectGames = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await invoke<GameDetectionResult>('detect_games');

      if (mountedRef.current) {
        setResult(data);
        setError(null);
        setLastUpdated(new Date());
      }
    } catch (e) {
      if (mountedRef.current) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(errorMessage);
        console.error('Game detection error:', errorMessage);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const getGameInfo = useCallback(async (gameId: string): Promise<GameInfoResult> => {
    try {
      const data = await invoke<GameInfoResult>('get_game_info', { gameId });
      return data;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error('Get game info error:', errorMessage);
      return {
        found: false,
        error: errorMessage,
      };
    }
  }, []);

  const getGameOptimization = useCallback(async (gameId: string): Promise<GameOptimization> => {
    try {
      const data = await invoke<GameOptimization>('get_game_optimization', { gameId });
      return data;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error('Get game optimization error:', errorMessage);
      return {
        name: 'Unknown',
        settings: {},
        tips: [],
        source: 'generic',
      };
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    detectGames();

    return () => {
      mountedRef.current = false;
    };
  }, [detectGames]);

  return {
    games: result?.games ?? [],
    launchers: result?.launchers ?? [],
    totalGames: result?.total_games ?? 0,
    result,
    loading,
    error,
    refresh: detectGames,
    refreshing,
    lastUpdated,
    getGameInfo,
    getGameOptimization,
  };
}

export default useGames;
