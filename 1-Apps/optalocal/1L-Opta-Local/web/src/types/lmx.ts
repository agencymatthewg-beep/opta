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
  role: "user" | "assistant" | "system" | "tool";
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
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** Tool/function call within an assistant message. */
export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** A single message in a CLI session (OpenAI chat format). */
export interface SessionMessage {
  role: "system" | "user" | "assistant" | "tool";
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
    this.name = "LMXError";
    this.status = status;
    this.body = body;
  }
}

// ---------------------------------------------------------------------------
// Extended Admin — Memory & Health
// ---------------------------------------------------------------------------

export interface MemoryDetail {
  total_gb: number;
  used_gb: number;
  available_gb: number;
  threshold_percent: number;
  models: Record<string, { memory_gb: number; loaded: boolean }>;
}

export interface AdminHealth {
  memory_percent: number;
  metal_stats?: Record<string, unknown>;
  helper_nodes: Record<string, unknown>;
  in_flight_requests: number;
}

export interface DiagnosticsReport {
  verdict: "healthy" | "degraded" | "critical";
  system_memory: { used_gb: number; total_gb: number; percent: number };
  models: Array<{ id: string; loaded: boolean; ready: boolean }>;
  inference_stats: {
    total_requests: number;
    errors: number;
    avg_latency_ms: number;
  };
  recent_errors: Array<{ timestamp: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Extended Admin — Model Management
// ---------------------------------------------------------------------------

export interface AdminLoadedModel {
  id: string;
  name?: string;
  memory_gb: number;
  request_count: number;
  last_used_at?: string;
  loaded_at: string;
  context_length?: number;
  backend_type?: string;
  ready: boolean;
  quarantined?: boolean;
  speculative?: { enabled: boolean; draft_model?: string; num_tokens?: number };
}

export interface AvailableModel {
  repo_id: string;
  local_path: string;
  size_bytes: number;
  downloaded_at: string;
}

export interface ModelLoadResponse {
  model?: AdminLoadedModel;
  status?: "loading" | "download_required";
  confirmation_token?: string;
  message?: string;
  memory_freed_gb?: number;
}

export interface DownloadProgress {
  download_id: string;
  percent: number;
  bytes_downloaded: number;
  total_bytes: number;
  files_completed: number;
  files_total: number;
  status: "pending" | "downloading" | "completed" | "failed";
  error?: string;
}

export interface ModelPerformanceConfig {
  model_id: string;
  backend_type?: string;
  speculative?: { enabled: boolean; draft_model?: string; num_tokens?: number };
  kv_bits?: number;
  prefix_cache?: boolean;
  max_context_length?: number;
  best_profile?: string;
}

export interface CompatibilityRecord {
  model_id: string;
  backend: string;
  outcome: "success" | "failure";
  reason?: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Extended Admin — Metrics
// ---------------------------------------------------------------------------

export interface MetricsJson {
  total_requests: number;
  total_errors: number;
  avg_latency_ms: number;
  p95_latency_ms?: number;
  tokens_per_second: number;
  total_tokens: number;
  speculative_accept_ratio?: number;
  loaded_models: number;
  in_flight_requests: number;
  uptime_seconds: number;
}

// ---------------------------------------------------------------------------
// Extended Admin — Config & Presets
// ---------------------------------------------------------------------------

export interface Preset {
  name: string;
  description?: string;
  model: string;
  parameters?: Record<string, unknown>;
  system_prompt?: string;
  routing_alias?: string;
  auto_load?: boolean;
  performance?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Extended Admin — Stack
// ---------------------------------------------------------------------------

export interface StackInfo {
  roles: Record<string, { model_id: string; loaded: boolean }>;
  helper_nodes: Record<
    string,
    {
      url: string;
      healthy: boolean;
      latency_ms?: number;
      circuit_open?: boolean;
    }
  >;
  backend_configs: Record<string, unknown>;
  default_model?: string;
}

// ---------------------------------------------------------------------------
// Extended Admin — Benchmarking
// ---------------------------------------------------------------------------

export interface BenchmarkRequest {
  model_id: string;
  prompt?: string;
  max_tokens?: number;
  runs?: number;
  warmup_runs?: number;
}

export interface BenchmarkResult {
  model_id: string;
  ttft_ms: number;
  total_time_ms: number;
  tokens_per_second: number;
  p50_ttft_ms?: number;
  p95_ttft_ms?: number;
  p50_tps?: number;
  p95_tps?: number;
  speculative_stats?: { accept_ratio?: number; tokens_generated?: number };
  coherent?: boolean;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Extended Admin — Quantization
// ---------------------------------------------------------------------------

export interface QuantizeRequest {
  repo_id: string;
  bits?: number;
  revision?: string;
}

export interface QuantizeJob {
  job_id: string;
  repo_id: string;
  status: "pending" | "running" | "completed" | "failed";
  percent?: number;
  output_size_bytes?: number;
  error?: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Extended Admin — Predictor & Helpers
// ---------------------------------------------------------------------------

export interface PredictorStats {
  next_predicted_model?: string;
  usage_stats: Record<string, { count: number; last_used: string }>;
}

export interface HelperNodeStatus {
  name: string;
  url: string;
  healthy: boolean;
  latency_p50_ms?: number;
  latency_p95_ms?: number;
  success_rate?: number;
  circuit_open?: boolean;
}

// ---------------------------------------------------------------------------
// Extended Admin — Logs
// ---------------------------------------------------------------------------

export interface LogFileMeta {
  filename: string;
  size_bytes: number;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Extended Admin — Session Search
// ---------------------------------------------------------------------------

export interface SessionSearchRequest {
  query: string;
  model?: string;
  tags?: string[];
  limit?: number;
}

// ---------------------------------------------------------------------------
// Agent Runs
// ---------------------------------------------------------------------------

/** Possible lifecycle states for a server-side agent run. */
export type AgentRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** A single server-side agent execution record (GET /admin/agents/runs/:id). */
export interface AgentRun {
  id: string;
  status: AgentRunStatus;
  /** User / system input that triggered the run. */
  input?: string;
  /** Final output produced by the agent (available when completed). */
  output?: string;
  /** Model used for this run. */
  model?: string;
  /** System prompt overrride. */
  system_prompt?: string;
  /** Names of skills / tools enabled for this run. */
  tools?: string[];
  /** Cap on the number of agentic turns. */
  max_turns?: number;
  created_at: string; // ISO 8601
  updated_at?: string; // ISO 8601
  /** Error message when status === 'failed'. */
  error?: string;
}

/** Payload for POST /admin/agents/runs. */
export interface AgentRunCreate {
  input: string;
  model?: string;
  system_prompt?: string;
  tools?: string[];
  max_turns?: number;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

/** JSON Schema fragment for a tool's input parameters. */
export interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
}

/** A single MCP tool exposed by a skill server. */
export interface SkillMcpTool {
  name: string;
  description?: string;
  /** JSON Schema for the tool's arguments (typically an object schema). */
  input_schema?: {
    type: 'object';
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
}

/** A skill definition returned by GET /admin/skills/:name. */
export interface Skill {
  name: string;
  description?: string;
  /** MCP server URL or identifier. */
  mcp_server?: string;
  /** Tools exposed by this skill (may be populated on detail calls). */
  tools?: SkillMcpTool[];
  enabled?: boolean;
}

/** Result of POST /admin/skills/:name/execute. */
export interface SkillExecuteResult {
  output: string;
  tool_calls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
  error?: string;
}

// ---------------------------------------------------------------------------
// ML — Embeddings & Rerank
// ---------------------------------------------------------------------------

/** Request body for POST /v1/embeddings. */
export interface EmbeddingsRequest {
  input: string | string[];
  model?: string;
}

/** A single embedding vector with its source index. */
export interface EmbeddingObject {
  object: 'embedding';
  index: number;
  /** Dense vector (float32 values). */
  embedding: number[];
}

/** Response from POST /v1/embeddings (OpenAI-compatible format). */
export interface EmbeddingsResponse {
  object: 'list';
  data: EmbeddingObject[];
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

/** Request body for POST /v1/rerank. */
export interface RerankRequest {
  query: string;
  documents: string[];
  top_k?: number;
}

/** A single reranked result with its original index and relevance score. */
export interface RerankResult {
  index: number;
  relevance_score: number;
  document: string;
}

/** Response from POST /v1/rerank. */
export interface RerankResponse {
  results: RerankResult[];
  model?: string;
}
