/**
 * Hook for learning visibility - surfaces Opta's learned preferences.
 *
 * Provides access to learned preferences, learning statistics, and
 * methods to update/delete user-controlled preferences.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { OptimizationPattern, UserProfile } from '../types/profile';

/**
 * Learned preference representation for UI display.
 * Extended from OptimizationPattern with additional UI fields.
 */
export interface LearnedPreference {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of what was learned */
  description: string;
  /** Whether this is a positive preference or aversion */
  isPositive: boolean;
  /** Confidence percentage (0-100) */
  confidence: number;
  /** Sample count used to derive this preference */
  sampleCount: number;
  /** Whether the preference is enabled */
  enabled: boolean;
  /** Type for adjustable preferences */
  type: 'boolean' | 'priority' | 'choice';
  /** Value for priority type preferences */
  value?: number;
  /** Last updated timestamp */
  lastUpdated: number;
  /** Original pattern reference */
  patternType: 'preference' | 'aversion' | 'timing';
  /** Setting category */
  settingCategory: 'graphics' | 'launch_options' | 'priority';
  /** Setting key */
  settingKey: string;
}

/**
 * Learning statistics for summary display.
 */
export interface LearningStats {
  /** Total decisions analyzed */
  totalDecisions: number;
  /** Number of preferences learned */
  preferencesLearned: number;
  /** Number of aversions learned */
  aversionsLearned: number;
  /** Total patterns */
  totalPatterns: number;
  /** Average confidence across all patterns */
  averageConfidence: number;
  /** Last learning update timestamp */
  lastUpdated: number | null;
}

export interface UseLearningResult {
  /** List of learned preferences */
  learnedPreferences: LearnedPreference[];
  /** Learning statistics */
  learningStats: LearningStats;
  /** Whether data is loading */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Update a preference */
  updatePreference: (id: string, updates: Partial<LearnedPreference>) => void;
  /** Delete a preference */
  deletePreference: (id: string) => void;
  /** Delete all preferences */
  deleteAllPreferences: () => void;
  /** Get relevant preferences for a specific game */
  getRelevantPreferences: (gameId: string) => LearnedPreference[];
  /** Refresh data from backend */
  refresh: () => Promise<void>;
}

/**
 * Convert backend pattern to UI preference.
 */
function patternToPreference(pattern: OptimizationPattern, index: number): LearnedPreference {
  // Generate display name based on pattern
  const categoryDisplay = pattern.settingCategory.replace(/_/g, ' ');
  const keyDisplay = pattern.settingKey.replace(/_/g, ' ');
  const name = `${categoryDisplay}: ${keyDisplay}`;

  return {
    id: `pattern_${index}_${pattern.settingKey}`,
    name,
    description: pattern.description,
    isPositive: pattern.patternType === 'preference',
    confidence: Math.round(pattern.confidence * 100),
    sampleCount: pattern.sampleCount,
    enabled: true,
    type: pattern.settingCategory === 'priority' ? 'priority' : 'boolean',
    value: pattern.settingCategory === 'priority' ? Math.round(pattern.confidence * 100) : undefined,
    lastUpdated: pattern.lastUpdated,
    patternType: pattern.patternType,
    settingCategory: pattern.settingCategory,
    settingKey: pattern.settingKey,
  };
}

/**
 * Calculate learning statistics from patterns.
 */
function calculateStats(patterns: OptimizationPattern[]): LearningStats {
  const preferences = patterns.filter(p => p.patternType === 'preference');
  const aversions = patterns.filter(p => p.patternType === 'aversion');

  const totalSamples = patterns.reduce((sum, p) => sum + p.sampleCount, 0);
  const avgConfidence = patterns.length > 0
    ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
    : 0;

  const lastUpdated = patterns.length > 0
    ? Math.max(...patterns.map(p => p.lastUpdated))
    : null;

  return {
    totalDecisions: totalSamples,
    preferencesLearned: preferences.length,
    aversionsLearned: aversions.length,
    totalPatterns: patterns.length,
    averageConfidence: Math.round(avgConfidence * 100),
    lastUpdated,
  };
}

const PREFERENCES_STORAGE_KEY = 'opta-learning-preferences';

/**
 * Load disabled preferences from localStorage.
 */
function loadDisabledPreferences(): Set<string> {
  try {
    const saved = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      return new Set(data.disabled || []);
    }
  } catch {
    // Ignore errors
  }
  return new Set();
}

/**
 * Save disabled preferences to localStorage.
 */
function saveDisabledPreferences(disabled: Set<string>): void {
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({
      disabled: Array.from(disabled),
      updatedAt: Date.now(),
    }));
  } catch {
    // Ignore errors
  }
}

export function useLearning(): UseLearningResult {
  const [patterns, setPatterns] = useState<OptimizationPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disabledIds, setDisabledIds] = useState<Set<string>>(() => loadDisabledPreferences());

  // Load patterns from user profile
  const loadPatterns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await invoke<UserProfile>('load_user_profile');
      setPatterns(profile.patterns || []);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      // Use empty patterns on error
      setPatterns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadPatterns();
  }, [loadPatterns]);

  // Convert patterns to preferences, applying disabled state
  const learnedPreferences = useMemo(() => {
    return patterns.map((pattern, index) => {
      const pref = patternToPreference(pattern, index);
      pref.enabled = !disabledIds.has(pref.id);
      return pref;
    });
  }, [patterns, disabledIds]);

  // Calculate stats
  const learningStats = useMemo(() => calculateStats(patterns), [patterns]);

  // Update a preference (toggle enabled, adjust value)
  const updatePreference = useCallback((id: string, updates: Partial<LearnedPreference>) => {
    if ('enabled' in updates) {
      setDisabledIds(prev => {
        const next = new Set(prev);
        if (updates.enabled) {
          next.delete(id);
        } else {
          next.add(id);
        }
        saveDisabledPreferences(next);
        return next;
      });
    }
    // Note: Value changes are stored locally only for now
    // In production, would sync to backend
  }, []);

  // Delete a preference (marks as disabled permanently)
  const deletePreference = useCallback((id: string) => {
    setDisabledIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveDisabledPreferences(next);
      return next;
    });
  }, []);

  // Delete all preferences
  const deleteAllPreferences = useCallback(() => {
    const allIds = new Set(learnedPreferences.map(p => p.id));
    setDisabledIds(allIds);
    saveDisabledPreferences(allIds);
  }, [learnedPreferences]);

  // Get preferences relevant to a specific game
  const getRelevantPreferences = useCallback((_gameId: string) => {
    // For now, return all enabled preferences
    // In production, would filter based on game category/settings
    return learnedPreferences.filter(p => p.enabled);
  }, [learnedPreferences]);

  // Refresh data
  const refresh = useCallback(async () => {
    await loadPatterns();
  }, [loadPatterns]);

  return {
    learnedPreferences,
    learningStats,
    loading,
    error,
    updatePreference,
    deletePreference,
    deleteAllPreferences,
    getRelevantPreferences,
    refresh,
  };
}

export default useLearning;
