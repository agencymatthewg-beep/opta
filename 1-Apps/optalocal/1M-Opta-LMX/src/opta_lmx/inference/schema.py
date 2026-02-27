"""Pydantic models for OpenAI-compatible request/response schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

# ─── Request Models ───────────────────────────────────────────────────────────
# Ordered to avoid forward references: FunctionCall → ToolCall → ChatMessage


class FunctionCall(BaseModel):
    """Function call details."""

    name: str
    arguments: str  # JSON string


class ToolCall(BaseModel):
    """A tool/function call from the model."""

    id: str
    type: str = "function"
    function: FunctionCall


class TextContentPart(BaseModel):
    """A text content part in a multimodal message."""

    type: str = "text"
    text: str


class ImageUrlDetail(BaseModel):
    """Image URL with optional detail level for vision models."""

    url: str  # data:image/png;base64,... or https://...
    detail: str = "auto"  # "low", "high", "auto"


class ImageContentPart(BaseModel):
    """An image content part in a multimodal message."""

    type: str = "image_url"
    image_url: ImageUrlDetail


ContentPart = TextContentPart | ImageContentPart


class ChatMessage(BaseModel):
    """A single message in a conversation.

    Content can be a plain string (text-only) or a list of content parts
    (multimodal, e.g. text + images for vision models). This matches the
    OpenAI API content format exactly.
    """

    role: str  # system, user, assistant, tool, developer
    content: str | list[ContentPart] | None = None
    tool_calls: list[ToolCall] | None = None
    tool_call_id: str | None = None
    name: str | None = None


class ChatCompletionRequest(BaseModel):
    """OpenAI-compatible chat completion request."""

    model: str
    messages: list[ChatMessage]
    temperature: float = Field(0.7, ge=0, le=2.0)
    top_p: float = Field(1.0, ge=0, le=1.0)
    max_tokens: int | None = None
    stream: bool = False
    stop: str | list[str] | None = None
    tools: list[dict[str, Any]] | None = None  # pass through unchanged
    tool_choice: str | dict[str, Any] | None = None
    response_format: dict[str, Any] | None = None
    user: str | None = None
    n: int = Field(1, ge=1, le=16)
    seed: int | None = None
    logprobs: bool | None = None
    top_logprobs: int | None = Field(None, ge=0, le=20)
    stream_options: dict[str, Any] | None = None
    frequency_penalty: float = Field(0.0, ge=-2.0, le=2.0)
    presence_penalty: float = Field(0.0, ge=-2.0, le=2.0)
    # F5: Per-request context window override (Ollama-compatible)
    num_ctx: int | None = Field(
        None, ge=512, le=131072,
        description=(
            "Override the model's context window for this request. "
            "Trims conversation to fit within this budget. "
            "None = use model's native context length."
        ),
    )


# ─── Response Models (Non-Streaming) ─────────────────────────────────────────


class Usage(BaseModel):
    """Token usage statistics."""

    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ResponseMessage(BaseModel):
    """Assistant message in a completion response."""

    role: str = "assistant"
    content: str | None = None
    tool_calls: list[ToolCall] | None = None


class Choice(BaseModel):
    """A single choice in a completion response."""

    index: int = 0
    message: ResponseMessage
    finish_reason: str  # "stop", "length", "tool_calls"


class ChatCompletionResponse(BaseModel):
    """OpenAI-compatible chat completion response."""

    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[Choice]
    usage: Usage


# ─── Response Models (Streaming) ─────────────────────────────────────────────


class FunctionCallDelta(BaseModel):
    """Incremental function call in a streaming tool call delta."""

    name: str | None = None
    arguments: str | None = None


class ToolCallDelta(BaseModel):
    """A tool call delta in a streaming chunk.

    Unlike ToolCall, fields are optional because streaming sends
    id/type/name only on the first chunk for each tool call.
    """

    index: int
    id: str | None = None
    type: str | None = None
    function: FunctionCallDelta | None = None


class DeltaMessage(BaseModel):
    """Delta content in a streaming chunk."""

    role: str | None = None
    content: str | None = None
    tool_calls: list[ToolCallDelta] | None = None


class ChunkChoice(BaseModel):
    """A single choice in a streaming chunk."""

    index: int = 0
    delta: DeltaMessage
    finish_reason: str | None = None


class ChatCompletionChunk(BaseModel):
    """OpenAI-compatible streaming chunk."""

    id: str
    object: str = "chat.completion.chunk"
    created: int
    model: str
    choices: list[ChunkChoice]
    usage: Usage | None = None


# ─── Models List ─────────────────────────────────────────────────────────────


class ModelObject(BaseModel):
    """A model in the models list."""

    id: str
    object: str = "model"
    created: int = 0
    owned_by: str = "local"


class ModelsListResponse(BaseModel):
    """OpenAI-compatible models list response."""

    object: str = "list"
    data: list[ModelObject]


# ─── Admin Request/Response Models ───────────────────────────────────────────


class AdminLoadRequest(BaseModel):
    """Request to load a model."""

    model_id: str
    max_context_length: int | None = None
    auto_download: bool = Field(
        False,
        description=(
            "If True, skip download confirmation and download immediately"
            " when model is not on disk."
        ),
    )
    performance_overrides: dict[str, Any] | None = Field(
        None,
        description=(
            "Manual performance overrides (kv_bits, kv_group_size, prefix_cache, "
            "speculative). Merged on top of preset defaults when loading."
        ),
    )
    keep_alive_sec: int | None = Field(
        None,
        ge=0,
        description=(
            "Per-model idle timeout in seconds. Overrides global TTL for this model. "
            "0 means never auto-evict."
        ),
    )
    allow_unsupported_runtime: bool = Field(
        False,
        description=(
            "Override known runtime/backend compatibility blocklists. "
            "Use only for manual recovery testing; may be unstable."
        ),
    )
    backend: str | None = Field(
        None,
        description=(
            "Preferred inference backend ('mlx' or 'gguf'). "
            "When None, the server selects the best available backend automatically."
        ),
    )


class AdminLoadResponse(BaseModel):
    """Response after loading a model."""

    success: bool
    model_id: str
    memory_after_load_gb: float | None = None
    time_to_load_ms: float | None = None


class AdminProbeRequest(BaseModel):
    """Request to probe backend compatibility before loading a model."""

    model_id: str
    timeout_sec: float = Field(90.0, ge=1.0, le=900.0)
    allow_unsupported_runtime: bool = Field(
        False,
        description="Include otherwise-blocked backends in candidate probing.",
    )


class AdminProbeCandidate(BaseModel):
    backend: str
    outcome: str
    reason: str | None = None


class AdminProbeResponse(BaseModel):
    model_id: str
    recommended_backend: str | None = None
    candidates: list[AdminProbeCandidate] = Field(default_factory=list)


class AdminCompatibilityRecord(BaseModel):
    ts: float
    model_id: str
    backend: str
    backend_version: str | None = None
    outcome: str
    reason: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AdminCompatibilityResponse(BaseModel):
    total: int
    rows: list[AdminCompatibilityRecord] = Field(default_factory=list)
    summary: dict[str, dict[str, Any]] | None = None


class AdminAutotuneRequest(BaseModel):
    """Request to benchmark candidate performance profiles and persist the best one."""

    model_id: str
    prompt: str = Field(
        "Explain the theory of relativity in simple terms.",
        description="Prompt used for profile benchmarking.",
    )
    max_tokens: int = Field(128, ge=1, le=4096)
    temperature: float = Field(0.7, ge=0, le=2.0)
    runs: int = Field(1, ge=1, le=5)
    profiles: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Candidate performance override dictionaries.",
    )
    allow_unsupported_runtime: bool = Field(
        False,
        description="Allow evaluating candidates on otherwise blocked backends.",
    )


class AdminAutotuneCandidate(BaseModel):
    profile: dict[str, Any] = Field(default_factory=dict)
    metrics: dict[str, float] = Field(default_factory=dict)
    score: float


class AdminAutotuneResponse(BaseModel):
    model_id: str
    backend: str
    backend_version: str
    best_profile: dict[str, Any] = Field(default_factory=dict)
    best_metrics: dict[str, float] = Field(default_factory=dict)
    best_score: float
    candidates: list[AdminAutotuneCandidate] = Field(default_factory=list)


class AdminAutotuneRecordResponse(BaseModel):
    ts: float
    model_id: str
    backend: str
    backend_version: str
    profile: dict[str, Any] = Field(default_factory=dict)
    metrics: dict[str, Any] = Field(default_factory=dict)
    score: float


class AdminUnloadRequest(BaseModel):
    """Request to unload a model."""

    model_id: str


class AdminUnloadResponse(BaseModel):
    """Response after unloading a model."""

    success: bool
    model_id: str
    memory_freed_gb: float | None = None


class MemoryStatus(BaseModel):
    """Memory usage details."""

    total_gb: float
    used_gb: float
    available_gb: float
    usage_percent: float
    threshold_percent: int


class AdminStatusResponse(BaseModel):
    """Full system status."""

    version: str
    uptime_seconds: float
    loaded_models: int
    models: list[str]
    memory: MemoryStatus
    in_flight_requests: int = 0
    max_concurrent_requests: int = 4


class AdminMemoryResponse(BaseModel):
    """Detailed memory breakdown."""

    total_unified_memory_gb: float
    used_gb: float
    available_gb: float
    threshold_percent: int
    models: dict[str, dict[str, Any]]


# ─── Error Response ──────────────────────────────────────────────────────────


class ErrorDetail(BaseModel):
    """OpenAI-compatible error detail."""

    message: str
    type: str
    param: str | None = None
    code: str | None = None


class ErrorResponse(BaseModel):
    """OpenAI-compatible error response."""

    error: ErrorDetail


# ─── Admin Models List ──────────────────────────────────────────────────────


class AdminModelDetail(BaseModel):
    """Detailed model info for admin endpoints."""

    id: str
    loaded: bool = True
    memory_gb: float = 0.0
    loaded_at: float = 0.0
    use_batching: bool = True
    request_count: int = 0
    last_used_at: float = 0.0
    context_length: int | None = None
    performance: dict[str, Any] = Field(default_factory=dict)
    speculative: dict[str, Any] = Field(default_factory=dict)
    readiness: dict[str, Any] = Field(default_factory=dict)


class AdminModelsResponse(BaseModel):
    """Response for GET /admin/models — detailed model inventory."""

    loaded: list[AdminModelDetail]
    count: int


class AdminModelPerformanceResponse(BaseModel):
    """Active performance configuration for a single loaded model."""

    model_id: str
    backend_type: str
    loaded_at: float
    request_count: int
    last_used_at: float
    memory_gb: float
    context_length: int | None = None
    use_batching: bool = True
    performance: dict[str, Any] = Field(default_factory=dict)
    speculative: dict[str, Any] = Field(default_factory=dict)
    readiness: dict[str, Any] = Field(default_factory=dict)
    global_defaults: dict[str, Any] = Field(default_factory=dict)


# ─── Admin Download/Delete Models ─────────────────────────────────────────────


class AdminDownloadRequest(BaseModel):
    """Request to download a model from HuggingFace."""

    repo_id: str = Field(
        ..., description="HuggingFace repo ID (e.g., 'mlx-community/Mistral-7B-Instruct-4bit')",
    )
    revision: str | None = Field(
        None, description="Git revision (branch, tag, or commit SHA)",
    )
    allow_patterns: list[str] | None = Field(
        None, description="Only download files matching these globs",
    )
    ignore_patterns: list[str] | None = Field(
        None, description="Skip files matching these globs",
    )


class AdminDownloadResponse(BaseModel):
    """Response after starting a model download."""

    download_id: str
    repo_id: str
    estimated_size_bytes: int | None = None
    status: str = "downloading"


class DownloadProgressResponse(BaseModel):
    """Progress of an ongoing or completed download."""

    download_id: str
    repo_id: str
    status: str  # "downloading", "completed", "failed"
    progress_percent: float = 0.0
    downloaded_bytes: int = 0
    total_bytes: int = 0
    files_completed: int = 0
    files_total: int = 0
    error: str | None = None
    error_code: str | None = None


class AdminDeleteResponse(BaseModel):
    """Response after deleting a model from disk."""

    success: bool
    model_id: str
    freed_bytes: int = 0


class AvailableModel(BaseModel):
    """A model available on disk (downloaded but not necessarily loaded)."""

    repo_id: str
    local_path: str
    size_bytes: int = 0
    downloaded_at: float = 0.0


# ─── Auto-Download Models ───────────────────────────────────────────────────


class ConfirmLoadRequest(BaseModel):
    """Request to confirm a pending download and auto-load."""

    confirmation_token: str


class AutoDownloadResponse(BaseModel):
    """Response when a model requires download before loading."""

    status: str  # "download_required", "downloading"
    model_id: str
    estimated_size_bytes: int | None = None
    estimated_size_human: str | None = None
    confirmation_token: str | None = None
    download_id: str | None = None
    message: str | None = None
    confirm_url: str | None = None
    progress_url: str | None = None


# ─── Preset Models ──────────────────────────────────────────────────────────


class BenchmarkRequest(BaseModel):
    """Request to benchmark a loaded model's inference speed."""

    model_id: str = Field(..., description="Model to benchmark (must be loaded)")
    prompt: str = Field(
        "Explain the theory of relativity in simple terms.",
        description="Prompt to use for benchmarking",
    )
    max_tokens: int = Field(128, ge=1, le=4096, description="Tokens to generate")
    temperature: float = Field(0.7, ge=0, le=2.0)
    runs: int = Field(1, ge=1, le=5, description="Number of benchmark runs (results averaged)")


class SpeculativeBenchmarkStats(BaseModel):
    """Speculative decoding stats for a run or aggregate benchmark."""

    requested: bool = False
    active: bool = False
    reason: str | None = None
    draft_model: str | None = None
    num_tokens: int | None = None
    accepted_tokens: int = 0
    rejected_tokens: int = 0
    ignored_tokens: int = 0
    acceptance_ratio: float | None = None
    telemetry: str = "unavailable"


class BenchmarkResult(BaseModel):
    """Result of a single benchmark run."""

    run: int
    tokens_generated: int
    time_to_first_token_ms: float
    total_time_ms: float
    tokens_per_second: float
    speculative: SpeculativeBenchmarkStats | None = None


class BenchmarkResponse(BaseModel):
    """Aggregated benchmark results for a model."""

    model_id: str
    backend_type: str  # "mlx" or "gguf"
    prompt: str
    max_tokens: int
    runs: int
    results: list[BenchmarkResult]
    avg_tokens_per_second: float
    avg_time_to_first_token_ms: float
    avg_total_time_ms: float
    speculative: SpeculativeBenchmarkStats | None = None


class QuantizeRequest(BaseModel):
    """Request to start a model quantization job."""

    source_model: str = Field(..., description="HuggingFace model ID to quantize")
    output_path: str | None = Field(
        None, description="Custom output path (auto-generated if omitted)"
    )
    bits: int = Field(4, description="Quantization bits (4 or 8)")
    group_size: int = Field(64, ge=1, description="Quantization group size")
    mode: str = Field("affine", pattern="^(affine|symmetric)$", description="Quantization mode")

    @field_validator("bits")
    @classmethod
    def _validate_bits(cls, v: int) -> int:
        if v not in (4, 8):
            raise ValueError(f"bits must be 4 or 8 (got {v})")
        return v


class PresetResponse(BaseModel):
    """A single preset's full details."""

    name: str
    description: str = ""
    model: str = ""
    parameters: dict[str, Any] = Field(default_factory=dict)
    system_prompt: str | None = None
    routing_alias: str | None = None
    auto_load: bool = False
    performance: dict[str, Any] = Field(default_factory=dict)
    chat_template: str | None = None


class PresetListResponse(BaseModel):
    """List of all loaded presets."""

    presets: list[PresetResponse]
    count: int
