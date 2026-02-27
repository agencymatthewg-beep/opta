"""Admin observability routes — Prometheus metrics, JSON metrics, SSE events."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse, StreamingResponse

from opta_lmx.api.deps import (
    AdminAuth,
    Engine,
    Events,
    Memory,
    Metrics,
)
from opta_lmx.inference.schema import ErrorResponse

logger = logging.getLogger(__name__)


admin_metrics_router = APIRouter()


@admin_metrics_router.get(
    "/admin/metrics",
    response_class=PlainTextResponse,
    responses={403: {"model": ErrorResponse}},
)
async def prometheus_metrics(
    _auth: AdminAuth, metrics: Metrics, engine: Engine, memory: Memory,
) -> PlainTextResponse:
    """Prometheus-compatible metrics endpoint.

    Returns metrics in Prometheus text exposition format for scraping.
    Includes live gauges for loaded model count, memory, and concurrency.
    """
    queued = engine.waiting_queue_count
    prometheus_kwargs: dict[str, Any] = {
        "loaded_model_count": len(engine.get_loaded_model_ids()),
        "memory_used_gb": memory.used_memory_gb(),
        "memory_total_gb": memory.total_memory_gb(),
        "in_flight_requests": engine.in_flight_count,
        "max_concurrent_requests": engine.max_concurrent_requests,
        "queued_requests": queued,
    }

    readiness_snapshot: dict[str, Any] | None = None
    readiness_helpers = (
        "readiness_snapshot",
        "get_readiness_snapshot",
        "model_readiness_snapshot",
    )
    for helper_name in readiness_helpers:
        helper = getattr(engine, helper_name, None)
        if callable(helper):
            try:
                snapshot = helper()
            except Exception:
                snapshot = None
            if isinstance(snapshot, dict):
                readiness_snapshot = snapshot
                break
    if readiness_snapshot is None and hasattr(engine, "model_readiness"):
        try:
            readiness_snapshot = {
                model_id: engine.model_readiness(model_id)
                for model_id in engine.get_loaded_model_ids()
            }
        except Exception:
            readiness_snapshot = None
    if readiness_snapshot is not None:
        prometheus_kwargs["model_readiness"] = readiness_snapshot

    compatibility_summary: dict[str, Any] | None = None
    compatibility_helpers = (
        "compatibility_summary",
        "get_compatibility_summary",
        "model_compatibility_summary",
        "compatibility_summary_by_model",
        "get_compatibility_summary_by_model",
    )
    for helper_name in compatibility_helpers:
        helper = getattr(engine, helper_name, None)
        if callable(helper):
            try:
                summary = helper()
            except Exception:
                summary = None
            if isinstance(summary, dict):
                compatibility_summary = summary
                break
    if compatibility_summary is None:
        registry = getattr(engine, "_compatibility", None)
        summary_by_model = getattr(registry, "summary_by_model", None)
        if callable(summary_by_model):
            try:
                candidate_summary = summary_by_model()
            except Exception:
                candidate_summary = None
            if isinstance(candidate_summary, dict):
                compatibility_summary = candidate_summary
    if compatibility_summary is not None:
        prometheus_kwargs["compatibility_summary"] = compatibility_summary

    try:
        content = metrics.prometheus(**prometheus_kwargs)
    except TypeError:
        prometheus_kwargs.pop("model_readiness", None)
        prometheus_kwargs.pop("compatibility_summary", None)
        content = metrics.prometheus(**prometheus_kwargs)

    return PlainTextResponse(
        content=content,
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@admin_metrics_router.get("/admin/metrics/json", responses={403: {"model": ErrorResponse}})
async def metrics_json(
    _auth: AdminAuth, metrics: Metrics,
) -> dict[str, Any]:
    """JSON metrics summary for admin dashboards."""
    return metrics.summary()


@admin_metrics_router.get("/admin/events", responses={403: {"model": ErrorResponse}})
async def admin_event_stream(
    _auth: AdminAuth, event_bus: Events, request: Request,
) -> StreamingResponse:
    """Server-Sent Events feed for real-time admin monitoring.

    Streams events for: model_loaded, model_unloaded, download_progress,
    download_completed, download_failed, request_completed, memory_warning,
    config_reloaded. Sends heartbeat every 30 seconds.
    """
    heartbeat_sec = getattr(request.app.state.config.server, "sse_heartbeat_interval_sec", 30)

    async def generate() -> AsyncIterator[str]:
        queue = event_bus.subscribe()
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=heartbeat_sec)
                    yield (
                        f"event: {event.event_type}\n"
                        f"data: {json.dumps(event.data)}\n\n"
                    )
                except TimeoutError:
                    yield f"event: heartbeat\ndata: {json.dumps({'timestamp': time.time()})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            event_bus.unsubscribe(queue)

    return StreamingResponse(generate(), media_type="text/event-stream")
