/**
 * WebSocket Server
 * Bun-based WebSocket server for Clawdbot connections.
 */

import type { ServerWebSocket, Server } from 'bun';
import { Connection, type ConnectionData, type MessageHandler } from './connection';
import { HeartbeatManager } from './heartbeat';
import type { Config } from '../config/env';
import type { PongPayload } from '../protocol/types';
import { decode } from '../protocol/codec';
import { SequenceManager, ClientSequenceTracker } from '../protocol/sequence';

export interface ClawdbotServerOptions {
  config: Config;
  onMessage: MessageHandler;
}

export class ClawdbotServer {
  private server: Server<ConnectionData> | null = null;
  private connections = new Map<ServerWebSocket<ConnectionData>, Connection>();
  private heartbeatManager: HeartbeatManager;
  private readonly config: Config;
  private readonly onMessage: MessageHandler;

  constructor(options: ClawdbotServerOptions) {
    this.config = options.config;
    this.onMessage = options.onMessage;

    this.heartbeatManager = new HeartbeatManager(
      {
        intervalMs: this.config.heartbeatIntervalMs,
        timeoutMs: this.config.heartbeatTimeoutMs,
      },
      (ws) => this.handleHeartbeatTimeout(ws as ServerWebSocket<ConnectionData>)
    );
  }

  /**
   * Start the WebSocket server
   */
  start(): void {
    const self = this;

    this.server = Bun.serve<ConnectionData>({
      port: this.config.wsPort,

      fetch(req, server) {
        // Upgrade HTTP to WebSocket
        const url = new URL(req.url);

        if (url.pathname === '/ws' || url.pathname === '/') {
          const success = server.upgrade(req, {
            data: {
              id: crypto.randomUUID(),
              connectedAt: new Date(),
              lastActivity: new Date(),
              sequenceManager: new SequenceManager(),
              clientSequenceTracker: new ClientSequenceTracker(),
            },
          });

          if (success) {
            return undefined;
          }
          return new Response('WebSocket upgrade failed', { status: 400 });
        }

        // Health check endpoint
        if (url.pathname === '/health') {
          return new Response(
            JSON.stringify({
              status: 'healthy',
              connections: self.connections.size,
              uptime: process.uptime(),
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response('Not found', { status: 404 });
      },

      websocket: {
        open(ws) {
          self.handleOpen(ws);
        },

        message(ws, message) {
          self.handleMessage(ws, message);
        },

        close(ws, code, reason) {
          self.handleClose(ws, code, reason);
        },

        drain(ws) {
          // Called when backpressure is relieved
          console.debug(`[Server] Backpressure relieved for connection`);
        },
      },
    });

    console.log(`[Server] Clawdbot WebSocket server listening on port ${this.config.wsPort}`);
  }

  /**
   * Stop the server
   */
  stop(): void {
    // Stop all heartbeats
    this.heartbeatManager.stopAll();

    // Close all connections
    for (const [ws] of this.connections) {
      ws.close(1001, 'Server shutting down');
    }
    this.connections.clear();

    // Stop server
    if (this.server) {
      this.server.stop();
      this.server = null;
    }

    console.log('[Server] Clawdbot server stopped');
  }

  /**
   * Handle new connection
   */
  private handleOpen(ws: ServerWebSocket<ConnectionData>): void {
    // Check max connections
    if (this.connections.size >= this.config.maxConnections) {
      console.warn('[Server] Max connections reached, rejecting');
      ws.close(1013, 'Server is at capacity');
      return;
    }

    // Create connection wrapper
    const connection = new Connection(ws, this.onMessage);
    this.connections.set(ws, connection);

    // Start heartbeat
    this.heartbeatManager.start(ws);

    console.log(`[Server] Connection opened: ${connection.data.id} (total: ${this.connections.size})`);
  }

  /**
   * Handle incoming message
   */
  private handleMessage(ws: ServerWebSocket<ConnectionData>, message: string | Buffer): void {
    const connection = this.connections.get(ws);
    if (!connection) {
      console.warn('[Server] Message from unknown connection');
      return;
    }

    // Check for pong (handled separately for heartbeat manager)
    try {
      const envelope = decode(message);
      if (envelope.type === 'system.pong') {
        this.heartbeatManager.handlePong(ws, envelope.payload as PongPayload);
        return;
      }
    } catch {
      // Will be handled by connection
    }

    // Delegate to connection handler
    connection.handleMessage(message).catch((error) => {
      console.error(`[Server] Error handling message:`, error);
    });
  }

  /**
   * Handle connection close
   */
  private handleClose(ws: ServerWebSocket<ConnectionData>, code: number, reason: string): void {
    const connection = this.connections.get(ws);
    const id = connection?.data.id ?? 'unknown';

    // Stop heartbeat
    this.heartbeatManager.stop(ws);

    // Remove connection
    this.connections.delete(ws);

    console.log(`[Server] Connection closed: ${id} (code: ${code}, reason: ${reason}, remaining: ${this.connections.size})`);
  }

  /**
   * Handle heartbeat timeout
   */
  private handleHeartbeatTimeout(ws: ServerWebSocket<ConnectionData>): void {
    const connection = this.connections.get(ws);
    if (connection) {
      console.warn(`[Server] Heartbeat timeout for connection: ${connection.data.id}`);
      ws.close(1000, 'Heartbeat timeout');
    }
  }

  /**
   * Get server statistics
   */
  getStats(): { connections: number; uptime: number } {
    return {
      connections: this.connections.size,
      uptime: process.uptime(),
    };
  }

  /**
   * Broadcast to all connections
   */
  broadcast(type: string, payload: unknown): void {
    for (const [_, connection] of this.connections) {
      connection.sendChatMessage(JSON.stringify(payload));
    }
  }
}
