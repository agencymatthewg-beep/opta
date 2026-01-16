import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  OptaScore,
  EnhancedGameScore,
  ScoreHistoryEntry,
  GlobalStats,
  HardwareTier
} from '@/types/scoring';

interface UseScoreReturn {
  // Overall Opta Score
  optaScore: OptaScore | null;
  loading: boolean;
  error: string | null;

  // Actions
  refreshScore: () => Promise<void>;
  getGameScore: (gameId: string) => Promise<EnhancedGameScore | null>;
  getScoreHistory: (gameId: string) => Promise<ScoreHistoryEntry[]>;
  getGlobalStats: () => Promise<GlobalStats>;
  getHardwareTier: () => Promise<HardwareTier>;

  // For animations
  isAnimating: boolean;
  setIsAnimating: (animating: boolean) => void;
}

export function useScore(): UseScoreReturn {
  const [optaScore, setOptaScore] = useState<OptaScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const refreshScore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<OptaScore>('calculate_opta_score');
      setOptaScore(result);
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

  useEffect(() => {
    refreshScore();
  }, [refreshScore]);

  return {
    optaScore,
    loading,
    error,
    refreshScore,
    getGameScore,
    getScoreHistory,
    getGlobalStats,
    getHardwareTier,
    isAnimating,
    setIsAnimating
  };
}
