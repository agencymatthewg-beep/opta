"""HTTP middleware for Opta-LMX — request ID propagation and request logging.

Uses raw ASGI middleware pattern instead of Starlette's BaseHTTPMiddleware
to avoid a documented issue where BaseHTTPMiddleware consumes StreamingResponse
bodies into memory before forwarding, causing memory spikes during SSE streaming.
"""

from __future__ import annotations

import json
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
    """Mutual TLS middleware with configurable enforcement modes."""

    def __init__(
        self,
        app: ASGIApp,
        mode: str = "off",
        client_subject_header: str = "",
        allowed_subjects: list[str] | None = None,
    ) -> None:
        self.app = app
        normalized_mode = (mode or "off").strip().lower()
        self.mode = normalized_mode if normalized_mode in {"off", "optional", "required"} else "off"
        self.client_subject_header = client_subject_header.strip()
        self.allowed_subjects = {
            subject.strip()
            for subject in (allowed_subjects or [])
            if subject.strip()
        }

    async def _reject(self, send: Send, *, status_code: int, detail: str) -> None:
        body = json.dumps({"detail": detail}).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": status_code,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("latin-1")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or self.mode == "off":
            await self.app(scope, receive, send)
            return

        subject: str | None = None
        if self.client_subject_header:
            raw_subject = _get_header(scope, self.client_subject_header)
            if raw_subject is not None:
                candidate = raw_subject.strip()
                if candidate:
                    subject = candidate

        if self.mode == "required" and subject is None:
            await self._reject(send, status_code=401, detail="mTLS client subject required")
            return

        if subject is not None and self.allowed_subjects and subject not in self.allowed_subjects:
            await self._reject(send, status_code=403, detail="mTLS subject not allowed")
            return

        if subject is not None:
            state = scope.setdefault("state", {})
            if isinstance(state, dict):
                state["mtls_subject"] = subject

        await self.app(scope, receive, send)


def _get_otel_trace_api() -> Any | None:
    """Best-effort import for OpenTelemetry trace API."""
    try:
        from opentelemetry import trace  # type: ignore[import-not-found]

        return trace
    except Exception:
        return None


def _set_span_attribute(span: Any, key: str, value: Any) -> None:
    """Set span attribute without allowing tracing failures to break requests."""
    try:
        span.set_attribute(key, value)
    except Exception:
        return


def _build_traceparent(span: Any) -> str | None:
    """Build W3C traceparent header value from current span context."""
    try:
        span_context = span.get_span_context()
        trace_id = int(getattr(span_context, "trace_id", 0))
        span_id = int(getattr(span_context, "span_id", 0))
        if trace_id == 0 or span_id == 0:
            return None
        trace_flags = int(getattr(span_context, "trace_flags", 1)) & 0xFF
        return f"00-{trace_id:032x}-{span_id:016x}-{trace_flags:02x}"
    except Exception:
        return None


class OpenTelemetryMiddleware:
    """OpenTelemetry tracing middleware (fail-open when OTEL is unavailable)."""

    def __init__(
        self,
        app: ASGIApp,
        *,
        enabled: bool = False,
        service_name: str = "opta-lmx",
        tracer: Any | None = None,
        **_: Any,
    ) -> None:
        self.app = app
        self.enabled = enabled
        self._tracer = tracer
        self._span_kind_server: Any | None = None
        if not self.enabled:
            return
        if self._tracer is not None:
            return

        trace_api = _get_otel_trace_api()
        if trace_api is None:
            return

        try:
            self._span_kind_server = trace_api.SpanKind.SERVER
        except Exception:
            self._span_kind_server = None
        try:
            self._tracer = trace_api.get_tracer(f"{service_name}.http")
        except Exception:
            self._tracer = None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not self.enabled or self._tracer is None:
            await self.app(scope, receive, send)
            return

        path = _get_path(scope)
        method = str(scope.get("method", ""))
        span_name = f"{method} {path}".strip() or "http.request"
        query_string = scope.get("query_string", b"")
        query = ""
        if isinstance(query_string, (bytes, bytearray)) and query_string:
            query = query_string.decode("latin-1", errors="ignore")
        host = _get_header(scope, "host")
        scheme = scope.get("scheme")
        http_version = scope.get("http_version")
        status_code: int | None = None

        start_kwargs: dict[str, Any] = {}
        if self._span_kind_server is not None:
            start_kwargs["kind"] = self._span_kind_server

        with self._tracer.start_as_current_span(span_name, **start_kwargs) as span:
            if method:
                _set_span_attribute(span, "http.request.method", method)
            if path:
                _set_span_attribute(span, "url.path", path)
            if query:
                _set_span_attribute(span, "url.query", query)
            if scheme:
                _set_span_attribute(span, "url.scheme", str(scheme))
            if host:
                _set_span_attribute(span, "server.address", host)
            if http_version:
                _set_span_attribute(span, "network.protocol.version", str(http_version))

            async def send_wrapper(message: Message) -> None:
                nonlocal status_code
                if message["type"] == "http.response.start":
                    status_code = int(message.get("status", 0))
                    _set_span_attribute(span, "http.response.status_code", status_code)
                    _set_span_attribute(span, "http.status_code", status_code)
                    traceparent = _build_traceparent(span)
                    if traceparent:
                        message.setdefault("headers", [])
                        headers = MutableHeaders(scope=message)
                        headers.append("traceparent", traceparent)
                await send(message)

            try:
                await self.app(scope, receive, send_wrapper)
            except Exception:
                if status_code is None:
                    _set_span_attribute(span, "http.response.status_code", 500)
                    _set_span_attribute(span, "http.status_code", 500)
                raise
