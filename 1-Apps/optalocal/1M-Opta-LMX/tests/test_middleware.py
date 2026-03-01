"""Tests for HTTP middleware — request ID and request logging."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

import opta_lmx.api.middleware as middleware_module
from opta_lmx.api.middleware import MTLSMiddleware, OpenTelemetryMiddleware
from opta_lmx.config import LMXConfig
from opta_lmx.main import create_app


def _make_state_echo_app(*, status_code: int = 200) -> Any:
    """Create a minimal ASGI app that echoes middleware state through headers."""

    async def app(scope, receive, send) -> None:
        if scope["type"] != "http":
            return

        headers: list[tuple[bytes, bytes]] = [(b"content-type", b"application/json")]
        state = scope.get("state")
        if isinstance(state, dict):
            subject = state.get("mtls_subject")
            if isinstance(subject, str):
                headers.append((b"x-mtls-subject", subject.encode("utf-8")))

        await send(
            {
                "type": "http.response.start",
                "status": status_code,
                "headers": headers,
            }
        )
        await send({"type": "http.response.body", "body": b"{}"})

    return app


class _FakeSpanContext:
    trace_id = int("4bf92f3577b34da6a3ce929d0e0e4736", 16)
    span_id = int("00f067aa0ba902b7", 16)
    trace_flags = 1


class _FakeSpan:
    def __init__(self) -> None:
        self.attributes: dict[str, Any] = {}

    def set_attribute(self, key: str, value: Any) -> None:
        self.attributes[key] = value

    def get_span_context(self) -> _FakeSpanContext:
        return _FakeSpanContext()


class _FakeSpanContextManager:
    def __init__(self, span: _FakeSpan) -> None:
        self._span = span

    def __enter__(self) -> _FakeSpan:
        return self._span

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


class _FakeTracer:
    def __init__(self) -> None:
        self.last_span: _FakeSpan | None = None
        self.last_name: str | None = None
        self.last_kwargs: dict[str, Any] = {}

    def start_as_current_span(self, name: str, **kwargs: Any) -> _FakeSpanContextManager:
        self.last_name = name
        self.last_kwargs = kwargs
        span = _FakeSpan()
        self.last_span = span
        return _FakeSpanContextManager(span)


@pytest.fixture
async def app_client(mock_engine, mock_model_manager, tmp_path):
    """Minimal test client for middleware tests."""
    from opta_lmx.config import RoutingConfig
    from opta_lmx.manager.memory import MemoryMonitor
    from opta_lmx.monitoring.events import EventBus
    from opta_lmx.monitoring.metrics import MetricsCollector
    from opta_lmx.presets.manager import PresetManager
    from opta_lmx.router.strategy import TaskRouter

    test_app = create_app(LMXConfig())

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as http_client:
        test_app.state.engine = mock_engine
        test_app.state.memory_monitor = MemoryMonitor(max_percent=90)
        test_app.state.model_manager = mock_model_manager
        test_app.state.router = TaskRouter(RoutingConfig())
        test_app.state.metrics = MetricsCollector()
        test_app.state.preset_manager = PresetManager(tmp_path / "presets")
        test_app.state.event_bus = EventBus()
        test_app.state.pending_downloads = {}
        test_app.state.start_time = 0.0
        test_app.state.admin_key = None
        test_app.state.inference_api_key = None
        test_app.state.supabase_jwt_enabled = False
        test_app.state.supabase_jwt_require = False
        test_app.state.supabase_jwt_verifier = None
        test_app.state.config = LMXConfig()
        test_app.state.remote_embedding = None
        test_app.state.remote_reranking = None
        yield http_client


class TestRequestIDMiddleware:
    """Tests for X-Request-ID middleware."""

    @pytest.mark.asyncio
    async def test_generates_request_id(self, app_client: AsyncClient) -> None:
        """Response includes X-Request-ID when client doesn't send one."""
        response = await app_client.get("/healthz")
        assert "x-request-id" in response.headers
        assert response.headers["x-request-id"].startswith("req-")

    @pytest.mark.asyncio
    async def test_preserves_client_request_id(self, app_client: AsyncClient) -> None:
        """Client-provided X-Request-ID is preserved in response."""
        response = await app_client.get(
            "/healthz", headers={"x-request-id": "my-custom-id"},
        )
        assert response.headers["x-request-id"] == "my-custom-id"


class TestRequestLoggingMiddleware:
    """Tests for request logging middleware."""

    @pytest.mark.asyncio
    async def test_logs_request(self, app_client: AsyncClient, caplog) -> None:
        """HTTP requests are logged with method, path, status, latency."""
        import logging
        with caplog.at_level(logging.INFO, logger="opta_lmx.api.middleware"):
            await app_client.get("/v1/models")

        assert any("http_request" in record.message for record in caplog.records)

    @pytest.mark.asyncio
    async def test_skips_healthz_logging(self, app_client: AsyncClient, caplog) -> None:
        """Healthz endpoint is not logged (noisy)."""
        import logging
        with caplog.at_level(logging.INFO, logger="opta_lmx.api.middleware"):
            await app_client.get("/healthz")

        http_records = [r for r in caplog.records if "http_request" in r.message]
        assert len(http_records) == 0


class TestMTLSMiddleware:
    """Tests for mTLS middleware enforcement logic."""

    @pytest.mark.asyncio
    async def test_required_rejects_missing_subject(self) -> None:
        """Required mode rejects requests with missing/blank client subject."""
        app = MTLSMiddleware(
            _make_state_echo_app(),
            mode="required",
            client_subject_header="x-client-subject",
        )
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.get("/v1/models")

        assert response.status_code == 401
        assert response.json()["detail"] == "mTLS client subject required"

    @pytest.mark.asyncio
    async def test_required_accepts_subject_and_sets_scope_state(self) -> None:
        """Required mode accepts subject header and stores it in request state."""
        app = MTLSMiddleware(
            _make_state_echo_app(),
            mode="required",
            client_subject_header="x-client-subject",
        )
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.get(
                "/v1/models",
                headers={"x-client-subject": "CN=trusted-client"},
            )

        assert response.status_code == 200
        assert response.headers["x-mtls-subject"] == "CN=trusted-client"

    @pytest.mark.asyncio
    async def test_allowlist_rejects_unlisted_subject(self) -> None:
        """Allowlist blocks client subjects that are not explicitly permitted."""
        app = MTLSMiddleware(
            _make_state_echo_app(),
            mode="optional",
            client_subject_header="x-client-subject",
            allowed_subjects=["CN=allowed-client"],
        )
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.get(
                "/v1/models",
                headers={"x-client-subject": "CN=blocked-client"},
            )

        assert response.status_code == 403
        assert response.json()["detail"] == "mTLS subject not allowed"


class TestOpenTelemetryMiddleware:
    """Tests for OpenTelemetry middleware behavior with optional dependencies."""

    @pytest.mark.asyncio
    async def test_disabled_passthrough(self) -> None:
        """Disabled OTEL middleware should not add tracing headers."""
        app = OpenTelemetryMiddleware(_make_state_echo_app(), enabled=False)
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.get("/v1/models")

        assert response.status_code == 200
        assert "traceparent" not in response.headers

    @pytest.mark.asyncio
    async def test_enabled_with_injected_tracer_adds_traceparent(self) -> None:
        """Enabled middleware uses provided tracer and emits traceparent header."""
        fake_tracer = _FakeTracer()
        app = OpenTelemetryMiddleware(
            _make_state_echo_app(status_code=201),
            enabled=True,
            tracer=fake_tracer,
        )
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.get("/v1/models?verbose=1")

        assert response.status_code == 201
        assert response.headers["traceparent"] == (
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
        )
        assert fake_tracer.last_name == "GET /v1/models"
        assert fake_tracer.last_span is not None
        assert fake_tracer.last_span.attributes["http.request.method"] == "GET"
        assert fake_tracer.last_span.attributes["url.path"] == "/v1/models"
        assert fake_tracer.last_span.attributes["http.response.status_code"] == 201

    @pytest.mark.asyncio
    async def test_enabled_falls_open_when_otel_unavailable(self, monkeypatch) -> None:
        """Enabled middleware fails open when OTEL import is unavailable."""
        monkeypatch.setattr(middleware_module, "_get_otel_trace_api", lambda: None)
        app = OpenTelemetryMiddleware(_make_state_echo_app(), enabled=True)
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.get("/v1/models")

        assert response.status_code == 200
        assert "traceparent" not in response.headers
