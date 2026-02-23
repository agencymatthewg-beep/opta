"""Tests for performance profile wiring — KV cache, speculative decoding, prefix cache."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from opta_lmx.inference.backend_policy import backend_candidates
from opta_lmx.inference.schema import ChatMessage
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.inference.types import LoadedModel
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.model_safety import CompatibilityRegistry


def _patch_simple(mock: Any) -> patch:
    """Patch sys.modules so _create_engine imports our mock SimpleEngine."""
    return patch.dict(
        "sys.modules", {"vllm_mlx.engine.simple": MagicMock(SimpleEngine=mock)},
    )


def _patch_batched(mock: Any) -> patch:
    """Patch sys.modules so _create_engine imports our mock BatchedEngine."""
    class DummySchedulerConfig:
        def __init__(self, **kwargs: Any) -> None:
            self.kwargs = kwargs

    return patch.dict(
        "sys.modules",
        {
            "vllm_mlx.engine.batched": MagicMock(BatchedEngine=mock),
            "vllm_mlx.scheduler": MagicMock(SchedulerConfig=DummySchedulerConfig),
        },
    )


@pytest.fixture
def engine() -> InferenceEngine:
    """Engine with default config (no global overrides)."""
    monitor = MemoryMonitor(max_percent=90)
    return InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)


@pytest.fixture
def engine_with_globals() -> InferenceEngine:
    """Engine with global KV + speculative config."""
    monitor = MemoryMonitor(max_percent=90)
    return InferenceEngine(
        memory_monitor=monitor,
        use_batching=False,
        warmup_on_load=False,
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
        with (
            patch(
                "opta_lmx.inference.engine.SimpleEngine", mock_simple,
                create=True,
            ),
            _patch_simple(mock_simple),
        ):
            await engine._create_engine("test/model", use_batching=False)

        mock_simple.assert_called_once()
        call_kwargs = mock_simple.call_args[1]
        assert call_kwargs.get("model_name") == "test/model"
        # No KV bits, no speculative, no prefix cache disable
        assert "kv_bits" not in call_kwargs
        assert "speculative_model" not in call_kwargs
        assert "prefix_cache" not in call_kwargs

    @pytest.mark.asyncio
    async def test_prefers_local_snapshot_path_for_cached_repo(
        self,
        engine: InferenceEngine,
        tmp_path,
    ) -> None:
        """Cached repo IDs should be passed to vllm-mlx as local snapshot paths."""
        snapshot_dir = tmp_path / "models--test--model" / "snapshots" / "abc123"
        snapshot_dir.mkdir(parents=True)
        config_file = snapshot_dir / "config.json"
        config_file.write_text("{}")

        mock_simple = MagicMock()
        with (
            _patch_simple(mock_simple),
            patch("huggingface_hub.try_to_load_from_cache", return_value=str(config_file)),
        ):
            await engine._create_engine("test/model", use_batching=False)

        call_kwargs = mock_simple.call_args[1]
        assert call_kwargs["model_name"] == str(snapshot_dir)

    @pytest.mark.asyncio
    async def test_global_kv_bits(self, engine_with_globals: InferenceEngine) -> None:
        """Global kv_bits are passed through."""
        mock_simple = MagicMock()
        with _patch_simple(mock_simple):
            await engine_with_globals._create_engine("test/model", use_batching=False)

        call_kwargs = mock_simple.call_args[1]
        assert call_kwargs["kv_bits"] == 8
        assert call_kwargs["kv_group_size"] == 64

    @pytest.mark.asyncio
    async def test_global_speculative(self, engine_with_globals: InferenceEngine) -> None:
        """Global speculative model is passed through."""
        mock_simple = MagicMock()
        with _patch_simple(mock_simple):
            await engine_with_globals._create_engine("test/model", use_batching=False)

        call_kwargs = mock_simple.call_args[1]
        assert call_kwargs["speculative_model"] == "draft-model-global"
        assert call_kwargs["num_speculative_tokens"] == 3

    @pytest.mark.asyncio
    async def test_preset_overrides_global_kv(self, engine_with_globals: InferenceEngine) -> None:
        """Preset kv_bits override global kv_bits."""
        mock_simple = MagicMock()
        with _patch_simple(mock_simple):
            await engine_with_globals._create_engine(
                "test/model", use_batching=False,
                performance_overrides={"kv_bits": 4, "kv_group_size": 32},
            )

        call_kwargs = mock_simple.call_args[1]
        assert call_kwargs["kv_bits"] == 4
        assert call_kwargs["kv_group_size"] == 32

    @pytest.mark.asyncio
    async def test_preset_overrides_global_speculative(
        self, engine_with_globals: InferenceEngine,
    ) -> None:
        """Preset speculative config overrides global."""
        mock_simple = MagicMock()
        with _patch_simple(mock_simple):
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
    async def test_preset_disables_prefix_cache(
        self, engine_with_globals: InferenceEngine,
    ) -> None:
        """Preset can disable prefix cache even if globally enabled."""
        mock_simple = MagicMock()
        with _patch_simple(mock_simple):
            await engine_with_globals._create_engine(
                "test/model", use_batching=False,
                performance_overrides={"prefix_cache": False},
            )

        call_kwargs = mock_simple.call_args[1]
        assert call_kwargs["prefix_cache"] is False

    @pytest.mark.asyncio
    async def test_batched_engine_receives_overrides(
        self, engine: InferenceEngine,
    ) -> None:
        """BatchedEngine receives performance overrides."""
        mock_batched = MagicMock()
        mock_instance = AsyncMock()
        mock_batched.return_value = mock_instance
        with _patch_batched(mock_batched):
            await engine._create_engine(
                "test/model", use_batching=True,
                performance_overrides={"kv_bits": 4},
            )

        call_kwargs = mock_batched.call_args[1]
        assert call_kwargs["kv_bits"] == 4
        mock_instance.start.assert_called_once()

    @pytest.mark.asyncio
    async def test_simple_engine_disables_unsupported_speculative_by_default(
        self, engine_with_globals: InferenceEngine,
    ) -> None:
        """Speculative request degrades to disabled when unsupported and not strict."""

        class SimpleNoSpec:
            def __init__(self, model_name: str) -> None:
                self.model_name = model_name

        with _patch_simple(SimpleNoSpec):
            _engine, status = await engine_with_globals._create_engine(
                "test/model", use_batching=False,
            )
        assert status["requested"] is True
        assert status["active"] is False
        assert status["reason"] == "backend_constructor_unsupported:SimpleEngine"

    @pytest.mark.asyncio
    async def test_simple_engine_rejects_unsupported_speculative_when_required(
        self, engine: InferenceEngine,
    ) -> None:
        """Strict mode keeps fail-closed semantics for unsupported speculative config."""

        class SimpleNoSpec:
            def __init__(self, model_name: str) -> None:
                self.model_name = model_name

        with _patch_simple(SimpleNoSpec):
            with pytest.raises(RuntimeError, match="Speculative decoding requested"):
                await engine._create_engine(
                    "test/model",
                    use_batching=False,
                    performance_overrides={
                        "speculative": {
                            "draft_model": "draft-model",
                            "num_tokens": 3,
                            "require_supported": True,
                        },
                    },
                )

    @pytest.mark.asyncio
    async def test_batched_engine_disables_unsupported_speculative_by_default(
        self, engine_with_globals: InferenceEngine,
    ) -> None:
        """Batched path degrades to disabled when speculative kwargs are unsupported."""

        class BatchedNoSpec:
            def __init__(
                self,
                model_name: str,
                trust_remote_code: bool = True,
                scheduler_config: Any | None = None,
                stream_interval: int = 1,
            ) -> None:
                self.model_name = model_name
                self.trust_remote_code = trust_remote_code
                self.scheduler_config = scheduler_config
                self.stream_interval = stream_interval

            async def start(self) -> None:
                return None

        with _patch_batched(BatchedNoSpec):
            _engine, status = await engine_with_globals._create_engine(
                "test/model", use_batching=True,
            )
        assert status["requested"] is True
        assert status["active"] is False
        assert status["reason"] == "backend_constructor_unsupported:BatchedEngine"

    @pytest.mark.asyncio
    async def test_batched_engine_rejects_unsupported_speculative_when_required(
        self, engine: InferenceEngine,
    ) -> None:
        """Strict mode fails closed on unsupported BatchedEngine speculative config."""

        class BatchedNoSpec:
            def __init__(
                self,
                model_name: str,
                trust_remote_code: bool = True,
                scheduler_config: Any | None = None,
                stream_interval: int = 1,
            ) -> None:
                self.model_name = model_name
                self.trust_remote_code = trust_remote_code
                self.scheduler_config = scheduler_config
                self.stream_interval = stream_interval

            async def start(self) -> None:
                return None

        with _patch_batched(BatchedNoSpec):
            with pytest.raises(RuntimeError, match="Speculative decoding requested"):
                await engine._create_engine(
                    "test/model",
                    use_batching=True,
                    performance_overrides={
                        "speculative": {
                            "draft_model": "draft-model",
                            "num_tokens": 3,
                            "require_supported": True,
                        },
                    },
                )

    @pytest.mark.asyncio
    async def test_memory_estimate_not_passed_to_engine(
        self, engine: InferenceEngine,
    ) -> None:
        """memory_estimate_gb from presets is NOT passed to vllm-mlx."""
        mock_simple = MagicMock()
        with _patch_simple(mock_simple):
            await engine._create_engine(
                "test/model", use_batching=False,
                performance_overrides={"memory_estimate_gb": 200, "kv_bits": 8},
            )

        call_kwargs = mock_simple.call_args[1]
        assert "memory_estimate_gb" not in call_kwargs
        assert call_kwargs["kv_bits"] == 8


class TestSpeculativeTelemetryAdapter:
    @pytest.mark.asyncio
    async def test_stream_telemetry_uses_from_draft_flag(self) -> None:
        monitor = MemoryMonitor(max_percent=90)
        engine = InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)

        class Chunk:
            def __init__(self, text: str, from_draft: bool) -> None:
                self.new_text = text
                self.from_draft = from_draft

        class StubEngine:
            async def stream_chat(self, **kwargs: Any):
                _ = kwargs
                yield Chunk("A", True)
                yield Chunk("B", False)

        engine._models["spec/model"] = LoadedModel(
            model_id="spec/model",
            engine=StubEngine(),
            speculative_requested=True,
            speculative_active=True,
            speculative_reason=None,
            speculative_draft_model="draft/model",
            speculative_num_tokens=4,
        )

        tokens: list[str] = []
        async for token in engine.stream_generate(
            model_id="spec/model",
            messages=[ChatMessage(role="user", content="hi")],
            max_tokens=2,
        ):
            tokens.append(token)

        telemetry = engine.pop_speculative_telemetry()
        assert tokens == ["A", "B"]
        assert telemetry is not None
        assert telemetry["active"] is True
        assert telemetry["accepted_tokens"] == 1
        assert telemetry["rejected_tokens"] == 1
        assert telemetry["telemetry"] == "inferred_from_flag"
        assert telemetry["acceptance_ratio"] == 0.5

    @pytest.mark.asyncio
    async def test_stream_telemetry_falls_back_to_ignored(self) -> None:
        monitor = MemoryMonitor(max_percent=90)
        engine = InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)

        class Chunk:
            def __init__(self, text: str) -> None:
                self.new_text = text

        class StubEngine:
            async def stream_chat(self, **kwargs: Any):
                _ = kwargs
                yield Chunk("A")
                yield Chunk("B")

        engine._models["spec/model"] = LoadedModel(
            model_id="spec/model",
            engine=StubEngine(),
            speculative_requested=True,
            speculative_active=True,
            speculative_reason=None,
            speculative_draft_model="draft/model",
            speculative_num_tokens=4,
        )

        tokens: list[str] = []
        async for token in engine.stream_generate(
            model_id="spec/model",
            messages=[ChatMessage(role="user", content="hi")],
            max_tokens=2,
        ):
            tokens.append(token)

        telemetry = engine.pop_speculative_telemetry()
        assert tokens == ["A", "B"]
        assert telemetry is not None
        assert telemetry["accepted_tokens"] == 0
        assert telemetry["rejected_tokens"] == 0
        assert telemetry["ignored_tokens"] == 2
        assert telemetry["telemetry"] == "unavailable"


class TestBackendPolicyFallback:
    def test_backend_policy_orders_candidates_with_optional_gguf_fallback(
        self,
        tmp_path,
    ) -> None:
        cfg = SimpleNamespace(
            backend_preference_order=["vllm-mlx", "mlx-lm"],
            gguf_fallback_enabled=True,
        )
        registry = CompatibilityRegistry(path=tmp_path / "compat-policy.json")
        assert backend_candidates("test/model", cfg, registry) == [
            "vllm-mlx",
            "mlx-lm",
            "gguf",
        ]

    def test_backend_policy_fallback_skips_latest_failed_backend(
        self,
        tmp_path,
    ) -> None:
        cfg = SimpleNamespace(
            backend_preference_order=["vllm-mlx", "mlx-lm"],
            gguf_fallback_enabled=True,
        )
        registry = CompatibilityRegistry(path=tmp_path / "compat-policy.json")
        registry.record(
            model_id="test/model",
            backend="vllm-mlx",
            backend_version_value="0.2.6",
            outcome="fail",
            reason="loader_crash",
        )
        assert backend_candidates("test/model", cfg, registry) == [
            "mlx-lm",
            "gguf",
        ]
        assert backend_candidates("test/model", cfg, registry, allow_failed=True) == [
            "vllm-mlx",
            "mlx-lm",
            "gguf",
        ]
