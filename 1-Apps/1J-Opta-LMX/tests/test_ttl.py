"""Tests for TTL auto-unload of idle models."""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, MagicMock

import pytest

from opta_lmx.config import MemoryConfig
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.manager.memory import MemoryMonitor


@pytest.fixture
def ttl_engine() -> InferenceEngine:
    """Engine with mocked model loading for TTL tests."""
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False)

    async def mock_create(model_id: str, use_batching: bool) -> MagicMock:
        mock = MagicMock()
        mock.chat = AsyncMock(return_value="test")
        return mock

    engine._create_engine = mock_create  # type: ignore[assignment]
    return engine


class TestTTLEviction:
    """Tests for InferenceEngine.evict_idle_models()."""

    @pytest.mark.asyncio
    async def test_evicts_idle_model(self, ttl_engine: InferenceEngine) -> None:
        """Models idle longer than TTL are evicted."""
        await ttl_engine.load_model("idle-model")

        # Set last_used_at to 2 hours ago
        loaded = ttl_engine.get_model("idle-model")
        loaded.last_used_at = time.time() - 7200

        evicted = await ttl_engine.evict_idle_models(ttl_seconds=3600)

        assert "idle-model" in evicted
        assert not ttl_engine.is_model_loaded("idle-model")

    @pytest.mark.asyncio
    async def test_keeps_active_model(self, ttl_engine: InferenceEngine) -> None:
        """Recently used models are not evicted."""
        await ttl_engine.load_model("active-model")

        # Set last_used_at to 10 seconds ago (well within TTL)
        loaded = ttl_engine.get_model("active-model")
        loaded.last_used_at = time.time() - 10

        evicted = await ttl_engine.evict_idle_models(ttl_seconds=3600)

        assert evicted == []
        assert ttl_engine.is_model_loaded("active-model")

    @pytest.mark.asyncio
    async def test_evicts_only_idle_models(self, ttl_engine: InferenceEngine) -> None:
        """Only idle models are evicted; active ones are retained."""
        await ttl_engine.load_model("idle-model")
        await ttl_engine.load_model("active-model")

        idle = ttl_engine.get_model("idle-model")
        idle.last_used_at = time.time() - 7200

        active = ttl_engine.get_model("active-model")
        active.last_used_at = time.time() - 10

        evicted = await ttl_engine.evict_idle_models(ttl_seconds=3600)

        assert "idle-model" in evicted
        assert "active-model" not in evicted
        assert ttl_engine.is_model_loaded("active-model")

    @pytest.mark.asyncio
    async def test_no_models_returns_empty(self, ttl_engine: InferenceEngine) -> None:
        """No loaded models returns empty eviction list."""
        evicted = await ttl_engine.evict_idle_models(ttl_seconds=3600)
        assert evicted == []


class TestTTLConfig:
    """Tests for TTL configuration defaults."""

    def test_defaults(self) -> None:
        """MemoryConfig TTL defaults are sensible."""
        config = MemoryConfig()
        assert config.ttl_enabled is False
        assert config.ttl_seconds == 3600
        assert config.ttl_check_interval_sec == 60

    def test_custom_values(self) -> None:
        """Custom TTL values are accepted."""
        config = MemoryConfig(ttl_enabled=True, ttl_seconds=1800, ttl_check_interval_sec=30)
        assert config.ttl_enabled is True
        assert config.ttl_seconds == 1800
        assert config.ttl_check_interval_sec == 30

    def test_minimum_ttl_seconds(self) -> None:
        """TTL seconds must be >= 60."""
        with pytest.raises(Exception):
            MemoryConfig(ttl_seconds=30)

    def test_minimum_check_interval(self) -> None:
        """Check interval must be >= 10."""
        with pytest.raises(Exception):
            MemoryConfig(ttl_check_interval_sec=5)
