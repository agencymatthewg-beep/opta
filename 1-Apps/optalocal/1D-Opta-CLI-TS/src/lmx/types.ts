// ─── Structured LMX Error ────────────────────────────────────────────────────

export class LmxApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'LmxApiError';
  }
}

// --- Public Response Types (what commands consume) ---

export interface LmxHealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version?: string;
  uptime_seconds?: number;
}

export interface LmxModelDetail {
  model_id: string;
  status: 'loaded' | 'loading' | 'unloading';
  memory_bytes?: number;
  context_length?: number;
  is_default?: boolean;
  loaded_at?: string;
  request_count?: number;
}

export interface LmxStatusResponse {
  status: string;
  version?: string;
  uptime_seconds?: number;
  models: LmxModelDetail[];
  memory?: {
    used_bytes: number;
    total_bytes: number;
    threshold: number;
  };
}

export interface LmxModelsResponse {
  models: LmxModelDetail[];
}

export type LmxLoadStatus = 'loaded' | 'download_required' | 'downloading';

export interface LmxLoadResponse {
  model_id: string;
  status: LmxLoadStatus;
  memory_bytes?: number;
  load_time_seconds?: number;
  estimated_size_bytes?: number;
  estimated_size_human?: string;
  confirmation_token?: string;
  download_id?: string;
  message?: string;
  confirm_url?: string;
  progress_url?: string;
}

export interface LmxUnloadResponse {
  model_id: string;
  status: 'unloaded';
  freed_bytes?: number;
}

export interface LmxAvailableModel {
  repo_id: string;
  local_path: string;
  size_bytes: number;
  downloaded_at?: number;
}

export interface LmxPreset {
  name: string;
  description?: string;
  model: string;
  parameters?: Record<string, unknown>;
  system_prompt?: string;
  routing_alias?: string;
  auto_load?: boolean;
  performance?: Record<string, unknown>;
}

export interface LmxPresetsResponse {
  presets: LmxPreset[];
  count: number;
}

export interface LmxStackRole {
  preferences: string[];
  resolved_model: string | null;
  loaded: boolean;
}

export interface LmxStackResponse {
  roles: Record<string, LmxStackRole>;
  helper_nodes: Record<string, unknown>;
  loaded_models: string[];
  default_model: string | null;
}

export interface LmxMemoryResponse {
  total_unified_memory_gb: number;
  used_gb: number;
  available_gb: number;
  threshold_percent: number;
  models: Record<string, { memory_gb: number; loaded: boolean }>;
}

export interface LmxDownloadResponse {
  downloadId: string;
  repoId: string;
  estimatedSizeBytes?: number;
  status: string;
}

export interface LmxDownloadProgress {
  downloadId: string;
  repoId: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progressPercent: number;
  downloadedBytes: number;
  totalBytes: number;
  filesCompleted: number;
  filesTotal: number;
  error?: string;
}

export interface LmxDeleteResponse {
  modelId: string;
  freedBytes: number;
}

export interface LmxModelPerformance {
  modelId: string;
  backendType: string;
  loadedAt: string;
  requestCount: number;
  lastUsedAt?: string;
  memoryGb: number;
  contextLength: number;
  useBatching: boolean;
  performanceOverrides: Record<string, unknown>;
  globalDefaults: Record<string, unknown>;
}

export interface LmxMetricsSummary {
  totalRequests: number;
  totalTokens: number;
  avgLatencyMs: number;
  errorRate: number;
  [key: string]: unknown;
}

export interface LmxBenchmarkRun {
  run: number;
  tokensGenerated: number;
  timeToFirstTokenMs: number;
  totalTimeMs: number;
  tokensPerSecond: number;
}

export interface LmxBenchmarkResult {
  modelId: string;
  backendType: string;
  prompt: string;
  maxTokens: number;
  runs: number;
  results: LmxBenchmarkRun[];
  avgTokensPerSecond: number;
  avgTimeToFirstTokenMs: number;
  avgTotalTimeMs: number;
}

export interface LmxBenchmarkPersistRequest {
  modelId: string;
  prompt?: string;
  numOutputTokens?: number;
  runs?: number;
  temperature?: number;
  warmupRuns?: number;
}

export interface LmxBenchmarkPersistStats {
  ttft_p50_sec: number;
  ttft_p95_sec: number;
  ttft_mean_sec: number;
  toks_per_sec_p50: number;
  toks_per_sec_p95: number;
  toks_per_sec_mean: number;
  prompt_tokens: number;
  output_tokens: number;
  runs_completed: number;
  warmup_runs_discarded: number;
  output_text: string;
  output_token_count: number;
  completed_naturally: boolean;
  repetition_ratio: number;
  coherence_flag: 'ok' | 'truncated' | 'repetitive' | 'garbled';
  tool_call?: Record<string, unknown> | null;
  skills: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface LmxBenchmarkPersistResult {
  model_id: string;
  backend: string;
  timestamp: string;
  status: 'ok' | 'insufficient_data';
  hardware: string;
  lmx_version: string;
  prompt_preview: string;
  stats: LmxBenchmarkPersistStats;
  [key: string]: unknown;
}

export interface LmxBenchmarkResultsOptions {
  modelId?: string;
}

export interface LmxConfigReloadResult {
  success: boolean;
  updated: string[];
}

export interface LmxLoadModelOptions extends LmxRequestOptions {
  backend?: string;
  autoDownload?: boolean;
  performanceOverrides?: Record<string, unknown>;
  keepAliveSec?: number;
  allowUnsupportedRuntime?: boolean;
}

export interface LmxPresetDetailResponse extends LmxPreset {
  [key: string]: unknown;
}

export interface LmxPresetReloadResult {
  success?: boolean;
  presets_loaded?: number;
  [key: string]: unknown;
}

export interface LmxProbeModelOptions {
  modelId: string;
  timeoutSec?: number;
  allowUnsupportedRuntime?: boolean;
}

export interface LmxProbeModelResult {
  model_id?: string;
  success?: boolean;
  [key: string]: unknown;
}

export interface LmxModelCompatibilityOptions {
  modelId?: string;
  backend?: string;
  outcome?: string;
  sinceTs?: number;
  limit?: number;
  includeSummary?: boolean;
}

export interface LmxModelCompatibilityResult {
  summary?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LmxAutotuneModelOptions {
  modelId: string;
  prompt?: string;
  maxTokens?: number;
  temperature?: number;
  runs?: number;
  profiles?: Array<Record<string, unknown> | string>;
  allowUnsupportedRuntime?: boolean;
}

export interface LmxAutotuneModelResult {
  model_id?: string;
  success?: boolean;
  [key: string]: unknown;
}

export interface LmxAutotuneRecordOptions {
  backend?: string;
  backendVersion?: string;
}

export interface LmxAutotuneRecordResult {
  model_id?: string;
  backend?: string;
  backend_version?: string;
  [key: string]: unknown;
}

export interface LmxQuantizeRequest {
  sourceModel: string;
  outputPath?: string;
  bits?: 4 | 8;
  groupSize?: number;
  mode?: 'affine' | 'symmetric';
}

export interface LmxQuantizeStartResult {
  job_id: string;
  source_model: string;
  output_path: string;
  bits: number;
  mode: string;
  status: string;
}

export interface LmxQuantizeJobResult {
  job_id?: string;
  source_model?: string;
  output_path?: string;
  bits?: number;
  group_size?: number;
  mode?: string;
  status?: string;
  started_at?: number;
  completed_at?: number;
  duration_sec?: number;
  output_size_bytes?: number;
  output_size_gb?: number;
  error?: string;
}

export interface LmxQuantizeJobsResult {
  jobs: LmxQuantizeJobResult[];
  count: number;
}

export interface LmxPredictorStats {
  predicted_next?: string | null;
  [key: string]: unknown;
}

export interface LmxHelpersHealth {
  helpers?: Record<string, unknown>;
  live_checks?: Record<string, boolean>;
  configured_count?: number;
  all_healthy?: boolean;
  [key: string]: unknown;
}

export interface LmxAgentRunStep {
  id?: string;
  role?: string;
  order?: number;
  status?: string;
  input?: string;
  output?: string | null;
  error?: string | null;
  created_at?: number;
  started_at?: number | null;
  completed_at?: number | null;
  [key: string]: unknown;
}

export interface LmxAgentRunRequest {
  strategy?: string;
  prompt?: string;
  roles?: string[];
  model?: string;
  role_models?: Record<string, string>;
  max_parallelism?: number;
  timeout_sec?: number | null;
  priority?: string;
  metadata?: Record<string, unknown>;
  submitted_by?: string | null;
  [key: string]: unknown;
}

export interface LmxAgentRunResult {
  object?: string;
  id: string;
  status: string;
  request?: LmxAgentRunRequest;
  steps?: LmxAgentRunStep[];
  result?: unknown;
  output?: unknown;
  error?: string | null;
  resolved_model?: string | null;
  created_at?: number;
  updated_at?: number;
  [key: string]: unknown;
}

export interface LmxAgentRunListResult {
  object?: string;
  data: LmxAgentRunResult[];
  total: number;
}

export interface LmxAgentRunCreatePayload {
  request?: Record<string, unknown>;
  agent?: string;
  input?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface LmxSkillSummary {
  schema?: string;
  name?: string;
  namespace?: string;
  version?: string;
  qualified_name?: string;
  reference?: string;
  description?: string;
  kind?: string;
  timeout_sec?: number;
  permission_tags?: string[];
  risk_tags?: string[];
  input_schema?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LmxSkillListResult {
  object?: string;
  data: LmxSkillSummary[];
}

export interface LmxSkillTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  namespace?: string | null;
  version?: string | null;
  aliases?: string[];
  [key: string]: unknown;
}

export interface LmxSkillMcpToolsResult {
  tools: LmxSkillTool[];
  list_changed_at?: string;
}

export interface LmxSkillExecuteRequest {
  arguments?: Record<string, unknown> | string;
  approved?: boolean;
  timeoutSec?: number;
}

export interface LmxSkillExecuteResponse {
  skill?: string;
  ok?: boolean;
  output?: unknown;
  error?: string | null;
  duration_ms?: number;
  timed_out?: boolean;
  denied?: boolean;
  requires_approval?: boolean;
  [key: string]: unknown;
}

export interface LmxSkillMcpCallRequest {
  name: string;
  arguments?: Record<string, unknown> | string;
  approved?: boolean;
}

export interface LmxSkillMcpCallResponse {
  skill_name?: string;
  kind?: string;
  ok?: boolean;
  output?: unknown;
  error?: string | null;
  duration_ms?: number;
  timed_out?: boolean;
  denied?: boolean;
  requires_approval?: boolean;
  [key: string]: unknown;
}

export interface LmxSkillOpenClawInvokeRequest {
  name?: string;
  tool?: string;
  toolName?: string;
  arguments?: Record<string, unknown> | string;
  input?: Record<string, unknown> | string;
  params?: Record<string, unknown> | string;
  approved?: boolean;
  timeoutSec?: number;
}

export interface LmxSkillOpenClawInvokeResponse {
  object?: string;
  tool?: string;
  ok?: boolean;
  result?: unknown;
  error?: string | null;
  duration_ms?: number;
  timed_out?: boolean;
  denied?: boolean;
  requires_approval?: boolean;
  [key: string]: unknown;
}

export interface LmxRagCollectionInfo {
  name: string;
  document_count: number;
  embedding_dimensions: number;
}

export interface LmxRagCollectionsResult {
  total_documents: number;
  collection_count: number;
  collections: LmxRagCollectionInfo[];
}

export interface LmxRagQueryRequest {
  collection: string;
  query: string;
  topK?: number;
  minScore?: number;
  model?: string;
  includeEmbeddings?: boolean;
  searchMode?: 'vector' | 'keyword' | 'hybrid';
  rerank?: boolean;
  rerankTopK?: number;
}

export interface LmxRagQueryResultRow {
  id?: string;
  text?: string;
  score?: number;
  metadata?: Record<string, unknown>;
  embedding?: number[] | null;
  [key: string]: unknown;
}

export interface LmxRagQueryResult {
  collection?: string;
  query?: string;
  results?: LmxRagQueryResultRow[];
  total_in_collection?: number;
  duration_ms?: number;
  [key: string]: unknown;
}

export interface LmxRagIngestRequest {
  collection: string;
  documents: string[];
  metadata?: Array<Record<string, unknown>>;
  chunkSize?: number;
  chunkOverlap?: number;
  chunking?: 'auto' | 'text' | 'code' | 'markdown_headers' | 'none';
  model?: string;
}

export interface LmxRagIngestResult {
  collection?: string;
  documents_ingested?: number;
  chunks_created?: number;
  document_ids?: string[];
  duration_ms?: number;
  [key: string]: unknown;
}

export interface LmxRagContextRequest {
  query: string;
  collections: string[];
  topKPerCollection?: number;
  minScore?: number;
  maxContextTokens?: number;
  model?: string;
  rerank?: boolean;
}

export interface LmxRagContextResult {
  context?: string;
  sources?: Array<Record<string, unknown>>;
  total_chunks?: number;
  estimated_tokens?: number;
  duration_ms?: number;
  [key: string]: unknown;
}

export interface LmxSessionListOptions {
  limit?: number;
  offset?: number;
  model?: string;
  tag?: string;
  since?: string;
}

export interface LmxSessionSearchOptions {
  query: string;
  limit?: number;
}

export interface LmxSessionSummary {
  id: string;
  title: string;
  model: string;
  tags: string[];
  created: string;
  updated: string;
  message_count: number;
}

export interface LmxSessionMessage {
  role: string;
  content?: string | unknown[] | null;
  tool_calls?: unknown[] | null;
  tool_call_id?: string | null;
}

export interface LmxSessionFull {
  id: string;
  title: string;
  model: string;
  tags: string[];
  created: string;
  updated: string;
  cwd: string;
  messages: LmxSessionMessage[];
  tool_call_count: number;
  compacted: boolean;
}

export interface LmxSessionListResult {
  sessions: LmxSessionSummary[];
  total: number;
}

export interface LmxSessionDeleteResult {
  deleted: boolean;
}

export interface LmxEmbeddingsRequest {
  input: string | string[];
  model: string;
  encodingFormat?: string;
}

export interface LmxEmbeddingItem {
  object: string;
  embedding: number[];
  index: number;
}

export interface LmxEmbeddingsUsage {
  prompt_tokens: number;
  total_tokens: number;
}

export interface LmxEmbeddingsResponse {
  object: string;
  data: LmxEmbeddingItem[];
  model: string;
  usage: LmxEmbeddingsUsage;
  [key: string]: unknown;
}

export interface LmxRerankRequest {
  model: string;
  query: string;
  documents: string[];
  topN?: number;
}

export interface LmxRerankDocumentResult {
  index: number;
  relevance_score: number;
  document?: {
    text: string;
  };
  [key: string]: unknown;
}

export interface LmxRerankResponse {
  results: LmxRerankDocumentResult[];
  model: string;
  usage?: {
    total_tokens: number;
  };
  [key: string]: unknown;
}

export interface LmxAnthropicMessage {
  role: string;
  content: string | Array<Record<string, unknown>>;
}

export interface LmxAnthropicMessagesRequest {
  model: string;
  messages: LmxAnthropicMessage[];
  maxTokens?: number;
  system?: string;
  temperature?: number;
  topP?: number;
  stream?: boolean;
  stopSequences?: string[];
}

export interface LmxAnthropicMessagesResponse {
  id?: string;
  type?: string;
  role?: string;
  model?: string;
  content?: Array<Record<string, unknown>>;
  stop_reason?: string | null;
  stop_sequence?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  [key: string]: unknown;
}

export interface LmxRequestOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

export interface LmxHardwareProfile {
  hostname: string;
  chip_name: string | null;
  memory_gb: number | null;
  cpu_cores: number | null;
  metal_available: boolean;
  architecture: string | null;
  gpu_family: string | null;
}

export interface LmxDeviceIdentity {
  hardware: LmxHardwareProfile;
  identity: {
    name: string;
    purpose: string;
    role: string;
  };
}

// ─── Zero-Config Discovery ─────────────────────────────────────────────────

export interface LmxDiscoveryEndpoints {
  preferred_base_url: string;
  base_urls: string[];
  openai_base_url: string;
  admin_base_url: string;
  websocket_url: string;
}

export interface LmxDiscoveryDoc {
  service: string;           // "opta-lmx"
  version: string;
  security_profile: string;  // "open" | "local-key" | "jwt"
  ready: boolean;
  loaded_models: string[];
  auth: {
    admin_key_required: boolean;
    inference_key_required: boolean;
    supabase_jwt_enabled: boolean;
  };
  endpoints: LmxDiscoveryEndpoints;
  client_probe_order: string[];
}
