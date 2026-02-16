"""Configuration loading from YAML with Pydantic validation."""

from __future__ import annotations

import logging
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

DEFAULT_CONFIG_PATHS = [
    Path.home() / ".opta-lmx" / "config.yaml",
    Path(__file__).parent.parent.parent / "config" / "default-config.yaml",
]


class ServerConfig(BaseModel):
    """Server binding and timeout settings."""

    host: str = "127.0.0.1"
    port: int = Field(1234, description="Port 1234 = drop-in LM Studio replacement")
    workers: int = 1
    timeout_sec: int = 300
    websocket_enabled: bool = Field(True, description="Enable WebSocket streaming endpoint")
    sse_events_enabled: bool = Field(True, description="Enable /admin/events SSE endpoint")
    sse_heartbeat_interval_sec: int = Field(30, description="SSE heartbeat interval in seconds")


class ModelsConfig(BaseModel):
    """Model loading and directory settings."""

    default_model: str | None = None
    models_directory: Path = Path("/Users/Shared/Opta-LMX/models")
    auto_load: list[str] = Field(default_factory=list)
    use_batching: bool = True
    gguf_context_length: int = Field(4096, description="Default context length for GGUF models")
    gguf_gpu_layers: int = Field(-1, description="GPU layers for GGUF (-1 = full Metal offload)")


class MemoryConfig(BaseModel):
    """Memory thresholds and eviction policy."""

    max_memory_percent: int = Field(90, ge=50, le=99)
    auto_evict_lru: bool = True


class LoggingConfig(BaseModel):
    """Logging level, format, and rotation settings."""

    level: str = "INFO"
    format: str = "structured"
    file: str | None = None
    max_file_bytes: int = Field(50 * 1024 * 1024, description="Max log file size before rotation (default 50MB)")
    backup_count: int = Field(5, ge=0, le=20, description="Number of rotated backup files to keep")


class RoutingConfig(BaseModel):
    """Smart routing aliases — map task names to model preference lists."""

    aliases: dict[str, list[str]] = Field(
        default_factory=lambda: {
            "code": [],
            "reasoning": [],
            "chat": [],
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


class SecurityConfig(BaseModel):
    """Authentication settings."""

    admin_key: str | None = Field(None, description="Required key for /admin/* endpoints. None = no auth.")


class LMXConfig(BaseModel):
    """Root configuration for Opta-LMX."""

    server: ServerConfig = Field(default_factory=ServerConfig)
    models: ModelsConfig = Field(default_factory=ModelsConfig)
    memory: MemoryConfig = Field(default_factory=MemoryConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    routing: RoutingConfig = Field(default_factory=RoutingConfig)
    presets: PresetsConfig = Field(default_factory=PresetsConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)


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
