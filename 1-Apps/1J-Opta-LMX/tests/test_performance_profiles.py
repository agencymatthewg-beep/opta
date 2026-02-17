"""Tests for performance profile wiring — KV cache, speculative decoding, prefix cache."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.manager.memory import MemoryMonitor


@pytest.fixture
def engine() -> InferenceEngine:
    """Engine with default config (no global overrides)."""
    monitor = MemoryMonitor(max_percent=90)
    return InferenceEngine(memory_monitor=monitor, use_batching=False)


@pytest.fixture
def engine_with_globals() -> InferenceEngine:
    """Engine with global KV + speculative config."""
    monitor = MemoryMonitor(max_percent=90)
    return InferenceEngine(
        memory_monitor=monitor,
        use_batching=False,
        kv_bits=8,
        kv_group_size=64,
        prefix_cache_enabled=True,
        speculative_model="draft-model-global",
        speculative_num_tokens=3,
    )


class TestCreateEngineKwargs:
    """Verify that _create_engine passes correct kwargs to vllm-mlx."""

    @pytest.mark.asyncio
    async def test_no_overrides_no_globals(self, engine: InferenceEngine) -> None:
        """No performance config → no extra kwargs."""
        mock_simple = MagicMock()
        with patch(
            "opta_lmx.inference.engine.SimpleEngine", mock_simple,
            create=True,
        ):
            # Patch the import inside _create_engine
            with patch.dict("sys.modules", {"vllm_mlx.engine.simple": MagicMock(SimpleEngine=mock_simple)}):
                await engine._create_engine("test/model", use_batching=False)

        mock_simple.assert_called_once()
        call_kwargs = mock_simple.call_args[1]
        assert call_kwargs.get("model_name") == "test/model"
        # No KV bits, no speculative, no prefix cache disable
        assert "kv_bits" not in call_kwargs
        assert "speculative_model" not in call_kwargs
        assert "prefix_cache" not in call_kwargs

    @pytest.mark.asyncio
    async def test_global_kv_bits(self, engine_with_globals: InferenceEngine) -> None:
        """Global kv_bits are passed through."""
        mock_simple = MagicMock()
        with patch.dict("sys.modules", {"vllm_mlx.engine.simple": MagicMock(SimpleEngine=mock_simple)}):
            await engine_with_globals._create_engine("test/model", use_batching=False)

        call_kwargs = mock_simple.call_args[1]
        assert call_kwargs["kv_bits"] == 8
        assert call_kwargs["kv_group_size"] == 64

    @pytest.mark.asyncio
    async def test_global_speculative(self, engine_with_globals: InferenceEngine) -> None:
        """Global speculative model is passed through."""
        mock_simple = MagicMock()
        with patch.dict("sys.modules", {"vllm_mlx.engine.simple": MagicMock(SimpleEngine=mock_simple)}):
            await engine_with_globals._create_engine("test/model", use_batching=False)

        call_kwargs = mock_simple.call_args[1]
        assert call_kwargs["speculative_model"] == "draft-model-global"
        assert call_kwargs["num_speculative_tokens"] == 3

    @pytest.mark.asyncio
    async def test_preset_overrides_global_kv(self, engine_with_globals: InferenceEngine) -> None:
        """Preset kv_bits override global kv_bits."""
        mock_simple = MagicMock()
        with patch.dict("sys.modules", {"vllm_mlx.engine.simple": MagicMock(SimpleEngine=mock_simple)}):
            await engine_with_globals._create_engine(
                "test/model", use_batching=False,
                performance_overrides={"kv_bits": 4, "kv_group_size": 32},
            )

        call_kwargs = mock_simple.call_args[1]
        assert call_kwargs["kv_bits"] == 4
        assert call_kwargs["kv_group_size"] == 32

    @pytest.mark.asyncio
    async def test_preset_overrides_global_speculative(self, engine_with_globals: InferenceEngine) -> None:
        """Preset speculative config overrides global."""
        mock_simple = MagicMock()
        with patch.dict("sys.modules", {"vllm_mlx.engine.simple": MagicMock(SimpleEngine=mock_simple)}):
            await engine_with_globals._create_engine(
                "test/model", use_batching=False,
                performance_overrides={
                    "speculative": {"draft_model": "preset-draft", "num_tokens": 7},
                },
            )

        call_kwargs = mock_simple.call_args[1]
        assert call_kwargs["speculative_model"] == "preset-draft"
        assert call_kwargs["num_speculative_tokens"] == 7

    @pytest.mark.asyncio
    async def test_preset_disables_prefix_cache(self, engine_with_globals: InferenceEngine) -> None:
        """Preset can disable prefix cache even if globally enabled."""
        mock_simple = MagicMock()
        with patch.dict("sys.modules", {"vllm_mlx.engine.simple": MagicMock(SimpleEngine=mock_simple)}):
            await engine_with_globals._create_engine(
                "test/model", use_batching=False,
                performance_overrides={"prefix_cache": False},
            )

        call_kwargs = mock_simple.call_args[1]
        assert call_kwargs["prefix_cache"] is False

    @pytest.mark.asyncio
    async def test_batched_engine_receives_overrides(self, engine_with_globals: InferenceEngine) -> None:
        """BatchedEngine also receives performance overrides."""
        mock_batched = MagicMock()
        mock_instance = AsyncMock()
        mock_batched.return_value = mock_instance
        with patch.dict("sys.modules", {"vllm_mlx.engine.batched": MagicMock(BatchedEngine=mock_batched)}):
            await engine_with_globals._create_engine(
                "test/model", use_batching=True,
                performance_overrides={"kv_bits": 4},
            )

        call_kwargs = mock_batched.call_args[1]
        assert call_kwargs["kv_bits"] == 4
        assert call_kwargs["speculative_model"] == "draft-model-global"
        mock_instance.start.assert_called_once()

    @pytest.mark.asyncio
    async def test_memory_estimate_not_passed_to_engine(self, engine: InferenceEngine) -> None:
        """memory_estimate_gb from presets is NOT passed to vllm-mlx."""
        mock_simple = MagicMock()
        with patch.dict("sys.modules", {"vllm_mlx.engine.simple": MagicMock(SimpleEngine=mock_simple)}):
            await engine._create_engine(
                "test/model", use_batching=False,
                performance_overrides={"memory_estimate_gb": 200, "kv_bits": 8},
            )

        call_kwargs = mock_simple.call_args[1]
        assert "memory_estimate_gb" not in call_kwargs
        assert call_kwargs["kv_bits"] == 8
