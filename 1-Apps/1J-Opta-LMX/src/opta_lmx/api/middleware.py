"""HTTP middleware for Opta-LMX — request ID propagation and request logging."""

from __future__ import annotations

import logging
import secrets
import time

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# Paths that generate too much noise for per-request logging
_QUIET_PATHS = frozenset({"/healthz", "/admin/events"})


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Add X-Request-ID to every request/response for distributed tracing.

    If the client sends X-Request-ID, it's preserved. Otherwise a new
    ID is generated. The ID is also bound to structlog's contextvars
    so all log lines within the request include it automatically.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Process request with request ID tracking."""
        request_id = request.headers.get("x-request-id") or f"req-{secrets.token_urlsafe(12)}"

        # Bind to structlog contextvars — all log lines in this request get the ID
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every HTTP request with method, path, status code, and latency.

    Skips noisy endpoints (healthz, SSE streams) to keep logs useful.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Log request details after response is sent."""
        if request.url.path in _QUIET_PATHS:
            return await call_next(request)

        start = time.monotonic()
        response = await call_next(request)
        elapsed = time.monotonic() - start

        logger.info(
            "http_request",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "latency_ms": round(elapsed * 1000, 1),
            },
        )
        return response
