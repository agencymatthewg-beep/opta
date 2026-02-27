/**
 * SQLite Database Foundation for Cross-Device Sync
 *
 * Provides local storage with:
 * - Settings/preferences
 * - User profiles
 * - Optimization history
 * - Sync metadata
 */

import { invoke } from '@tauri-apps/api/core';

// Database types
export interface SyncableRecord {
  id: string;
  version: number;
  updated_at: number;
  deleted_at: number | null;
  sync_status: 'pending' | 'synced' | 'conflict';
  device_id: string;
}

export interface UserSettings extends SyncableRecord {
  key: string;
  value: string;
  category: 'preferences' | 'display' | 'notifications' | 'optimization';
}

export interface OptimizationProfile extends SyncableRecord {
  name: string;
  description: string;
  settings: string; // JSON
  is_active: boolean;
}

export interface SyncMetadata {
  device_id: string;
  device_name: string;
  last_sync_at: number | null;
  sync_token: string | null;
  is_primary: boolean;
}

// Database operations
class SyncDatabase {
  private initialized = false;
  private deviceId: string | null = null;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create tables via Tauri command
      await invoke('init_sync_database');
      this.deviceId = await this.getOrCreateDeviceId();
      this.initialized = true;
    } catch (err) {
      console.error('Failed to initialize sync database:', err);
      // Fall back to localStorage for now
      this.initialized = true;
    }
  }

  /**
   * Get or create unique device ID
   */
  private async getOrCreateDeviceId(): Promise<string> {
    try {
      let deviceId = localStorage.getItem('opta_device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('opta_device_id', deviceId);
      }
      return deviceId;
    } catch {
      return `device_${Date.now()}`;
    }
  }

  /**
   * Get current device ID
   */
  getDeviceId(): string {
    return this.deviceId || 'unknown';
  }

  // ============================================
  // Settings Operations
  // ============================================

  /**
   * Get a setting value
   */
  async getSetting(key: string): Promise<string | null> {
    await this.init();
    try {
      const result = await invoke<string | null>('get_setting', { key });
      return result;
    } catch {
      // Fallback to localStorage
      return localStorage.getItem(`opta_setting_${key}`);
    }
  }

  /**
   * Set a setting value
   */
  async setSetting(
    key: string,
    value: string,
    category: UserSettings['category'] = 'preferences'
  ): Promise<void> {
    await this.init();
    try {
      await invoke('set_setting', {
        key,
        value,
        category,
        deviceId: this.deviceId,
      });
    } catch {
      // Fallback to localStorage
      localStorage.setItem(`opta_setting_${key}`, value);
    }
  }

  /**
   * Get all settings in a category
   */
  async getSettingsByCategory(category: UserSettings['category']): Promise<Record<string, string>> {
    await this.init();
    try {
      const result = await invoke<Record<string, string>>('get_settings_by_category', { category });
      return result;
    } catch {
      // Fallback: scan localStorage
      const settings: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('opta_setting_')) {
          const settingKey = key.replace('opta_setting_', '');
          settings[settingKey] = localStorage.getItem(key) || '';
        }
      }
      return settings;
    }
  }

  /**
   * Delete a setting
   */
  async deleteSetting(key: string): Promise<void> {
    await this.init();
    try {
      await invoke('delete_setting', { key, deviceId: this.deviceId });
    } catch {
      localStorage.removeItem(`opta_setting_${key}`);
    }
  }

  // ============================================
  // Profile Operations
  // ============================================

  /**
   * Get all optimization profiles
   */
  async getProfiles(): Promise<OptimizationProfile[]> {
    await this.init();
    try {
      const result = await invoke<OptimizationProfile[]>('get_profiles');
      return result;
    } catch {
      // Fallback: load from localStorage
      const stored = localStorage.getItem('opta_profiles');
      return stored ? JSON.parse(stored) : [];
    }
  }

  /**
   * Get active profile
   */
  async getActiveProfile(): Promise<OptimizationProfile | null> {
    await this.init();
    try {
      const result = await invoke<OptimizationProfile | null>('get_active_profile');
      return result;
    } catch {
      const profiles = await this.getProfiles();
      return profiles.find(p => p.is_active) || null;
    }
  }

  /**
   * Save a profile
   */
  async saveProfile(profile: Omit<OptimizationProfile, keyof SyncableRecord>): Promise<string> {
    await this.init();
    const id = `profile_${Date.now()}`;
    const fullProfile: OptimizationProfile = {
      id,
      version: 1,
      updated_at: Date.now(),
      deleted_at: null,
      sync_status: 'pending',
      device_id: this.deviceId || 'unknown',
      ...profile,
    };

    try {
      await invoke('save_profile', { profile: fullProfile });
    } catch {
      // Fallback
      const profiles = await this.getProfiles();
      profiles.push(fullProfile);
      localStorage.setItem('opta_profiles', JSON.stringify(profiles));
    }

    return id;
  }

  /**
   * Set active profile
   */
  async setActiveProfile(profileId: string): Promise<void> {
    await this.init();
    try {
      await invoke('set_active_profile', { profileId, deviceId: this.deviceId });
    } catch {
      const profiles = await this.getProfiles();
      const updated = profiles.map(p => ({
        ...p,
        is_active: p.id === profileId,
      }));
      localStorage.setItem('opta_profiles', JSON.stringify(updated));
    }
  }

  /**
   * Delete a profile
   */
  async deleteProfile(profileId: string): Promise<void> {
    await this.init();
    try {
      await invoke('delete_profile', { profileId, deviceId: this.deviceId });
    } catch {
      const profiles = await this.getProfiles();
      const filtered = profiles.filter(p => p.id !== profileId);
      localStorage.setItem('opta_profiles', JSON.stringify(filtered));
    }
  }

  // ============================================
  // Sync Operations
  // ============================================

  /**
   * Get pending changes for sync
   */
  async getPendingChanges(): Promise<SyncableRecord[]> {
    await this.init();
    try {
      const result = await invoke<SyncableRecord[]>('get_pending_changes');
      return result;
    } catch {
      return [];
    }
  }

  /**
   * Mark records as synced
   */
  async markAsSynced(ids: string[]): Promise<void> {
    await this.init();
    try {
      await invoke('mark_as_synced', { ids });
    } catch {
      console.error('Failed to mark records as synced');
    }
  }

  /**
   * Apply remote changes
   */
  async applyRemoteChanges(changes: SyncableRecord[]): Promise<void> {
    await this.init();
    try {
      await invoke('apply_remote_changes', { changes, deviceId: this.deviceId });
    } catch {
      console.error('Failed to apply remote changes');
    }
  }

  /**
   * Get sync metadata
   */
  async getSyncMetadata(): Promise<SyncMetadata | null> {
    await this.init();
    try {
      const result = await invoke<SyncMetadata | null>('get_sync_metadata');
      return result;
    } catch {
      return null;
    }
  }

  /**
   * Update sync metadata
   */
  async updateSyncMetadata(metadata: Partial<SyncMetadata>): Promise<void> {
    await this.init();
    try {
      await invoke('update_sync_metadata', { metadata });
    } catch {
      console.error('Failed to update sync metadata');
    }
  }
}

// Export singleton instance
export const syncDatabase = new SyncDatabase();
