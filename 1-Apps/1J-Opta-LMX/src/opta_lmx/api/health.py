"""Health check routes — unauthenticated /healthz and authenticated /admin/health."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from opta_lmx import __version__
from opta_lmx.api.deps import AdminAuth, Memory

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    """Unauthenticated liveness probe for load balancers and monitoring.

    Returns 200 with {"status": "ok"} if the server process is alive.
    No auth required — safe for Kubernetes probes, Cloudflare health checks,
    and uptime monitoring systems.
    """
    return {"status": "ok", "version": __version__}


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
