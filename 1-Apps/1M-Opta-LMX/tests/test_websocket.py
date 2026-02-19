"""Tests for Feature 2: WebSocket Streaming."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

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
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)

    async def mock_create(model_id: str, use_batching: bool, **_kw: object) -> MagicMock:
        mock = MagicMock()
        mock.chat = AsyncMock(return_value="Hello from WebSocket test!")
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


async def test_ws_connect_and_disconnect(ws_app) -> None:
    """WebSocket connects and disconnects cleanly."""
    from starlette.testclient import TestClient

    client = TestClient(ws_app)
    with client.websocket_connect("/v1/chat/stream") as _ws:
        pass  # Just connect and disconnect


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


async def test_ws_chat_request_streaming(ws_app) -> None:
    """Streaming chat request returns token chunks followed by done."""
    from starlette.testclient import TestClient

    engine = ws_app.state.engine

    # Override mock engine to stream tokens
    async def mock_create(model_id: str, use_batching: bool, **_kw: object) -> MagicMock:
        mock = MagicMock()
        mock.chat = AsyncMock(return_value="Hello World")

        async def mock_stream_chat(**kwargs):
            for token in ["Hello", " World"]:
                yield token

        mock.stream_chat = mock_stream_chat
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


async def test_ws_unknown_message_type(ws_app) -> None:
    """Unknown message type returns error."""
    from starlette.testclient import TestClient

    client = TestClient(ws_app)
    with client.websocket_connect("/v1/chat/stream") as ws:
        ws.send_json({"type": "unknown_type"})

        response = ws.receive_json()
        assert response["type"] == "chat.error"
        assert "Unknown message type" in response["error"]


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


# ─── Preset Resolution Tests ────────────────────────────────────────────


async def test_ws_preset_resolution(ws_app, tmp_path) -> None:
    """WebSocket resolves 'preset:name' to the preset's model."""
    from starlette.testclient import TestClient

    from opta_lmx.presets.manager import Preset

    engine = ws_app.state.engine
    await engine.load_model("resolved-model")

    # Register a preset
    preset = Preset(
        name="test-preset",
        model="resolved-model",
        parameters={"temperature": 0.1, "max_tokens": 100},
        system_prompt="You are a test bot.",
    )
    ws_app.state.preset_manager._presets["test-preset"] = preset

    client = TestClient(ws_app)
    with client.websocket_connect("/v1/chat/stream") as ws:
        ws.send_json({
            "type": "chat.request",
            "model": "preset:test-preset",
            "messages": [{"role": "user", "content": "Hello"}],
            "stream": False,
        })

        response = ws.receive_json()
        assert response["type"] == "chat.done"
        assert response["content"] == "Hello from WebSocket test!"


async def test_ws_preset_not_found(ws_app) -> None:
    """Unknown preset returns chat.error."""
    from starlette.testclient import TestClient

    client = TestClient(ws_app)
    with client.websocket_connect("/v1/chat/stream") as ws:
        ws.send_json({
            "type": "chat.request",
            "model": "preset:nonexistent",
            "messages": [{"role": "user", "content": "Hello"}],
        })

        response = ws.receive_json()
        assert response["type"] == "chat.error"
        assert "nonexistent" in response["error"]


# ─── Metrics Recording Tests ────────────────────────────────────────────


async def test_ws_records_metrics_non_streaming(ws_app) -> None:
    """Non-streaming WebSocket request records a RequestMetric."""
    from starlette.testclient import TestClient

    engine = ws_app.state.engine
    await engine.load_model("metrics-model")

    metrics = ws_app.state.metrics
    assert metrics._total_requests == 0

    client = TestClient(ws_app)
    with client.websocket_connect("/v1/chat/stream") as ws:
        ws.send_json({
            "type": "chat.request",
            "model": "metrics-model",
            "messages": [{"role": "user", "content": "Hello"}],
            "stream": False,
        })
        ws.receive_json()  # chat.done

    assert metrics._total_requests == 1
    assert "metrics-model" in metrics._model_requests


async def test_ws_records_metrics_streaming(ws_app) -> None:
    """Streaming WebSocket request records a RequestMetric."""
    from starlette.testclient import TestClient

    engine = ws_app.state.engine

    async def mock_create(model_id: str, use_batching: bool, **_kw: object) -> MagicMock:
        mock = MagicMock()
        mock.chat = AsyncMock(return_value="Hello")

        async def mock_stream_chat(**kwargs):
            yield "Hi"

        mock.stream_chat = mock_stream_chat
        return mock

    engine._create_engine = mock_create  # type: ignore[assignment]
    await engine.load_model("stream-metrics")

    metrics = ws_app.state.metrics
    before = metrics._total_stream_requests

    client = TestClient(ws_app)
    with client.websocket_connect("/v1/chat/stream") as ws:
        ws.send_json({
            "type": "chat.request",
            "model": "stream-metrics",
            "messages": [{"role": "user", "content": "Hello"}],
            "stream": True,
        })
        msgs = []
        while True:
            msg = ws.receive_json()
            msgs.append(msg)
            if msg["type"] in ("chat.done", "chat.error"):
                break

    assert metrics._total_stream_requests == before + 1


# ─── Tools Pass-through Tests ───────────────────────────────────────────


async def test_ws_tools_passed_to_engine(ws_app) -> None:
    """Tools parameter is extracted from WebSocket data and passed to engine."""
    from starlette.testclient import TestClient

    engine = ws_app.state.engine
    captured_kwargs: dict = {}

    async def mock_create(model_id: str, use_batching: bool, **_kw: object) -> MagicMock:
        mock = MagicMock()

        async def mock_chat(**kwargs):
            captured_kwargs.update(kwargs)
            return "Tool response"

        mock.chat = mock_chat
        return mock

    engine._create_engine = mock_create  # type: ignore[assignment]
    await engine.load_model("tools-model")

    tools = [{"type": "function", "function": {"name": "get_time", "parameters": {}}}]

    client = TestClient(ws_app)
    with client.websocket_connect("/v1/chat/stream") as ws:
        ws.send_json({
            "type": "chat.request",
            "model": "tools-model",
            "messages": [{"role": "user", "content": "What time is it?"}],
            "tools": tools,
            "stream": False,
        })

        response = ws.receive_json()
        assert response["type"] == "chat.done"
        assert captured_kwargs.get("tools") == tools
