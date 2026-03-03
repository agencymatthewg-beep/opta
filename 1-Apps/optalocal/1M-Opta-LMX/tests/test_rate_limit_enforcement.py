"""Integration tests for rate limiting enforcement in the FastAPI application."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from opta_lmx.config import LMXConfig, RoutingConfig
from opta_lmx.inference.embedding_engine import EmbeddingEngine
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.main import create_app
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.manager.model import ModelManager
from opta_lmx.monitoring.events import EventBus
from opta_lmx.monitoring.metrics import MetricsCollector
from opta_lmx.presets.manager import PresetManager
from opta_lmx.router.strategy import TaskRouter


async def _setup_rate_limited_client(
    mock_engine: InferenceEngine,
    mock_model_manager: ModelManager,
    tmp_path,
    limit: str = "2/minute",
) -> AsyncClient:
    """Setup a client with rate limiting enabled and a specific limit."""
    config = LMXConfig()
    config.security.rate_limit.enabled = True
    config.security.rate_limit.default_limit = limit
    config.security.rate_limit.chat_completions_limit = limit
    config.security.inference_api_key = "valid-key"

    test_app = create_app(config)

    # We must properly initialize the app state just like in conftest.py
    test_app.state.engine = mock_engine
    test_app.state.memory_monitor = MemoryMonitor(max_percent=90)
    test_app.state.model_manager = mock_model_manager
    test_app.state.router = TaskRouter(RoutingConfig())
    test_app.state.metrics = MetricsCollector()
    test_app.state.preset_manager = PresetManager(tmp_path / "presets")
    test_app.state.event_bus = EventBus()
    test_app.state.embedding_engine = EmbeddingEngine()
    test_app.state.pending_downloads = {}
    test_app.state.start_time = 0.0
    test_app.state.admin_key = None
    test_app.state.inference_api_key = "valid-key"
    test_app.state.supabase_jwt_enabled = False
    test_app.state.supabase_jwt_require = False
    test_app.state.supabase_jwt_verifier = None
    test_app.state.config = config
    test_app.state.remote_embedding = None
    test_app.state.remote_reranking = None

    # Actually mock a loaded model in the engine so the route can proceed
    await mock_engine.load_model("test-model")

    return AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test")


@pytest.mark.asyncio
async def test_rate_limit_exceeded(mock_engine, mock_model_manager, tmp_path):
    """Test that exceeding the rate limit returns a 429 Too Many Requests."""
    from opta_lmx.api.rate_limit import SLOWAPI_AVAILABLE

    if not SLOWAPI_AVAILABLE:
        pytest.skip("slowapi is not installed")

    client = await _setup_rate_limited_client(
        mock_engine,
        mock_model_manager,
        tmp_path,
        limit="2/minute",
    )

    headers = {"Authorization": "Bearer valid-key"}
    payload = {
        "model": "test-model",
        "messages": [{"role": "user", "content": "Hello"}],
    }

    # Request 1: OK
    resp1 = await client.post("/v1/chat/completions", json=payload, headers=headers)
    assert resp1.status_code != 429, f"Got unexpected 429: {resp1.json()}"

    # Request 2: OK
    resp2 = await client.post("/v1/chat/completions", json=payload, headers=headers)
    assert resp2.status_code != 429, f"Got unexpected 429: {resp2.json()}"

    # Request 3: Exceeds rate limit
    resp3 = await client.post("/v1/chat/completions", json=payload, headers=headers)
    assert resp3.status_code == 429
    assert "Rate limit exceeded" in resp3.json()["error"]

    await client.aclose()


@pytest.mark.asyncio
async def test_invalid_auth_rejected_before_rate_limit(mock_engine, mock_model_manager, tmp_path):
    """Test that invalid auth is rejected (401) without consuming the rate limit."""
    from opta_lmx.api.rate_limit import SLOWAPI_AVAILABLE

    if not SLOWAPI_AVAILABLE:
        pytest.skip("slowapi is not installed")

    # Limit is 1/minute
    client = await _setup_rate_limited_client(
        mock_engine,
        mock_model_manager,
        tmp_path,
        limit="1/minute",
    )

    valid_headers = {"Authorization": "Bearer valid-key"}
    invalid_headers = {"Authorization": "Bearer bad-key"}
    payload = {
        "model": "test-model",
        "messages": [{"role": "user", "content": "Hello"}],
    }

    # Send 5 requests with invalid auth, should all return 401
    for _ in range(5):
        resp_invalid = await client.post(
            "/v1/chat/completions",
            json=payload,
            headers=invalid_headers,
        )
        assert resp_invalid.status_code == 401

    # The valid request should still pass; invalid auth fails before limiter checks.
    resp_valid = await client.post("/v1/chat/completions", json=payload, headers=valid_headers)
    assert resp_valid.status_code != 429
    assert resp_valid.status_code == 200

    await client.aclose()
