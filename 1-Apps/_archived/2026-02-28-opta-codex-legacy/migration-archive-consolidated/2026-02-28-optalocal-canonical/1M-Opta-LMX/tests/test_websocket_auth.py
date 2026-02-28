from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from opta_lmx.config import LMXConfig, RoutingConfig
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.main import create_app
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.monitoring.events import EventBus
from opta_lmx.monitoring.metrics import MetricsCollector
from opta_lmx.presets.manager import PresetManager
from opta_lmx.router.strategy import TaskRouter


def _build_app_with_ws_key(tmp_path) -> object:
    config = LMXConfig(security={"inference_api_key": "test-key"})
    app = create_app(config)

    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)

    async def mock_create(model_id: str, use_batching: bool, **_kw: object) -> MagicMock:
        mock = MagicMock()
        mock.chat = AsyncMock(return_value="ok")
        return mock

    async def mock_create_tuple(model_id: str, use_batching: bool, **_kw: object) -> tuple:
        mock = MagicMock()
        mock.chat = AsyncMock(return_value="ok")
        return mock, {}

    engine._create_engine = mock_create  # type: ignore[assignment]
    engine._lifecycle._create_engine = mock_create_tuple  # type: ignore[assignment]
    engine._lifecycle._run_load_canary = AsyncMock()  # type: ignore[assignment]

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
    app.state.inference_api_key = "test-key"

    return app


def test_websocket_requires_api_key(tmp_path) -> None:
    app = _build_app_with_ws_key(tmp_path)
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect), client.websocket_connect("/v1/chat/stream"):
        pass


def test_websocket_accepts_api_key_query(tmp_path) -> None:
    app = _build_app_with_ws_key(tmp_path)
    client = TestClient(app)
    with client.websocket_connect("/v1/chat/stream?api_key=test-key"):
        pass
