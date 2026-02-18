"""Configuration loading from YAML with Pydantic validation.

Supports environment variable overrides via pydantic-settings.
Env vars use ``LMX_`` prefix with ``__`` as nested delimiter, e.g.
``LMX_SERVER__PORT=8080`` overrides ``server.port``.
"""

from __future__ import annotations

import logging
from pathlib import Path

import yaml
from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

RUNTIME_STATE_PATH = Path.home() / ".opta-lmx" / "runtime-state.json"

DEFAULT_CONFIG_PATHS = [
    Path.home() / ".opta-lmx" / "config.yaml",
    Path(__file__).parent.parent.parent / "config" / "default-config.yaml",
]


class ServerConfig(BaseModel):
    """Server binding and timeout settings."""

    host: str = "127.0.0.1"
    port: int = Field(1234, ge=1, le=65535, description="Port 1234 = drop-in LM Studio replacement")
    workers: int = Field(1, ge=1)
    timeout_sec: int = Field(300, ge=1)
    websocket_enabled: bool = Field(True, description="Enable WebSocket streaming endpoint")
    sse_events_enabled: bool = Field(True, description="Enable /admin/events SSE endpoint")
    sse_heartbeat_interval_sec: int = Field(
        30, ge=1, description="SSE heartbeat interval in seconds"
    )


class ModelsConfig(BaseModel):
    """Model loading and directory settings."""

    default_model: str | None = None
    models_directory: Path = Path("/Users/Shared/Opta-LMX/models")
    auto_load: list[str] = Field(default_factory=list)
    use_batching: bool = True
    max_concurrent_requests: int = Field(
        4, ge=1, le=64, description="Max parallel inference requests (semaphore limit)",
    )
    inference_timeout_sec: int = Field(
        300, ge=10, le=3600, description="Max seconds per inference request before timeout",
    )
    warmup_on_load: bool = Field(
        True, description="Run a small inference after model load to prime JIT/KV cache",
    )
    semaphore_timeout_sec: float = Field(
        30.0, ge=1.0, le=300.0,
        description="Max seconds to wait for inference semaphore before returning 429",
    )
    gguf_context_length: int = Field(
        4096, ge=512, description="Default context length for GGUF models"
    )
    gguf_gpu_layers: int = Field(
        -1, ge=-1, description="GPU layers for GGUF (-1 = full Metal offload)"
    )
    kv_bits: int | None = Field(None, description="KV cache quantization bits (4 or 8, None=FP16)")
    kv_group_size: int = Field(64, ge=1, description="KV cache quantization group size")

    @field_validator("kv_bits")
    @classmethod
    def _validate_kv_bits(cls, v: int | None) -> int | None:
        if v is not None and v not in (4, 8):
            raise ValueError(f"kv_bits must be 4 or 8 (got {v}). Use None for FP16.")
        return v

    prefix_cache_enabled: bool = Field(True, description="Enable prefix caching for multi-turn")
    embedding_model: str | None = Field(
        None, description="Embedding model HF ID for /v1/embeddings (lazy-loaded)",
    )
    speculative_model: str | None = Field(
        None, description="Draft model HF ID for speculative decoding",
    )
    speculative_num_tokens: int = Field(
        5, ge=1, le=20, description="Tokens per speculative step",
    )
    stream_interval: int = Field(
        1, ge=1, le=32,
        description="Tokens to batch before SSE yield (higher = less overhead, more latency)",
    )
    metal_cache_limit_gb: float | None = Field(
        None, ge=0.5,
        description="MLX Metal buffer cache limit in GB (None = MLX default)",
    )
    # E3: Scheduler tuning for BatchedEngine
    scheduler_max_num_seqs: int = Field(
        256, ge=1, le=1024,
        description="Max sequences the scheduler tracks (lower = less overhead for local use)",
    )
    scheduler_prefill_batch_size: int = Field(
        8, ge=1, le=64,
        description="Number of sequences to prefill in one batch",
    )
    scheduler_completion_batch_size: int = Field(
        32, ge=1, le=256,
        description="Number of sequences to decode in one batch",
    )
    scheduler_cache_memory_percent: float = Field(
        0.2, ge=0.05, le=0.8,
        description="Fraction of memory to use for KV cache (0.2 = 20%)",
    )


class MemoryConfig(BaseModel):
    """Memory thresholds and eviction policy."""

    max_memory_percent: int = Field(90, ge=50, le=99)
    auto_evict_lru: bool = True
    ttl_enabled: bool = Field(False, description="Auto-unload models after idle timeout")
    ttl_seconds: int = Field(3600, ge=60, description="Idle timeout before eviction (seconds)")
    ttl_check_interval_sec: int = Field(60, ge=10, description="How often to check for idle models")


class LoggingConfig(BaseModel):
    """Logging level, format, and rotation settings."""

    level: str = Field("INFO", pattern="^(DEBUG|INFO|WARNING|ERROR)$")
    format: str = Field("structured", pattern="^(structured|text)$")
    file: str | None = None
    max_file_bytes: int = Field(
        50 * 1024 * 1024, description="Max log file size before rotation (default 50MB)",
    )
    backup_count: int = Field(5, ge=0, le=20, description="Number of rotated backup files to keep")


class RoutingConfig(BaseModel):
    """Smart routing aliases — map task names to model preference lists."""

    aliases: dict[str, list[str]] = Field(
        default_factory=lambda: {
            "code": [], "reasoning": [], "chat": [],
        },
        description="Map alias → ordered list of preferred model IDs. First loaded match wins.",
    )
    default_model: str | None = Field(
        None,
        description="Model ID for 'auto' alias. If None, uses first loaded model.",
    )


class PresetsConfig(BaseModel):
    """Model preset file settings."""

    directory: Path = Field(
        default_factory=lambda: Path.home() / ".opta-lmx" / "presets",
        description="Directory containing YAML preset files",
    )
    enabled: bool = Field(True, description="Enable preset resolution in inference requests")


class HelperNodeEndpoint(BaseModel):
    """Configuration for a single helper node endpoint (embedding or reranking).

    A Helper Node is a Workstation with opt-in inference capability enabled.
    By default, only the LLM Host runs models. Helper Nodes are experimental
    and may impact the Workstation's performance.
    """

    url: str = Field(..., description="Base URL of the helper node (e.g. http://192.168.188.20:1234)")
    model: str = Field(..., description="Model name to request from the helper node")
    timeout_sec: float = Field(10.0, ge=1.0, le=120.0, description="Request timeout in seconds")
    fallback: str = Field(
        "local",
        pattern="^(local|skip)$",
        description="On failure: 'local' = use local model, 'skip' = return error",
    )


class HelperNodesConfig(BaseModel):
    """Helper node endpoints for distributed embedding and reranking on LAN devices.

    Helper Nodes are OFF by default. Only enable if you want a Workstation
    to contribute inference compute at the cost of its own performance.
    """

    embedding: HelperNodeEndpoint | None = Field(
        None, description="Helper node embedding endpoint (proxied by /v1/embeddings)",
    )
    reranking: HelperNodeEndpoint | None = Field(
        None, description="Helper node reranking endpoint",
    )


class RAGConfig(BaseModel):
    """RAG (Retrieval-Augmented Generation) pipeline settings."""

    enabled: bool = Field(True, description="Enable RAG API endpoints")
    persist_path: Path = Field(
        default_factory=lambda: Path.home() / ".opta-lmx" / "rag-store.json",
        description="Path for vector store JSON persistence",
    )
    default_chunk_size: int = Field(512, ge=64, le=2048, description="Default tokens per chunk")
    default_chunk_overlap: int = Field(
        64, ge=0, le=512, description="Default overlap between chunks"
    )
    max_documents_per_ingest: int = Field(
        100, ge=1, le=1000, description="Max documents per ingest request"
    )
    auto_persist: bool = Field(True, description="Auto-save store after mutations")

    # Phase 9: Hybrid search tuning
    rrf_k: int = Field(60, ge=1, le=200, description="RRF fusion constant (higher = flatter ranking)")
    rrf_vector_weight: float = Field(
        1.0, ge=0.0, le=5.0, description="Weight for vector search leg in RRF fusion"
    )
    rrf_keyword_weight: float = Field(
        1.0, ge=0.0, le=5.0, description="Weight for keyword search leg in RRF fusion"
    )

    # Phase 9: Embedding configuration
    embedding_model: str | None = Field(
        None, description="Default embedding model HF ID for RAG ingestion"
    )
    embedding_dimensions: int | None = Field(
        None, ge=64, le=4096, description="Expected embedding dimensions (None = auto-detect)"
    )

    # Phase 9: Reranking
    reranker_model: str | None = Field(
        None, description="Reranker model HF ID (e.g. jinaai/jina-reranker-v3-mlx)"
    )
    rerank_enabled: bool = Field(False, description="Enable reranking by default on search")
    rerank_initial_k: int = Field(
        50, ge=5, le=200, description="Candidates to retrieve before reranking"
    )
    rerank_final_k: int = Field(
        5, ge=1, le=50, description="Results to return after reranking"
    )

    # Phase 9: Chunking strategy
    chunking_strategy: str = Field(
        "fixed",
        pattern="^(fixed|markdown_headers|code)$",
        description="Default chunking strategy: fixed, markdown_headers, or code",
    )

    @model_validator(mode="after")
    def _validate_chunk_overlap(self) -> RAGConfig:
        if self.default_chunk_overlap >= self.default_chunk_size:
            raise ValueError(
                f"default_chunk_overlap ({self.default_chunk_overlap}) must be less than "
                f"default_chunk_size ({self.default_chunk_size})"
            )
        return self


class SecurityConfig(BaseModel):
    """Authentication settings."""

    admin_key: str | None = Field(
        None, description="Required key for /admin/* endpoints. None = no auth.",
    )


class LMXConfig(BaseSettings):
    """Root configuration for Opta-LMX.

    Environment variables override YAML values using ``LMX_`` prefix
    and ``__`` as nested delimiter.  For example::

        LMX_SERVER__PORT=8080      -> server.port = 8080
        LMX_MEMORY__MAX_MEMORY_PERCENT=85  -> memory.max_memory_percent = 85
    """

    model_config = SettingsConfigDict(
        env_prefix="LMX_",
        env_nested_delimiter="__",
    )

    server: ServerConfig = Field(default_factory=ServerConfig)  # type: ignore[arg-type]
    models: ModelsConfig = Field(default_factory=ModelsConfig)  # type: ignore[arg-type]
    memory: MemoryConfig = Field(default_factory=MemoryConfig)  # type: ignore[arg-type]
    logging: LoggingConfig = Field(default_factory=LoggingConfig)  # type: ignore[arg-type]
    routing: RoutingConfig = Field(default_factory=RoutingConfig)  # type: ignore[arg-type]
    presets: PresetsConfig = Field(default_factory=PresetsConfig)  # type: ignore[arg-type]
    helper_nodes: HelperNodesConfig = Field(default_factory=HelperNodesConfig)  # type: ignore[arg-type]
    rag: RAGConfig = Field(default_factory=RAGConfig)  # type: ignore[arg-type]
    security: SecurityConfig = Field(default_factory=SecurityConfig)  # type: ignore[arg-type]


def load_config(path: Path | None = None) -> LMXConfig:
    """Load config from YAML file, falling back to defaults.

    Search order:
    1. Explicit path argument
    2. ~/.opta-lmx/config.yaml
    3. Built-in default-config.yaml
    4. Pydantic defaults (if no file found)
    """
    if path and path.exists():
        return _parse_yaml(path)

    for candidate in DEFAULT_CONFIG_PATHS:
        if candidate.exists():
            logger.info("config_loaded", extra={"path": str(candidate)})
            return _parse_yaml(candidate)

    logger.info("config_defaults", extra={"reason": "no config file found"})
    return LMXConfig()


def _parse_yaml(path: Path) -> LMXConfig:
    """Parse a YAML file into LMXConfig."""
    with open(path) as f:
        raw = yaml.safe_load(f)
    if raw is None:
        return LMXConfig()
    return LMXConfig.model_validate(raw)
