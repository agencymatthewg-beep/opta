"""Tests for HTTP middleware — request ID and request logging."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from opta_lmx.config import LMXConfig
from opta_lmx.main import create_app


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
