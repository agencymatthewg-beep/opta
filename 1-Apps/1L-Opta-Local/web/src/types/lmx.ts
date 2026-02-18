/**
 * Opta LMX API Types
 *
 * TypeScript interfaces for the Opta LMX server API.
 * Derived from SHARED.md data models and OpenAI-compatible endpoints.
 */

// ---------------------------------------------------------------------------
// Server Status
// ---------------------------------------------------------------------------

export interface ServerStatus {
  vram_used_gb: number;
  vram_total_gb: number;
  loaded_models: LoadedModel[];
  active_requests: number;
  /** May be absent from partial SSE status updates. */
  tokens_per_second?: number;
  /** May be absent if hardware sensor is unavailable. */
  temperature_celsius?: number;
  uptime_seconds: number;
}

export interface LoadedModel {
  id: string;
  name: string;
  /** VRAM consumed by this model (GB). Optional — not all endpoints return this. */
  vram_gb?: number;
  /** Quantization format (e.g. "4bit", "8bit"). Optional — OpenAI-compat omits this. */
  quantization?: string;
  /** Max context window size. Optional — OpenAI-compat omits this. */
  context_length?: number;
  loaded_at: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  model?: string;
  tokens_used?: number;
  created_at: string;
  /** Tool calls made by an assistant message (from CLI sessions). */
  tool_calls?: ToolCall[];
  /** Tool call ID this message is a response to (role: 'tool'). */
  tool_call_id?: string;
  /** Tool function name (role: 'tool'). */
  tool_name?: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: ChatCompletionUsage;
}

// ---------------------------------------------------------------------------
// Streaming Chat (SSE chunks)
// ---------------------------------------------------------------------------

export interface ChatCompletionDelta {
  role?: string;
  content?: string;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionDelta;
  finish_reason?: string | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
}

// ---------------------------------------------------------------------------
// Sessions (local browser sessions — simplified format)
// ---------------------------------------------------------------------------

export interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// CLI Sessions (served by LMX /admin/sessions — matches Pydantic models)
// ---------------------------------------------------------------------------

/** Lightweight session metadata for list views (no messages). */
export interface SessionSummary {
  id: string;
  title: string;
  model: string;
  tags: string[];
  created: string; // ISO 8601
  updated: string; // ISO 8601
  message_count: number;
}

/** Content part in a multi-modal message (text or image). */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/** Tool/function call within an assistant message. */
export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/** A single message in a CLI session (OpenAI chat format). */
export interface SessionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[] | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  /** Function name for tool role messages. */
  name?: string;
}

/** Complete session with all messages, returned by GET /admin/sessions/:id. */
export interface SessionFull {
  id: string;
  title: string;
  model: string;
  tags: string[];
  created: string; // ISO 8601
  updated: string; // ISO 8601
  cwd: string;
  messages: SessionMessage[];
  tool_call_count: number;
  compacted: boolean;
}

/** Paginated session list response from GET /admin/sessions. */
export interface SessionListResponse {
  sessions: SessionSummary[];
  total: number;
}

// ---------------------------------------------------------------------------
// Model Management
// ---------------------------------------------------------------------------

export interface ModelLoadRequest {
  model_path: string;
  quantization?: string;
}

// ---------------------------------------------------------------------------
// OpenAI-compatible model list response
// ---------------------------------------------------------------------------

export interface ModelsResponse {
  data: LoadedModel[];
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class LMXError extends Error {
  public readonly status: number;
  public readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'LMXError';
    this.status = status;
    this.body = body;
  }
}
