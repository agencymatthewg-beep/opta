"""Health check routes — unauthenticated /healthz, /readyz and authenticated /admin/health."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from opta_lmx import __version__
from opta_lmx.api.deps import AdminAuth, Engine, Memory, RemoteEmbedding, RemoteReranking

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
async def health_check(_auth: AdminAuth, memory: Memory) -> dict[str, Any]:
    """Detailed health check with memory status (requires admin auth).

    Returns 'ok' when server is running and responsive.
    Returns 'degraded' if memory pressure is high.
    """
    usage = memory.usage_percent()

    if usage > 95:
        return {
            "status": "degraded",
            "version": __version__,
            "reason": f"Memory at {usage:.1f}% — approaching OOM threshold",
        }

    return {"status": "ok", "version": __version__}
