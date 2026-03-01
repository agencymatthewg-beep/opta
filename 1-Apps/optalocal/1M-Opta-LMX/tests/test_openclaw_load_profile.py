"""OpenClaw-style multi-bot load profile tests."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.inference.schema import ChatMessage
from opta_lmx.manager.memory import MemoryMonitor


async def test_openclaw_load_profile_six_clients() -> None:
    """Six clients should complete concurrent runs under fairness and model caps."""
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(
        memory_monitor=monitor,
        use_batching=False,
        max_concurrent_requests=4,
        per_client_default_concurrency=1,
        per_model_concurrency_limits={"test/model-a": 2},
        semaphore_timeout_sec=10.0,
        warmup_on_load=False,
        adaptive_concurrency_enabled=False,
    )

    async def mock_create(model_id: str, use_batching: bool, **_kw: object) -> MagicMock:
        mock = MagicMock()
        mock.chat = AsyncMock(return_value="test response")
        return mock

    async def mock_create_tuple(model_id: str, use_batching: bool, **_kw: object) -> tuple:
        mock = MagicMock()
        mock.chat = AsyncMock(return_value="test response")
        return mock, {}

    engine._create_engine = mock_create  # type: ignore[assignment]
    engine._lifecycle._create_engine = mock_create_tuple  # type: ignore[assignment]
    engine._lifecycle._run_load_canary = AsyncMock()  # type: ignore[assignment]
    await engine.load_model("test/model-a")

    async def slow_generate(*args: object, **kwargs: object) -> tuple[str, int, int, dict]:
        await asyncio.sleep(0.05)
        return "response", 6, 3, {}

    engine._generator._do_generate = slow_generate  # type: ignore[assignment]

    clients = [f"bot-{index}" for index in range(6)]
    messages = [ChatMessage(role="user", content="run load profile")]
    completions: dict[str, int] = {client: 0 for client in clients}

    async def _run(client_id: str) -> None:
        await engine.generate("test/model-a", messages, client_id=client_id)
        completions[client_id] += 1

    tasks = [asyncio.create_task(_run(client_id)) for client_id in clients for _ in range(2)]
    await asyncio.gather(*tasks)

    assert all(count == 2 for count in completions.values())
    assert engine.waiting_queue_count == 0
