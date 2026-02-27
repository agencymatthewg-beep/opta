/**
 * Clawdbot WebSocket Client
 * Handles connection, reconnection, and message passing
 */

import { encode, decode, createEnvelope } from "./protocol-codec";
import type {
  ProtocolEnvelope,
  ChatMessage,
  MessageAck,
  BotStateUpdate,
  StreamingChunk,
  PingPayload,
  PongPayload,
  ConnectionState,
  BotState,
} from "./types";
import { createChatMessage, generateMessageID } from "./types";

export interface ClawdbotClientOptions {
  serverUrl: string;
  onConnectionChange?: (state: ConnectionState) => void;
  onMessage?: (message: ChatMessage) => void;
  onMessageAck?: (ack: MessageAck) => void;
  onBotState?: (state: BotStateUpdate) => void;
  onStreamingChunk?: (chunk: StreamingChunk) => void;
  onError?: (error: Error) => void;
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
}

export class ClawdbotClient {
  private ws: WebSocket | null = null;
  private options: Required<ClawdbotClientOptions>;
  private sequence = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connectionState: ConnectionState = "disconnected";
  private intentionalClose = false;

  constructor(options: ClawdbotClientOptions) {
    this.options = {
      onConnectionChange: () => {},
      onMessage: () => {},
      onMessageAck: () => {},
      onBotState: () => {},
      onStreamingChunk: () => {},
      onError: () => {},
      reconnectDelayMs: 3000,
      maxReconnectAttempts: 10,
      ...options,
    };
  }

  /**
   * Connect to the Clawdbot server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.intentionalClose = false;
    this.setConnectionState("connecting");

    try {
      // Normalize URL to ws/wss
      let url = this.options.serverUrl;
      if (url.startsWith("http://")) {
        url = url.replace("http://", "ws://");
      } else if (url.startsWith("https://")) {
        url = url.replace("https://", "wss://");
      } else if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
        url = `ws://${url}`;
      }

      // Append /ws path if not present
      if (!url.endsWith("/ws") && !url.endsWith("/")) {
        url = `${url}/ws`;
      } else if (url.endsWith("/")) {
        url = `${url}ws`;
      }

      this.ws = new WebSocket(url);
      this.setupEventHandlers();
    } catch (error) {
      this.setConnectionState("error");
      this.options.onError(error instanceof Error ? error : new Error(String(error)));
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.clearTimers();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.setConnectionState("disconnected");
  }

  /**
   * Send a chat message
   */
  sendMessage(content: string): ChatMessage {
    const message = createChatMessage(content, { type: "user" });

    if (this.ws?.readyState === WebSocket.OPEN) {
      const envelope = createEnvelope("chat.message", this.nextSequence(), message);
      this.ws.send(encode(envelope));
      message.status = "sent";
    }

    return message;
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === "connected";
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setConnectionState("connected");
      this.startPingTimer();
    };

    this.ws.onclose = (event) => {
      this.clearTimers();

      if (this.intentionalClose) {
        this.setConnectionState("disconnected");
      } else {
        this.setConnectionState("reconnecting");
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event) => {
      this.options.onError(new Error("WebSocket error"));
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  private handleMessage(data: string): void {
    try {
      const envelope = decode(data);
      this.routeMessage(envelope);
    } catch (error) {
      console.warn("[ClawdbotClient] Failed to decode message:", error);
    }
  }

  private routeMessage(envelope: ProtocolEnvelope): void {
    switch (envelope.type) {
      case "chat.message":
        this.options.onMessage(envelope.payload as ChatMessage);
        break;

      case "message.ack":
        this.options.onMessageAck(envelope.payload as MessageAck);
        break;

      case "bot.state":
        this.options.onBotState(envelope.payload as BotStateUpdate);
        break;

      case "streaming.chunk":
        this.options.onStreamingChunk(envelope.payload as StreamingChunk);
        break;

      case "system.ping":
        this.handlePing(envelope.payload as PingPayload);
        break;

      case "system.error":
        console.error("[ClawdbotClient] Server error:", envelope.payload);
        break;
    }
  }

  private handlePing(payload: PingPayload): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const pong: PongPayload = {
      timestamp: new Date().toISOString(),
      echoTimestamp: payload.timestamp,
    };

    const envelope = createEnvelope("system.pong", this.nextSequence(), pong);
    this.ws.send(encode(envelope));
  }

  private startPingTimer(): void {
    // Client-side ping to detect dead connections
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const ping: PingPayload = { timestamp: new Date().toISOString() };
        const envelope = createEnvelope("system.ping", this.nextSequence(), ping);
        this.ws.send(encode(envelope));
      }
    }, 30000);
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.setConnectionState("error");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.options.reconnectDelayMs * Math.min(this.reconnectAttempts, 5);

    this.reconnectTimer = setTimeout(() => {
      if (!this.intentionalClose) {
        this.connect();
      }
    }, delay);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.options.onConnectionChange(state);
    }
  }

  private nextSequence(): number {
    return ++this.sequence;
  }
}
