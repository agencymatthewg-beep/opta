/**
 * Opta LMX API — TypeScript type definitions.
 *
 * Covers every response shape consumed by the dashboard.
 * Grouped by API domain (health, admin, models, inference, etc.).
 */

// ── Health & Readiness ──────────────────────────────────────────────────────

export interface HealthzResponse {
    status: string
    version: string
}

export interface ReadyzResponse {
    status: string
    version?: string
    reason?: string
    models_loaded?: number
}

export interface MetalInfo {
    active_memory_gb: number
    peak_memory_gb: number
    cache_memory_gb: number
}

export interface HelperHealth {
    url: string
    healthy: boolean
}

export interface AdminHealthResponse {
    status: 'ok' | 'degraded'
    version: string
    reason: string | null
    memory_usage_percent: number
    metal: MetalInfo | null
    helpers: Record<string, HelperHealth>
    models_loaded: number
    in_flight_requests: number
}

// ── Admin Status & Memory ───────────────────────────────────────────────────

export interface AdminStatusResponse {
    version: string
    uptime_seconds: number
    models_loaded: number
    memory: {
        used_percent: number
        used_gb: number
        total_gb: number
    }
    in_flight_requests: number
    max_concurrent_requests: number
}

export interface PerModelMemory {
    model_id: string
    memory_gb: number
    backend: string
}

export interface MemoryStatusResponse {
    used_percent: number
    used_gb: number
    total_gb: number
    threshold_percent: number
    per_model: PerModelMemory[]
}

export interface DeviceIdentityResponse {
    chip: string
    memory_gb: number
    hostname: string
    name?: string
    purpose?: string
    role?: string
    os_version?: string
}

// ── Models ──────────────────────────────────────────────────────────────────

export interface LoadedModelStats {
    total_requests: number
    total_tokens_generated: number
    avg_tokens_per_second: number
    last_used_at: number | null
}

export interface LoadedModel {
    model_id: string
    backend: string
    memory_used_gb: number
    loaded_at: number
    keep_alive_sec: number | null
    performance_overrides: Record<string, unknown> | null
    stats: LoadedModelStats
}

export interface AvailableModel {
    repo_id: string
    local_path: string
    size_bytes: number
    downloaded_at: string | null
}

export interface AdminLoadRequest {
    model_id: string
    auto_download?: boolean
    keep_alive_sec?: number | null
    performance_overrides?: Record<string, unknown> | null
    allow_unsupported_runtime?: boolean
    backend?: string | null
}

export interface AdminLoadResponse {
    success: boolean
    model_id: string
    memory_after_load_gb: number
    time_to_load_ms: number
}

export interface AutoDownloadResponse {
    status: 'download_required' | 'downloading'
    model_id: string
    download_id?: string
    estimated_size_bytes?: number | null
    estimated_size_human?: string | null
    confirmation_token?: string
    message: string
    confirm_url?: string
    progress_url?: string
}

export interface AdminUnloadRequest {
    model_id: string
}

export interface AdminUnloadResponse {
    success: boolean
    model_id: string
    memory_freed_gb: number
}

export interface ConfirmLoadRequest {
    confirmation_token: string
}

export interface AdminDeleteResponse {
    success: boolean
    model_id: string
    freed_bytes: number
}

export interface AdminDownloadRequest {
    repo_id: string
    revision?: string | null
    allow_patterns?: string[] | null
    ignore_patterns?: string[] | null
}

export interface AdminDownloadResponse {
    download_id: string
    repo_id: string
    estimated_size_bytes: number | null
    status: string
}

export interface DownloadProgress {
    download_id: string
    repo_id: string
    status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled'
    progress_percent: number
    downloaded_bytes: number
    total_bytes: number
    files_completed: number
    files_total: number
    error: string | null
    error_code: string | null
    started_at?: number
    completed_at?: number | null
}

export interface DownloadListResponse {
    downloads: DownloadProgress[]
}

export interface AdminProbeRequest {
    model_id: string
    timeout_sec?: number
    allow_unsupported_runtime?: boolean
}

export interface AdminProbeResponse {
    model_id: string
    backends: Record<
        string,
        {
            supported: boolean
            reason?: string
            estimated_memory_gb?: number
        }
    >
}

export interface AdminAutotuneRequest {
    model_id: string
    profiles?: Record<string, unknown>[]
    prompt?: string
    max_tokens?: number
    temperature?: number
    runs?: number
    allow_unsupported_runtime?: boolean
}

export interface AdminAutotuneResponse {
    model_id: string
    backend: string
    backend_version: string | null
    best_profile: Record<string, unknown>
    best_metrics: Record<string, number>
    best_score: number
    candidates: Array<{
        profile: Record<string, unknown>
        metrics: Record<string, number>
        score: number
    }>
}

export interface AutotuneRecordResponse {
    model_id: string
    backend: string
    backend_version: string | null
    profile: Record<string, unknown>
    metrics: Record<string, number>
    score: number
    updated_at: number
}

export interface ModelPerformanceResponse {
    model_id: string
    backend: string
    performance: Record<string, unknown>
}

export interface CompatibilityRow {
    model_id: string
    backend: string
    outcome: string
    reason?: string
    timestamp: number
}

export interface ModelCompatibilityResponse {
    total: number
    rows: CompatibilityRow[]
    summary?: Record<string, unknown>
}

// ── Inference ───────────────────────────────────────────────────────────────

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string | null
    tool_calls?: ToolCall[]
    tool_call_id?: string
    name?: string
}

export interface ToolCall {
    id: string
    type: 'function'
    function: {
        name: string
        arguments: string
    }
}

export interface ChatCompletionRequest {
    model: string
    messages: ChatMessage[]
    temperature?: number
    max_tokens?: number
    stream?: boolean
    top_p?: number
    stop?: string | string[]
    tools?: unknown[]
    tool_choice?: unknown
}

export interface Usage {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
}

export interface ChatCompletionChoice {
    index: number
    message: ChatMessage
    finish_reason: string | null
}

export interface ChatCompletionResponse {
    id: string
    object: string
    created: number
    model: string
    choices: ChatCompletionChoice[]
    usage: Usage
}

/** Streaming SSE delta chunk. */
export interface ChatCompletionChunk {
    id: string
    object: string
    created: number
    model: string
    choices: Array<{
        index: number
        delta: Partial<ChatMessage>
        finish_reason: string | null
    }>
    usage?: Usage | null
}

export interface OpenAIModel {
    id: string
    object: 'model'
    created: number
    owned_by: string
}

export interface ModelsListResponse {
    object: 'list'
    data: OpenAIModel[]
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export interface MetricsSummary {
    total_requests: number
    total_tokens_generated: number
    total_prompt_tokens: number
    avg_tokens_per_second: number
    avg_time_to_first_token_ms: number
    avg_total_time_ms: number
    p50_tokens_per_second: number
    p95_tokens_per_second: number
    p99_tokens_per_second: number
    error_count: number
    error_rate: number
    requests_per_minute: number
    [key: string]: number
}

// ── Server-Sent Events ─────────────────────────────────────────────────────

export type ServerEventType =
    | 'model_loaded'
    | 'model_unloaded'
    | 'download_progress'
    | 'download_completed'
    | 'download_failed'
    | 'request_completed'
    | 'memory_warning'
    | 'config_reloaded'
    | 'heartbeat'

export interface ServerEvent {
    event_type: ServerEventType
    data: Record<string, unknown>
}

// ── Presets ──────────────────────────────────────────────────────────────────

export interface Preset {
    name: string
    description: string
    model_pattern?: string
    parameters: Record<string, unknown>
    routing_aliases?: string[]
}

export interface PresetListResponse {
    presets: Preset[]
    total: number
}

// ── Sessions ────────────────────────────────────────────────────────────────

export interface SessionSummary {
    id: string
    title: string | null
    model: string | null
    created_at: string
    updated_at: string
    message_count: number
    tags: string[]
    first_user_message: string | null
}

export interface SessionFull extends SessionSummary {
    messages: ChatMessage[]
}

export interface SessionListResponse {
    sessions: SessionSummary[]
    total: number
    limit: number
    offset: number
}

// ── Benchmark ───────────────────────────────────────────────────────────────

export interface BenchmarkRunRequest {
    model_id: string
    prompt?: string
    num_output_tokens?: number
    runs?: number
    temperature?: number
    warmup_runs?: number
}

export interface BenchmarkRunResult {
    run_index: number
    time_to_first_token_ms: number
    total_time_ms: number
    tokens_generated: number
    tokens_per_second: number
    prompt_tokens: number
}

export interface BenchmarkRunResponse {
    model_id: string
    hardware: string
    prompt: string
    runs: BenchmarkRunResult[]
    avg_time_to_first_token_ms: number
    avg_total_time_ms: number
    avg_tokens_per_second: number
    p50_tokens_per_second: number
    p95_tokens_per_second: number
    total_runs: number
    timestamp: string
}

// ── Stack & Config ──────────────────────────────────────────────────────────

export interface StackRole {
    alias: string
    preferred_models: string[]
    loaded_model: string | null
    status: 'loaded' | 'unloaded' | 'unavailable'
}

export interface StackStatusResponse {
    roles: StackRole[]
    helpers: Record<string, HelperHealth>
}

export interface ConfigReloadResponse {
    success: boolean
    updated: string[]
}

// ── Quantization ────────────────────────────────────────────────────────────

export interface QuantizeJobStatus {
    job_id: string
    model_id: string
    target_bits: number
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
    progress_percent: number
    output_path?: string
    error?: string
    created_at: number
    completed_at?: number | null
}

// ── Diagnostics ─────────────────────────────────────────────────────────────

export interface DiagnosticsResponse {
    verdict: 'healthy' | 'degraded' | 'critical'
    reason: string | null
    uptime_seconds: number
    memory: {
        used_percent: number
        used_gb: number
        total_gb: number
        threshold_percent: number
    }
    models: Array<{
        model_id: string
        backend: string
        memory_gb: number
        loaded_at: number
        requests: number
    }>
    metrics: {
        total_requests: number
        avg_tokens_per_second: number
        error_rate: number
    }
    agents: Record<string, unknown> | null
    recent_errors: Array<{
        timestamp: number
        category: string
        message: string
    }>
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export interface HelpersHealthResponse {
    helpers: Record<
        string,
        {
            url: string
            healthy: boolean
            latency_ms: number
            success_rate: number
            request_count: number
        }
    >
}

// ── Predictor ───────────────────────────────────────────────────────────────

export interface PredictorStatsResponse {
    predictions: Record<string, unknown>
}

// ── Error ───────────────────────────────────────────────────────────────────

export interface LmxApiError {
    error: {
        message: string
        type: string
        param?: string | null
        code?: string | null
    }
}

// ── Connection State ────────────────────────────────────────────────────────

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error'

export interface ConnectionState {
    status: ConnectionStatus
    version: string | null
    url: string
    adminKey: string | null
    lastChecked: number | null
    error: string | null
}

// ── Audio (TTS / STT) ────────────────────────────────────────────────────────

export interface SpeechRequest {
    model?: string
    input: string
    voice?: string
    response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'
    speed?: number
}

export interface TranscriptionResponse {
    text: string
    language?: string
    duration?: number
    words?: Array<{ word: string; start: number; end: number }>
}

// ── RAG & Embeddings ─────────────────────────────────────────────────────────

export interface RagIngestRequest {
    collection: string
    documents: string[]
    metadata?: Array<Record<string, unknown>>
    chunk_size?: number
    chunk_overlap?: number
    chunking?: 'auto' | 'text' | 'code' | 'markdown_headers' | 'none'
    model?: string
}

export interface RagIngestResponse {
    collection: string
    documents_ingested: number
    chunks_created: number
    document_ids: string[]
    duration_ms: number
}

export interface RagQueryRequest {
    collection: string
    query: string
    top_k?: number
    min_score?: number
    model?: string
    search_mode?: 'vector' | 'keyword' | 'hybrid'
    rerank?: boolean
    rerank_top_k?: number
}

export interface RagQueryResult {
    id: string
    text: string
    score: number
    metadata: Record<string, unknown>
}

export interface RagQueryResponse {
    collection: string
    query: string
    results: RagQueryResult[]
    total_in_collection: number
    duration_ms: number
}

export interface RagCollection {
    name: string
    document_count: number
    embedding_dimensions: number
}

export interface RagCollectionsResponse {
    total_documents: number
    collection_count: number
    collections: RagCollection[]
}

export interface EmbeddingData {
    object: 'embedding'
    index: number
    embedding: number[]
}

export interface EmbeddingResponse {
    object: 'list'
    data: EmbeddingData[]
    model: string
    usage: { prompt_tokens: number; total_tokens: number }
}

// ── Skills & MCP Registry ────────────────────────────────────────────────────

export interface Skill {
    schema: string
    name: string
    namespace: string
    version: string
    qualified_name: string
    reference: string
    description: string
    kind: string
    timeout_sec: number
    permission_tags: string[]
    risk_tags: string[]
    input_schema: Record<string, unknown>
}

export interface SkillListResponse {
    object: 'list'
    data: Skill[]
}

export interface SkillExecuteRequest {
    arguments: Record<string, unknown>
    approved?: boolean
    timeout_sec?: number
}

export interface SkillExecuteResponse {
    skill: string
    ok: boolean
    output: unknown
    error?: string
    duration_ms: number
    timed_out: boolean
    denied: boolean
    requires_approval: boolean
}

export interface MCPTool {
    name: string
    description: string
    input_schema: Record<string, unknown>
    namespace?: string
    version?: string
    aliases?: string[]
}

export interface MCPToolsResponse {
    tools: MCPTool[]
    list_changed_at: string
}

export interface MCPToolCallRequest {
    name: string
    arguments?: Record<string, unknown>
    approved?: boolean
}

export interface MCPToolCallResponse {
    skill_name: string
    kind: string
    ok: boolean
    output: unknown
    error?: string
    duration_ms: number
    timed_out: boolean
    denied: boolean
    requires_approval: boolean
}

// ── Agent Orchestration ───────────────────────────────────────────────────────

export type AgentRunStatus =
    | 'queued'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled'

export interface AgentStep {
    id: string
    role: string
    status: AgentRunStatus
    error?: string
    completed_at?: number
}

export interface AgentRequest {
    prompt: string
    roles?: string[]
    model?: string
    strategy?: string
    max_parallelism?: number
    timeout_sec?: number
    priority?: string
    metadata?: Record<string, unknown>
    approval_required?: boolean
}

export interface AgentRun {
    object: 'agent.run'
    id: string
    status: AgentRunStatus
    request: AgentRequest
    steps: AgentStep[]
    result: unknown
    output: unknown
    error?: string
    resolved_model?: string
    created_at: number
    updated_at: number
}

export interface AgentRunCreateRequest {
    request?: AgentRequest
    agent?: string
    input?: Record<string, unknown>
    metadata?: Record<string, unknown>
}

export interface AgentRunListResponse {
    object: 'list'
    data: AgentRun[]
    total: number
}

// ── Journal Logs ──────────────────────────────────────────────────────────────

export interface LogFileEntry {
    filename: string
    size_bytes: number
    created_at: string
}

