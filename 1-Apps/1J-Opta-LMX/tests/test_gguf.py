"""Tests for Feature 1: GGUF Fallback Engine."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from opta_lmx.inference.engine import InferenceEngine, _detect_format
from opta_lmx.manager.memory import MemoryMonitor


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
        import sys

        # Temporarily remove llama_cpp from modules if present
        original = sys.modules.pop("llama_cpp", None)
        try:
            # Force fresh import
            import importlib
            import opta_lmx.inference.gguf_backend as mod
            importlib.reload(mod)

            with pytest.raises(ImportError, match="llama-cpp-python"):
                mod.GGUFBackend(model_path="/fake.gguf")
        finally:
            if original is not None:
                sys.modules["llama_cpp"] = original


# ─── Integration Tests: Engine with GGUF ──────────────────────────────────


async def test_engine_loads_gguf_model(tmp_path: Path) -> None:
    """InferenceEngine detects GGUF format and uses GGUFBackend."""
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False)

    mock_backend = MagicMock()

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
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False)

    mock_backend = MagicMock()

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
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False)

    mock_backend = MagicMock()
    mock_backend.generate = AsyncMock(return_value=("GGUF response", 10, 5))

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
        mock_backend.generate.assert_called_once()


async def test_engine_gguf_stream_delegates_to_backend(tmp_path: Path) -> None:
    """stream_generate() delegates to GGUF backend for GGUF models."""
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False)

    async def mock_stream(*args, **kwargs):
        for token in ["Hello", " from", " GGUF"]:
            yield token

    mock_backend = MagicMock()
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
