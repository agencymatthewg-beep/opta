/**
 * Cross-Device Sync Infrastructure
 *
 * Provides comprehensive sync capabilities:
 * - Local SQLite storage foundation
 * - Cloud sync for cross-device settings/profiles
 * - P2P LAN sync for direct device communication
 * - Offline-first queue with optimistic updates
 */

export { syncDatabase } from './database';
export type {
  SyncableRecord,
  UserSettings,
  OptimizationProfile,
  SyncMetadata,
} from './database';

export { cloudSync } from './cloudSync';
export type { SyncConfig, SyncResult, SyncStatus } from './cloudSync';

export { lanSync } from './lanSync';
export type {
  PeerDevice,
  LANSyncConfig,
  LANSyncStatus,
  LANSyncEvent,
} from './lanSync';

export { offlineQueue } from './offlineQueue';
export type {
  QueuedOperation,
  OptimisticUpdate,
  QueueStatus,
  QueueEvent,
} from './offlineQueue';
