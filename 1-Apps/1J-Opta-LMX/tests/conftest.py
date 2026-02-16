"""Pytest fixtures for Opta-LMX tests."""

from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from opta_lmx.config import LMXConfig, RoutingConfig
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.inference.types import DownloadTask, ModelInfo
from opta_lmx.main import create_app
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.manager.model import ModelManager
from opta_lmx.monitoring.events import EventBus
from opta_lmx.monitoring.metrics import MetricsCollector
from opta_lmx.presets.manager import PresetManager
from opta_lmx.router.strategy import TaskRouter


@pytest.fixture
def config() -> LMXConfig:
    """Default test configuration."""
    return LMXConfig()


@pytest.fixture
def memory_monitor() -> MemoryMonitor:
    """Real memory monitor (uses actual system memory)."""
    return MemoryMonitor(max_percent=90)


@pytest.fixture
def mock_engine() -> InferenceEngine:
    """Mock inference engine that doesn't require MLX hardware."""
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False)

    # Patch _create_engine to avoid importing vllm-mlx
    async def mock_create(model_id: str, use_batching: bool) -> MagicMock:
        mock = MagicMock()
        mock.chat = MagicMock(return_value="Hello! I'm a test response.")
        return mock

    engine._create_engine = mock_create  # type: ignore[assignment]
    return engine


@pytest.fixture
def mock_model_manager(tmp_path: Path) -> ModelManager:
    """Mock model manager using a temp directory.

    is_model_available() always returns True so load tests
    don't trigger the auto-download flow.
    """
    manager = ModelManager(models_directory=tmp_path)

    async def _always_available(model_id: str) -> bool:
        return True

    manager.is_model_available = _always_available  # type: ignore[assignment]
    return manager


async def _make_test_client(
    mock_engine: InferenceEngine,
    mock_model_manager: ModelManager,
    tmp_path: Path,
    *,
    admin_key: str | None = None,
) -> AsyncIterator[AsyncClient]:
    """Shared test client factory — injects mock services into app state."""
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
        test_app.state.admin_key = admin_key
        test_app.state.config = LMXConfig()
        yield http_client


@pytest.fixture
async def client(
    mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
) -> AsyncIterator[AsyncClient]:
    """Test HTTP client with mocked engine (no auth)."""
    async for c in _make_test_client(mock_engine, mock_model_manager, tmp_path):
        yield c


@pytest.fixture
async def client_with_auth(
    mock_engine: InferenceEngine, mock_model_manager: ModelManager, tmp_path: Path,
) -> AsyncIterator[AsyncClient]:
    """Test HTTP client with admin key authentication enabled."""
    async for c in _make_test_client(
        mock_engine, mock_model_manager, tmp_path, admin_key="test-secret-key"
    ):
        yield c
