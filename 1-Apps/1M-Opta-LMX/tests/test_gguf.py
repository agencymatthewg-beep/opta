"""Tests for Feature 1: GGUF Fallback Engine."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from opta_lmx.inference.engine import (
    InferenceEngine,
    ModelRuntimeCompatibilityError,
    _detect_format,
    _detect_runtime_incompatibility,
)
from opta_lmx.inference.gguf_resolver import resolve_local_gguf_equivalents
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.model_safety import ErrorCodes
from opta_lmx.runtime.child_loader_supervisor import LoaderSupervisorOutcome
from opta_lmx.runtime.loader_protocol import LoaderFailure

# ─── Unit Tests: Format Detection ─────────────────────────────────────────


def test_detect_format_mlx_default() -> None:
    """Default format is MLX for standard HF model IDs."""
    assert _detect_format("mlx-community/Qwen2.5-32B-4bit") == "mlx"


def test_detect_format_mlx_arbitrary_name() -> None:
    """Arbitrary model names without GGUF markers default to MLX."""
    assert _detect_format("my-model") == "mlx"
    assert _detect_format("TheBloke/Mistral-7B-Instruct") == "mlx"


def test_detect_format_gguf_file_extension() -> None:
    """Files ending in .gguf are detected as GGUF."""
    assert _detect_format("/models/llama-7b-q4_0.gguf") == "gguf"
    assert _detect_format("model.gguf") == "gguf"


def test_detect_format_gguf_in_repo_name() -> None:
    """Repo names containing 'gguf' or 'GGUF' are detected as GGUF."""
    assert _detect_format("TheBloke/Mistral-7B-GGUF") == "gguf"
    assert _detect_format("user/model-gguf-q4") == "gguf"
    assert _detect_format("TheBloke/Llama-2-7B-Chat-GGUF") == "gguf"


def test_detect_format_gguf_case_insensitive() -> None:
    """GGUF detection is case-insensitive."""
    assert _detect_format("repo/Gguf-Model") == "gguf"
    assert _detect_format("repo/model-GGuF") == "gguf"


def test_detect_runtime_incompatibility_for_glm_signature() -> None:
    """glm_moe_dsa signatures are flagged as runtime-incompatible."""
    with (
        patch(
            "opta_lmx.inference.engine._load_model_config",
            return_value={
                "model_type": "glm_moe_dsa",
                "architectures": ["GlmMoeDsaForCausalLM"],
            },
        ),
        patch(
            "opta_lmx.inference.engine._runtime_backend_versions",
            return_value={"vllm-mlx": "0.2.6", "mlx-lm": "0.30.7"},
        ),
    ):
        issue = _detect_runtime_incompatibility("inferencerlabs/GLM-5-MLX-4.8bit")

    assert issue is not None
    assert issue["matched_signature"] == "glm_moe_dsa"
    assert issue["runtime_versions"]["vllm-mlx"] == "0.2.6"


@pytest.mark.asyncio
async def test_engine_blocks_incompatible_model_by_default() -> None:
    """Known-incompatible signatures should fail before engine bring-up."""
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)
    create_engine = AsyncMock(return_value=MagicMock())
    engine._create_engine = create_engine  # type: ignore[assignment]

    with patch(
        "opta_lmx.inference.engine._detect_runtime_incompatibility",
        return_value={
            "matched_signature": "glm_moe_dsa",
            "model_type": "glm_moe_dsa",
            "architectures": ["GlmMoeDsaForCausalLM"],
            "runtime_versions": {"vllm-mlx": "0.2.6", "mlx-lm": "0.30.7"},
        },
    ):
        with pytest.raises(ModelRuntimeCompatibilityError):
            await engine.load_model("inferencerlabs/GLM-5-MLX-4.8bit")

    create_engine.assert_not_awaited()


@pytest.mark.asyncio
async def test_engine_allows_incompatible_model_with_override() -> None:
    """Explicit override should permit load attempts for debugging."""
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)
    fake_engine = MagicMock()
    fake_engine.chat = AsyncMock(return_value="OK")
    create_engine = AsyncMock(return_value=(fake_engine, {"requested": False, "active": False}))
    engine._create_engine = create_engine  # type: ignore[assignment]

    with patch(
        "opta_lmx.inference.engine._detect_runtime_incompatibility",
        return_value={
            "matched_signature": "glm_moe_dsa",
            "model_type": "glm_moe_dsa",
            "architectures": ["GlmMoeDsaForCausalLM"],
            "runtime_versions": {"vllm-mlx": "0.2.6", "mlx-lm": "0.30.7"},
        },
    ):
        info = await engine.load_model(
            "inferencerlabs/GLM-5-MLX-4.8bit",
            allow_unsupported_runtime=True,
        )

    assert info.loaded is True
    create_engine.assert_awaited_once()


# ─── Unit Tests: GGUFBackend ──────────────────────────────────────────────


class TestGGUFBackend:
    """Test GGUFBackend with a mock Llama class."""

    @pytest.fixture
    def mock_llama(self) -> MagicMock:
        """Create a mock Llama instance."""
        llama = MagicMock()
        llama.create_chat_completion.return_value = {
            "choices": [{"message": {"content": "Hello from GGUF!"}}],
            "usage": {"prompt_tokens": 5, "completion_tokens": 4},
        }
        return llama

    async def test_generate_returns_content_and_tokens(self, mock_llama: MagicMock) -> None:
        """generate() returns content and token counts from llama-cpp-python."""
        with patch.dict("sys.modules", {"llama_cpp": MagicMock()}):
            from opta_lmx.inference.gguf_backend import GGUFBackend

            backend = GGUFBackend.__new__(GGUFBackend)
            backend._llm = mock_llama

            content, prompt_tokens, completion_tokens = await backend.generate(
                messages=[{"role": "user", "content": "Hi"}],
                temperature=0.7,
                max_tokens=100,
                top_p=1.0,
                stop=None,
                tools=None,
            )

            assert content == "Hello from GGUF!"
            assert prompt_tokens == 5
            assert completion_tokens == 4

    async def test_generate_passes_stop_sequences(self, mock_llama: MagicMock) -> None:
        """generate() passes stop sequences to llama-cpp-python."""
        with patch.dict("sys.modules", {"llama_cpp": MagicMock()}):
            from opta_lmx.inference.gguf_backend import GGUFBackend

            backend = GGUFBackend.__new__(GGUFBackend)
            backend._llm = mock_llama

            await backend.generate(
                messages=[{"role": "user", "content": "Hi"}],
                temperature=0.7,
                max_tokens=100,
                top_p=1.0,
                stop=["```"],
                tools=None,
            )

            call_kwargs = mock_llama.create_chat_completion.call_args[1]
            assert call_kwargs["stop"] == ["```"]

    async def test_stream_yields_tokens(self) -> None:
        """stream() yields individual tokens from llama-cpp-python streaming."""
        mock_llama = MagicMock()
        chunks = [
            {"choices": [{"delta": {"content": "Hello"}}]},
            {"choices": [{"delta": {"content": " world"}}]},
            {"choices": [{"delta": {}}]},  # empty delta at end
        ]
        mock_llama.create_chat_completion.return_value = iter(chunks)

        with patch.dict("sys.modules", {"llama_cpp": MagicMock()}):
            from opta_lmx.inference.gguf_backend import GGUFBackend

            backend = GGUFBackend.__new__(GGUFBackend)
            backend._llm = mock_llama

            tokens = []
            async for token in backend.stream(
                messages=[{"role": "user", "content": "Hi"}],
                temperature=0.7,
                max_tokens=100,
                top_p=1.0,
                stop=None,
                tools=None,
            ):
                tokens.append(token)

            assert tokens == ["Hello", " world"]

    def test_close_deletes_llm(self) -> None:
        """close() removes the Llama instance."""
        with patch.dict("sys.modules", {"llama_cpp": MagicMock()}):
            from opta_lmx.inference.gguf_backend import GGUFBackend

            backend = GGUFBackend.__new__(GGUFBackend)
            backend._llm = MagicMock()
            backend.close()
            assert not hasattr(backend, "_llm")

    def test_import_error_without_llama_cpp(self) -> None:
        """GGUFBackend raises ImportError when llama-cpp-python is missing."""
        import importlib
        import sys

        # Force import machinery to treat llama_cpp as missing.
        original = sys.modules.get("llama_cpp")
        had_llama_cpp = "llama_cpp" in sys.modules
        sys.modules["llama_cpp"] = None
        try:
            import opta_lmx.inference.gguf_backend as mod
            importlib.reload(mod)

            with pytest.raises(ImportError, match="llama-cpp-python"):
                mod.GGUFBackend(model_path="/fake.gguf")
        finally:
            if had_llama_cpp:
                sys.modules["llama_cpp"] = original
            else:
                sys.modules.pop("llama_cpp", None)


# ─── Integration Tests: Engine with GGUF ──────────────────────────────────


async def test_engine_loads_gguf_model(tmp_path: Path) -> None:
    """InferenceEngine detects GGUF format and uses GGUFBackend."""
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)

    mock_backend = MagicMock()
    mock_backend.generate = AsyncMock(return_value=("OK", 1, 1))

    with patch(
        "opta_lmx.inference.gguf_backend.GGUFBackend", return_value=mock_backend
    ):
        fake_gguf = str(tmp_path / "model.gguf")
        info = await engine.load_model(fake_gguf)

        assert info.loaded is True
        assert engine.is_model_loaded(fake_gguf)

        loaded = engine._models[fake_gguf]
        assert loaded.backend_type == "gguf"
        assert loaded.backend is mock_backend
        assert loaded.engine is None  # No vllm-mlx engine for GGUF


async def test_engine_unload_gguf_calls_close(tmp_path: Path) -> None:
    """Unloading a GGUF model calls backend.close()."""
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)

    mock_backend = MagicMock()
    mock_backend.generate = AsyncMock(return_value=("OK", 1, 1))

    with patch(
        "opta_lmx.inference.gguf_backend.GGUFBackend", return_value=mock_backend
    ):
        fake_gguf = str(tmp_path / "model.gguf")
        await engine.load_model(fake_gguf)
        await engine.unload_model(fake_gguf)

        mock_backend.close.assert_called_once()
        assert not engine.is_model_loaded(fake_gguf)


async def test_engine_gguf_generate_delegates_to_backend(tmp_path: Path) -> None:
    """generate() delegates to GGUF backend for GGUF models."""
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)

    mock_backend = MagicMock()
    mock_backend.generate = AsyncMock(
        side_effect=[
            ("OK", 1, 1),  # load-time canary
            ("GGUF response", 10, 5),  # explicit generate() request
        ],
    )

    with patch(
        "opta_lmx.inference.gguf_backend.GGUFBackend", return_value=mock_backend
    ):
        fake_gguf = str(tmp_path / "model.gguf")
        await engine.load_model(fake_gguf)

        from opta_lmx.inference.schema import ChatMessage
        response = await engine.generate(
            model_id=fake_gguf,
            messages=[ChatMessage(role="user", content="Hello")],
        )

        assert response.choices[0].message.content == "GGUF response"
        assert response.usage.prompt_tokens == 10
        assert response.usage.completion_tokens == 5
        assert mock_backend.generate.await_count == 2


async def test_engine_gguf_stream_delegates_to_backend(tmp_path: Path) -> None:
    """stream_generate() delegates to GGUF backend for GGUF models."""
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)

    async def mock_stream(*args, **kwargs):
        for token in ["Hello", " from", " GGUF"]:
            yield token

    mock_backend = MagicMock()
    mock_backend.generate = AsyncMock(return_value=("OK", 1, 1))
    mock_backend.stream = mock_stream

    with patch(
        "opta_lmx.inference.gguf_backend.GGUFBackend", return_value=mock_backend
    ):
        fake_gguf = str(tmp_path / "model.gguf")
        await engine.load_model(fake_gguf)

        from opta_lmx.inference.schema import ChatMessage
        tokens = []
        async for token in engine.stream_generate(
            model_id=fake_gguf,
            messages=[ChatMessage(role="user", content="Hello")],
        ):
            tokens.append(token)

        assert tokens == ["Hello", " from", " GGUF"]


# ─── Config Tests ────────────────────────────────────────────────────────


def test_gguf_config_defaults() -> None:
    """ModelsConfig has GGUF config fields with proper defaults."""
    from opta_lmx.config import ModelsConfig

    config = ModelsConfig()
    assert config.gguf_context_length == 4096
    assert config.gguf_gpu_layers == -1


def test_gguf_config_custom_values() -> None:
    """ModelsConfig accepts custom GGUF values."""
    from opta_lmx.config import ModelsConfig

    config = ModelsConfig(gguf_context_length=8192, gguf_gpu_layers=32)
    assert config.gguf_context_length == 8192
    assert config.gguf_gpu_layers == 32


def test_loader_isolation_config_defaults() -> None:
    """ModelsConfig exposes loader isolation controls for crash-safe bring-up."""
    from opta_lmx.config import ModelsConfig

    config = ModelsConfig()
    assert config.loader_isolation_enabled is True
    assert config.loader_timeout_sec == 120


@pytest.mark.asyncio
async def test_loader_supervisor_failure_stops_inprocess_load_and_marks_failure() -> None:
    """Loader supervisor failures should abort before in-process engine creation."""
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)
    create_engine = AsyncMock(return_value=MagicMock())
    engine._create_engine = create_engine  # type: ignore[assignment]

    failure = LoaderFailure(
        code=ErrorCodes.MODEL_LOADER_CRASHED,
        message="Child loader crashed with signal 6",
        signal=6,
    )
    with patch(
        "opta_lmx.inference.engine.run_loader_supervisor",
        AsyncMock(return_value=LoaderSupervisorOutcome(ok=False, failure=failure)),
    ), patch(
        "opta_lmx.inference.engine.backend_candidates",
        return_value=["vllm-mlx"],
    ):
        with pytest.raises(RuntimeError, match=ErrorCodes.MODEL_LOADER_CRASHED):
            await engine.load_model("test/model-loader-fail")

    create_engine.assert_not_awaited()


def test_gguf_equivalence_resolver_finds_local_candidate_by_name_pattern(tmp_path: Path) -> None:
    local_gguf = tmp_path / "MiniMax-M2.5-4bit-Q4_K_M.gguf"
    local_gguf.write_text("gguf")

    resolved = resolve_local_gguf_equivalents(
        "mlx-community/MiniMax-M2.5-4bit",
        search_roots=[tmp_path],
    )
    assert str(local_gguf) in resolved


def test_gguf_equivalence_resolver_disabled_by_default() -> None:
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)
    assert engine._gguf_fallback_enabled is False  # noqa: SLF001 - test default policy wiring
