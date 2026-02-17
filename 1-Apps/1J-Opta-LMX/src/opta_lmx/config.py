"""Configuration loading from YAML with Pydantic validation.

Supports environment variable overrides via pydantic-settings.
Env vars use ``LMX_`` prefix with ``__`` as nested delimiter, e.g.
``LMX_SERVER__PORT=8080`` overrides ``server.port``.
"""

from __future__ import annotations

import logging
from pathlib import Path

import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

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
    sse_heartbeat_interval_sec: int = Field(30, ge=1, description="SSE heartbeat interval in seconds")


class ModelsConfig(BaseModel):
    """Model loading and directory settings."""

    default_model: str | None = None
    models_directory: Path = Path("/Users/Shared/Opta-LMX/models")
    auto_load: list[str] = Field(default_factory=list)
    use_batching: bool = True
    gguf_context_length: int = Field(4096, ge=512, description="Default context length for GGUF models")
    gguf_gpu_layers: int = Field(-1, ge=-1, description="GPU layers for GGUF (-1 = full Metal offload)")
    kv_bits: int | None = Field(None, description="KV cache quantization bits (4 or 8, None=FP16)")
    kv_group_size: int = Field(64, ge=1, description="KV cache quantization group size")
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
            "code": list[str](), "reasoning": list[str](), "chat": list[str](),
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


class RemoteHelperEndpoint(BaseModel):
    """Configuration for a single remote helper endpoint (embedding or reranking)."""

    url: str = Field(..., description="Base URL of the remote helper (e.g. http://192.168.188.20:1234)")
    model: str = Field(..., description="Model name to request from the remote endpoint")
    timeout_sec: float = Field(10.0, ge=1.0, le=120.0, description="Request timeout in seconds")
    fallback: str = Field(
        "local",
        pattern="^(local|skip)$",
        description="On failure: 'local' = use local model, 'skip' = return error",
    )


class RemoteHelpersConfig(BaseModel):
    """Remote helper endpoints for embedding and reranking on LAN devices."""

    embedding: RemoteHelperEndpoint | None = Field(
        None, description="Remote embedding endpoint (proxied by /v1/embeddings)",
    )
    reranking: RemoteHelperEndpoint | None = Field(
        None, description="Remote reranking endpoint",
    )


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
    remote_helpers: RemoteHelpersConfig = Field(default_factory=RemoteHelpersConfig)  # type: ignore[arg-type]
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
