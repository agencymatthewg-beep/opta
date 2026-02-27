"""Unit tests for MLXLM backend adapter argument mapping."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

from opta_lmx.inference.mlx_lm_backend import MLXLMBackend


@pytest.mark.asyncio
async def test_generate_uses_sampler_not_temp_kwarg() -> None:
    """Adapter should pass sampler into mlx-lm generate instead of legacy temp kwargs."""
    backend = MLXLMBackend("test/model")
    backend._model = object()
    backend._tokenizer = object()

    captured: dict[str, Any] = {}

    def fake_generate(model: Any, tokenizer: Any, **kwargs: Any) -> str:
        captured.update(kwargs)
        return "ok"

    backend._generate_fn = fake_generate

    with patch("mlx_lm.sample_utils.make_sampler", return_value="sampler") as make_sampler:
        content, prompt_tokens, completion_tokens = await backend.generate(
            messages=[{"role": "user", "content": "hello"}],
            temperature=0.7,
            max_tokens=16,
            top_p=0.95,
            stop=None,
            tools=None,
        )

    assert content == "ok"
    assert prompt_tokens >= 1
    assert completion_tokens >= 1
    make_sampler.assert_called_once_with(temp=0.7, top_p=0.95)
    assert captured["sampler"] == "sampler"
    assert "temp" not in captured
    assert "top_p" not in captured
