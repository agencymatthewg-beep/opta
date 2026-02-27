"""Tests for priority-aware agents run scheduler."""

from __future__ import annotations

import asyncio
from pathlib import Path

from opta_lmx.agents.scheduler import RunQueueFullError, RunScheduler


async def test_scheduler_dispatches_interactive_before_normal_and_batch() -> None:
    scheduler = RunScheduler(max_queue_size=16, worker_count=1)
    processed: list[str] = []

    async def _handler(run_id: str) -> None:
        processed.append(run_id)

    await scheduler.start(_handler)
    try:
        await scheduler.submit("run-batch", priority="batch")
        await scheduler.submit("run-normal", priority="normal")
        await scheduler.submit("run-interactive", priority="interactive")
        await asyncio.sleep(0.05)
    finally:
        await scheduler.stop()

    assert processed[:3] == ["run-interactive", "run-normal", "run-batch"]


async def test_scheduler_defaults_unknown_priority_to_normal() -> None:
    scheduler = RunScheduler(max_queue_size=8, worker_count=1)
    processed: list[str] = []

    async def _handler(run_id: str) -> None:
        processed.append(run_id)

    await scheduler.start(_handler)
    try:
        await scheduler.submit("run-a", priority="unknown")
        await scheduler.submit("run-b", priority="normal")
        await asyncio.sleep(0.05)
    finally:
        await scheduler.stop()

    assert processed[:2] == ["run-a", "run-b"]


async def test_scheduler_reports_queue_saturation_details() -> None:
    scheduler = RunScheduler(max_queue_size=1, worker_count=1)

    async def _handler(_: str) -> None:
        await asyncio.sleep(0.01)

    await scheduler.start(_handler)
    try:
        await scheduler.submit("run-a", priority="normal")
        try:
            await scheduler.submit("run-b", priority="normal")
        except RunQueueFullError as exc:
            assert exc.size == 1
            assert exc.capacity == 1
            assert str(exc) == "Run queue is full (1/1)"
        else:
            raise AssertionError("Expected RunQueueFullError")
    finally:
        await scheduler.stop()


async def test_sqlite_scheduler_preserves_queued_runs_across_restart(tmp_path: Path) -> None:
    queue_path = tmp_path / "agents-queue.db"
    first = RunScheduler(
        max_queue_size=4,
        worker_count=1,
        backend="sqlite",
        persist_path=queue_path,
        poll_interval_sec=0.5,
    )

    async def _no_op(_: str) -> None:
        await asyncio.sleep(0.1)

    await first.start(_no_op)
    try:
        await first.submit("run-persist", priority="normal")
    finally:
        await first.stop()

    processed: list[str] = []
    second = RunScheduler(
        max_queue_size=4,
        worker_count=1,
        backend="sqlite",
        persist_path=queue_path,
        poll_interval_sec=0.01,
    )

    async def _handler(run_id: str) -> None:
        processed.append(run_id)

    await second.start(_handler)
    try:
        deadline = asyncio.get_running_loop().time() + 2.0
        while asyncio.get_running_loop().time() < deadline:
            if processed:
                break
            await asyncio.sleep(0.01)
    finally:
        await second.stop()

    assert processed == ["run-persist"]
