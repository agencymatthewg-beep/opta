"""Shared dependencies for API route handlers.

Provides both raw dependency functions (get_engine, etc.) and
Annotated type aliases (Engine, Memory, etc.) for FastAPI's modern
Depends() injection pattern.
"""

from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request

from opta_lmx.inference.embedding_engine import EmbeddingEngine
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.manager.model import ModelManager
from opta_lmx.monitoring.events import EventBus
from opta_lmx.monitoring.metrics import MetricsCollector
from opta_lmx.presets.manager import PresetManager
from opta_lmx.helpers.client import HelperNodeClient
from opta_lmx.router.strategy import TaskRouter


def get_engine(request: Request) -> InferenceEngine:
    """Get the inference engine from app state."""
    return request.app.state.engine  # type: ignore[no-any-return]


def get_memory(request: Request) -> MemoryMonitor:
    """Get the memory monitor from app state."""
    return request.app.state.memory_monitor  # type: ignore[no-any-return]


def get_start_time(request: Request) -> float:
    """Get the server start time from app state."""
    return request.app.state.start_time  # type: ignore[no-any-return]


def get_metrics(request: Request) -> MetricsCollector:
    """Get the metrics collector from app state."""
    return request.app.state.metrics  # type: ignore[no-any-return]


def get_router(request: Request) -> TaskRouter:
    """Get the task router from app state."""
    return request.app.state.router  # type: ignore[no-any-return]


def get_model_manager(request: Request) -> ModelManager:
    """Get the model manager from app state."""
    return request.app.state.model_manager  # type: ignore[no-any-return]


def get_preset_manager(request: Request) -> PresetManager:
    """Get the preset manager from app state."""
    return request.app.state.preset_manager  # type: ignore[no-any-return]


def get_event_bus(request: Request) -> EventBus:
    """Get the event bus from app state."""
    return request.app.state.event_bus  # type: ignore[no-any-return]


def get_embedding_engine(request: Request) -> EmbeddingEngine | None:
    """Get the embedding engine from app state, or None if not configured."""
    return getattr(request.app.state, "embedding_engine", None)


def get_remote_embedding(request: Request) -> HelperNodeClient | None:
    """Get the helper node embedding client, or None if not configured."""
    return getattr(request.app.state, "remote_embedding", None)


def get_remote_reranking(request: Request) -> HelperNodeClient | None:
    """Get the helper node reranking client, or None if not configured."""
    return getattr(request.app.state, "remote_reranking", None)


def verify_admin_key(request: Request, x_admin_key: str | None = Header(None)) -> None:
    """Verify X-Admin-Key header if admin_key is configured.

    If security.admin_key is null in config, authentication is disabled
    (LAN-only trust model). If set, the header must match exactly.
    """
    config_key: str | None = getattr(request.app.state, "admin_key", None)
    if config_key is None:
        return  # No auth configured — trust LAN
    if x_admin_key is None or not secrets.compare_digest(x_admin_key, config_key):
        raise HTTPException(status_code=403, detail="Invalid or missing admin key")


# ─── Annotated type aliases for Depends() injection ────────────────────────

Engine = Annotated[InferenceEngine, Depends(get_engine)]
Memory = Annotated[MemoryMonitor, Depends(get_memory)]
StartTime = Annotated[float, Depends(get_start_time)]
Metrics = Annotated[MetricsCollector, Depends(get_metrics)]
Router = Annotated[TaskRouter, Depends(get_router)]
Manager = Annotated[ModelManager, Depends(get_model_manager)]
Presets = Annotated[PresetManager, Depends(get_preset_manager)]
Events = Annotated[EventBus, Depends(get_event_bus)]
Embeddings = Annotated[EmbeddingEngine | None, Depends(get_embedding_engine)]
RemoteEmbedding = Annotated[HelperNodeClient | None, Depends(get_remote_embedding)]
RemoteReranking = Annotated[HelperNodeClient | None, Depends(get_remote_reranking)]
AdminAuth = Annotated[None, Depends(verify_admin_key)]
