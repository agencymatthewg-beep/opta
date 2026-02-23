"""Performance regression gate for OpenClaw-style concurrent load."""

from __future__ import annotations

import asyncio
import os
import time
from unittest.mock import AsyncMock, MagicMock

import pytest

from opta_lmx.inference.autotune_scoring import score_profile
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.inference.schema import ChatMessage
from opta_lmx.manager.memory import MemoryMonitor


def _p95(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, int((len(ordered) - 1) * 0.95))
    return ordered[index]


def assert_tuned_profile_regression_within_gate(
    baseline: dict[str, float],
    current: dict[str, float],
    *,
    max_drop_ratio: float = 0.15,
) -> None:
    """Fail if tuned profile throughput regresses beyond allowed ratio."""
    baseline_tps = float(baseline.get("avg_tokens_per_second", 0.0) or 0.0)
    current_tps = float(current.get("avg_tokens_per_second", 0.0) or 0.0)
    assert baseline_tps > 0.0, "Baseline avg_tokens_per_second must be > 0"
    drop_ratio = (baseline_tps - current_tps) / baseline_tps
    assert drop_ratio <= max_drop_ratio, (
        f"Tuned profile regression exceeded gate: "
        f"baseline={baseline_tps:.2f} current={current_tps:.2f} "
        f"drop={drop_ratio * 100:.2f}% allowed={max_drop_ratio * 100:.2f}%"
    )


async def test_openclaw_perf_regression_gate() -> None:
    """Guard p95 latency and throughput for a 6-client profile."""
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(
        memory_monitor=monitor,
        use_batching=False,
        max_concurrent_requests=4,
        per_client_default_concurrency=1,
        per_model_concurrency_limits={"test/model-a": 2},
        semaphore_timeout_sec=2.0,
        warmup_on_load=False,
        adaptive_concurrency_enabled=False,
    )

    async def mock_create(model_id: str, use_batching: bool, **_kw: object) -> MagicMock:
        mock = MagicMock()
        mock.chat = AsyncMock(return_value="test response")
        return mock

    engine._create_engine = mock_create  # type: ignore[assignment]
    await engine.load_model("test/model-a")

    async def fixed_cost_generate(*args: object, **kwargs: object) -> tuple[str, int, int, dict]:
        await asyncio.sleep(0.02)
        return "response", 8, 4, {}

    engine._do_generate = fixed_cost_generate  # type: ignore[assignment]
    clients = [f"bot-{index}" for index in range(6)]
    messages = [ChatMessage(role="user", content="perf gate")]
    latencies: list[float] = []

    async def _run(client_id: str) -> None:
        started = time.perf_counter()
        await engine.generate("test/model-a", messages, client_id=client_id)
        latencies.append(time.perf_counter() - started)

    tasks = [
        asyncio.create_task(_run(client_id))
        for client_id in clients
        for _ in range(4)
    ]
    started_all = time.perf_counter()
    await asyncio.gather(*tasks)
    elapsed = time.perf_counter() - started_all

    throughput_rps = len(tasks) / elapsed if elapsed > 0 else 0.0
    p95_sec = _p95(latencies)
    max_p95_sec = float(os.getenv("LMX_PERF_GATE_MAX_P95_SEC", "0.60"))
    min_throughput_rps = float(os.getenv("LMX_PERF_GATE_MIN_THROUGHPUT_RPS", "20.0"))

    assert p95_sec <= max_p95_sec, (
        f"Perf gate failed: p95={p95_sec:.4f}s exceeds max {max_p95_sec:.4f}s"
    )
    assert throughput_rps >= min_throughput_rps, (
        f"Perf gate failed: throughput={throughput_rps:.2f} rps below min "
        f"{min_throughput_rps:.2f} rps"
    )


def test_autotune_score_orders_profiles_and_tiebreakers() -> None:
    fast = score_profile(
        avg_tokens_per_second=150.0,
        avg_ttft_ms=320.0,
        error_rate=0.0,
        avg_total_ms=1100.0,
        queue_wait_ms=20.0,
    )
    slow = score_profile(
        avg_tokens_per_second=95.0,
        avg_ttft_ms=700.0,
        error_rate=0.02,
        avg_total_ms=1800.0,
        queue_wait_ms=60.0,
    )
    assert fast.score > slow.score
    assert fast.sort_key < slow.sort_key


def test_autotune_perf_regression_gate_uses_15_percent_threshold() -> None:
    baseline = {"avg_tokens_per_second": 100.0}
    within_gate = {"avg_tokens_per_second": 85.0}
    regressed = {"avg_tokens_per_second": 84.0}

    assert_tuned_profile_regression_within_gate(
        baseline,
        within_gate,
        max_drop_ratio=0.15,
    )
    with pytest.raises(AssertionError):
        assert_tuned_profile_regression_within_gate(
            baseline,
            regressed,
            max_drop_ratio=0.15,
        )
