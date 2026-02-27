"""SSE integration tests — verify streaming through the full API stack.

Uses httpx-sse to parse Server-Sent Events from /v1/chat/completions
with stream=true, validating OpenAI SSE protocol compliance end-to-end.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from httpx_sse import aconnect_sse

from opta_lmx.config import LMXConfig
from opta_lmx.inference.embedding_engine import EmbeddingEngine
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.inference.types import ModelInfo
from opta_lmx.main import create_app
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.manager.model import ModelManager
from opta_lmx.monitoring.events import EventBus
from opta_lmx.monitoring.metrics import MetricsCollector
from opta_lmx.presets.manager import PresetManager
from opta_lmx.router.strategy import TaskRouter


@pytest.fixture
async def sse_client(tmp_path: Path) -> AsyncIterator[AsyncClient]:
    """HTTP client with mocked engine that supports streaming."""
    config = LMXConfig()
    test_app = create_app(config)

    # Build a mock engine with stream_generate support
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)

    # Mock is_model_loaded to return True for our test model
    engine.is_model_loaded = lambda model_id: model_id == "test-model"  # type: ignore[assignment]

    # Mock get_loaded_models to return a model
    engine.get_loaded_models = lambda: [  # type: ignore[assignment]
        ModelInfo(model_id="test-model", loaded_at=0.0)
    ]

    # Mock stream_generate to yield tokens
    async def mock_stream(*_args: object, **_kwargs: object) -> AsyncIterator[str]:
        for token in ["Hello", " from", " LMX", "!"]:
            yield token

    engine.stream_generate = mock_stream  # type: ignore[assignment]

    # Also mock non-streaming generate for completeness
    mock_response = MagicMock()
    mock_response.model_dump.return_value = {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "created": 0,
        "model": "test-model",
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": "Hello!"},
            "finish_reason": "stop",
        }],
        "usage": {"prompt_tokens": 10, "completion_tokens": 1, "total_tokens": 11},
    }
    mock_response.usage = MagicMock(prompt_tokens=10, completion_tokens=1)
    engine.generate = AsyncMock(return_value=mock_response)  # type: ignore[assignment]

    mock_model_manager = ModelManager(models_directory=tmp_path)
    mock_model_manager.is_model_available = AsyncMock(return_value=True)  # type: ignore[assignment]

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as http_client:
        test_app.state.engine = engine
        test_app.state.memory_monitor = monitor
        test_app.state.model_manager = mock_model_manager
        test_app.state.router = TaskRouter(config.routing)
        test_app.state.metrics = MetricsCollector()
        test_app.state.preset_manager = PresetManager(tmp_path / "presets")
        test_app.state.event_bus = EventBus()
        test_app.state.embedding_engine = EmbeddingEngine()
        test_app.state.pending_downloads = {}
        test_app.state.start_time = 0.0
        test_app.state.admin_key = None
        test_app.state.config = config
        test_app.state.remote_embedding = None
        test_app.state.remote_reranking = None
        yield http_client


class TestSSEIntegration:
    """End-to-end SSE streaming through /v1/chat/completions."""

    @pytest.mark.asyncio
    async def test_sse_stream_basic(self, sse_client: AsyncClient) -> None:
        """Streaming response contains valid SSE events with correct structure."""
        async with aconnect_sse(
            sse_client,
            "POST",
            "/v1/chat/completions",
            json={
                "model": "test-model",
                "messages": [{"role": "user", "content": "Hi"}],
                "stream": True,
            },
        ) as event_source:
            events = [sse async for sse in event_source.aiter_sse()]

        # Should have: role chunk + 4 content chunks + final chunk + [DONE]
        assert len(events) >= 6

        # Last event is [DONE] sentinel
        assert events[-1].data == "[DONE]"

    @pytest.mark.asyncio
    async def test_sse_first_chunk_has_role(self, sse_client: AsyncClient) -> None:
        """First SSE event sets role=assistant."""
        async with aconnect_sse(
            sse_client,
            "POST",
            "/v1/chat/completions",
            json={
                "model": "test-model",
                "messages": [{"role": "user", "content": "Hi"}],
                "stream": True,
            },
        ) as event_source:
            events = [sse async for sse in event_source.aiter_sse()]

        first = json.loads(events[0].data)
        assert first["choices"][0]["delta"]["role"] == "assistant"
        assert first["id"].startswith("chatcmpl-")
        assert first["model"] == "test-model"
        assert first["object"] == "chat.completion.chunk"

    @pytest.mark.asyncio
    async def test_sse_content_tokens(self, sse_client: AsyncClient) -> None:
        """Content tokens are delivered as individual SSE events."""
        async with aconnect_sse(
            sse_client,
            "POST",
            "/v1/chat/completions",
            json={
                "model": "test-model",
                "messages": [{"role": "user", "content": "Hi"}],
                "stream": True,
            },
        ) as event_source:
            events = [sse async for sse in event_source.aiter_sse()]

        # Content events are events[1] through events[4] (4 tokens)
        content_events = [
            e for e in events
            if e.data != "[DONE]" and json.loads(e.data)["choices"][0]["delta"].get("content")
        ]
        tokens = [json.loads(e.data)["choices"][0]["delta"]["content"] for e in content_events]
        assert tokens == ["Hello", " from", " LMX", "!"]

    @pytest.mark.asyncio
    async def test_sse_final_chunk_stop(self, sse_client: AsyncClient) -> None:
        """Second-to-last event has finish_reason=stop."""
        async with aconnect_sse(
            sse_client,
            "POST",
            "/v1/chat/completions",
            json={
                "model": "test-model",
                "messages": [{"role": "user", "content": "Hi"}],
                "stream": True,
            },
        ) as event_source:
            events = [sse async for sse in event_source.aiter_sse()]

        # The event before [DONE] should have finish_reason="stop"
        final = json.loads(events[-2].data)
        assert final["choices"][0]["finish_reason"] == "stop"

    @pytest.mark.asyncio
    async def test_sse_response_content_type(self, sse_client: AsyncClient) -> None:
        """Streaming response has text/event-stream content type."""
        response = await sse_client.post(
            "/v1/chat/completions",
            json={
                "model": "test-model",
                "messages": [{"role": "user", "content": "Hi"}],
                "stream": True,
            },
        )
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"

    @pytest.mark.asyncio
    async def test_sse_model_not_found(self, sse_client: AsyncClient) -> None:
        """Streaming request for unloaded model returns JSON error, not SSE."""
        response = await sse_client.post(
            "/v1/chat/completions",
            json={
                "model": "nonexistent-model",
                "messages": [{"role": "user", "content": "Hi"}],
                "stream": True,
            },
        )
        assert response.status_code == 404
        data = response.json()
        assert data["error"]["type"] == "invalid_request_error"
