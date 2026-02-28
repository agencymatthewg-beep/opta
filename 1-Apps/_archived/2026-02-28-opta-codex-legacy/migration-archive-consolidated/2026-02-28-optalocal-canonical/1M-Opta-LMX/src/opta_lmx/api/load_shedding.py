"""Load shedding middleware — reject requests when memory is critically high."""

from __future__ import annotations

import logging

import psutil
from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger(__name__)

EXEMPT_PATHS = {"/healthz", "/readyz", "/admin/health"}


class LoadSheddingMiddleware:
    """Reject requests with 503 when system memory exceeds threshold."""

    def __init__(self, app: ASGIApp, threshold_percent: float = 95.0) -> None:
        self.app = app
        self.threshold = threshold_percent

    def _get_memory_percent(self, scope: Scope) -> float:
        """Get current memory usage percent, preferring app state monitor over psutil."""
        app = scope.get("app")
        if app is not None:
            monitor = getattr(getattr(app, "state", None), "memory_monitor", None)
            if monitor is not None:
                return monitor.usage_percent()
        return psutil.virtual_memory().percent

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        scope_type = scope.get("type", "")
        if scope_type in ("http", "websocket"):
            path = scope.get("path", "")
            if path not in EXEMPT_PATHS:
                mem_percent = self._get_memory_percent(scope)
                if mem_percent >= self.threshold:
                    logger.warning(
                        "load_shedding_triggered",
                        extra={
                            "memory_percent": mem_percent,
                            "threshold": self.threshold,
                            "path": path,
                            "scope_type": scope_type,
                        },
                    )
                    if scope_type == "websocket":
                        await self._close_websocket(send, mem_percent)
                    else:
                        await self._send_503(send)
                    return
        await self.app(scope, receive, send)

    async def _close_websocket(self, send: Send, mem_percent: float) -> None:
        """Close WebSocket with 1013 (Try Again Later) close code."""
        await send(
            {
                "type": "websocket.close",
                "code": 1013,  # Try Again Later
                "reason": f"Server under memory pressure ({mem_percent:.1f}%)",
            }
        )

    async def _send_503(self, send: Send) -> None:
        body = (
            b'{"error": {"message": "Server under memory pressure",'
            b' "type": "server_error", "code": "overloaded"}}'
        )
        await send(
            {
                "type": "http.response.start",
                "status": 503,
                "headers": [
                    [b"content-type", b"application/json"],
                    [b"retry-after", b"30"],
                ],
            }
        )
        await send(
            {
                "type": "http.response.body",
                "body": body,
            }
        )
