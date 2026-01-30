/**
 * Clawdbot Protocol Types
 * TypeScript types matching the server protocol (OptaMolt-compatible)
 */

// ============================================================================
// Message Identification
// ============================================================================

export type MessageID = string;

export function generateMessageID(): MessageID {
  return crypto.randomUUID().toLowerCase();
}

// ============================================================================
// Message Status & Sender
// ============================================================================

export type MessageStatus = "pending" | "sent" | "delivered" | "failed";

export type MessageSender =
  | { type: "user" }
  | { type: "bot"; name: string };

// ============================================================================
// Core Message Types
// ============================================================================

export interface ChatMessage {
  id: MessageID;
  content: string;
  sender: MessageSender;
  timestamp: string;
  status: MessageStatus;
  threadID?: string;
  replyTo?: MessageID;
}

export function createChatMessage(
  content: string,
  sender: MessageSender,
  options?: Partial<ChatMessage>
): ChatMessage {
  return {
    id: options?.id ?? generateMessageID(),
    content,
    sender,
    timestamp: options?.timestamp ?? new Date().toISOString(),
    status: options?.status ?? "pending",
    threadID: options?.threadID,
    replyTo: options?.replyTo,
  };
}

// ============================================================================
// Protocol Envelope
// ============================================================================

export type ProtocolMessageType =
  | "chat.message"
  | "message.ack"
  | "bot.state"
  | "streaming.chunk"
  | "system.ping"
  | "system.pong"
  | "system.error";

export interface ProtocolEnvelope<T = unknown> {
  version: "1.0";
  type: ProtocolMessageType;
  sequence: number;
  payload: T;
  serverTimestamp?: string;
}

// ============================================================================
// Acknowledgment
// ============================================================================

export type AckStatus = "received" | "processed" | "error";

export interface MessageAck {
  messageID: MessageID;
  status: AckStatus;
  serverTimestamp: string;
  error?: string;
}

// ============================================================================
// Bot State
// ============================================================================

export type BotState = "idle" | "thinking" | "typing" | "toolUse";

export interface BotStateUpdate {
  state: BotState;
  botName: string;
  detail?: string;
  timestamp: string;
}

// ============================================================================
// Streaming
// ============================================================================

export interface StreamingChunk {
  messageID: MessageID;
  chunkIndex: number;
  content: string;
  isFinal: boolean;
}

// ============================================================================
// System Messages
// ============================================================================

export interface PingPayload {
  timestamp: string;
}

export interface PongPayload {
  timestamp: string;
  echoTimestamp: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Connection State
// ============================================================================

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";
