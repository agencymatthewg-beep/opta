"""Type definitions for inference."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any


@dataclass
class DownloadTask:
    """Internal tracking for an async model download."""

    download_id: str
    repo_id: str
    revision: str | None = None
    status: str = "downloading"  # "downloading", "completed", "failed"
    progress_percent: float = 0.0
    downloaded_bytes: int = 0
    total_bytes: int = 0
    files_completed: int = 0
    files_total: int = 0
    error: str | None = None
    error_code: str | None = None
    local_path: str | None = None
    task: asyncio.Task[None] | None = field(default=None, repr=False)
    started_at: float = 0.0
    completed_at: float | None = None


@dataclass
class ModelInfo:
    """Information about a loaded model."""

    model_id: str
    loaded: bool = True
    memory_used_gb: float = 0.0
    loaded_at: float = 0.0
    use_batching: bool = True


@dataclass
class LoadedModel:
    """Internal tracking for a loaded model instance."""

    model_id: str
    engine: Any  # SimpleEngine or BatchedEngine from vllm-mlx
    loaded_at: float = 0.0
    use_batching: bool = True
    estimated_memory_gb: float = 0.0
    request_count: int = 0
    last_used_at: float = field(default=0.0)
    backend_type: str = "mlx"  # "mlx" or "gguf"
    backend: Any = None  # InferenceBackend instance (for GGUF); None = use engine directly
    context_length: int | None = None  # Max context length from model config
    performance_overrides: dict[str, Any] = field(default_factory=dict)  # Active perf settings
    keep_alive_sec: int | None = None  # Per-model TTL override (None = use global)
    speculative_requested: bool = False
    speculative_active: bool = False
    speculative_reason: str | None = None
    speculative_draft_model: str | None = None
    speculative_num_tokens: int | None = None
