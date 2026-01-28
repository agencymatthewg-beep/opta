import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  OptaScore,
  EnhancedGameScore,
  ScoreHistoryEntry,
  GlobalStats,
  HardwareTier,
  LeaderboardEntry
} from '@/types/scoring';

interface UseScoreReturn {
  // Overall Opta Score
  optaScore: OptaScore | null;
  loading: boolean;
  error: string | null;

  // Leaderboard data
  leaderboard: LeaderboardEntry[];

  // Actions
  refreshScore: () => Promise<void>;
  getGameScore: (gameId: string) => Promise<EnhancedGameScore | null>;
  getScoreHistory: (gameId: string) => Promise<ScoreHistoryEntry[]>;
  getGlobalStats: () => Promise<GlobalStats>;
  getHardwareTier: () => Promise<HardwareTier>;
  getLeaderboard: () => Promise<LeaderboardEntry[]>;

  // For animations
  isAnimating: boolean;
  setIsAnimating: (animating: boolean) => void;
}

export function useScore(): UseScoreReturn {
  const [optaScore, setOptaScore] = useState<OptaScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const refreshScore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [scoreResult, leaderboardResult] = await Promise.all([
        invoke<OptaScore>('calculate_opta_score').catch(() => null),
        invoke<LeaderboardEntry[]>('get_leaderboard').catch(() => [])
      ]);
      if (scoreResult) {
        setOptaScore(scoreResult);
      }
      // Add ranks to leaderboard entries
      const rankedLeaderboard = leaderboardResult.map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));
      setLeaderboard(rankedLeaderboard);
    } catch (e) {
      console.error('Failed to load Opta Score:', e);
      setError(e instanceof Error ? e.message : 'Failed to load score');
    } finally {
      setLoading(false);
    }
  }, []);

  const getGameScore = useCallback(async (gameId: string) => {
    try {
      return await invoke<EnhancedGameScore>('calculate_enhanced_score', { gameId });
    } catch (e) {
      console.error('Failed to get game score:', e);
      return null;
    }
  }, []);

  const getScoreHistory = useCallback(async (gameId: string) => {
    try {
      return await invoke<ScoreHistoryEntry[]>('get_score_history', { gameId });
    } catch (e) {
      console.error('Failed to get score history:', e);
      return [];
    }
  }, []);

  const getGlobalStats = useCallback(async () => {
    try {
      return await invoke<GlobalStats>('get_global_stats');
    } catch {
      return {
        total_games_optimized: 0,
        average_score: 0,
        highest_score: 0,
        highest_score_game: '',
        last_updated: 0
      };
    }
  }, []);

  const getHardwareTier = useCallback(async () => {
    try {
      return await invoke<HardwareTier>('get_hardware_tier');
    } catch {
      return { tier: 'midrange', signature: 'Unknown', priceRange: '' } as HardwareTier;
    }
  }, []);

  const getLeaderboard = useCallback(async () => {
    try {
      const result = await invoke<LeaderboardEntry[]>('get_leaderboard');
      return result.map((entry, index) => ({ ...entry, rank: index + 1 }));
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    refreshScore();
  }, [refreshScore]);

  return {
    optaScore,
    loading,
    error,
    leaderboard,
    refreshScore,
    getGameScore,
    getScoreHistory,
    getGlobalStats,
    getHardwareTier,
    getLeaderboard,
    isAnimating,
    setIsAnimating
  };
}
