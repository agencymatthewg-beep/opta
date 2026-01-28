/**
 * Phase 46: Dynamic Profile Engine
 *
 * ProfileStore handles persistence of profiles and preferences
 * to localStorage with migration support.
 */

import type {
  OptimizationProfile,
  ProfileStoreState,
  ProfileSwitchEvent,
  ProfileSchedule,
  GameOverride,
} from './types';
import { DEFAULT_PROFILES } from './types';

const STORAGE_KEY = 'opta:profile-store';
const CURRENT_VERSION = 1;
const MAX_HISTORY_LENGTH = 50;

/**
 * ProfileStore - Persistent storage for optimization profiles.
 */
export class ProfileStore {
  private state: ProfileStoreState;
  private listeners: Set<(state: ProfileStoreState) => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  /**
   * Load state from localStorage or initialize with defaults.
   */
  private loadState(): ProfileStoreState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ProfileStoreState;
        return this.migrateState(parsed);
      }
    } catch (error) {
      console.error('Failed to load profile store:', error);
    }

    return this.getDefaultState();
  }

  /**
   * Get default store state.
   */
  private getDefaultState(): ProfileStoreState {
    const profiles: Record<string, OptimizationProfile> = {};
    for (const profile of DEFAULT_PROFILES) {
      profiles[profile.id] = { ...profile };
    }

    return {
      profiles,
      activeProfileId: 'auto',
      autoSwitchEnabled: true,
      switchHistory: [],
      schedules: [],
      version: CURRENT_VERSION,
      updatedAt: Date.now(),
    };
  }

  /**
   * Migrate state from older versions.
   */
  private migrateState(state: ProfileStoreState): ProfileStoreState {
    // Currently at v1, no migrations needed yet
    if (!state.version || state.version < CURRENT_VERSION) {
      // Future migrations would go here
      state.version = CURRENT_VERSION;
    }

    // Ensure default profiles exist
    for (const defaultProfile of DEFAULT_PROFILES) {
      if (!state.profiles[defaultProfile.id]) {
        state.profiles[defaultProfile.id] = { ...defaultProfile };
      }
    }

    return state;
  }

  /**
   * Save state to localStorage.
   */
  private saveState(): void {
    this.state.updatedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.error('Failed to save profile store:', error);
    }
    this.notifyListeners();
  }

  /**
   * Notify all listeners of state change.
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Subscribe to state changes.
   */
  subscribe(listener: (state: ProfileStoreState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current state.
   */
  getState(): ProfileStoreState {
    return this.state;
  }

  /**
   * Get all profiles.
   */
  getProfiles(): OptimizationProfile[] {
    return Object.values(this.state.profiles);
  }

  /**
   * Get a profile by ID.
   */
  getProfile(id: string): OptimizationProfile | null {
    return this.state.profiles[id] ?? null;
  }

  /**
   * Get the active profile.
   */
  getActiveProfile(): OptimizationProfile | null {
    return this.state.profiles[this.state.activeProfileId] ?? null;
  }

  /**
   * Set the active profile.
   */
  setActiveProfile(
    profileId: string,
    reason: ProfileSwitchEvent['reason'] = 'manual'
  ): void {
    const previousId = this.state.activeProfileId;
    if (previousId === profileId) return;

    const profile = this.state.profiles[profileId];
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    // Update active flags
    for (const p of Object.values(this.state.profiles)) {
      p.isActive = p.id === profileId;
    }

    // Record switch event
    const event: ProfileSwitchEvent = {
      fromProfileId: previousId,
      toProfileId: profileId,
      reason,
      timestamp: Date.now(),
      context: {
        powerSource: 'unknown',
        memoryPressure: 'normal',
        thermalState: 'nominal',
        timeOfDay: Date.now(),
        gameDetected: false,
      },
    };

    this.state.switchHistory.unshift(event);
    if (this.state.switchHistory.length > MAX_HISTORY_LENGTH) {
      this.state.switchHistory = this.state.switchHistory.slice(0, MAX_HISTORY_LENGTH);
    }

    this.state.activeProfileId = profileId;
    this.saveState();
  }

  /**
   * Create a new profile.
   */
  createProfile(profile: Omit<OptimizationProfile, 'id' | 'createdAt' | 'updatedAt'>): OptimizationProfile {
    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    const newProfile: OptimizationProfile = {
      ...profile,
      id,
      isDefault: false,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    };

    this.state.profiles[id] = newProfile;
    this.saveState();

    return newProfile;
  }

  /**
   * Update an existing profile.
   */
  updateProfile(id: string, updates: Partial<OptimizationProfile>): OptimizationProfile {
    const profile = this.state.profiles[id];
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    // Don't allow changing certain fields on default profiles
    if (profile.isDefault) {
      delete updates.id;
      delete updates.isDefault;
      delete updates.mode;
    }

    Object.assign(profile, updates, { updatedAt: Date.now() });
    this.saveState();

    return profile;
  }

  /**
   * Delete a profile (only custom profiles can be deleted).
   */
  deleteProfile(id: string): boolean {
    const profile = this.state.profiles[id];
    if (!profile) return false;
    if (profile.isDefault) {
      throw new Error('Cannot delete default profiles');
    }

    // If this was the active profile, switch to auto
    if (this.state.activeProfileId === id) {
      this.state.activeProfileId = 'auto';
      this.state.profiles['auto'].isActive = true;
    }

    delete this.state.profiles[id];
    this.saveState();

    return true;
  }

  /**
   * Add a game override to a profile.
   */
  addGameOverride(profileId: string, override: GameOverride): void {
    const profile = this.state.profiles[profileId];
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    profile.gameOverrides[override.gameId] = override;
    profile.updatedAt = Date.now();
    this.saveState();
  }

  /**
   * Remove a game override from a profile.
   */
  removeGameOverride(profileId: string, gameId: string): void {
    const profile = this.state.profiles[profileId];
    if (!profile) return;

    delete profile.gameOverrides[gameId];
    profile.updatedAt = Date.now();
    this.saveState();
  }

  /**
   * Set auto-switch enabled state.
   */
  setAutoSwitchEnabled(enabled: boolean): void {
    this.state.autoSwitchEnabled = enabled;
    this.saveState();
  }

  /**
   * Get auto-switch enabled state.
   */
  isAutoSwitchEnabled(): boolean {
    return this.state.autoSwitchEnabled;
  }

  /**
   * Add a schedule.
   */
  addSchedule(schedule: Omit<ProfileSchedule, 'id'>): ProfileSchedule {
    const id = `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newSchedule: ProfileSchedule = { ...schedule, id };

    this.state.schedules.push(newSchedule);
    this.saveState();

    return newSchedule;
  }

  /**
   * Update a schedule.
   */
  updateSchedule(id: string, updates: Partial<ProfileSchedule>): ProfileSchedule | null {
    const index = this.state.schedules.findIndex(s => s.id === id);
    if (index === -1) return null;

    Object.assign(this.state.schedules[index], updates);
    this.saveState();

    return this.state.schedules[index];
  }

  /**
   * Delete a schedule.
   */
  deleteSchedule(id: string): boolean {
    const index = this.state.schedules.findIndex(s => s.id === id);
    if (index === -1) return false;

    this.state.schedules.splice(index, 1);
    this.saveState();

    return true;
  }

  /**
   * Get all schedules.
   */
  getSchedules(): ProfileSchedule[] {
    return this.state.schedules;
  }

  /**
   * Get switch history.
   */
  getSwitchHistory(): ProfileSwitchEvent[] {
    return this.state.switchHistory;
  }

  /**
   * Undo the last profile switch.
   */
  undoLastSwitch(): boolean {
    if (this.state.switchHistory.length === 0) return false;

    const lastSwitch = this.state.switchHistory[0];
    const previousProfile = this.state.profiles[lastSwitch.fromProfileId];

    if (previousProfile) {
      // Remove the undo'd switch from history
      this.state.switchHistory.shift();

      // Switch back without recording
      for (const p of Object.values(this.state.profiles)) {
        p.isActive = p.id === previousProfile.id;
      }
      this.state.activeProfileId = previousProfile.id;
      this.saveState();

      return true;
    }

    return false;
  }

  /**
   * Reset to default state.
   */
  reset(): void {
    this.state = this.getDefaultState();
    this.saveState();
  }

  /**
   * Export state for backup.
   */
  export(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Import state from backup.
   */
  import(data: string): boolean {
    try {
      const parsed = JSON.parse(data) as ProfileStoreState;
      this.state = this.migrateState(parsed);
      this.saveState();
      return true;
    } catch (error) {
      console.error('Failed to import profile store:', error);
      return false;
    }
  }
}

// Singleton instance
let storeInstance: ProfileStore | null = null;

/**
 * Get the ProfileStore singleton instance.
 */
export function getProfileStore(): ProfileStore {
  if (!storeInstance) {
    storeInstance = new ProfileStore();
  }
  return storeInstance;
}
