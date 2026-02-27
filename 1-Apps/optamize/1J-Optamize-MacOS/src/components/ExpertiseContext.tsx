/**
 * ExpertiseContext - Global state provider for expertise-level detection.
 *
 * Expertise detection adapts UI complexity based on user behavior:
 * - simple: Plain language, fewer options for beginners
 * - standard: Balanced explanations for regular users
 * - power: Full technical details for advanced users
 *
 * The system auto-detects expertise from behavior but allows manual override.
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ExpertiseLevel, ExpertiseProfile } from '@/types/expertise';

interface ExpertiseContextType {
  /** Current expertise level (auto-detected or manual) */
  level: ExpertiseLevel;
  /** Confidence in the auto-detection (0-100) */
  confidence: number;
  /** Whether the current level is from manual override */
  isManualOverride: boolean;
  /** Set manual level override (null clears override) */
  setManualLevel: (level: ExpertiseLevel | null) => Promise<void>;
  /** Record a behavioral signal */
  recordSignal: (signal: string, value: number) => void;
  /** Loading state */
  loading: boolean;
}

const ExpertiseContext = createContext<ExpertiseContextType | undefined>(undefined);

const STORAGE_KEY = 'opta_expertise_profile';

export function ExpertiseProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ExpertiseProfile>({
    currentLevel: 'standard',
    confidence: 50,
    signals: {
      usesTechnicalFeatures: 0,
      readsDocumentation: 0,
      usesShortcuts: 0,
      expandsTechnicalDetails: 0,
      usesInvestigationMode: 0,
      timeInApp: 0,
      sessionsCount: 0,
      optimizationsApplied: 0,
    },
    history: [],
    manualOverride: null,
  });
  const [loading, setLoading] = useState(true);

  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const result = await invoke<ExpertiseProfile>('get_expertise_profile');
        if (result) {
          setProfile(result);
        }
      } catch (error) {
        // If Tauri call fails, try localStorage fallback
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            setProfile(JSON.parse(saved));
          } catch {
            // Use default profile
          }
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // Persist to localStorage as backup
  useEffect(() => {
    if (!loading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    }
  }, [profile, loading]);

  const setManualLevel = useCallback(async (level: ExpertiseLevel | null) => {
    try {
      const newProfile = await invoke<ExpertiseProfile>('set_expertise_override', { level });
      if (newProfile) {
        setProfile(newProfile);
      }
    } catch (error) {
      // Fallback: update local state directly
      setProfile((prev) => ({
        ...prev,
        manualOverride: level,
        currentLevel: level || prev.currentLevel,
        confidence: level ? 100 : prev.confidence,
      }));
    }
  }, []);

  const recordSignal = useCallback((signal: string, value: number) => {
    // Fire and forget - don't block UI
    invoke<ExpertiseProfile>('record_expertise_signal', { signalName: signal, value })
      .then((newProfile) => {
        if (newProfile) {
          setProfile(newProfile);
        }
      })
      .catch(() => {
        // Silently fail - signal tracking is non-critical
      });
  }, []);

  return (
    <ExpertiseContext.Provider
      value={{
        level: profile.manualOverride || profile.currentLevel,
        confidence: profile.confidence,
        isManualOverride: !!profile.manualOverride,
        setManualLevel,
        recordSignal,
        loading,
      }}
    >
      {children}
    </ExpertiseContext.Provider>
  );
}

/**
 * Hook to access expertise context.
 * Must be used within ExpertiseProvider.
 */
export function useExpertise() {
  const context = useContext(ExpertiseContext);
  if (!context) {
    throw new Error('useExpertise must be used within ExpertiseProvider');
  }
  return context;
}
