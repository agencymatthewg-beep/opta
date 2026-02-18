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
  tokens_per_second: number;
  temperature_celsius: number;
  uptime_seconds: number;
}

export interface LoadedModel {
  id: string;
  name: string;
  vram_gb: number;
  quantization: string;
  context_length: number;
  loaded_at: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  tokens_used?: number;
  created_at: string;
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
// Sessions
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
