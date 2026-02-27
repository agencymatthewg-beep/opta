"""Tests for /v1/embeddings endpoint."""

from __future__ import annotations

from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from opta_lmx.config import LMXConfig
from opta_lmx.inference.embedding_engine import EmbeddingEngine
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.main import create_app
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.manager.model import ModelManager
from opta_lmx.monitoring.events import EventBus
from opta_lmx.monitoring.metrics import MetricsCollector
from opta_lmx.presets.manager import PresetManager
from opta_lmx.router.strategy import TaskRouter


@pytest.fixture
async def embedding_client(
    mock_engine: InferenceEngine,
    mock_model_manager: ModelManager,
    tmp_path,
) -> AsyncIterator[AsyncClient]:
    """Test client with a mock embedding engine."""
    config = LMXConfig()
    app = create_app(config)

    embedding_engine = EmbeddingEngine()
    # Mock the embed method to return fake vectors
    embedding_engine.embed = AsyncMock(  # type: ignore[method-assign]
        return_value=[[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
    )
    embedding_engine._model_id = "test-embedding-model"
    embedding_engine._model = True  # Mark as loaded

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        app.state.engine = mock_engine
        app.state.embedding_engine = embedding_engine
        app.state.memory_monitor = MemoryMonitor(max_percent=90)
        app.state.model_manager = mock_model_manager
        app.state.router = TaskRouter(config.routing)
        app.state.metrics = MetricsCollector()
        app.state.preset_manager = PresetManager(tmp_path / "presets")
        app.state.event_bus = EventBus()
        app.state.pending_downloads = {}
        app.state.start_time = 0.0
        app.state.admin_key = None
        app.state.config = config
        yield client


async def test_embeddings_single_text(embedding_client: AsyncClient) -> None:
    """Single text input returns embedding array."""
    response = await embedding_client.post("/v1/embeddings", json={
        "input": "Hello world",
        "model": "test-embedding-model",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["object"] == "list"
    assert len(data["data"]) == 2  # Mock returns 2 vectors
    assert data["data"][0]["object"] == "embedding"
    assert data["data"][0]["index"] == 0
    assert isinstance(data["data"][0]["embedding"], list)
    assert data["model"] == "test-embedding-model"
    assert "usage" in data
    assert data["usage"]["prompt_tokens"] > 0


async def test_embeddings_multiple_texts(embedding_client: AsyncClient) -> None:
    """Multiple text inputs return multiple embeddings."""
    response = await embedding_client.post("/v1/embeddings", json={
        "input": ["Hello", "World"],
        "model": "test-embedding-model",
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 2
    assert data["data"][0]["index"] == 0
    assert data["data"][1]["index"] == 1


async def test_embeddings_empty_input(embedding_client: AsyncClient) -> None:
    """Empty input list returns 400."""
    response = await embedding_client.post("/v1/embeddings", json={
        "input": [],
        "model": "test-embedding-model",
    })
    assert response.status_code == 400


async def test_embeddings_no_engine(
    mock_engine: InferenceEngine,
    mock_model_manager: ModelManager,
    tmp_path,
) -> None:
    """Returns 503 when no embedding engine is available."""
    config = LMXConfig()
    app = create_app(config)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        app.state.engine = mock_engine
        # Deliberately NOT setting embedding_engine
        app.state.embedding_engine = None
        app.state.memory_monitor = MemoryMonitor(max_percent=90)
        app.state.model_manager = mock_model_manager
        app.state.router = TaskRouter(config.routing)
        app.state.metrics = MetricsCollector()
        app.state.preset_manager = PresetManager(tmp_path / "presets")
        app.state.event_bus = EventBus()
        app.state.pending_downloads = {}
        app.state.start_time = 0.0
        app.state.admin_key = None
        app.state.config = config

        response = await client.post("/v1/embeddings", json={
            "input": "Hello",
            "model": "test-model",
        })
        assert response.status_code == 503


# ─── EmbeddingEngine Unit Tests ────────────────────────────────────────────


def test_embedding_engine_initial_state() -> None:
    """New engine has no model loaded."""
    engine = EmbeddingEngine()
    assert not engine.is_loaded
    assert engine.model_id is None


def test_embedding_engine_info() -> None:
    """Info returns expected structure."""
    engine = EmbeddingEngine()
    info = engine.get_info()
    assert info["model_id"] is None
    assert info["loaded"] is False
    assert info["loaded_at"] is None
