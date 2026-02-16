"""Health check routes — /admin/health endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from opta_lmx import __version__
from opta_lmx.api.deps import AdminAuth, Memory

router = APIRouter()


@router.get("/admin/health")
async def health_check(_auth: AdminAuth, memory: Memory) -> dict:
    """Simple health check for monitoring.

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
