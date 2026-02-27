"""Triage diagnostics endpoint — /admin/diagnostics.

Provides a comprehensive system health snapshot for rapid triage:
memory, loaded models, inference metrics, agent state, recent errors,
and an automatic health verdict (healthy / degraded / critical).

Part of P4: Observability Maturity.
"""

from __future__ import annotations

import platform
import time
from typing import Any, Literal

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from opta_lmx.api.deps import (
    AdminAuth,
    Engine,
    Memory,
    Metrics,
    StartTime,
)
from opta_lmx.monitoring.event_schema import classify_event

router = APIRouter(prefix="/admin", tags=["admin"])


def _compute_health_verdict(
    *,
    memory_percent: float,
    memory_threshold: int,
    quarantined_count: int,
    error_rate_pct: float,
    crash_loop: bool,
) -> Literal["healthy", "degraded", "critical"]:
    """Determine overall health verdict from system signals.

    Rules (ordered by severity):
      - crash_loop detected             -> critical
      - error_rate > 5%                 -> critical
      - memory >= threshold (e.g. 90%)  -> degraded
      - any quarantined models          -> degraded
      - otherwise                       -> healthy
    """
    if crash_loop:
        return "critical"
    if error_rate_pct > 5.0:
        return "critical"
    if memory_percent >= memory_threshold:
        return "degraded"
    if quarantined_count > 0:
        return "degraded"
    return "healthy"


def _collect_recent_errors(request: Request, limit: int = 10) -> list[dict[str, Any]]:
    """Collect recent error-severity events from the journal manager.

    Falls back to an empty list if journaling is disabled or unavailable.
    """
    journal_manager = getattr(request.app.state, "journal_manager", None)
    if journal_manager is None:
        return []

    errors: list[dict[str, Any]] = []
    try:
        entries = journal_manager.recent_entries(limit=200)
    except Exception:
        return []

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        event_type = entry.get("event_type", "")
        _, severity = classify_event(event_type, entry.get("data"))
        if severity in ("error", "critical"):
            errors.append({
                "timestamp": entry.get("timestamp"),
                "event_type": event_type,
                "message": entry.get("message", entry.get("data", {}).get("message", "")),
                "model_id": entry.get("model_id", entry.get("data", {}).get("model_id")),
                "severity": severity,
            })
            if len(errors) >= limit:
                break

    return errors


def _get_agent_stats(request: Request) -> dict[str, Any]:
    """Extract agent runtime statistics from app state."""
    agent_runtime = getattr(request.app.state, "agent_runtime", None)
    if agent_runtime is None:
        return {"active_runs": 0, "completed_runs": 0, "failed_runs": 0}

    runs: dict[str, Any] = getattr(agent_runtime, "_runs", {})
    active = 0
    completed = 0
    failed = 0

    for run in runs.values():
        status = str(getattr(run, "status", ""))
        if status in ("running", "queued", "waiting_approval"):
            active += 1
        elif status == "completed":
            completed += 1
        elif status in ("failed", "cancelled"):
            failed += 1

    return {
        "active_runs": active,
        "completed_runs": completed,
        "failed_runs": failed,
    }


@router.get("/diagnostics")
async def get_diagnostics(
    request: Request,
    _auth: AdminAuth,
    engine: Engine,
    memory: Memory,
    metrics: Metrics,
    start_time: StartTime,
) -> JSONResponse:
    """Comprehensive triage diagnostics report.

    Returns system memory, loaded model details, inference statistics,
    agent state, recent errors, and an automatic health verdict.
    Requires admin authentication.
    """
    now = time.time()
    uptime = now - start_time

    # ── System ───────────────────────────────────────────────────────
    memory_status = memory.get_status()
    runtime_state = getattr(request.app.state, "runtime_state", None)
    crash_loop = bool(runtime_state and runtime_state.is_crash_loop())

    system_info: dict[str, Any] = {
        "memory_percent": memory_status.usage_percent,
        "memory_gb_used": memory_status.used_gb,
        "memory_gb_total": memory_status.total_gb,
        "uptime_seconds": round(uptime, 1),
        "python_version": platform.python_version(),
        "crash_loop_detected": crash_loop,
    }

    # ── Models ───────────────────────────────────────────────────────
    loaded_models = engine.get_loaded_models_detailed()
    readiness_snap = engine.readiness_snapshot()

    quarantined_count = sum(
        1 for row in readiness_snap.values()
        if row.get("state") == "quarantined"
    )

    model_entries: list[dict[str, Any]] = []
    for model in loaded_models:
        model_id = model.model_id
        readiness = readiness_snap.get(model_id, {}).get("state", "unknown")
        model_entries.append({
            "id": model_id,
            "readiness": readiness,
            "loaded_at": model.loaded_at,
            "requests_total": model.request_count,
            "backend_type": getattr(model, "backend_type", "unknown"),
            "memory_gb": round(model.estimated_memory_gb, 2),
        })

    models_info: dict[str, Any] = {
        "loaded_count": len(loaded_models),
        "quarantined_count": quarantined_count,
        "models": model_entries,
    }

    # ── Inference ────────────────────────────────────────────────────
    metrics_summary = metrics.summary()
    total_requests = metrics_summary.get("total_requests", 0)
    total_errors = metrics_summary.get("total_errors", 0)
    error_rate_pct = round(
        (total_errors / total_requests * 100) if total_requests > 0 else 0.0,
        2,
    )

    # Average latency from histogram sums (approximation)
    avg_latency_ms = 0.0
    if total_requests > 0 and hasattr(metrics, "_latency_sum"):
        total_latency = sum(metrics._latency_sum.values())
        avg_latency_ms = round((total_latency / total_requests) * 1000, 1)

    total_tokens = (
        metrics_summary.get("total_completion_tokens", 0)
        + metrics_summary.get("total_prompt_tokens", 0)
    )

    inference_info: dict[str, Any] = {
        "total_requests": total_requests,
        "active_requests": engine.in_flight_count,
        "avg_latency_ms": avg_latency_ms,
        "error_rate_pct": error_rate_pct,
        "tokens_generated": metrics_summary.get("total_completion_tokens", 0),
        "total_tokens_processed": total_tokens,
    }

    # ── Agents ───────────────────────────────────────────────────────
    agents_info = _get_agent_stats(request)

    # ── Recent errors ────────────────────────────────────────────────
    recent_errors = _collect_recent_errors(request, limit=10)

    # ── Health verdict ───────────────────────────────────────────────
    verdict = _compute_health_verdict(
        memory_percent=memory_status.usage_percent,
        memory_threshold=memory.threshold_percent,
        quarantined_count=quarantined_count,
        error_rate_pct=error_rate_pct,
        crash_loop=crash_loop,
    )

    return JSONResponse(content={
        "timestamp": now,
        "system": system_info,
        "models": models_info,
        "inference": inference_info,
        "agents": agents_info,
        "recent_errors": recent_errors,
        "health_verdict": verdict,
    })
