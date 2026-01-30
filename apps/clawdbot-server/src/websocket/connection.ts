/**
 * Connection Handler
 * Manages individual WebSocket client connections.
 */

import type { ServerWebSocket } from 'bun';
import { decode, encode, ProtocolCodecError } from '../protocol/codec';
import { SequenceManager, ClientSequenceTracker } from '../protocol/sequence';
import {
  createEnvelope,
  generateMessageID,
  type ProtocolEnvelope,
  type ChatMessage,
  type MessageAck,
  type BotStateUpdate,
  type StreamingChunk,
  type PingPayload,
  isChatMessage,
} from '../protocol/types';
import { createPongResponse } from './heartbeat';

export interface ConnectionData {
  id: string;
  connectedAt: Date;
  lastActivity: Date;
  sequenceManager: SequenceManager;
  clientSequenceTracker: ClientSequenceTracker;
}

export type MessageHandler = (
  connection: Connection,
  message: ChatMessage
) => Promise<void>;

export class Connection {
  public readonly data: ConnectionData;

  constructor(
    public readonly ws: ServerWebSocket<ConnectionData>,
    private readonly onMessage: MessageHandler
  ) {
    this.data = {
      id: generateMessageID(),
      connectedAt: new Date(),
      lastActivity: new Date(),
      sequenceManager: new SequenceManager(),
      clientSequenceTracker: new ClientSequenceTracker(),
    };
  }

  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(raw: string | Buffer): Promise<void> {
    this.data.lastActivity = new Date();

    let envelope: ProtocolEnvelope;
    try {
      envelope = decode(raw);
    } catch (error) {
      if (error instanceof ProtocolCodecError) {
        this.sendError(error.code, error.message);
      } else {
        this.sendError('DECODE_ERROR', 'Failed to decode message');
      }
      return;
    }

    // Track client sequence
    const { valid, missed } = this.data.clientSequenceTracker.track(envelope.sequence);
    if (!valid) {
      console.warn(`[Connection ${this.data.id}] Duplicate or old sequence: ${envelope.sequence}`);
      return;
    }
    if (missed.length > 0) {
      console.warn(`[Connection ${this.data.id}] Missed sequences: ${missed.join(', ')}`);
    }

    // Route by message type
    switch (envelope.type) {
      case 'chat.message':
        if (isChatMessage(envelope.payload)) {
          await this.handleChatMessage(envelope.payload);
        }
        break;

      case 'system.ping':
        this.handlePing(envelope.payload as PingPayload);
        break;

      case 'system.pong':
        // Handled by HeartbeatManager
        break;

      default:
        console.warn(`[Connection ${this.data.id}] Unhandled message type: ${envelope.type}`);
    }
  }

  /**
   * Handle incoming chat message
   */
  private async handleChatMessage(message: ChatMessage): Promise<void> {
    // Send acknowledgment
    this.sendAck(message.id, 'received');

    // Delegate to message handler
    try {
      await this.onMessage(this, message);
      this.sendAck(message.id, 'processed');
    } catch (error) {
      console.error(`[Connection ${this.data.id}] Message processing error:`, error);
      this.sendAck(message.id, 'error', String(error));
    }
  }

  /**
   * Handle ping - respond with pong
   */
  private handlePing(payload: PingPayload): void {
    const response = createPongResponse(payload, this.data.sequenceManager.next());
    this.ws.send(response);
  }

  /**
   * Send acknowledgment
   */
  sendAck(messageID: string, status: MessageAck['status'], error?: string): void {
    const ack: MessageAck = {
      messageID,
      status,
      serverTimestamp: new Date().toISOString(),
      error,
    };
    this.send('message.ack', ack);
  }

  /**
   * Send bot state update
   */
  sendBotState(state: BotStateUpdate['state'], detail?: string): void {
    const update: BotStateUpdate = {
      state,
      botName: 'Clawdbot',
      detail,
      timestamp: new Date().toISOString(),
    };
    this.send('bot.state', update);
  }

  /**
   * Send streaming chunk
   */
  sendStreamingChunk(messageID: string, chunkIndex: number, content: string, isFinal: boolean): void {
    const chunk: StreamingChunk = {
      messageID,
      chunkIndex,
      content,
      isFinal,
    };
    this.send('streaming.chunk', chunk);
  }

  /**
   * Send a complete chat message (for non-streaming responses)
   */
  sendChatMessage(content: string, replyTo?: string): void {
    const message: ChatMessage = {
      id: generateMessageID(),
      content,
      sender: { type: 'bot', name: 'Clawdbot' },
      timestamp: new Date().toISOString(),
      status: 'delivered',
      replyTo,
    };
    this.send('chat.message', message);
  }

  /**
   * Send error message
   */
  sendError(code: string, message: string): void {
    this.send('system.error', { code, message });
  }

  /**
   * Send a protocol envelope
   */
  private send<T>(type: ProtocolEnvelope['type'], payload: T): void {
    const envelope = createEnvelope(type, this.data.sequenceManager.next(), payload);
    try {
      this.ws.send(encode(envelope));
    } catch (error) {
      console.error(`[Connection ${this.data.id}] Send error:`, error);
    }
  }

  /**
   * Close the connection
   */
  close(code?: number, reason?: string): void {
    this.ws.close(code, reason);
  }
}
