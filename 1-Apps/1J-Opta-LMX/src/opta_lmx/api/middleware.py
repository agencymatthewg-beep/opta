"""HTTP middleware for Opta-LMX — request ID propagation."""

from __future__ import annotations

import secrets

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


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
