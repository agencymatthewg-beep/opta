"""Tests for Feature 2: WebSocket Streaming."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from opta_lmx.config import LMXConfig, RoutingConfig
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.main import create_app
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.monitoring.events import EventBus
from opta_lmx.monitoring.metrics import MetricsCollector
from opta_lmx.presets.manager import PresetManager
from opta_lmx.router.strategy import TaskRouter


@pytest.fixture
def ws_app(tmp_path):
    """Create a FastAPI app with mock engine for WebSocket tests."""
    config = LMXConfig()
    app = create_app(config)

    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False)

    async def mock_create(model_id: str, use_batching: bool) -> MagicMock:
        mock = MagicMock()
        mock.chat = MagicMock(return_value="Hello from WebSocket test!")
        return mock

    engine._create_engine = mock_create  # type: ignore[assignment]

    app.state.engine = engine
    app.state.memory_monitor = monitor
    app.state.model_manager = MagicMock()
    app.state.router = TaskRouter(RoutingConfig())
    app.state.metrics = MetricsCollector()
    app.state.preset_manager = PresetManager(tmp_path / "presets")
    app.state.event_bus = EventBus()
    app.state.pending_downloads = {}
    app.state.start_time = 0.0
    app.state.admin_key = None
    app.state.config = config

    return app


@pytest.mark.asyncio
async def test_ws_connect_and_disconnect(ws_app) -> None:
    """WebSocket connects and disconnects cleanly."""
    from starlette.testclient import TestClient

    client = TestClient(ws_app)
    with client.websocket_connect("/v1/chat/stream") as ws:
        pass  # Just connect and disconnect


@pytest.mark.asyncio
async def test_ws_chat_request_non_streaming(ws_app) -> None:
    """Non-streaming chat request returns a chat.done response."""
    from starlette.testclient import TestClient

    # Pre-load a model
    engine = ws_app.state.engine
    await engine.load_model("test-model")

    client = TestClient(ws_app)
    with client.websocket_connect("/v1/chat/stream") as ws:
        ws.send_json({
            "type": "chat.request",
            "model": "test-model",
            "messages": [{"role": "user", "content": "Hello"}],
            "stream": False,
        })

        response = ws.receive_json()
        assert response["type"] == "chat.done"
        assert response["request_id"].startswith("chatcmpl-")
        assert response["finish_reason"] == "stop"
        assert response["content"] == "Hello from WebSocket test!"
        assert "usage" in response


@pytest.mark.asyncio
async def test_ws_chat_request_streaming(ws_app) -> None:
    """Streaming chat request returns token chunks followed by done."""
    from starlette.testclient import TestClient

    engine = ws_app.state.engine

    # Override mock engine to stream tokens
    async def mock_create(model_id: str, use_batching: bool) -> MagicMock:
        mock = MagicMock()

        def stream_chat(**kwargs):
            return iter(["Hello", " World"])

        mock.chat = stream_chat
        return mock

    engine._create_engine = mock_create  # type: ignore[assignment]
    await engine.load_model("stream-model")

    client = TestClient(ws_app)
    with client.websocket_connect("/v1/chat/stream") as ws:
        ws.send_json({
            "type": "chat.request",
            "model": "stream-model",
            "messages": [{"role": "user", "content": "Hello"}],
            "stream": True,
        })

        # Collect all messages
        messages = []
        while True:
            msg = ws.receive_json()
            messages.append(msg)
            if msg["type"] in ("chat.done", "chat.error"):
                break

        # Should have token messages followed by done
        token_msgs = [m for m in messages if m["type"] == "chat.token"]
        done_msgs = [m for m in messages if m["type"] == "chat.done"]

        assert len(token_msgs) == 2
        assert token_msgs[0]["content"] == "Hello"
        assert token_msgs[1]["content"] == " World"
        assert len(done_msgs) == 1
        assert done_msgs[0]["finish_reason"] == "stop"


@pytest.mark.asyncio
async def test_ws_model_not_loaded(ws_app) -> None:
    """Requesting a model that isn't loaded returns chat.error."""
    from starlette.testclient import TestClient

    client = TestClient(ws_app)
    with client.websocket_connect("/v1/chat/stream") as ws:
        ws.send_json({
            "type": "chat.request",
            "model": "nonexistent-model",
            "messages": [{"role": "user", "content": "Hello"}],
        })

        response = ws.receive_json()
        assert response["type"] == "chat.error"
        assert "not loaded" in response["error"]


@pytest.mark.asyncio
async def test_ws_unknown_message_type(ws_app) -> None:
    """Unknown message type returns error."""
    from starlette.testclient import TestClient

    client = TestClient(ws_app)
    with client.websocket_connect("/v1/chat/stream") as ws:
        ws.send_json({"type": "unknown_type"})

        response = ws.receive_json()
        assert response["type"] == "chat.error"
        assert "Unknown message type" in response["error"]


@pytest.mark.asyncio
async def test_ws_cancel_nonexistent_request(ws_app) -> None:
    """Cancelling a non-existent request_id is silently ignored."""
    from starlette.testclient import TestClient

    client = TestClient(ws_app)
    with client.websocket_connect("/v1/chat/stream") as ws:
        ws.send_json({
            "type": "chat.cancel",
            "request_id": "chatcmpl-doesnotexist",
        })
        # Should not crash — just silently ignored


# ─── Config Tests ────────────────────────────────────────────────────────


def test_websocket_disabled_config() -> None:
    """WebSocket router is not mounted when websocket_enabled=False."""
    config = LMXConfig()
    config.server.websocket_enabled = False
    app = create_app(config)

    routes = [r.path for r in app.routes]
    assert "/v1/chat/stream" not in routes


def test_websocket_enabled_config() -> None:
    """WebSocket router is mounted when websocket_enabled=True (default)."""
    config = LMXConfig()
    app = create_app(config)

    routes = [r.path for r in app.routes]
    assert "/v1/chat/stream" in routes
