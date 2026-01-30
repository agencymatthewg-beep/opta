/**
 * Heartbeat Manager
 * Manages ping/pong heartbeats to detect dead connections.
 */

import type { ServerWebSocket } from 'bun';
import { encode } from '../protocol/codec';
import { createEnvelope, type PingPayload, type PongPayload } from '../protocol/types';
import { SequenceManager } from '../protocol/sequence';

export interface HeartbeatConfig {
  intervalMs: number;
  timeoutMs: number;
}

interface PendingPing {
  timestamp: string;
  timer: ReturnType<typeof setTimeout>;
}

export class HeartbeatManager {
  private intervals = new Map<ServerWebSocket<unknown>, ReturnType<typeof setInterval>>();
  private pendingPings = new Map<ServerWebSocket<unknown>, PendingPing>();
  private sequenceManagers = new Map<ServerWebSocket<unknown>, SequenceManager>();

  constructor(
    private readonly config: HeartbeatConfig,
    private readonly onTimeout: (ws: ServerWebSocket<unknown>) => void
  ) {}

  /**
   * Start heartbeat for a connection
   */
  start(ws: ServerWebSocket<unknown>): void {
    // Clean up any existing heartbeat
    this.stop(ws);

    // Create sequence manager for this connection
    const seqManager = new SequenceManager();
    this.sequenceManagers.set(ws, seqManager);

    // Send periodic pings
    const interval = setInterval(() => {
      this.sendPing(ws, seqManager);
    }, this.config.intervalMs);

    this.intervals.set(ws, interval);
  }

  /**
   * Stop heartbeat for a connection
   */
  stop(ws: ServerWebSocket<unknown>): void {
    const interval = this.intervals.get(ws);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(ws);
    }

    const pending = this.pendingPings.get(ws);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingPings.delete(ws);
    }

    this.sequenceManagers.delete(ws);
  }

  /**
   * Handle incoming pong
   */
  handlePong(ws: ServerWebSocket<unknown>, payload: PongPayload): void {
    const pending = this.pendingPings.get(ws);
    if (!pending) {
      return; // No pending ping, ignore
    }

    // Validate echo timestamp matches
    if (payload.echoTimestamp !== pending.timestamp) {
      console.warn('[Heartbeat] Pong timestamp mismatch');
      return;
    }

    // Clear timeout - connection is alive
    clearTimeout(pending.timer);
    this.pendingPings.delete(ws);

    // Calculate latency
    const latency = Date.now() - new Date(pending.timestamp).getTime();
    console.debug(`[Heartbeat] Pong received, latency: ${latency}ms`);
  }

  /**
   * Send a ping to a connection
   */
  private sendPing(ws: ServerWebSocket<unknown>, seqManager: SequenceManager): void {
    // Don't send if there's already a pending ping
    if (this.pendingPings.has(ws)) {
      console.warn('[Heartbeat] Pending ping timeout, connection may be dead');
      return;
    }

    const timestamp = new Date().toISOString();
    const payload: PingPayload = { timestamp };
    const envelope = createEnvelope('system.ping', seqManager.next(), payload);

    try {
      ws.send(encode(envelope));

      // Set timeout for pong response
      const timer = setTimeout(() => {
        console.warn('[Heartbeat] Ping timeout, closing connection');
        this.pendingPings.delete(ws);
        this.onTimeout(ws);
      }, this.config.timeoutMs);

      this.pendingPings.set(ws, { timestamp, timer });
    } catch (error) {
      console.error('[Heartbeat] Failed to send ping:', error);
    }
  }

  /**
   * Get number of active connections being monitored
   */
  getActiveCount(): number {
    return this.intervals.size;
  }

  /**
   * Stop all heartbeats
   */
  stopAll(): void {
    for (const [ws] of this.intervals) {
      this.stop(ws);
    }
  }
}

/**
 * Create a pong response for a ping
 */
export function createPongResponse(
  pingPayload: PingPayload,
  sequence: number
): string {
  const pongPayload: PongPayload = {
    timestamp: new Date().toISOString(),
    echoTimestamp: pingPayload.timestamp,
  };
  return encode(createEnvelope('system.pong', sequence, pongPayload));
}
