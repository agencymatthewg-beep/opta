"""Health check routes — unauthenticated /healthz, /readyz and authenticated /admin/health."""

from __future__ import annotations

import datetime
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from opta_lmx import __version__
from opta_lmx.api.deps import AdminAuth, Engine, Memory, RemoteEmbedding, RemoteReranking
from opta_lmx.discovery import build_discovery_document

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    """Unauthenticated liveness probe for load balancers and monitoring.

    Returns 200 with {"status": "ok"} if the server process is alive.
    No auth required — safe for Kubernetes probes, Cloudflare health checks,
    and uptime monitoring systems.
    """
    return {"status": "ok", "version": __version__}


@router.get("/readyz", response_model=None)
async def readyz(request: Request) -> JSONResponse:
    """Unauthenticated readiness probe for load balancers.

    Returns 200 when at least one model is loaded and the server
    is accepting inference requests. Returns 503 during startup,
    model loading, or shutdown drain.
    """
    engine = request.app.state.engine
    loaded = engine.get_loaded_models()

    if not loaded:
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "reason": "no models loaded"},
        )

    return JSONResponse(
        status_code=200,
        content={
            "status": "ready",
            "version": __version__,
            "models_loaded": len(loaded),
        },
    )


@router.get("/admin/health")
async def health_check(
    _auth: AdminAuth,
    engine: Engine,
    memory: Memory,
    remote_embedding: RemoteEmbedding,
    remote_reranking: RemoteReranking,
) -> dict[str, Any]:
    """Detailed health check with memory, Metal, engine, and helper node status.

    Returns 'ok' when all subsystems are healthy.
    Returns 'degraded' if memory pressure is high or helpers are unhealthy.
    """
    usage = memory.usage_percent()

    # Metal GPU memory (graceful fallback if MLX unavailable)
    metal_info: dict[str, Any] | None = None
    try:
        import mlx.core as mx

        metal_info = {
            "active_memory_gb": round(mx.metal.get_active_memory() / (1024**3), 2),
            "peak_memory_gb": round(mx.metal.get_peak_memory() / (1024**3), 2),
            "cache_memory_gb": round(mx.metal.get_cache_memory() / (1024**3), 2),
        }
    except Exception:
        metal_info = None

    # Helper node status
    helpers: dict[str, Any] = {}
    if remote_embedding is not None:
        helpers["embedding"] = {
            "url": remote_embedding.url,
            "healthy": remote_embedding.is_healthy,
        }
    if remote_reranking is not None:
        helpers["reranking"] = {
            "url": remote_reranking.url,
            "healthy": remote_reranking.is_healthy,
        }

    # Engine status
    loaded_models = engine.get_loaded_models()

    status = "ok"
    reason = None
    if usage > 95:
        status = "degraded"
        reason = f"Memory at {usage:.1f}% — approaching OOM threshold"
    elif any(not h.get("healthy", True) for h in helpers.values()):
        status = "degraded"
        reason = "One or more helper nodes unhealthy"

    return {
        "status": status,
        "version": __version__,
        "reason": reason,
        "memory_usage_percent": round(usage, 1),
        "metal": metal_info,
        "helpers": helpers,
        "models_loaded": len(loaded_models),
        "in_flight_requests": engine.in_flight_count,
    }


# ---------------------------------------------------------------------------
# Backward-compatible /v3 stubs
# ---------------------------------------------------------------------------
# Opta CLI daemon clients (daemon-client/http-client.ts, connectionProbe.ts)
# probe /v3/health and /v3/metrics.  When a consumer accidentally targets
# the LMX port (1234) instead of the daemon port (9999) these 404 and spam
# the access logs.  The thin stubs below return a minimal healthy response
# so misconfigured probes succeed gracefully rather than generating noise.
#
# Added 2026-03-05 — safe to remove once all daemon clients are confirmed
# to target the correct port, or migrated to /healthz + /readyz for LMX.


@router.get("/v3/health")
async def v3_health_compat(request: Request) -> dict[str, Any]:
    """Legacy /v3/health compatibility stub for daemon clients hitting LMX."""
    engine = request.app.state.engine
    loaded = engine.get_loaded_models()
    return {
        "status": "ok" if loaded else "degraded",
        "version": __version__,
        "service": "opta-lmx",
        "compat": "v3-stub",
        "models_loaded": len(loaded),
    }


@router.get("/v3/metrics")
async def v3_metrics_compat(request: Request) -> dict[str, Any]:
    """Legacy /v3/metrics compatibility stub for daemon clients hitting LMX."""
    engine = request.app.state.engine
    return {
        "service": "opta-lmx",
        "version": __version__,
        "compat": "v3-stub",
        "in_flight_requests": engine.in_flight_count,
        "models_loaded": len(engine.get_loaded_models()),
        "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }


@router.get("/v1/discovery")
async def discovery(request: Request, engine: Engine) -> dict[str, Any]:
    """Return pairing metadata for zero-config Opta-LMX client discovery."""
    config = request.app.state.config
    loaded_models = [model.model_id for model in engine.get_loaded_models()]
    return build_discovery_document(
        config=config,
        version=__version__,
        loaded_models=loaded_models,
        in_flight_requests=engine.in_flight_count,
    )


@router.get("/.well-known/opta-lmx")
async def discovery_well_known(request: Request, engine: Engine) -> dict[str, Any]:
    """Well-known alias for discovery consumers."""
    return await discovery(request=request, engine=engine)
