"""Health check routes — /admin/health endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Header, Request

from opta_lmx import __version__
from opta_lmx.api.deps import verify_admin_key
from opta_lmx.manager.memory import MemoryMonitor

router = APIRouter()


@router.get("/admin/health")
async def health_check(request: Request, x_admin_key: str | None = Header(None)) -> dict:
    """Simple health check for monitoring.

    Returns 'ok' when server is running and responsive.
    Returns 'degraded' if memory pressure is high.
    """
    verify_admin_key(request, x_admin_key)
    memory: MemoryMonitor = request.app.state.memory_monitor
    usage = memory.usage_percent()

    if usage > 95:
        return {
            "status": "degraded",
            "version": __version__,
            "reason": f"Memory at {usage:.1f}% — approaching OOM threshold",
        }

    return {"status": "ok", "version": __version__}
