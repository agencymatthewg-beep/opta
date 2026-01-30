/**
 * Protocol Types for Clawdbot Server
 * TypeScript port of OptaMolt/Protocol/MessageTypes.swift and StreamingTypes.swift
 */

// ============================================================================
// Message Identification
// ============================================================================

/** Unique message identifier */
export type MessageID = string;

/** Generate a new unique message ID */
export function generateMessageID(): MessageID {
  return crypto.randomUUID().toLowerCase();
}

// ============================================================================
// Message Status & Sender
// ============================================================================

/** Message delivery status */
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed';

/** Sender identification */
export type MessageSender =
  | { type: 'user' }
  | { type: 'bot'; name: string };

// ============================================================================
// Core Message Types
// ============================================================================

/** A chat message in the Opta protocol */
export interface ChatMessage {
  id: MessageID;
  content: string;
  sender: MessageSender;
  timestamp: string; // ISO 8601
  status: MessageStatus;
  threadID?: string;
  replyTo?: MessageID;
}

/** Create a new chat message */
export function createChatMessage(
  content: string,
  sender: MessageSender,
  options?: {
    id?: MessageID;
    timestamp?: string;
    status?: MessageStatus;
    threadID?: string;
    replyTo?: MessageID;
  }
): ChatMessage {
  return {
    id: options?.id ?? generateMessageID(),
    content,
    sender,
    timestamp: options?.timestamp ?? new Date().toISOString(),
    status: options?.status ?? 'pending',
    threadID: options?.threadID,
    replyTo: options?.replyTo,
  };
}

// ============================================================================
// Protocol Envelope
// ============================================================================

/** Protocol message types */
export type ProtocolMessageType =
  | 'chat.message'
  | 'message.ack'
  | 'bot.state'
  | 'streaming.chunk'
  | 'system.ping'
  | 'system.pong'
  | 'system.error';

/** Protocol envelope wrapping messages with metadata */
export interface ProtocolEnvelope<T = unknown> {
  version: '1.0';
  type: ProtocolMessageType;
  sequence: number;
  payload: T;
  serverTimestamp?: string; // ISO 8601
}

/** Create a protocol envelope */
export function createEnvelope<T>(
  type: ProtocolMessageType,
  sequence: number,
  payload: T,
  serverTimestamp?: string
): ProtocolEnvelope<T> {
  return {
    version: '1.0',
    type,
    sequence,
    payload,
    serverTimestamp: serverTimestamp ?? new Date().toISOString(),
  };
}

// ============================================================================
// Acknowledgment
// ============================================================================

/** Ack status */
export type AckStatus = 'received' | 'processed' | 'error';

/** Acknowledgment for message receipt */
export interface MessageAck {
  messageID: MessageID;
  status: AckStatus;
  serverTimestamp: string;
  error?: string;
}

// ============================================================================
// Bot State
// ============================================================================

/** Bot's current processing state */
export type BotState = 'idle' | 'thinking' | 'typing' | 'toolUse';

/** State update from bot */
export interface BotStateUpdate {
  state: BotState;
  botName: string;
  detail?: string; // e.g., "Searching web..." for toolUse
  timestamp: string;
}

// ============================================================================
// Streaming
// ============================================================================

/** A chunk of streaming response */
export interface StreamingChunk {
  messageID: MessageID;
  chunkIndex: number;
  content: string;
  isFinal: boolean;
}

// ============================================================================
// System Messages
// ============================================================================

/** Ping payload */
export interface PingPayload {
  timestamp: string;
}

/** Pong payload */
export interface PongPayload {
  timestamp: string;
  echoTimestamp: string; // Original ping timestamp
}

/** Error payload */
export interface ErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isChatMessage(payload: unknown): payload is ChatMessage {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'id' in payload &&
    'content' in payload &&
    'sender' in payload
  );
}

export function isStreamingChunk(payload: unknown): payload is StreamingChunk {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'messageID' in payload &&
    'chunkIndex' in payload &&
    'content' in payload &&
    'isFinal' in payload
  );
}

export function isBotStateUpdate(payload: unknown): payload is BotStateUpdate {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'state' in payload &&
    'botName' in payload
  );
}
