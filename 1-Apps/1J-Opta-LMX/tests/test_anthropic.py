"""Tests for Anthropic /v1/messages API endpoint."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from opta_lmx.config import LMXConfig
from opta_lmx.main import create_app


@pytest.fixture
async def anthropic_client(
    mock_engine, mock_model_manager, tmp_path,
) -> AsyncIterator[AsyncClient]:
    """Test client with mock engine for Anthropic endpoint tests."""
    from opta_lmx.manager.memory import MemoryMonitor
    from opta_lmx.monitoring.events import EventBus
    from opta_lmx.monitoring.metrics import MetricsCollector
    from opta_lmx.presets.manager import PresetManager
    from opta_lmx.router.strategy import TaskRouter
    from opta_lmx.config import RoutingConfig

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
        yield http_client


class TestAnthropicNonStreaming:
    """Tests for non-streaming /v1/messages."""

    @pytest.mark.asyncio
    async def test_basic_response_shape(
        self, anthropic_client: AsyncClient, mock_engine,
    ) -> None:
        """Response matches Anthropic Messages format."""
        await mock_engine.load_model("test-model")

        response = await anthropic_client.post("/v1/messages", json={
            "model": "test-model",
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 100,
        })

        assert response.status_code == 200
        data = response.json()
        assert data["id"].startswith("msg_")
        assert data["type"] == "message"
        assert data["role"] == "assistant"
        assert data["model"] == "test-model"
        assert isinstance(data["content"], list)
        assert len(data["content"]) == 1
        assert data["content"][0]["type"] == "text"
        assert len(data["content"][0]["text"]) > 0
        assert data["stop_reason"] == "end_turn"

    @pytest.mark.asyncio
    async def test_usage_fields(
        self, anthropic_client: AsyncClient, mock_engine,
    ) -> None:
        """Usage has input_tokens and output_tokens (not prompt/completion)."""
        await mock_engine.load_model("test-model")

        response = await anthropic_client.post("/v1/messages", json={
            "model": "test-model",
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 100,
        })

        data = response.json()
        assert "usage" in data
        assert "input_tokens" in data["usage"]
        assert "output_tokens" in data["usage"]
        # Should NOT have OpenAI-style fields
        assert "prompt_tokens" not in data["usage"]
        assert "completion_tokens" not in data["usage"]

    @pytest.mark.asyncio
    async def test_system_prompt(
        self, anthropic_client: AsyncClient, mock_engine,
    ) -> None:
        """System field is accepted as top-level parameter."""
        await mock_engine.load_model("test-model")

        response = await anthropic_client.post("/v1/messages", json={
            "model": "test-model",
            "messages": [{"role": "user", "content": "Hello"}],
            "system": "You are a helpful assistant.",
            "max_tokens": 100,
        })

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_model_not_loaded(
        self, anthropic_client: AsyncClient,
    ) -> None:
        """Unloaded model returns 404 in Anthropic error format."""
        response = await anthropic_client.post("/v1/messages", json={
            "model": "nonexistent-model",
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 100,
        })

        assert response.status_code == 404
        data = response.json()
        assert data["type"] == "error"
        assert data["error"]["type"] == "not_found_error"


class TestAnthropicStreaming:
    """Tests for streaming /v1/messages."""

    @pytest.mark.asyncio
    async def test_streaming_event_types(
        self, anthropic_client: AsyncClient, mock_engine,
    ) -> None:
        """Streaming returns correct SSE event sequence."""
        await mock_engine.load_model("test-model")

        response = await anthropic_client.post("/v1/messages", json={
            "model": "test-model",
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 100,
            "stream": True,
        })

        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        # Parse SSE events
        events = []
        for line in response.text.split("\n"):
            if line.startswith("event: "):
                events.append(line[7:])

        # Verify event sequence
        assert "message_start" in events
        assert "content_block_start" in events
        assert "content_block_stop" in events
        assert "message_delta" in events
        assert "message_stop" in events

    @pytest.mark.asyncio
    async def test_streaming_message_start_shape(
        self, anthropic_client: AsyncClient, mock_engine,
    ) -> None:
        """message_start event contains proper message structure."""
        await mock_engine.load_model("test-model")

        response = await anthropic_client.post("/v1/messages", json={
            "model": "test-model",
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 100,
            "stream": True,
        })

        # Find message_start data
        lines = response.text.split("\n")
        for i, line in enumerate(lines):
            if line == "event: message_start":
                data_line = lines[i + 1]
                data = json.loads(data_line[6:])  # strip "data: "
                assert data["type"] == "message_start"
                assert data["message"]["id"].startswith("msg_")
                assert data["message"]["role"] == "assistant"
                break
