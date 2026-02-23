"""Chaos-style resilience tests for cancellations, timeouts, and queue pressure."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from opta_lmx.agents.models import AgentRequest, ExecutionStrategy, RunStatus
from opta_lmx.agents.runtime import AgentsRuntime
from opta_lmx.agents.scheduler import RunScheduler
from opta_lmx.agents.state_store import AgentsStateStore
from opta_lmx.config import RoutingConfig
from opta_lmx.inference.engine import InferenceEngine
from opta_lmx.inference.schema import ChatMessage
from opta_lmx.manager.memory import MemoryMonitor
from opta_lmx.model_safety import ErrorCodes
from opta_lmx.router.strategy import TaskRouter
from opta_lmx.runtime.child_loader_supervisor import LoaderSupervisorOutcome
from opta_lmx.runtime.loader_protocol import LoaderFailure
from opta_lmx.skills.dispatch import QueuedSkillDispatcher, SkillDispatchOverloadedError
from opta_lmx.skills.executors import SkillExecutor
from opta_lmx.skills.manifest import SkillManifest


class _BlockingEngine:
    def __init__(self) -> None:
        self._loaded = ["model-a"]
        self._release = asyncio.Event()

    def get_loaded_model_ids(self) -> list[str]:
        return list(self._loaded)

    def is_model_loaded(self, model_id: str) -> bool:
        return model_id in self._loaded

    async def generate(
        self,
        model_id: str,
        _messages: list[ChatMessage],
        **_: object,
    ) -> object:
        await self._release.wait()
        from opta_lmx.inference.schema import (
            ChatCompletionResponse,
            Choice,
            ResponseMessage,
            Usage,
        )

        return ChatCompletionResponse(
            id="chatcmpl-chaos",
            created=0,
            model=model_id,
            choices=[Choice(message=ResponseMessage(content="ok"), finish_reason="stop")],
            usage=Usage(prompt_tokens=1, completion_tokens=1, total_tokens=2),
        )

    def release(self) -> None:
        self._release.set()


async def _wait_for_run(runtime: AgentsRuntime, run_id: str, target: set[RunStatus]) -> RunStatus:
    deadline = asyncio.get_running_loop().time() + 3.0
    while asyncio.get_running_loop().time() < deadline:
        run = runtime.get(run_id)
        if run is not None and run.status in target:
            return run.status
        await asyncio.sleep(0.01)
    raise AssertionError(f"Timed out waiting for run {run_id} to reach {target}")


def assert_loader_failure_gate(*, engine: InferenceEngine, model_id: str, attempts: int) -> None:
    """Reliability gate assertion for repeated loader failures."""
    readiness = engine.model_readiness(model_id)
    assert readiness.get("state") == "quarantined"
    assert int(readiness.get("crash_count", 0)) >= min(3, attempts)
    assert engine.in_flight_count == 0
    assert model_id not in engine.get_loaded_model_ids()


async def test_chaos_agent_cancel_queued_run_under_pressure(tmp_path: Path) -> None:
    engine = _BlockingEngine()
    runtime = AgentsRuntime(
        engine=engine,
        router=TaskRouter(RoutingConfig(aliases={})),
        state_store=AgentsStateStore(path=tmp_path / "chaos-runs.json"),
        scheduler=RunScheduler(max_queue_size=2, worker_count=1),
    )
    await runtime.start()
    try:
        first = await runtime.submit(
            AgentRequest(
                strategy=ExecutionStrategy.HANDOFF,
                prompt="first",
                roles=["planner"],
            )
        )
        second = await runtime.submit(
            AgentRequest(
                strategy=ExecutionStrategy.HANDOFF,
                prompt="second",
                roles=["planner"],
            )
        )

        await _wait_for_run(runtime, second.id, {RunStatus.QUEUED, RunStatus.RUNNING})
        cancelled = await runtime.cancel(second.id)
        assert cancelled is True
        await _wait_for_run(runtime, second.id, {RunStatus.CANCELLED})

        engine.release()
        status = await _wait_for_run(
            runtime,
            first.id,
            {RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.CANCELLED},
        )
        assert status in {RunStatus.COMPLETED, RunStatus.FAILED}
    finally:
        engine.release()
        await runtime.stop()


async def test_chaos_inference_timeout_does_not_leak_in_flight() -> None:
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(
        memory_monitor=monitor,
        use_batching=False,
        max_concurrent_requests=2,
        inference_timeout_sec=1,
        warmup_on_load=False,
    )

    async def mock_create(model_id: str, use_batching: bool, **_kw: object) -> MagicMock:
        mock = MagicMock()
        mock.chat = AsyncMock(return_value="response")
        return mock

    engine._create_engine = mock_create  # type: ignore[assignment]
    await engine.load_model("test/model-timeout")

    async def very_slow(*args: object, **kwargs: object) -> tuple[str, int, int]:
        await asyncio.sleep(2.0)
        return "slow", 4, 1

    engine._do_generate = very_slow  # type: ignore[assignment]
    with pytest.raises(RuntimeError, match="timed out"):
        await engine.generate("test/model-timeout", [ChatMessage(role="user", content="hi")])
    assert engine.in_flight_count == 0


async def test_chaos_skill_queue_pressure_returns_backpressure(tmp_path: Path) -> None:
    module_path = tmp_path / "chaos_skill.py"
    module_path.write_text(
        "import time\n"
        "def run(delay: float) -> str:\n"
        "    time.sleep(delay)\n"
        "    return 'ok'\n",
        encoding="utf-8",
    )
    manifest = SkillManifest.model_validate(
        {
            "schema": "opta.skills.manifest/v1",
            "name": "chaos_skill",
            "kind": "entrypoint",
            "description": "Chaos test skill",
            "entrypoint": "chaos_skill:run",
        }
    )
    dispatcher = QueuedSkillDispatcher(
        executor=SkillExecutor(module_search_paths=[tmp_path]),
        worker_count=1,
        max_queue_size=1,
    )
    await dispatcher.start()
    try:
        first = asyncio.create_task(dispatcher.execute(manifest, arguments={"delay": 0.15}))
        await asyncio.sleep(0.01)
        second = asyncio.create_task(dispatcher.execute(manifest, arguments={"delay": 0.15}))
        await asyncio.sleep(0.01)
        with pytest.raises(SkillDispatchOverloadedError):
            await dispatcher.execute(manifest, arguments={"delay": 0.15})
        await first
        await second
    finally:
        await dispatcher.close()


async def test_chaos_loader_repeated_failures_eventually_quarantine() -> None:
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)

    create_engine = AsyncMock(return_value=MagicMock())
    engine._create_engine = create_engine  # type: ignore[assignment]

    failure = LoaderFailure(
        code=ErrorCodes.MODEL_LOADER_CRASHED,
        message="Child loader crashed with signal 6",
        signal=6,
    )
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "opta_lmx.inference.engine.backend_candidates",
            lambda *_args, **_kwargs: ["vllm-mlx"],
        )
        mp.setattr(
            "opta_lmx.inference.engine.run_loader_supervisor",
            AsyncMock(return_value=LoaderSupervisorOutcome(ok=False, failure=failure)),
        )
        for _ in range(3):
            with pytest.raises(RuntimeError, match=ErrorCodes.MODEL_LOADER_CRASHED):
                await engine.load_model("test/model-chaos-loader")

    state = engine.model_readiness("test/model-chaos-loader")
    assert state["state"] == "quarantined"


async def test_chaos_loader_failure_gate_reports_zero_api_crashes() -> None:
    """Reliability gate: repeated loader crash/timeout outcomes never crash API process."""
    monitor = MemoryMonitor(max_percent=90)
    engine = InferenceEngine(memory_monitor=monitor, use_batching=False, warmup_on_load=False)
    engine._create_engine = AsyncMock(return_value=MagicMock())  # type: ignore[assignment]

    failure_crash = LoaderFailure(
        code=ErrorCodes.MODEL_LOADER_CRASHED,
        message="Child loader crashed with signal 6",
        signal=6,
    )
    failure_timeout = LoaderFailure(
        code=ErrorCodes.MODEL_LOAD_TIMEOUT,
        message="Child loader timed out",
    )
    attempts = 20
    sequence = [
        LoaderSupervisorOutcome(
            ok=False,
            failure=failure_crash if idx % 2 == 0 else failure_timeout,
        )
        for idx in range(attempts)
    ]

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "opta_lmx.inference.engine.backend_candidates",
            lambda *_args, **_kwargs: ["vllm-mlx"],
        )
        mp.setattr(
            "opta_lmx.inference.engine.run_loader_supervisor",
            AsyncMock(side_effect=sequence),
        )
        for _ in range(attempts):
            with pytest.raises(RuntimeError):
                await engine.load_model("test/model-chaos-gate")

    assert_loader_failure_gate(engine=engine, model_id="test/model-chaos-gate", attempts=attempts)
