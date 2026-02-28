"""HTTP middleware for Opta-LMX — request ID propagation and request logging.

Uses raw ASGI middleware pattern instead of Starlette's BaseHTTPMiddleware
to avoid a documented issue where BaseHTTPMiddleware consumes StreamingResponse
bodies into memory before forwarding, causing memory spikes during SSE streaming.
"""

from __future__ import annotations

import logging
import secrets
import time
from typing import Any

import structlog
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger(__name__)

# Paths that generate too much noise for per-request logging
_QUIET_PATHS = frozenset({"/healthz", "/admin/events"})


def _get_header(scope: Scope, name: str) -> str | None:
    """Extract a header value from the ASGI scope (case-insensitive)."""
    name_lower = name.lower().encode("latin-1")
    for key, value in scope.get("headers", []):
        if key == name_lower:
            return value.decode("latin-1")
    return None


def _get_path(scope: Scope) -> str:
    """Extract the request path from the ASGI scope."""
    return scope.get("path", "")


class RequestIDMiddleware:
    """Add X-Request-ID to every request/response for distributed tracing.

    If the client sends X-Request-ID, it's preserved. Otherwise a new
    ID is generated. The ID is also bound to structlog's contextvars
    so all log lines within the request include it automatically.

    Uses raw ASGI pattern to avoid BaseHTTPMiddleware buffering
    StreamingResponse bodies into memory.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Process request with request ID tracking."""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _get_header(scope, "x-request-id") or f"req-{secrets.token_urlsafe(12)}"

        # Store in scope state for downstream middleware/handlers
        if "state" not in scope:
            scope["state"] = {}
        scope["state"]["request_id"] = request_id

        # Bind to structlog contextvars — all log lines in this request get the ID
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.append("X-Request-ID", request_id)
            await send(message)

        await self.app(scope, receive, send_wrapper)


class RequestLoggingMiddleware:
    """Log every HTTP request with method, path, status code, and latency.

    Skips noisy endpoints (healthz, SSE streams) to keep logs useful.

    Uses raw ASGI pattern to avoid BaseHTTPMiddleware buffering
    StreamingResponse bodies into memory.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Log request details after response is sent."""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = _get_path(scope)
        if path in _QUIET_PATHS:
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "")
        start = time.monotonic()
        status_code: int | None = None

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 0)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            elapsed = time.monotonic() - start
            logger.info(
                "http_request",
                extra={
                    "method": method,
                    "path": path,
                    "status": status_code,
                    "latency_ms": round(elapsed * 1000, 1),
                },
            )


class MTLSMiddleware:
    """Mutual TLS middleware — mTLS enforcement planned for Phase 11.

    Currently validates configuration and logs warnings when mTLS is expected
    but not fully implemented. Passes through all requests.
    """

    def __init__(
        self,
        app: ASGIApp,
        mode: str = "off",
        client_subject_header: str = "",
        allowed_subjects: list[str] | None = None,
    ) -> None:
        self.app = app
        self.mode = mode
        self.client_subject_header = client_subject_header
        self.allowed_subjects = set(allowed_subjects or [])

        if mode == "required":
            logger.warning(
                "mtls_required_not_implemented",
                extra={
                    "mode": mode,
                    "note": "mTLS enforcement is planned for Phase 11. "
                    "Current mode logs this warning but does not enforce.",
                },
            )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and self.mode == "required":
            headers = dict(scope.get("headers", []))
            client_subject = None
            for key, value in headers:
                if key.decode("latin-1").lower() == self.client_subject_header.lower():
                    client_subject = value.decode("latin-1")
                    break

            if not client_subject:
                logger.debug(
                    "mtls_missing_client_subject",
                    extra={
                        "header": self.client_subject_header,
                        "path": scope.get("path", ""),
                    },
                )
            elif self.allowed_subjects and client_subject not in self.allowed_subjects:
                logger.debug(
                    "mtls_untrusted_client_subject",
                    extra={
                        "subject": client_subject,
                        "allowed": list(self.allowed_subjects),
                    },
                )

        await self.app(scope, receive, send)


class OpenTelemetryMiddleware:
    """OpenTelemetry tracing middleware — OTEL integration planned for Phase 12.

    Currently passes through all requests and logs a warning when enabled.
    Full implementation will add trace context propagation and span creation.
    """

    def __init__(self, app: ASGIApp, enabled: bool = False, **kwargs: Any) -> None:
        self.app = app
        self.enabled = enabled

        if enabled:
            logger.warning(
                "otel_not_implemented",
                extra={
                    "enabled": enabled,
                    "note": "OpenTelemetry integration is planned for Phase 12. "
                    "Current middleware passes through all requests.",
                },
            )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if self.enabled and scope["type"] == "http":
            logger.debug(
                "otel_span_placeholder",
                extra={
                    "path": scope.get("path", ""),
                    "method": scope.get("method", ""),
                    "note": "Full OTEL implementation pending Phase 12",
                },
            )
        await self.app(scope, receive, send)
