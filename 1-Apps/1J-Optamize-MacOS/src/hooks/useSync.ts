/**
 * Cross-Device Sync Hook
 *
 * Unified hook for managing sync across all channels:
 * - Cloud sync for settings and profiles
 * - LAN sync for peer-to-peer communication
 * - Offline queue for optimistic updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  syncDatabase,
  cloudSync,
  lanSync,
  offlineQueue,
  SyncStatus,
  LANSyncStatus,
  QueueStatus,
  PeerDevice,
  SyncResult,
  QueueEvent,
  LANSyncEvent,
  OptimizationProfile,
} from '../lib/sync';

export interface SyncState {
  // Cloud sync
  cloudStatus: SyncStatus;
  lastCloudSync: number | null;
  cloudError: string | null;

  // LAN sync
  lanStatus: LANSyncStatus;
  peers: PeerDevice[];
  connectedPeers: number;

  // Offline queue
  queueStatus: QueueStatus;
  pendingOperations: number;
  failedOperations: number;

  // Overall
  isOnline: boolean;
  isSyncing: boolean;
}

export interface SyncActions {
  // Cloud
  syncCloud: () => Promise<SyncResult>;
  configureCloud: (endpoint: string, apiKey?: string) => void;
  enableCloud: (enabled: boolean) => void;

  // LAN
  startLanDiscovery: () => void;
  stopLanDiscovery: () => void;
  connectToPeer: (peerId: string) => Promise<boolean>;
  syncWithPeer: (peerId: string) => Promise<boolean>;
  syncAllPeers: () => Promise<number>;
  setDeviceName: (name: string) => void;

  // Queue
  retryFailedOperations: () => Promise<void>;
  clearFailedOperations: () => Promise<void>;
  cancelOperation: (operationId: string) => Promise<boolean>;

  // Settings/Profiles
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<void>;
  getProfiles: () => Promise<OptimizationProfile[]>;
  getActiveProfile: () => Promise<OptimizationProfile | null>;
  setActiveProfile: (profileId: string) => Promise<void>;
}

export interface UseSyncOptions {
  autoCloudSync?: boolean;
  autoLanDiscovery?: boolean;
  cloudEndpoint?: string;
  cloudApiKey?: string;
  deviceName?: string;
  onCloudSync?: (result: SyncResult) => void;
  onPeerDiscovered?: (peer: PeerDevice) => void;
  onPeerSync?: (peerId: string, received: number) => void;
  onQueueEvent?: (event: QueueEvent) => void;
}

export function useSync(options: UseSyncOptions = {}): SyncState & SyncActions {
  const {
    autoCloudSync = false,
    autoLanDiscovery = false,
    cloudEndpoint,
    cloudApiKey,
    deviceName = 'Opta Device',
    onCloudSync,
    onPeerDiscovered,
    onPeerSync,
    onQueueEvent,
  } = options;

  // State
  const [cloudStatus, setCloudStatus] = useState<SyncStatus>('idle');
  const [lastCloudSync, setLastCloudSync] = useState<number | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [lanStatus, setLanStatus] = useState<LANSyncStatus>('idle');
  const [peers, setPeers] = useState<PeerDevice[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>(offlineQueue.getStatus());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Refs for callbacks
  const onCloudSyncRef = useRef(onCloudSync);
  const onPeerDiscoveredRef = useRef(onPeerDiscovered);
  const onPeerSyncRef = useRef(onPeerSync);
  const onQueueEventRef = useRef(onQueueEvent);

  useEffect(() => {
    onCloudSyncRef.current = onCloudSync;
    onPeerDiscoveredRef.current = onPeerDiscovered;
    onPeerSyncRef.current = onPeerSync;
    onQueueEventRef.current = onQueueEvent;
  }, [onCloudSync, onPeerDiscovered, onPeerSync, onQueueEvent]);

  // Initialize database
  useEffect(() => {
    syncDatabase.init();
  }, []);

  // Configure cloud sync
  useEffect(() => {
    if (cloudEndpoint) {
      cloudSync.configure({
        enabled: autoCloudSync,
        endpoint: cloudEndpoint,
        apiKey: cloudApiKey,
      });
    }
  }, [cloudEndpoint, cloudApiKey, autoCloudSync]);

  // Configure LAN sync
  useEffect(() => {
    lanSync.configure({
      enabled: autoLanDiscovery,
      deviceName,
    });
  }, [autoLanDiscovery, deviceName]);

  // Cloud sync status listener
  useEffect(() => {
    const unsubscribe = cloudSync.onStatusChange((status) => {
      setCloudStatus(status);
      if (status === 'idle') {
        setLastCloudSync(cloudSync.getLastSync());
      }
    });
    return unsubscribe;
  }, []);

  // LAN sync event listener
  useEffect(() => {
    const unsubscribe = lanSync.onEvent((event: LANSyncEvent) => {
      if (event.type === 'status_change') {
        setLanStatus(event.status);
      } else if (event.type === 'peer_discovered') {
        setPeers(lanSync.getPeers());
        onPeerDiscoveredRef.current?.(event.peer);
      } else if (event.type === 'peer_connected') {
        setPeers(lanSync.getPeers());
      } else if (event.type === 'peer_lost') {
        setPeers(lanSync.getPeers());
      } else if (event.type === 'sync_complete') {
        onPeerSyncRef.current?.(event.peerId, event.received);
      }
    });
    return unsubscribe;
  }, []);

  // Queue event listener
  useEffect(() => {
    const unsubscribe = offlineQueue.onEvent((event: QueueEvent) => {
      setQueueStatus(offlineQueue.getStatus());
      onQueueEventRef.current?.(event);

      if (event.type === 'online') {
        setIsOnline(true);
      } else if (event.type === 'offline') {
        setIsOnline(false);
      }
    });
    return unsubscribe;
  }, []);

  // Online/offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Actions
  const syncCloud = useCallback(async (): Promise<SyncResult> => {
    const result = await cloudSync.syncNow();
    if (result.success) {
      setCloudError(null);
    } else {
      setCloudError(result.error || 'Sync failed');
    }
    onCloudSyncRef.current?.(result);
    return result;
  }, []);

  const configureCloud = useCallback((endpoint: string, apiKey?: string) => {
    cloudSync.configure({
      enabled: true,
      endpoint,
      apiKey,
    });
  }, []);

  const enableCloud = useCallback((enabled: boolean) => {
    cloudSync.configure({ enabled });
  }, []);

  const startLanDiscovery = useCallback(() => {
    lanSync.configure({ enabled: true });
    lanSync.startDiscovery();
  }, []);

  const stopLanDiscovery = useCallback(() => {
    lanSync.stopDiscovery();
  }, []);

  const connectToPeer = useCallback(async (peerId: string): Promise<boolean> => {
    return lanSync.connectToPeer(peerId);
  }, []);

  const syncWithPeer = useCallback(async (peerId: string): Promise<boolean> => {
    return lanSync.syncWithPeer(peerId);
  }, []);

  const syncAllPeers = useCallback(async (): Promise<number> => {
    return lanSync.syncAll();
  }, []);

  const setDeviceName = useCallback((name: string) => {
    lanSync.configure({ deviceName: name });
  }, []);

  const retryFailedOperations = useCallback(async () => {
    await offlineQueue.retryFailed();
  }, []);

  const clearFailedOperations = useCallback(async () => {
    await offlineQueue.clearFailed();
  }, []);

  const cancelOperation = useCallback(async (operationId: string): Promise<boolean> => {
    return offlineQueue.cancel(operationId);
  }, []);

  const getSetting = useCallback(async (key: string): Promise<string | null> => {
    return syncDatabase.getSetting(key);
  }, []);

  const setSetting = useCallback(async (key: string, value: string): Promise<void> => {
    await syncDatabase.setSetting(key, value);
  }, []);

  const getProfiles = useCallback(async (): Promise<OptimizationProfile[]> => {
    return syncDatabase.getProfiles();
  }, []);

  const getActiveProfile = useCallback(async (): Promise<OptimizationProfile | null> => {
    return syncDatabase.getActiveProfile();
  }, []);

  const setActiveProfile = useCallback(async (profileId: string): Promise<void> => {
    await syncDatabase.setActiveProfile(profileId);
  }, []);

  // Computed values
  const connectedPeers = peers.filter((p) => p.isConnected).length;
  const isSyncing = cloudStatus === 'syncing' || lanStatus === 'syncing' || queueStatus.isProcessing;

  return {
    // State
    cloudStatus,
    lastCloudSync,
    cloudError,
    lanStatus,
    peers,
    connectedPeers,
    queueStatus,
    pendingOperations: queueStatus.pending,
    failedOperations: queueStatus.failed,
    isOnline,
    isSyncing,

    // Actions
    syncCloud,
    configureCloud,
    enableCloud,
    startLanDiscovery,
    stopLanDiscovery,
    connectToPeer,
    syncWithPeer,
    syncAllPeers,
    setDeviceName,
    retryFailedOperations,
    clearFailedOperations,
    cancelOperation,
    getSetting,
    setSetting,
    getProfiles,
    getActiveProfile,
    setActiveProfile,
  };
}
