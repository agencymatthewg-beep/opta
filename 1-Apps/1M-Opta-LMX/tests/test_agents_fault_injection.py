"""Phase F hardening: fault injection and guardrails tests for multi-agent runtime.

Validates that the agents runtime degrades gracefully under engine failures,
budget exhaustion, timeout enforcement, retry exhaustion, cancellation, and
startup recovery scenarios.
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path

from opta_lmx.agents.models import (
    AgentRequest,
    AgentRun,
    ExecutionStrategy,
    RunStatus,
    StepStatus,
)
from opta_lmx.agents.runtime import AgentsRuntime
from opta_lmx.agents.scheduler import RunScheduler
from opta_lmx.agents.state_store import AgentsStateStore
from opta_lmx.config import RoutingConfig
from opta_lmx.inference.schema import (
    ChatCompletionResponse,
    ChatMessage,
    Choice,
    ResponseMessage,
    Usage,
)
from opta_lmx.router.strategy import TaskRouter

TERMINAL_STATES = {RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.CANCELLED}


# ---------------------------------------------------------------------------
# Fake engine and helpers (mirroring test_agents_runtime.py patterns)
# ---------------------------------------------------------------------------


class FakeEngine:
    """Minimal engine stub whose generate() can be overridden per test."""

    def __init__(self, *, loaded_models: list[str]) -> None:
        self._loaded_models = list(loaded_models)
        self.calls: list[str] = []

    def get_loaded_model_ids(self) -> list[str]:
        return list(self._loaded_models)

    def is_model_loaded(self, model_id: str) -> bool:
        return model_id in self._loaded_models

    def get_model_load_snapshot(
        self, model_ids: list[str] | None = None,
    ) -> dict[str, float]:
        return {m: 1.0 for m in self._loaded_models}

    async def generate(
        self,
        model_id: str,
        messages: list[ChatMessage],
        priority: str = "normal",
        **_: object,
    ) -> ChatCompletionResponse:
        role = _extract_role(messages)
        self.calls.append(role)
        return _ok_response(model_id, f"output:{role}")


class FakeRouter:
    """Trivial router that returns model_id unchanged."""

    def resolve(
        self,
        model_id: str,
        loaded_model_ids: list[str],
        *,
        client_id: str | None = None,
        model_load_snapshot: object = None,
    ) -> str:
        return model_id


def _extract_role(messages: list[ChatMessage]) -> str:
    for msg in messages:
        if msg.role != "system":
            continue
        content = msg.content
        if not isinstance(content, str):
            continue
        prefix = "You are acting as the "
        suffix = " agent."
        if content.startswith(prefix) and content.endswith(suffix):
            return content[len(prefix):-len(suffix)]
    return "assistant"


def _ok_response(
    model_id: str,
    content: str,
    prompt_tokens: int = 10,
    completion_tokens: int = 20,
) -> ChatCompletionResponse:
    return ChatCompletionResponse(
        id="fake-resp",
        created=0,
        model=model_id,
        choices=[Choice(message=ResponseMessage(content=content), finish_reason="stop")],
        usage=Usage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
        ),
    )


def _make_runtime(
    tmp_path: Path,
    *,
    engine: object,
    queue_size: int = 16,
    workers: int = 2,
    **runtime_kwargs: object,
) -> AgentsRuntime:
    store = AgentsStateStore(path=tmp_path / "agent-runs.json")
    scheduler = RunScheduler(max_queue_size=queue_size, worker_count=workers)
    router = TaskRouter(RoutingConfig(aliases={}, default_model=None))
    return AgentsRuntime(
        engine=engine,
        router=router,
        state_store=store,
        scheduler=scheduler,
        **runtime_kwargs,  # type: ignore[arg-type]
    )


async def _wait_terminal(
    runtime: AgentsRuntime,
    run_id: str,
    *,
    timeout_sec: float = 5.0,
) -> AgentRun:
    """Wait until the run reaches a terminal state."""
    deadline = asyncio.get_running_loop().time() + timeout_sec
    while asyncio.get_running_loop().time() < deadline:
        run = runtime.get(run_id)
        if run is not None and run.status in TERMINAL_STATES:
            return run
        await asyncio.sleep(0.01)
    raise AssertionError(f"Timed out waiting for terminal state on run {run_id}")


async def _wait_status(
    runtime: AgentsRuntime,
    run_id: str,
    status: RunStatus,
    *,
    timeout_sec: float = 5.0,
) -> AgentRun:
    """Wait until the run reaches a specific status."""
    deadline = asyncio.get_running_loop().time() + timeout_sec
    while asyncio.get_running_loop().time() < deadline:
        run = runtime.get(run_id)
        if run is not None and run.status == status:
            return run
        await asyncio.sleep(0.01)
    raise AssertionError(f"Timed out waiting for {status} on run {run_id}")


# ---------------------------------------------------------------------------
# 1. Engine timeout fails step and run
# ---------------------------------------------------------------------------


async def test_engine_timeout_fails_step_and_run(tmp_path: Path) -> None:
    """When engine.generate raises asyncio.TimeoutError the run should FAIL."""

    class TimeoutEngine(FakeEngine):
        async def generate(self, model_id: str, messages: list[ChatMessage], **kw: object) -> ChatCompletionResponse:
            raise asyncio.TimeoutError("inference timed out")

    engine = TimeoutEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="trigger timeout",
            roles=["planner"],
        ))
        run = await _wait_terminal(runtime, submitted.id)
    finally:
        await runtime.stop()

    assert run.status == RunStatus.FAILED
    assert run.error is not None


# ---------------------------------------------------------------------------
# 2. Engine runtime error fails step and run
# ---------------------------------------------------------------------------


async def test_engine_error_fails_step_and_run(tmp_path: Path) -> None:
    """When engine.generate raises RuntimeError('GPU OOM') the run should FAIL."""

    class OOMEngine(FakeEngine):
        async def generate(self, model_id: str, messages: list[ChatMessage], **kw: object) -> ChatCompletionResponse:
            raise RuntimeError("GPU OOM")

    engine = OOMEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="trigger OOM",
            roles=["planner"],
        ))
        run = await _wait_terminal(runtime, submitted.id)
    finally:
        await runtime.stop()

    assert run.status == RunStatus.FAILED
    assert run.error is not None
    assert "GPU OOM" in run.error


# ---------------------------------------------------------------------------
# 3. Model unavailable at execution time
# ---------------------------------------------------------------------------


async def test_model_unavailable_at_execution_time(tmp_path: Path) -> None:
    """If all models disappear before generate is called, the run should FAIL."""

    class VanishingEngine(FakeEngine):
        """Starts with models loaded but removes them before generate."""

        def __init__(self) -> None:
            super().__init__(loaded_models=["model-a"])
            self._vanished = False

        def get_loaded_model_ids(self) -> list[str]:
            if self._vanished:
                return []
            return super().get_loaded_model_ids()

        def is_model_loaded(self, model_id: str) -> bool:
            if self._vanished:
                return False
            return super().is_model_loaded(model_id)

        async def generate(self, model_id: str, messages: list[ChatMessage], **kw: object) -> ChatCompletionResponse:
            # Models vanish the moment execution starts; runtime calls
            # _resolve_model_for_requested -> get_loaded_model_ids first.
            self._vanished = True
            raise RuntimeError("model not loaded")

    engine = VanishingEngine()
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="test vanish",
            roles=["alpha", "beta"],
        ))
        run = await _wait_terminal(runtime, submitted.id)
    finally:
        await runtime.stop()

    assert run.status == RunStatus.FAILED
    assert run.error is not None


# ---------------------------------------------------------------------------
# 4. Retry exhaustion fails run
# ---------------------------------------------------------------------------


async def test_retry_exhaustion_fails_run(tmp_path: Path) -> None:
    """Engine raises retryable 'Server is busy' on ALL attempts; run should FAIL."""

    class AlwaysBusyEngine(FakeEngine):
        def __init__(self) -> None:
            super().__init__(loaded_models=["model-a"])
            self.attempt_count = 0

        async def generate(self, model_id: str, messages: list[ChatMessage], **kw: object) -> ChatCompletionResponse:
            self.attempt_count += 1
            raise RuntimeError("Server is busy")

    engine = AlwaysBusyEngine()
    runtime = _make_runtime(
        tmp_path,
        engine=engine,
        step_retry_attempts=2,
        step_retry_backoff_sec=0.0,
    )
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="always busy",
            roles=["planner"],
        ))
        run = await _wait_terminal(runtime, submitted.id)
    finally:
        await runtime.stop()

    assert run.status == RunStatus.FAILED
    assert "Server is busy" in (run.error or "")
    # step_retry_attempts=2 means 3 total attempts (1 initial + 2 retries)
    assert engine.attempt_count == 3


# ---------------------------------------------------------------------------
# 5. Retry succeeds after transient failure
# ---------------------------------------------------------------------------


async def test_retry_succeeds_after_transient_failure(tmp_path: Path) -> None:
    """Engine fails once with 'Server is busy' then succeeds; run should COMPLETE."""

    class FlakyEngine(FakeEngine):
        def __init__(self) -> None:
            super().__init__(loaded_models=["model-a"])
            self.failures_remaining = 1

        async def generate(self, model_id: str, messages: list[ChatMessage], **kw: object) -> ChatCompletionResponse:
            if self.failures_remaining > 0:
                self.failures_remaining -= 1
                raise RuntimeError("Server is busy")
            return await super().generate(model_id, messages, **kw)

    engine = FlakyEngine()
    runtime = _make_runtime(
        tmp_path,
        engine=engine,
        step_retry_attempts=2,
        step_retry_backoff_sec=0.0,
    )
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="flaky test",
            roles=["planner"],
        ))
        run = await _wait_terminal(runtime, submitted.id)
    finally:
        await runtime.stop()

    assert run.status == RunStatus.COMPLETED
    assert engine.failures_remaining == 0


# ---------------------------------------------------------------------------
# 6. Run timeout enforcement
# ---------------------------------------------------------------------------


async def test_run_timeout_enforcement(tmp_path: Path) -> None:
    """Set timeout_sec=0.1; engine sleeps 2s; run should FAIL with timeout message."""

    class SlowEngine(FakeEngine):
        async def generate(self, model_id: str, messages: list[ChatMessage], **kw: object) -> ChatCompletionResponse:
            await asyncio.sleep(2.0)
            return await super().generate(model_id, messages, **kw)

    engine = SlowEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="slow request",
            roles=["planner"],
            timeout_sec=0.1,
        ))
        run = await _wait_terminal(runtime, submitted.id)
    finally:
        await runtime.stop()

    assert run.status == RunStatus.FAILED
    assert run.error is not None
    assert "timeout" in run.error.lower()


# ---------------------------------------------------------------------------
# 7. Max steps per run enforced
# ---------------------------------------------------------------------------


async def test_max_steps_per_run_enforced(tmp_path: Path) -> None:
    """Submit request with 10 roles but max_steps_per_run=5; should raise ValueError."""
    engine = FakeEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine, max_steps_per_run=5)
    await runtime.start()
    try:
        raised = False
        try:
            await runtime.submit(AgentRequest(
                strategy=ExecutionStrategy.HANDOFF,
                prompt="too many roles",
                roles=[f"role-{i}" for i in range(10)],
            ))
        except ValueError as exc:
            raised = True
            assert "10" in str(exc)
            assert "5" in str(exc)
        assert raised, "Expected ValueError for exceeding max_steps_per_run"
    finally:
        await runtime.stop()


# ---------------------------------------------------------------------------
# 8. Concurrent runs: mixed success and failure
# ---------------------------------------------------------------------------


async def test_concurrent_runs_mixed_success_failure(tmp_path: Path) -> None:
    """Submit 5 runs: 3 succeed, 2 fail via engine error. Verify statuses."""

    fail_roles = {"fail-role-0", "fail-role-1"}

    class MixedEngine(FakeEngine):
        async def generate(self, model_id: str, messages: list[ChatMessage], **kw: object) -> ChatCompletionResponse:
            role = _extract_role(messages)
            if role in fail_roles:
                raise RuntimeError(f"Deliberate failure for {role}")
            return await super().generate(model_id, messages, **kw)

    engine = MixedEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine, workers=4)
    await runtime.start()
    try:
        run_ids: list[str] = []
        # Submit 3 succeeding runs
        for i in range(3):
            sub = await runtime.submit(AgentRequest(
                strategy=ExecutionStrategy.HANDOFF,
                prompt=f"ok-{i}",
                roles=[f"ok-role-{i}"],
            ))
            run_ids.append(sub.id)
        # Submit 2 failing runs
        for i in range(2):
            sub = await runtime.submit(AgentRequest(
                strategy=ExecutionStrategy.HANDOFF,
                prompt=f"fail-{i}",
                roles=[f"fail-role-{i}"],
            ))
            run_ids.append(sub.id)

        # Wait for all to terminate
        final_runs: list[AgentRun] = []
        for rid in run_ids:
            final_runs.append(await _wait_terminal(runtime, rid))
    finally:
        await runtime.stop()

    completed = [r for r in final_runs if r.status == RunStatus.COMPLETED]
    failed = [r for r in final_runs if r.status == RunStatus.FAILED]
    assert len(completed) == 3
    assert len(failed) == 2


# ---------------------------------------------------------------------------
# 9. Parallel map partial failure cancels siblings via TaskGroup
# ---------------------------------------------------------------------------


async def test_parallel_map_partial_failure_cancels_siblings(tmp_path: Path) -> None:
    """In PARALLEL_MAP one role raises; TaskGroup propagates and run FAILS."""

    class PartialFailEngine(FakeEngine):
        async def generate(self, model_id: str, messages: list[ChatMessage], **kw: object) -> ChatCompletionResponse:
            role = _extract_role(messages)
            if role == "bad":
                raise RuntimeError("step explosion")
            # Slow enough that cancellation is observable
            await asyncio.sleep(0.2)
            return await super().generate(model_id, messages, **kw)

    engine = PartialFailEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.PARALLEL_MAP,
            prompt="parallel fault",
            roles=["good-1", "good-2", "bad"],
            max_parallelism=4,
        ))
        run = await _wait_terminal(runtime, submitted.id)
    finally:
        await runtime.stop()

    assert run.status == RunStatus.FAILED
    assert run.error is not None
    # TaskGroup wraps the child exception; the run-level error is the
    # ExceptionGroup message, while the original error is on the step.
    failed_steps = [s for s in run.steps if s.status == StepStatus.FAILED]
    assert len(failed_steps) == 1
    assert failed_steps[0].role == "bad"
    assert "step explosion" in (failed_steps[0].error or "")
    # Sibling steps should be cancelled by TaskGroup propagation
    cancelled_steps = [s for s in run.steps if s.status == StepStatus.CANCELLED]
    assert len(cancelled_steps) >= 1


# ---------------------------------------------------------------------------
# 10. Startup recovery marks incomplete runs FAILED
# ---------------------------------------------------------------------------


async def test_startup_recovery_marks_incomplete_runs_failed(tmp_path: Path) -> None:
    """State store contains a RUNNING run; new runtime marks it FAILED on init."""
    store_path = tmp_path / "agent-runs.json"
    store = AgentsStateStore(path=store_path)

    # Manually create a run in RUNNING state
    incomplete_run = AgentRun(
        id="run-incomplete-001",
        request=AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="was running",
            roles=["planner"],
        ),
        status=RunStatus.RUNNING,
        steps=[],
    )
    store.upsert_run(incomplete_run)

    # Also create one in QUEUED
    queued_run = AgentRun(
        id="run-queued-002",
        request=AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="was queued",
            roles=["planner"],
        ),
        status=RunStatus.QUEUED,
        steps=[],
    )
    store.upsert_run(queued_run)

    # Create a new runtime that reads the same store
    engine = FakeEngine(loaded_models=["model-a"])
    new_store = AgentsStateStore(path=store_path)
    scheduler = RunScheduler(max_queue_size=16, worker_count=1)
    router = TaskRouter(RoutingConfig(aliases={}, default_model=None))
    runtime = AgentsRuntime(
        engine=engine,
        router=router,
        state_store=new_store,
        scheduler=scheduler,
    )

    recovered_running = runtime.get("run-incomplete-001")
    recovered_queued = runtime.get("run-queued-002")

    assert recovered_running is not None
    assert recovered_running.status == RunStatus.FAILED
    assert "interrupted" in (recovered_running.error or "").lower()

    assert recovered_queued is not None
    assert recovered_queued.status == RunStatus.FAILED
    assert "interrupted" in (recovered_queued.error or "").lower()


# ---------------------------------------------------------------------------
# 11. Budget exhaustion mid-handoff
# ---------------------------------------------------------------------------


async def test_budget_exhaustion_mid_handoff(tmp_path: Path) -> None:
    """HANDOFF with 3 roles, token_budget=25; first step uses 30 tokens total.

    Second step should not execute; run should be FAILED with budget error.
    """

    class HighTokenEngine(FakeEngine):
        async def generate(self, model_id: str, messages: list[ChatMessage], **kw: object) -> ChatCompletionResponse:
            role = _extract_role(messages)
            self.calls.append(role)
            return _ok_response(model_id, f"output:{role}", prompt_tokens=15, completion_tokens=15)

    engine = HighTokenEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="budget test",
            roles=["alpha", "beta", "gamma"],
            token_budget=25,
        ))
        run = await _wait_terminal(runtime, submitted.id)
    finally:
        await runtime.stop()

    assert run.status == RunStatus.FAILED
    assert run.error is not None
    assert "Budget exhausted" in run.error
    assert "token" in run.error
    # Only the first step should have executed; the budget check before
    # the second step should have caught the overrun.
    assert len(engine.calls) == 1


# ---------------------------------------------------------------------------
# 12. Cancelled run stops executing steps
# ---------------------------------------------------------------------------


async def test_cancelled_run_stops_executing_steps(tmp_path: Path) -> None:
    """Submit HANDOFF run with slow engine, cancel mid-execution.

    Remaining steps should not complete.
    """

    step_started = asyncio.Event()

    class SlowHandoffEngine(FakeEngine):
        async def generate(self, model_id: str, messages: list[ChatMessage], **kw: object) -> ChatCompletionResponse:
            role = _extract_role(messages)
            self.calls.append(role)
            step_started.set()
            # First step is slow to give cancellation time to land
            await asyncio.sleep(1.0)
            return await FakeEngine.generate(self, model_id, messages, **kw)

    engine = SlowHandoffEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine, workers=1)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="cancel me",
            roles=["alpha", "beta", "gamma"],
        ))
        # Wait until the first step begins executing
        await asyncio.wait_for(step_started.wait(), timeout=2.0)
        # Now cancel
        cancelled = await runtime.cancel(submitted.id)
        assert cancelled is True

        run = await _wait_terminal(runtime, submitted.id)
    finally:
        await runtime.stop()

    assert run.status == RunStatus.CANCELLED
    # At most the first step should have started
    assert len(engine.calls) <= 1


# ---------------------------------------------------------------------------
# 13. Guardrail: max_parallelism respected (sequential when =1)
# ---------------------------------------------------------------------------


async def test_guardrail_max_parallelism_respected(tmp_path: Path) -> None:
    """PARALLEL_MAP with max_parallelism=1 and 5 roles should execute sequentially.

    We verify sequential execution by recording timestamps and checking that
    no two steps overlap.
    """

    step_intervals: list[tuple[float, float]] = []

    class TimingEngine(FakeEngine):
        async def generate(self, model_id: str, messages: list[ChatMessage], **kw: object) -> ChatCompletionResponse:
            start = time.monotonic()
            await asyncio.sleep(0.05)  # 50ms per step
            end = time.monotonic()
            step_intervals.append((start, end))
            role = _extract_role(messages)
            return _ok_response(model_id, f"output:{role}")

    engine = TimingEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.PARALLEL_MAP,
            prompt="parallelism test",
            roles=["r0", "r1", "r2", "r3", "r4"],
            max_parallelism=1,
        ))
        run = await _wait_terminal(runtime, submitted.id)
    finally:
        await runtime.stop()

    assert run.status == RunStatus.COMPLETED
    assert len(step_intervals) == 5

    # Sort intervals by start time and verify no overlap:
    # Each step should start after or at the end of the previous one.
    sorted_intervals = sorted(step_intervals, key=lambda iv: iv[0])
    for i in range(1, len(sorted_intervals)):
        prev_end = sorted_intervals[i - 1][1]
        curr_start = sorted_intervals[i][0]
        assert curr_start >= prev_end - 0.001, (
            f"Step {i} started at {curr_start:.4f} before step {i-1} ended at {prev_end:.4f} "
            f"-- max_parallelism=1 violated"
        )
