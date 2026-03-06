/**
 * Opta LMX API — TypeScript type definitions.
 *
 * Covers every response shape consumed by the dashboard.
 * Grouped by API domain (health, admin, models, inference, etc.).
 */

// ── Activation & Pairing (mirrored from protocol/v3/types) ──────────────────

export type ActivationState =
    | 'runtime_unavailable'
    | 'runtime_ready'
    | 'accounts_authenticated'
    | 'pairing_pending'
    | 'pairing_claimed'
    | 'bridge_connected'
    | 'code_ready'

export type ActivationScopeStatus = 'pending' | 'satisfied' | 'insufficient'

export interface PairingBridgePayloadMetadata {
    state: ActivationState
    expiresAt: string | null
    recoveryAction: string | null
    scopeStatus: ActivationScopeStatus
}

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

// ── Paired Device Control Plane ────────────────────────────────────────────

export type PairingSessionStatus = 'pending' | 'claimed' | 'expired' | 'cancelled'

export interface PairingSession {
    id: string
    userId: string
    code: string
    status: PairingSessionStatus
    deviceId: string | null
    deviceLabel: string | null
    capabilityScopes: string[]
    createdAt: string
    expiresAt: string
    claimedAt: string | null
    bridgeTokenId: string | null
}

export interface BridgeTokenClaims {
    tokenId: string
    userId: string
    deviceId: string
    trustState: string | null
    scopes: string[]
    issuedAt: string
    expiresAt: string
    status: 'active' | 'revoked' | 'expired'
}

export interface DeviceRuntimeStatus {
    status: 'offline' | 'pairing' | 'connected' | 'degraded' | 'unauthorized'
    activationState?: ActivationState
    reason: string | null
    lastSeenAt: string | null
}

export interface PairingSessionEnvelope {
    session: PairingSession
    metadata?: PairingBridgePayloadMetadata
}

export interface BridgeTokenMintEnvelope {
    token: string
    claims: BridgeTokenClaims
    metadata?: PairingBridgePayloadMetadata
}

export interface SetupCheck {
    id: string
    title: string
    status: 'pending' | 'passed' | 'failed'
    detail?: string | null
    actionId?: string | null
}

export interface SetupFixAction {
    id: string
    label: string
    operationId?: string | null
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

export interface AdminProbeCandidate {
    backend: string
    outcome: string
    reason?: string | null
}

export interface AdminProbeResponse {
    model_id: string
    recommended_backend?: string | null
    candidates: AdminProbeCandidate[]
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
    ts: number
    model_id: string
    backend: string
    backend_version: string
    profile: Record<string, unknown>
    metrics: Record<string, unknown>
    score: number
}

export interface ModelPerformanceResponse {
    model_id: string
    backend_type: string
    loaded_at: number
    request_count: number
    last_used_at: number
    memory_gb: number
    context_length?: number | null
    use_batching?: boolean
    performance: Record<string, unknown>
    speculative?: Record<string, unknown>
    readiness?: Record<string, unknown>
    global_defaults?: Record<string, unknown>
}

export interface CompatibilityRow {
    ts?: number
    model_id: string
    backend: string
    backend_version?: string | null
    outcome: string
    reason?: string | null
    metadata?: Record<string, unknown>
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

export interface ResponsesRequest {
    model: string
    input: string
    stream?: boolean
    temperature?: number
    max_tokens?: number
    max_output_tokens?: number
    top_p?: number
    tools?: unknown[]
}

export interface ResponsesResponse {
    id: string
    object: string
    status: string
    output_text: string
    output: unknown[]
}

export interface LegacyCompletionRequest {
    model: string
    prompt: string | string[]
    suffix?: string | null
    max_tokens?: number | null
    temperature?: number
    top_p?: number
    n?: number
    stream?: boolean
    logprobs?: number | null
    echo?: boolean
    stop?: string | string[] | null
    presence_penalty?: number
    frequency_penalty?: number
    best_of?: number | null
    user?: string | null
    seed?: number | null
    num_ctx?: number | null
}

export interface LegacyCompletionChoice {
    text: string
    index: number
    logprobs: unknown
    finish_reason: string | null
}

export interface LegacyCompletionResponse {
    id: string
    object: string
    created: number
    model: string
    choices: LegacyCompletionChoice[]
    usage: Usage
}

export interface AnthropicMessageRequest {
    role: 'user' | 'assistant'
    content: string
}

export interface AnthropicMessagesRequest {
    model: string
    messages: AnthropicMessageRequest[]
    max_tokens?: number
    system?: string | null
    temperature?: number
    top_p?: number | null
    stream?: boolean
    stop_sequences?: string[] | null
}

export interface AnthropicMessagesResponse {
    id: string
    type: string
    role: string
    model: string
    content: Array<{ type: string; text: string }>
    stop_reason: string | null
    stop_sequence: string | null
    usage: {
        input_tokens: number
        output_tokens: number
    }
}

export interface RerankRequest {
    model: string
    query: string
    documents: string[]
    top_n?: number | null
}

export interface RerankResponse {
    results: Array<{
        index: number
        relevance_score: number
        document: { text: string }
    }>
    model: string
    usage: {
        total_tokens: number
    }
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
    total_accesses?: number
    unique_models?: number
    history_size?: number
    top_models?: Array<[string, number]>
    transition_count?: number
    predicted_next?: string | null
    [key: string]: unknown
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
    arguments: Record<string, unknown> | string
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
    arguments?: Record<string, unknown> | string
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

export interface MCPPromptArgument {
    name: string
    required: boolean
}

export interface MCPPrompt {
    name: string
    description: string
    arguments: MCPPromptArgument[]
}

export interface MCPPromptsResponse {
    ok: boolean
    prompts: MCPPrompt[]
}

export interface MCPPromptGetRequest {
    name: string
    arguments?: Record<string, unknown>
}

export interface MCPPromptMessage {
    role: string
    content: Record<string, unknown>
}

export interface MCPPromptGetResponse {
    ok: boolean
    messages?: MCPPromptMessage[]
    error?: string
}

export interface MCPResource {
    uri: string
    name: string
    description: string
    mimeType?: string
    mime_type?: string
}

export interface MCPResourcesResponse {
    ok: boolean
    resources: MCPResource[]
}

export interface MCPResourceReadRequest {
    uri: string
}

export interface MCPResourceContent {
    uri: string
    mimeType?: string
    mime_type?: string
    text: string
}

export interface MCPResourceReadResponse {
    ok: boolean
    contents?: MCPResourceContent[]
    error?: string
}

export interface MCPCapabilitiesResponse {
    ok: boolean
    capabilities: Record<string, unknown>
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
