/**
 * Hook for user profile management.
 *
 * Provides access to user preferences, hardware signature, and optimization statistics.
 * Auto-loads profile on mount for immediate availability.
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { UserProfile, ProfileUpdate } from '../types/profile';

export interface UseUserProfileResult {
  /** Current user profile, null if not loaded */
  profile: UserProfile | null;
  /** Whether profile is loading */
  loading: boolean;
  /** Last error message, null if no error */
  error: string | null;
  /** Load profile from storage */
  loadProfile: () => Promise<UserProfile>;
  /** Update profile preferences (partial update) */
  updateProfile: (updates: ProfileUpdate) => Promise<UserProfile>;
  /** Delete profile and all associated data */
  deleteProfile: () => Promise<boolean>;
  /** Refresh profile from storage */
  refresh: () => Promise<void>;
}

export function useUserProfile(): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (): Promise<UserProfile> => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<UserProfile>('load_user_profile');
      setProfile(result);
      return result;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (updates: ProfileUpdate): Promise<UserProfile> => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<UserProfile>('update_user_profile', { updates });
      setProfile(result);
      return result;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteProfile = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<boolean>('delete_user_profile');
      if (result) {
        setProfile(null);
      }
      return result;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    await loadProfile();
  }, [loadProfile]);

  // Auto-load profile on mount
  useEffect(() => {
    loadProfile().catch((e) => {
      // Error is already set in state, just log for debugging
      console.error('Failed to load user profile:', e);
    });
  }, [loadProfile]);

  return {
    profile,
    loading,
    error,
    loadProfile,
    updateProfile,
    deleteProfile,
    refresh,
  };
}

export default useUserProfile;
