/**
 * Cloud Sync Service
 *
 * Handles synchronization with cloud storage for cross-device
 * settings and profile sync. Uses a simple REST API approach
 * that can be backed by ElectricSQL or similar services.
 */

import { syncDatabase } from './database';

export interface SyncConfig {
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  syncInterval: number; // ms
}

export interface SyncResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  conflicts: number;
  error?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

class CloudSyncService {
  private config: SyncConfig = {
    enabled: false,
    syncInterval: 60000, // 1 minute
  };
  private status: SyncStatus = 'idle';
  private lastSync: number | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  /**
   * Configure the sync service
   */
  configure(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.enabled) {
      this.startPeriodicSync();
    } else {
      this.stopPeriodicSync();
    }
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Get last sync timestamp
   */
  getLastSync(): number | null {
    return this.lastSync;
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.listeners.forEach(cb => cb(status));
  }

  /**
   * Perform a sync operation
   */
  async sync(): Promise<SyncResult> {
    if (!this.config.enabled) {
      return { success: false, uploaded: 0, downloaded: 0, conflicts: 0, error: 'Sync not enabled' };
    }

    if (this.status === 'syncing') {
      return { success: false, uploaded: 0, downloaded: 0, conflicts: 0, error: 'Sync in progress' };
    }

    this.setStatus('syncing');

    try {
      // Check network connectivity
      if (!navigator.onLine) {
        this.setStatus('offline');
        return { success: false, uploaded: 0, downloaded: 0, conflicts: 0, error: 'Offline' };
      }

      // Get pending local changes
      const pendingChanges = await syncDatabase.getPendingChanges();

      // Upload changes
      let uploaded = 0;
      if (pendingChanges.length > 0 && this.config.endpoint) {
        try {
          const response = await fetch(`${this.config.endpoint}/sync/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
            },
            body: JSON.stringify({
              device_id: syncDatabase.getDeviceId(),
              changes: pendingChanges,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            uploaded = result.accepted || 0;
            await syncDatabase.markAsSynced(pendingChanges.map(c => c.id));
          }
        } catch (err) {
          console.error('Upload failed:', err);
        }
      }

      // Download changes from other devices
      let downloaded = 0;
      let conflicts = 0;
      if (this.config.endpoint) {
        try {
          const metadata = await syncDatabase.getSyncMetadata();
          const response = await fetch(`${this.config.endpoint}/sync/download`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
            },
            body: JSON.stringify({
              device_id: syncDatabase.getDeviceId(),
              since: metadata?.last_sync_at || 0,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.changes && result.changes.length > 0) {
              await syncDatabase.applyRemoteChanges(result.changes);
              downloaded = result.changes.length;
              conflicts = result.conflicts || 0;
            }
          }
        } catch (err) {
          console.error('Download failed:', err);
        }
      }

      // Update sync metadata
      this.lastSync = Date.now();
      await syncDatabase.updateSyncMetadata({
        last_sync_at: this.lastSync,
      });

      this.setStatus('idle');
      return { success: true, uploaded, downloaded, conflicts };
    } catch (err) {
      console.error('Sync failed:', err);
      this.setStatus('error');
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Start periodic sync
   */
  startPeriodicSync(): void {
    if (this.syncTimer) return;

    // Initial sync
    this.sync();

    // Periodic sync
    this.syncTimer = setInterval(() => {
      this.sync();
    }, this.config.syncInterval);
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Force a sync now
   */
  async syncNow(): Promise<SyncResult> {
    return this.sync();
  }

  /**
   * Check if sync is available
   */
  isAvailable(): boolean {
    return this.config.enabled && navigator.onLine;
  }
}

// Export singleton instance
export const cloudSync = new CloudSyncService();
