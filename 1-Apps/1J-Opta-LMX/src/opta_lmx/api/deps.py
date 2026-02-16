"""Shared dependencies for API route handlers."""

from __future__ import annotations

from fastapi import Header, HTTPException, Request

from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.manager.model import ModelManager
from opta_lmx.monitoring.events import EventBus
from opta_lmx.monitoring.metrics import MetricsCollector
from opta_lmx.presets.manager import PresetManager
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


def verify_admin_key(request: Request, x_admin_key: str | None = Header(None)) -> None:
    """Verify X-Admin-Key header if admin_key is configured.

    If security.admin_key is null in config, authentication is disabled
    (LAN-only trust model). If set, the header must match exactly.
    """
    config_key: str | None = getattr(request.app.state, "admin_key", None)
    if config_key is None:
        return  # No auth configured — trust LAN
    if x_admin_key != config_key:
        raise HTTPException(status_code=403, detail="Invalid or missing admin key")
