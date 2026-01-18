/**
 * Phase 46: Dynamic Profile Engine
 *
 * React hook for accessing and managing optimization profiles.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  getProfileEngine,
  getProfileMatcher,
  getProfileStore,
  type OptimizationProfile,
  type ProfileContext,
  type ProfileSwitchResult,
  type GameOverride,
  type ProfileSchedule,
  type HardwareTuning,
} from '../lib/profiles';

export interface UseProfileResult {
  /** All available profiles */
  profiles: OptimizationProfile[];
  /** Currently active profile */
  activeProfile: OptimizationProfile | null;
  /** Current game override (if any) */
  currentGameOverride: GameOverride | null;
  /** Effective hardware tuning (profile + override merged) */
  effectiveTuning: HardwareTuning | null;
  /** Whether auto-switching is enabled */
  autoSwitchEnabled: boolean;
  /** All configured schedules */
  schedules: ProfileSchedule[];
  /** Loading state */
  loading: boolean;
  /** Last error message */
  error: string | null;

  // Actions
  /** Switch to a specific profile */
  switchProfile: (profileId: string) => Promise<ProfileSwitchResult>;
  /** Create a new custom profile */
  createProfile: (profile: Omit<OptimizationProfile, 'id' | 'createdAt' | 'updatedAt'>) => OptimizationProfile;
  /** Update an existing profile */
  updateProfile: (id: string, updates: Partial<OptimizationProfile>) => OptimizationProfile;
  /** Delete a custom profile */
  deleteProfile: (id: string) => boolean;
  /** Toggle auto-switch */
  setAutoSwitch: (enabled: boolean) => void;
  /** Add a game override to a profile */
  addGameOverride: (profileId: string, override: GameOverride) => void;
  /** Remove a game override */
  removeGameOverride: (profileId: string, gameId: string) => void;
  /** Add a schedule */
  addSchedule: (schedule: Omit<ProfileSchedule, 'id'>) => ProfileSchedule;
  /** Update a schedule */
  updateSchedule: (id: string, updates: Partial<ProfileSchedule>) => ProfileSchedule | null;
  /** Delete a schedule */
  deleteSchedule: (id: string) => boolean;
  /** Undo last switch */
  undoLastSwitch: () => boolean;
  /** Trigger auto-detection (check current context and switch if needed) */
  checkAutoSwitch: () => Promise<void>;
}

/**
 * Get current system context for profile matching.
 */
async function getCurrentContext(): Promise<ProfileContext> {
  const context: ProfileContext = {
    powerSource: 'unknown',
    memoryPressure: 'normal',
    thermalState: 'nominal',
    timeOfDay: Date.now(),
    gameDetected: false,
  };

  // Try to get system state from platform backends
  try {
    // Try macOS first
    const macStatus = await invoke<{
      memory: { level: string };
      thermal: { level: string };
      energy: { powerSource: string };
    }>('macos_get_optimization_status');

    if (macStatus) {
      context.memoryPressure = macStatus.memory.level === 'critical'
        ? 'critical'
        : macStatus.memory.level === 'warn'
          ? 'warn'
          : 'normal';

      context.thermalState = macStatus.thermal.level === 'critical'
        ? 'critical'
        : macStatus.thermal.level === 'serious'
          ? 'serious'
          : macStatus.thermal.level === 'fair'
            ? 'fair'
            : 'nominal';

      context.powerSource = macStatus.energy.powerSource === 'ac'
        ? 'ac'
        : macStatus.energy.powerSource === 'battery'
          ? 'battery'
          : 'unknown';
    }
  } catch {
    // Try Windows
    try {
      const winStatus = await invoke<{
        memoryPressure: string;
        thermalState: string;
        powerSource: string;
      }>('windows_get_optimization_status');

      if (winStatus) {
        context.memoryPressure = winStatus.memoryPressure as ProfileContext['memoryPressure'];
        context.thermalState = winStatus.thermalState as ProfileContext['thermalState'];
        context.powerSource = winStatus.powerSource as ProfileContext['powerSource'];
      }
    } catch {
      // Platform commands not available - use defaults
    }
  }

  return context;
}

/**
 * Hook for managing optimization profiles.
 *
 * @param autoDetectInterval - Interval (ms) for auto-detection checks. 0 to disable.
 */
export function useProfile(autoDetectInterval: number = 10000): UseProfileResult {
  const store = useMemo(() => getProfileStore(), []);
  const engine = useMemo(() => getProfileEngine(), []);
  const matcher = useMemo(() => getProfileMatcher(), []);

  const [storeState, setStoreState] = useState(store.getState());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentGameOverride, setCurrentGameOverride] = useState<GameOverride | null>(null);

  const mountedRef = useRef(true);

  // Subscribe to store changes
  useEffect(() => {
    return store.subscribe(setStoreState);
  }, [store]);

  // Subscribe to engine events
  useEffect(() => {
    return engine.onProfileSwitch((result) => {
      if (mountedRef.current) {
        setCurrentGameOverride(result.gameOverride ?? null);
      }
    });
  }, [engine]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Initialize engine with active profile
  useEffect(() => {
    const activeProfile = store.getActiveProfile();
    if (activeProfile && !engine.getCurrentProfile()) {
      engine.activateProfile(activeProfile).catch(console.error);
    }
  }, [store, engine]);

  // Auto-detection interval
  useEffect(() => {
    if (autoDetectInterval <= 0 || !storeState.autoSwitchEnabled) return;

    const checkContext = async () => {
      if (!mountedRef.current || !storeState.autoSwitchEnabled) return;

      try {
        const context = await getCurrentContext();
        const profiles = Object.values(storeState.profiles);
        const match = matcher.matchProfile(profiles, context, storeState.schedules);

        if (match.shouldSwitch && match.profileId !== storeState.activeProfileId) {
          const profile = storeState.profiles[match.profileId];
          if (profile) {
            await engine.activateProfile(profile, context);
            store.setActiveProfile(match.profileId, 'auto_game');
          }
        }
      } catch (err) {
        console.warn('Auto-detection failed:', err);
      }
    };

    const intervalId = setInterval(checkContext, autoDetectInterval);
    return () => clearInterval(intervalId);
  }, [autoDetectInterval, storeState, matcher, engine, store]);

  // Switch to a specific profile
  const switchProfile = useCallback(async (profileId: string): Promise<ProfileSwitchResult> => {
    setLoading(true);
    setError(null);

    try {
      const profile = store.getProfile(profileId);
      if (!profile) {
        throw new Error(`Profile not found: ${profileId}`);
      }

      const context = await getCurrentContext();
      const result = await engine.activateProfile(profile, context);
      store.setActiveProfile(profileId, 'manual');

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [store, engine]);

  // Create a new profile
  const createProfile = useCallback((
    profile: Omit<OptimizationProfile, 'id' | 'createdAt' | 'updatedAt'>
  ): OptimizationProfile => {
    return store.createProfile(profile);
  }, [store]);

  // Update an existing profile
  const updateProfile = useCallback((
    id: string,
    updates: Partial<OptimizationProfile>
  ): OptimizationProfile => {
    return store.updateProfile(id, updates);
  }, [store]);

  // Delete a profile
  const deleteProfile = useCallback((id: string): boolean => {
    return store.deleteProfile(id);
  }, [store]);

  // Toggle auto-switch
  const setAutoSwitch = useCallback((enabled: boolean): void => {
    store.setAutoSwitchEnabled(enabled);
  }, [store]);

  // Add game override
  const addGameOverride = useCallback((profileId: string, override: GameOverride): void => {
    store.addGameOverride(profileId, override);
  }, [store]);

  // Remove game override
  const removeGameOverride = useCallback((profileId: string, gameId: string): void => {
    store.removeGameOverride(profileId, gameId);
  }, [store]);

  // Schedule management
  const addSchedule = useCallback((schedule: Omit<ProfileSchedule, 'id'>): ProfileSchedule => {
    return store.addSchedule(schedule);
  }, [store]);

  const updateSchedule = useCallback((
    id: string,
    updates: Partial<ProfileSchedule>
  ): ProfileSchedule | null => {
    return store.updateSchedule(id, updates);
  }, [store]);

  const deleteSchedule = useCallback((id: string): boolean => {
    return store.deleteSchedule(id);
  }, [store]);

  // Undo last switch
  const undoLastSwitch = useCallback((): boolean => {
    const result = store.undoLastSwitch();
    if (result) {
      const activeProfile = store.getActiveProfile();
      if (activeProfile) {
        engine.activateProfile(activeProfile).catch(console.error);
      }
    }
    return result;
  }, [store, engine]);

  // Check auto-switch
  const checkAutoSwitch = useCallback(async (): Promise<void> => {
    if (!storeState.autoSwitchEnabled) return;

    const context = await getCurrentContext();
    const profiles = Object.values(storeState.profiles);
    const match = matcher.matchProfile(profiles, context, storeState.schedules);

    if (match.shouldSwitch && match.profileId !== storeState.activeProfileId) {
      await switchProfile(match.profileId);
    }
  }, [storeState, matcher, switchProfile]);

  // Derive values from state
  const profiles = useMemo(() => Object.values(storeState.profiles), [storeState.profiles]);
  const activeProfile = useMemo(
    () => storeState.profiles[storeState.activeProfileId] ?? null,
    [storeState.profiles, storeState.activeProfileId]
  );
  const effectiveTuning = useMemo(() => engine.getEffectiveTuning(), [engine, currentGameOverride]);

  return {
    profiles,
    activeProfile,
    currentGameOverride,
    effectiveTuning,
    autoSwitchEnabled: storeState.autoSwitchEnabled,
    schedules: storeState.schedules,
    loading,
    error,

    switchProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    setAutoSwitch,
    addGameOverride,
    removeGameOverride,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    undoLastSwitch,
    checkAutoSwitch,
  };
}

export default useProfile;
