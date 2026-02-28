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
// Responses API (/v1/responses)
// ---------------------------------------------------------------------------

export type ResponseRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ResponseInputTextPart {
  type: 'input_text';
  text: string;
}

export interface ResponseInputImagePart {
  type: 'input_image';
  image_url: string;
  detail?: 'low' | 'high' | 'auto';
}

export type ResponseInputPart = ResponseInputTextPart | ResponseInputImagePart;

export interface ResponseInputMessage {
  role: ResponseRole;
  content: string | ResponseInputPart[];
}

export interface ResponsesCreateRequest {
  model: string;
  input: string | ResponseInputMessage | ResponseInputMessage[];
  instructions?: string;
  stream?: boolean;
  temperature?: number;
  max_output_tokens?: number;
  metadata?: Record<string, string>;
}

export interface ResponseOutputText {
  type: 'output_text';
  text: string;
  annotations?: Array<Record<string, unknown>>;
}

export interface ResponseOutputMessage {
  type: 'message';
  id?: string;
  role: 'assistant' | 'tool';
  content: ResponseOutputText[];
}

export interface ResponseUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface ResponsesCreateResponse {
  id: string;
  object: string;
  created_at: number;
  model: string;
  status?: string;
  output: ResponseOutputMessage[];
  usage?: ResponseUsage;
}

// ---------------------------------------------------------------------------
// Messages API (/v1/messages)
// ---------------------------------------------------------------------------

export type MessagesRole = 'user' | 'assistant';

export interface MessageTextContentBlock {
  type: 'text';
  text: string;
}

export type MessageContentBlock = MessageTextContentBlock;

export interface MessageRequestItem {
  role: MessagesRole;
  content: string | MessageContentBlock[];
}

export interface MessagesCreateRequest {
  model: string;
  messages: MessageRequestItem[];
  max_tokens: number;
  system?: string | MessageContentBlock[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
}

export interface MessagesCreateResponseUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface MessagesCreateResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: MessageContentBlock[];
  stop_reason?: string | null;
  stop_sequence?: string | null;
  usage?: MessagesCreateResponseUsage;
}

// ---------------------------------------------------------------------------
// Embeddings API (/v1/embeddings)
// ---------------------------------------------------------------------------

export type EmbeddingInput = string | string[] | number[] | number[][];

export interface EmbeddingsRequest {
  model: string;
  input: EmbeddingInput;
  dimensions?: number;
  encoding_format?: 'float' | 'base64';
  user?: string;
}

export interface EmbeddingDatum {
  object: 'embedding';
  index: number;
  embedding: number[] | string;
}

export interface EmbeddingsUsage {
  prompt_tokens: number;
  total_tokens: number;
}

export interface EmbeddingsResponse {
  object: 'list';
  data: EmbeddingDatum[];
  model: string;
  usage?: EmbeddingsUsage;
}

// ---------------------------------------------------------------------------
// Rerank API (/v1/rerank)
// ---------------------------------------------------------------------------

export interface RerankDocument {
  text: string;
  id?: string;
  metadata?: Record<string, unknown>;
}

export interface RerankRequest {
  model: string;
  query: string;
  documents: Array<string | RerankDocument>;
  top_n?: number;
  return_documents?: boolean;
}

export interface RerankResult {
  index: number;
  relevance_score: number;
  document?: RerankDocument;
}

export interface RerankResponse {
  id?: string;
  model?: string;
  results: RerankResult[];
}

// ---------------------------------------------------------------------------
// Admin endpoints
// ---------------------------------------------------------------------------

export interface MemoryStats {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  utilization?: number;
}

export interface AdminMemoryDeviceStats extends MemoryStats {
  device?: string;
}

export interface AdminMemoryResponse {
  total_unified_memory_gb?: number;
  used_gb?: number;
  available_gb?: number;
  threshold_percent?: number;
  models?: Record<
    string,
    {
      memory_gb: number;
      loaded: boolean;
    }
  >;
  timestamp?: string;
  process?: {
    rss_bytes: number;
    vms_bytes?: number;
    shared_bytes?: number;
  };
  system?: MemoryStats;
  gpu?: AdminMemoryDeviceStats[];
}

export type DiagnosticStatus = 'ok' | 'warning' | 'error' | 'unknown';

export interface DiagnosticCheck {
  status: DiagnosticStatus;
  message?: string;
  latency_ms?: number;
  details?: Record<string, unknown>;
}

export interface DiagnosticIssue {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

export interface AdminDiagnosticsResponse {
  status?: 'ok' | 'degraded' | 'error' | 'unknown';
  generated_at?: string;
  checks?: Record<string, DiagnosticCheck>;
  issues?: DiagnosticIssue[];
  timestamp?: number;
  system?: Record<string, unknown>;
  models?: Record<string, unknown>;
  inference?: Record<string, unknown>;
  agents?: Record<string, unknown>;
  recent_errors?: Array<Record<string, unknown>>;
  health_verdict?: Record<string, unknown>;
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
