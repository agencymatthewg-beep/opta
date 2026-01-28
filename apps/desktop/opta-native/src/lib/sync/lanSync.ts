/**
 * LAN P2P Sync Service
 *
 * Enables direct device-to-device sync over local network
 * using WebRTC for peer discovery and data transfer.
 */

import { syncDatabase, type SyncableRecord } from './database';

export interface PeerDevice {
  id: string;
  name: string;
  lastSeen: number;
  isConnected: boolean;
}

export interface LANSyncConfig {
  enabled: boolean;
  deviceName: string;
  autoConnect: boolean;
  broadcastInterval: number; // ms
}

export type LANSyncStatus = 'idle' | 'discovering' | 'connecting' | 'connected' | 'syncing' | 'error';

class LANSyncService {
  private config: LANSyncConfig = {
    enabled: false,
    deviceName: 'Opta Device',
    autoConnect: true,
    broadcastInterval: 5000,
  };
  private status: LANSyncStatus = 'idle';
  private peers: Map<string, PeerDevice> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private listeners: Set<(event: LANSyncEvent) => void> = new Set();
  private discoveryTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Configure LAN sync
   */
  configure(config: Partial<LANSyncConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.enabled) {
      this.startDiscovery();
    } else {
      this.stopDiscovery();
    }
  }

  /**
   * Get current status
   */
  getStatus(): LANSyncStatus {
    return this.status;
  }

  /**
   * Get discovered peers
   */
  getPeers(): PeerDevice[] {
    return Array.from(this.peers.values());
  }

  /**
   * Subscribe to events
   */
  onEvent(callback: (event: LANSyncEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: LANSyncEvent): void {
    this.listeners.forEach(cb => cb(event));
  }

  private setStatus(status: LANSyncStatus): void {
    this.status = status;
    this.emit({ type: 'status_change', status });
  }

  /**
   * Start peer discovery
   */
  startDiscovery(): void {
    if (!this.config.enabled) return;

    this.setStatus('discovering');

    // Use BroadcastChannel for same-origin discovery (demo/development)
    // In production, would use mDNS or WebRTC signaling server
    try {
      this.broadcastChannel = new BroadcastChannel('opta_lan_sync');

      this.broadcastChannel.onmessage = (event) => {
        this.handleDiscoveryMessage(event.data);
      };

      // Start broadcasting presence
      this.broadcastPresence();
      this.discoveryTimer = setInterval(() => {
        this.broadcastPresence();
        this.cleanupStalePeers();
      }, this.config.broadcastInterval);
    } catch (err) {
      console.error('Failed to start discovery:', err);
      this.setStatus('error');
    }
  }

  /**
   * Stop peer discovery
   */
  stopDiscovery(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }

    this.peers.clear();
    this.setStatus('idle');
  }

  /**
   * Broadcast device presence
   */
  private broadcastPresence(): void {
    if (!this.broadcastChannel) return;

    const message: PresenceMessage = {
      type: 'presence',
      deviceId: syncDatabase.getDeviceId(),
      deviceName: this.config.deviceName,
      timestamp: Date.now(),
    };

    this.broadcastChannel.postMessage(message);
  }

  /**
   * Handle discovery messages
   */
  private handleDiscoveryMessage(message: LANMessage): void {
    // Ignore our own messages
    if (message.deviceId === syncDatabase.getDeviceId()) return;

    if (message.type === 'presence') {
      const existing = this.peers.get(message.deviceId);
      const peer: PeerDevice = {
        id: message.deviceId,
        name: message.deviceName,
        lastSeen: message.timestamp,
        isConnected: existing?.isConnected || false,
      };
      this.peers.set(message.deviceId, peer);
      this.emit({ type: 'peer_discovered', peer });

      // Auto-connect if enabled
      if (this.config.autoConnect && !peer.isConnected) {
        this.connectToPeer(peer.id);
      }
    } else if (message.type === 'sync_request' && message.targetId === syncDatabase.getDeviceId()) {
      this.handleSyncRequest(message);
    } else if (message.type === 'sync_response' && message.targetId === syncDatabase.getDeviceId()) {
      this.handleSyncResponse(message);
    }
  }

  /**
   * Remove peers that haven't been seen recently
   */
  private cleanupStalePeers(): void {
    const staleThreshold = Date.now() - (this.config.broadcastInterval * 3);

    for (const [id, peer] of this.peers) {
      if (peer.lastSeen < staleThreshold) {
        this.peers.delete(id);
        this.emit({ type: 'peer_lost', peerId: id });
      }
    }
  }

  /**
   * Connect to a peer
   */
  async connectToPeer(peerId: string): Promise<boolean> {
    const peer = this.peers.get(peerId);
    if (!peer) return false;

    this.setStatus('connecting');

    try {
      // In a full implementation, would establish WebRTC connection here
      // For now, use BroadcastChannel for direct messaging
      peer.isConnected = true;
      this.peers.set(peerId, peer);
      this.emit({ type: 'peer_connected', peer });
      this.setStatus('connected');
      return true;
    } catch (err) {
      console.error('Failed to connect to peer:', err);
      this.setStatus('error');
      return false;
    }
  }

  /**
   * Sync with a specific peer
   */
  async syncWithPeer(peerId: string): Promise<boolean> {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.isConnected) return false;

    this.setStatus('syncing');

    try {
      // Get our pending changes
      const pendingChanges = await syncDatabase.getPendingChanges();

      // Send sync request
      const message: SyncRequestMessage = {
        type: 'sync_request',
        deviceId: syncDatabase.getDeviceId(),
        deviceName: this.config.deviceName,
        targetId: peerId,
        timestamp: Date.now(),
        changes: pendingChanges,
      };

      this.broadcastChannel?.postMessage(message);
      this.setStatus('connected');
      return true;
    } catch (err) {
      console.error('Failed to sync with peer:', err);
      this.setStatus('error');
      return false;
    }
  }

  /**
   * Handle incoming sync request
   */
  private async handleSyncRequest(message: SyncRequestMessage): Promise<void> {
    try {
      // Apply their changes
      if (message.changes && message.changes.length > 0) {
        await syncDatabase.applyRemoteChanges(message.changes);
      }

      // Get our changes to send back
      const ourChanges = await syncDatabase.getPendingChanges();

      // Send response
      const response: SyncResponseMessage = {
        type: 'sync_response',
        deviceId: syncDatabase.getDeviceId(),
        deviceName: this.config.deviceName,
        targetId: message.deviceId,
        timestamp: Date.now(),
        changes: ourChanges,
        accepted: message.changes?.length || 0,
      };

      this.broadcastChannel?.postMessage(response);
      this.emit({ type: 'sync_complete', peerId: message.deviceId, received: message.changes?.length || 0 });
    } catch (err) {
      console.error('Failed to handle sync request:', err);
    }
  }

  /**
   * Handle sync response
   */
  private async handleSyncResponse(message: SyncResponseMessage): Promise<void> {
    try {
      // Apply their changes
      if (message.changes && message.changes.length > 0) {
        await syncDatabase.applyRemoteChanges(message.changes);
      }

      // Mark our changes as synced
      if (message.accepted > 0) {
        const pending = await syncDatabase.getPendingChanges();
        await syncDatabase.markAsSynced(pending.slice(0, message.accepted).map(c => c.id));
      }

      this.emit({ type: 'sync_complete', peerId: message.deviceId, received: message.changes?.length || 0 });
    } catch (err) {
      console.error('Failed to handle sync response:', err);
    }
  }

  /**
   * Sync with all connected peers
   */
  async syncAll(): Promise<number> {
    let synced = 0;

    for (const peer of this.peers.values()) {
      if (peer.isConnected) {
        const success = await this.syncWithPeer(peer.id);
        if (success) synced++;
      }
    }

    return synced;
  }
}

// Message types
interface PresenceMessage {
  type: 'presence';
  deviceId: string;
  deviceName: string;
  timestamp: number;
}

interface SyncRequestMessage {
  type: 'sync_request';
  deviceId: string;
  deviceName: string;
  targetId: string;
  timestamp: number;
  changes: SyncableRecord[];
}

interface SyncResponseMessage {
  type: 'sync_response';
  deviceId: string;
  deviceName: string;
  targetId: string;
  timestamp: number;
  changes: SyncableRecord[];
  accepted: number;
}

// Union type for all messages
type LANMessage = PresenceMessage | SyncRequestMessage | SyncResponseMessage;

// Event types
export type LANSyncEvent =
  | { type: 'status_change'; status: LANSyncStatus }
  | { type: 'peer_discovered'; peer: PeerDevice }
  | { type: 'peer_connected'; peer: PeerDevice }
  | { type: 'peer_lost'; peerId: string }
  | { type: 'sync_complete'; peerId: string; received: number };

// Export singleton instance
export const lanSync = new LANSyncService();
