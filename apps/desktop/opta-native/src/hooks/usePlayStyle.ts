/**
 * React hook for chess play style analysis.
 *
 * Analyzes user's imported games to create a style fingerprint
 * that can be used for:
 * - Comparing with famous players
 * - Training a personalized AI clone
 * - Identifying strengths and weaknesses
 *
 * @see useGameArchive - Provides the games for analysis
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ArchivedGame } from '@/types/gameArchive';
import {
  analyzePlayStyle,
  type PlayStyleAnalysis,
  type PlayStyleMetrics,
  type CloneAISettings,
  DEFAULT_CLONE_SETTINGS,
  getArchetype,
  calculateStyleSimilarity,
  findMostSimilarPlayer,
  getTopSimilarPlayers,
  type FamousPlayerProfile,
} from '@/lib/chess/style';

// LocalStorage keys
const STYLE_ANALYSIS_KEY = 'opta_play_style_analysis';
const CLONE_SETTINGS_KEY = 'opta_clone_settings';

/**
 * Load saved style analysis from localStorage.
 */
function loadStyleAnalysis(): PlayStyleAnalysis | null {
  try {
    const saved = localStorage.getItem(STYLE_ANALYSIS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Save style analysis to localStorage.
 */
function saveStyleAnalysis(analysis: PlayStyleAnalysis): void {
  try {
    localStorage.setItem(STYLE_ANALYSIS_KEY, JSON.stringify(analysis));
  } catch (error) {
    console.error('Failed to save style analysis:', error);
  }
}

/**
 * Load clone settings from localStorage.
 */
function loadCloneSettings(): CloneAISettings {
  try {
    const saved = localStorage.getItem(CLONE_SETTINGS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_CLONE_SETTINGS;
}

/**
 * Save clone settings to localStorage.
 */
function saveCloneSettings(settings: CloneAISettings): void {
  try {
    localStorage.setItem(CLONE_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save clone settings:', error);
  }
}

/**
 * Options for usePlayStyle hook.
 */
export interface UsePlayStyleOptions {
  /** Games to analyze */
  games?: ArchivedGame[];
  /** Auto-analyze when games change */
  autoAnalyze?: boolean;
  /** Load cached analysis on mount */
  loadCached?: boolean;
}

/**
 * Return type for usePlayStyle hook.
 */
export interface UsePlayStyleReturn {
  // Analysis state
  /** The full style analysis */
  analysis: PlayStyleAnalysis | null;
  /** Just the core metrics */
  metrics: PlayStyleMetrics | null;
  /** Whether analysis is in progress */
  isAnalyzing: boolean;
  /** Analysis error (if any) */
  error: string | null;

  // Derived data
  /** User's play style archetype */
  archetype: ReturnType<typeof getArchetype> | null;
  /** Most similar famous player */
  mostSimilarPlayer: { player: FamousPlayerProfile; similarity: number } | null;
  /** Top 3 similar players */
  topSimilarPlayers: Array<{ player: FamousPlayerProfile; similarity: number }>;

  // Clone settings
  /** Current clone AI settings */
  cloneSettings: CloneAISettings;
  /** Update clone settings */
  setCloneSettings: (settings: CloneAISettings | ((prev: CloneAISettings) => CloneAISettings)) => void;

  // Actions
  /** Trigger analysis of provided games */
  analyzeGames: (games: ArchivedGame[]) => void;
  /** Compare metrics with another profile */
  compareTo: (other: PlayStyleMetrics) => number;
  /** Clear cached analysis */
  clearAnalysis: () => void;
}

/**
 * Hook for play style analysis and clone AI management.
 *
 * @param options - Configuration options
 * @returns Style analysis and clone controls
 *
 * @example
 * ```tsx
 * const { games } = useGameArchive();
 * const { analysis, archetype, mostSimilarPlayer, cloneSettings, setCloneSettings } = usePlayStyle({
 *   games,
 *   autoAnalyze: true,
 * });
 *
 * if (analysis) {
 *   console.log('Aggression:', analysis.metrics.aggression);
 *   console.log('You play like:', mostSimilarPlayer?.player.name);
 * }
 * ```
 */
export function usePlayStyle(options: UsePlayStyleOptions = {}): UsePlayStyleReturn {
  const { games = [], autoAnalyze = true, loadCached = true } = options;

  // State
  const [analysis, setAnalysis] = useState<PlayStyleAnalysis | null>(() =>
    loadCached ? loadStyleAnalysis() : null
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloneSettings, setCloneSettingsState] = useState<CloneAISettings>(loadCloneSettings);

  // Extract metrics for convenience
  const metrics = analysis?.metrics ?? null;

  // Calculate archetype
  const archetype = useMemo(() => {
    if (!metrics) return null;
    return getArchetype(metrics);
  }, [metrics]);

  // Find most similar famous player
  const mostSimilarPlayer = useMemo(() => {
    if (!metrics) return null;
    return findMostSimilarPlayer(metrics);
  }, [metrics]);

  // Get top similar players
  const topSimilarPlayers = useMemo(() => {
    if (!metrics) return [];
    return getTopSimilarPlayers(metrics, 3);
  }, [metrics]);

  /**
   * Analyze a set of games.
   */
  const analyzeGames = useCallback((gamesToAnalyze: ArchivedGame[]) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Run analysis (this is synchronous but could be made async for large datasets)
      const result = analyzePlayStyle(gamesToAnalyze);
      setAnalysis(result);
      saveStyleAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // Auto-analyze when games change (if enabled)
  useEffect(() => {
    if (autoAnalyze && games.length > 0) {
      // Debounce to avoid re-analyzing on every game load
      const timeout = setTimeout(() => {
        analyzeGames(games);
      }, 500);

      return () => clearTimeout(timeout);
    }
  }, [games, autoAnalyze, analyzeGames]);

  /**
   * Compare metrics to another profile.
   */
  const compareTo = useCallback(
    (other: PlayStyleMetrics): number => {
      if (!metrics) return 0;
      return calculateStyleSimilarity(metrics, other);
    },
    [metrics]
  );

  /**
   * Clear cached analysis.
   */
  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    localStorage.removeItem(STYLE_ANALYSIS_KEY);
  }, []);

  /**
   * Update clone settings with persistence.
   */
  const setCloneSettings = useCallback(
    (value: CloneAISettings | ((prev: CloneAISettings) => CloneAISettings)) => {
      setCloneSettingsState((prev) => {
        const next = typeof value === 'function' ? value(prev) : value;
        saveCloneSettings(next);
        return next;
      });
    },
    []
  );

  return {
    // Analysis state
    analysis,
    metrics,
    isAnalyzing,
    error,

    // Derived data
    archetype,
    mostSimilarPlayer,
    topSimilarPlayers,

    // Clone settings
    cloneSettings,
    setCloneSettings,

    // Actions
    analyzeGames,
    compareTo,
    clearAnalysis,
  };
}

export default usePlayStyle;
