"""Real MLX smoke test for Apple Silicon CI runners.

This intentionally runs against a real MLX model (no mocks) to catch:
- model load regressions
- streaming path breakage
- /v1/responses SSE contract issues with tools enabled
"""

from __future__ import annotations

import asyncio
import os
import platform
import time
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from opta_lmx.config import LMXConfig
from opta_lmx.inference.schema import ChatMessage
from opta_lmx.main import create_app

_RUN_REAL_SMOKE = os.getenv("LMX_RUN_REAL_MLX_SMOKE", "0") == "1"
_IS_APPLE_SILICON = (
    platform.system() == "Darwin"
    and platform.machine().lower() in {"arm64", "aarch64"}
)
_MODEL_ID = os.getenv(
    "LMX_MLX_SMOKE_MODEL",
    "mlx-community/SmolLM2-360M-Instruct-4bit",
)
_LOAD_TIMEOUT_SEC = float(os.getenv("LMX_MLX_SMOKE_TIMEOUT_SEC", "1800"))

_REAL_SMOKE_SKIP_REASON = (
    "Real MLX smoke is only enabled when "
    "LMX_RUN_REAL_MLX_SMOKE=1 on Apple Silicon."
)


async def _collect_with_timeout(stream: AsyncIterator[str], timeout_sec: float) -> str:
    chunks: list[str] = []

    async def _consume() -> None:
        async for token in stream:
            if token:
                chunks.append(token)
            if len("".join(chunks)) >= 24:
                break

    await asyncio.wait_for(_consume(), timeout=timeout_sec)
    return "".join(chunks).strip()


@pytest.mark.asyncio
@pytest.mark.skipif(
    not (_RUN_REAL_SMOKE and _IS_APPLE_SILICON),
    reason=_REAL_SMOKE_SKIP_REASON,
)
async def test_real_mlx_end_to_end_smoke() -> None:
    """Load a real MLX model, run generation + streaming, and validate Responses SSE."""
    app = create_app(LMXConfig())

    async with app.router.lifespan_context(app):
        engine = app.state.engine
        load_started = time.monotonic()
        info = await asyncio.wait_for(
            engine.load_model(_MODEL_ID),
            timeout=_LOAD_TIMEOUT_SEC,
        )
        assert info.loaded is True
        assert engine.is_model_loaded(_MODEL_ID)
        assert (time.monotonic() - load_started) > 0

        non_stream = await asyncio.wait_for(
            engine.generate(
                model_id=_MODEL_ID,
                messages=[ChatMessage(role="user", content="Reply with two short words.")],
                temperature=0.0,
                max_tokens=24,
            ),
            timeout=180,
        )
        text = (non_stream.choices[0].message.content or "").strip()
        assert text
        assert non_stream.usage.total_tokens > 0

        stream_text = await _collect_with_timeout(
            engine.stream_generate(
                model_id=_MODEL_ID,
                messages=[ChatMessage(role="user", content="Count from one to four.")],
                temperature=0.0,
                max_tokens=32,
            ),
            timeout_sec=180,
        )
        assert stream_text

        events: list[str] = []
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            async with client.stream(
                "POST",
                "/v1/responses",
                json={
                    "model": _MODEL_ID,
                    "input": "What is the weather in San Francisco? Use a tool if appropriate.",
                    "stream": True,
                    "tools": [
                        {
                            "type": "function",
                            "function": {
                                "name": "get_weather",
                                "description": "Return weather for a location",
                                "parameters": {
                                    "type": "object",
                                    "properties": {
                                        "location": {"type": "string"},
                                    },
                                    "required": ["location"],
                                },
                            },
                        }
                    ],
                },
            ) as response:
                assert response.status_code == 200
                async for line in response.aiter_lines():
                    if line.startswith("event: "):
                        events.append(line.removeprefix("event: ").strip())
                    elif line.strip() == "data: [DONE]":
                        break

        assert "response.created" in events
        assert "response.completed" in events
        if "response.function_call_arguments.delta" in events:
            assert "response.output_item.added" in events
            assert "response.function_call_arguments.done" in events

        await engine.unload_model(_MODEL_ID)
        assert not engine.is_model_loaded(_MODEL_ID)


def test_mlx_lm_backend_adapter_symbol_exists() -> None:
    from opta_lmx.inference.mlx_lm_backend import MLXLMBackend

    assert MLXLMBackend is not None
