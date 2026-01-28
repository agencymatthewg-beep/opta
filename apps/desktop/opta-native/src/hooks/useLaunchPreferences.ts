/**
 * Hook for managing launch preferences.
 *
 * Stores default launch settings and per-game overrides in localStorage.
 */

import { useState, useCallback, useEffect } from 'react';
import type { LaunchConfig } from '../types/launcher';

/** Storage key for launch preferences */
const LAUNCH_PREFERENCES_KEY = 'opta_launch_preferences';

/**
 * Default launch preferences.
 */
export interface LaunchPreferences {
  /** Default apply optimizations setting */
  defaultApplyOptimizations: boolean;
  /** Default run stealth mode setting */
  defaultRunStealthMode: boolean;
  /** Default track session setting */
  defaultTrackSession: boolean;
  /** Per-game preference overrides */
  gameOverrides: Record<string, Partial<LaunchConfig>>;
}

/**
 * Default values for launch preferences.
 */
const DEFAULT_PREFERENCES: LaunchPreferences = {
  defaultApplyOptimizations: true,
  defaultRunStealthMode: true,
  defaultTrackSession: false,
  gameOverrides: {},
};

/**
 * Return type for useLaunchPreferences hook.
 */
export interface UseLaunchPreferencesResult {
  /** Current launch preferences */
  preferences: LaunchPreferences;
  /** Get launch config for a specific game (applies overrides) */
  getConfigForGame: (gameId: string) => LaunchConfig;
  /** Update default preferences */
  updateDefaults: (updates: Partial<Omit<LaunchPreferences, 'gameOverrides'>>) => void;
  /** Set per-game override */
  setGameOverride: (gameId: string, config: Partial<LaunchConfig>) => void;
  /** Clear per-game override */
  clearGameOverride: (gameId: string) => void;
  /** Check if a game has custom overrides */
  hasGameOverride: (gameId: string) => boolean;
  /** Reset all preferences to defaults */
  resetToDefaults: () => void;
}

/**
 * Load preferences from localStorage.
 */
function loadPreferences(): LaunchPreferences {
  try {
    const stored = localStorage.getItem(LAUNCH_PREFERENCES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<LaunchPreferences>;
      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
        gameOverrides: {
          ...DEFAULT_PREFERENCES.gameOverrides,
          ...parsed.gameOverrides,
        },
      };
    }
  } catch (e) {
    console.error('Failed to load launch preferences:', e);
  }
  return DEFAULT_PREFERENCES;
}

/**
 * Save preferences to localStorage.
 */
function savePreferences(preferences: LaunchPreferences): void {
  try {
    localStorage.setItem(LAUNCH_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (e) {
    console.error('Failed to save launch preferences:', e);
  }
}

/**
 * Hook to manage launch preferences.
 *
 * @example
 * ```tsx
 * const { preferences, getConfigForGame, setGameOverride } = useLaunchPreferences();
 *
 * // Get config for a game (with overrides applied)
 * const config = getConfigForGame('steam_730');
 *
 * // Set a per-game override
 * setGameOverride('steam_730', { applyOptimizations: false });
 * ```
 */
export function useLaunchPreferences(): UseLaunchPreferencesResult {
  const [preferences, setPreferences] = useState<LaunchPreferences>(loadPreferences);

  // Save to localStorage whenever preferences change
  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  /**
   * Get launch config for a specific game.
   * Applies any game-specific overrides on top of defaults.
   */
  const getConfigForGame = useCallback(
    (gameId: string): LaunchConfig => {
      const override = preferences.gameOverrides[gameId] || {};
      return {
        applyOptimizations:
          override.applyOptimizations ?? preferences.defaultApplyOptimizations,
        runStealthMode:
          override.runStealthMode ?? preferences.defaultRunStealthMode,
        trackSession: override.trackSession ?? preferences.defaultTrackSession,
      };
    },
    [preferences]
  );

  /**
   * Update default preferences.
   */
  const updateDefaults = useCallback(
    (updates: Partial<Omit<LaunchPreferences, 'gameOverrides'>>) => {
      setPreferences((prev) => ({
        ...prev,
        ...updates,
      }));
    },
    []
  );

  /**
   * Set a per-game override.
   */
  const setGameOverride = useCallback(
    (gameId: string, config: Partial<LaunchConfig>) => {
      setPreferences((prev) => ({
        ...prev,
        gameOverrides: {
          ...prev.gameOverrides,
          [gameId]: {
            ...prev.gameOverrides[gameId],
            ...config,
          },
        },
      }));
    },
    []
  );

  /**
   * Clear a per-game override.
   */
  const clearGameOverride = useCallback((gameId: string) => {
    setPreferences((prev) => {
      const { [gameId]: _, ...rest } = prev.gameOverrides;
      return {
        ...prev,
        gameOverrides: rest,
      };
    });
  }, []);

  /**
   * Check if a game has custom overrides.
   */
  const hasGameOverride = useCallback(
    (gameId: string): boolean => {
      return gameId in preferences.gameOverrides;
    },
    [preferences.gameOverrides]
  );

  /**
   * Reset all preferences to defaults.
   */
  const resetToDefaults = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  return {
    preferences,
    getConfigForGame,
    updateDefaults,
    setGameOverride,
    clearGameOverride,
    hasGameOverride,
    resetToDefaults,
  };
}

export default useLaunchPreferences;
