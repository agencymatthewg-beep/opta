"""Load shedding middleware — reject requests when memory is critically high."""

from __future__ import annotations

import logging

import psutil
from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger(__name__)

EXEMPT_PATHS = {"/healthz", "/readyz"}


class LoadSheddingMiddleware:
    """Reject requests with 503 when system memory exceeds threshold."""

    def __init__(self, app: ASGIApp, threshold_percent: float = 95.0) -> None:
        self.app = app
        self.threshold = threshold_percent

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path not in EXEMPT_PATHS:
                mem = psutil.virtual_memory()
                if mem.percent >= self.threshold:
                    logger.warning("load_shedding_triggered", extra={
                        "memory_percent": mem.percent,
                        "threshold": self.threshold,
                        "path": path,
                    })
                    await self._send_503(send)
                    return
        await self.app(scope, receive, send)

    async def _send_503(self, send: Send) -> None:
        body = b'{"error": {"message": "Server under memory pressure", "type": "server_error", "code": "overloaded"}}'
        await send({
            "type": "http.response.start",
            "status": 503,
            "headers": [
                [b"content-type", b"application/json"],
                [b"retry-after", b"30"],
            ],
        })
        await send({
            "type": "http.response.body",
            "body": body,
        })
