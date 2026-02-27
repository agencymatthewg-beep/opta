"""Tests for multi-agent runtime execution."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import cast

from opta_lmx.agents.models import (
    AgentRequest,
    ExecutionStrategy,
    RunStatus,
    StepStatus,
)
from opta_lmx.agents.runtime import AgentsRuntime
from opta_lmx.agents.scheduler import RunScheduler
from opta_lmx.agents.state_store import AgentsStateStore
from opta_lmx.agents.tracing import TraceEvent, Tracer
from opta_lmx.config import RoutingConfig
from opta_lmx.inference.schema import (
    ChatCompletionResponse,
    ChatMessage,
    Choice,
    ResponseMessage,
    Usage,
)
from opta_lmx.router.strategy import TaskRouter

TERMINAL_RUN_STATES = {
    RunStatus.COMPLETED,
    RunStatus.FAILED,
    RunStatus.CANCELLED,
}


class FakeEngine:
    """Small in-memory engine stub for runtime tests."""

    def __init__(self, *, loaded_models: list[str]) -> None:
        self._loaded_models = list(loaded_models)
        self.calls: list[str] = []
        self.model_calls: list[str] = []
        self.priorities: list[str] = []
        self.system_prompts: list[str] = []
        self.tools_payloads: list[list[dict[str, object]] | None] = []
        self.client_ids: list[str | None] = []
        self.block_event: asyncio.Event | None = None

    def get_loaded_model_ids(self) -> list[str]:
        return list(self._loaded_models)

    def is_model_loaded(self, model_id: str) -> bool:
        return model_id in self._loaded_models

    async def generate(
        self,
        model_id: str,
        messages: list[ChatMessage],
        priority: str = "normal",
        **_: object,
    ) -> ChatCompletionResponse:
        role = _extract_role(messages)
        user_input = _extract_user_input(messages)
        system_prompt = _extract_system_prompt(messages)
        self.calls.append(role)
        self.model_calls.append(model_id)
        self.priorities.append(priority)
        self.system_prompts.append(system_prompt)
        self.tools_payloads.append(cast(list[dict[str, object]] | None, _.get("tools")))
        self.client_ids.append(cast(str | None, _.get("client_id")))

        if self.block_event is not None:
            await self.block_event.wait()

        content = f"{role}:{user_input}"
        return ChatCompletionResponse(
            id="run-test",
            created=0,
            model=model_id,
            choices=[Choice(message=ResponseMessage(content=content), finish_reason="stop")],
            usage=Usage(prompt_tokens=1, completion_tokens=1, total_tokens=2),
        )


def _extract_role(messages: list[ChatMessage]) -> str:
    for message in messages:
        if message.role != "system":
            continue
        content = message.content
        if not isinstance(content, str):
            continue
        prefix = "You are acting as the "
        suffix = " agent."
        if content.startswith(prefix) and content.endswith(suffix):
            return content[len(prefix) : -len(suffix)]
    return "assistant"


def _extract_system_prompt(messages: list[ChatMessage]) -> str:
    for message in messages:
        if message.role == "system" and isinstance(message.content, str):
            return message.content
    return ""


def _extract_user_input(messages: list[ChatMessage]) -> str:
    for message in reversed(messages):
        if message.role == "user" and isinstance(message.content, str):
            return message.content
        return ""


class CollectingTracer:
    """Tracer test double that records all events."""

    def __init__(self) -> None:
        self.events: list[TraceEvent] = []

    def emit(self, event: TraceEvent) -> None:
        self.events.append(event)


async def _wait_for_status(
    runtime: AgentsRuntime,
    run_id: str,
    statuses: set[RunStatus],
    *,
    timeout_sec: float = 2.0,
) -> RunStatus:
    deadline = asyncio.get_running_loop().time() + timeout_sec
    while asyncio.get_running_loop().time() < deadline:
        run = runtime.get(run_id)
        if run is None:
            await asyncio.sleep(0.01)
            continue
        if run.status in statuses:
            return run.status
        await asyncio.sleep(0.01)
    raise AssertionError(f"Timed out waiting for {statuses} on run {run_id}")


def _make_runtime(
    tmp_path: Path,
    *,
    engine: FakeEngine,
    queue_size: int = 16,
    workers: int = 2,
    tracer: Tracer | None = None,
    runtime_overrides: dict[str, object] | None = None,
) -> AgentsRuntime:
    store = AgentsStateStore(path=tmp_path / "agent-runs.json")
    scheduler = RunScheduler(max_queue_size=queue_size, worker_count=workers)
    router = TaskRouter(RoutingConfig(aliases={}, default_model=None))
    overrides = runtime_overrides or {}
    return AgentsRuntime(
        engine=engine,
        router=router,
        state_store=store,
        scheduler=scheduler,
        tracer=tracer,
        **overrides,
    )


async def test_runtime_fails_run_when_no_models_loaded(tmp_path: Path) -> None:
    engine = FakeEngine(loaded_models=[])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="Do work",
            roles=["planner"],
        ))
        await _wait_for_status(runtime, submitted.id, TERMINAL_RUN_STATES)
        run = runtime.get(submitted.id)
        assert run is not None
        assert run.status == RunStatus.FAILED
        assert run.error is not None
        assert "No models are currently loaded" in run.error
    finally:
        await runtime.stop()


async def test_runtime_parallel_map_executes_all_roles(tmp_path: Path) -> None:
    engine = FakeEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.PARALLEL_MAP,
            prompt="Evaluate this plan",
            roles=["researcher", "coder", "reviewer"],
            max_parallelism=2,
        ))
        await _wait_for_status(runtime, submitted.id, TERMINAL_RUN_STATES)

        run = runtime.get(submitted.id)
        assert run is not None
        assert run.status == RunStatus.COMPLETED
        assert all(step.status == StepStatus.COMPLETED for step in run.steps)

        result = cast(dict[str, str], run.result)
        assert set(result.keys()) == {"researcher", "coder", "reviewer"}
    finally:
        await runtime.stop()


async def test_runtime_router_uses_role_ordering(tmp_path: Path) -> None:
    engine = FakeEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.ROUTER,
            prompt="Sequence roles",
            roles=["reviewer", "planner", "coder"],
        ))
        await _wait_for_status(runtime, submitted.id, TERMINAL_RUN_STATES)

        run = runtime.get(submitted.id)
        assert run is not None
        assert run.status == RunStatus.COMPLETED
        assert engine.calls == ["planner", "coder", "reviewer"]
    finally:
        await runtime.stop()


async def test_runtime_handoff_chains_outputs_between_steps(
    tmp_path: Path,
) -> None:
    engine = FakeEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="seed",
            roles=["alpha", "beta", "gamma"],
        ))
        await _wait_for_status(runtime, submitted.id, TERMINAL_RUN_STATES)

        run = runtime.get(submitted.id)
        assert run is not None
        assert run.status == RunStatus.COMPLETED
        assert run.result == "gamma:beta:alpha:seed"
        assert run.steps[1].input == "alpha:seed"
        assert run.steps[2].input == "beta:alpha:seed"
    finally:
        await runtime.stop()


async def test_runtime_cancel_marks_running_run_cancelled(
    tmp_path: Path,
) -> None:
    engine = FakeEngine(loaded_models=["model-a"])
    engine.block_event = asyncio.Event()
    runtime = _make_runtime(tmp_path, engine=engine, workers=1)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="slow",
            roles=["planner"],
        ))
        await _wait_for_status(runtime, submitted.id, {RunStatus.RUNNING})
        cancelled = await runtime.cancel(submitted.id)
        assert cancelled is True
        await _wait_for_status(runtime, submitted.id, {RunStatus.CANCELLED})

        run = runtime.get(submitted.id)
        assert run is not None
        assert run.status == RunStatus.CANCELLED
    finally:
        engine.block_event.set()
        await runtime.stop()


async def test_runtime_reports_queue_saturation_in_failed_run(tmp_path: Path) -> None:
    engine = FakeEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine, queue_size=1, workers=1)
    await runtime.start()
    try:
        await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="first",
            roles=["planner"],
        ))
        overflow = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="second",
            roles=["planner"],
        ))
    finally:
        await runtime.stop()

    assert overflow.status == RunStatus.FAILED
    assert overflow.error is not None
    assert "Run queue is full (1/1)" in overflow.error
    assert "Retry when queue pressure drops." in overflow.error


async def test_runtime_passes_submitted_by_as_client_id(tmp_path: Path) -> None:
    """Engine requests should forward client identity for fairness controls."""
    engine = FakeEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="route this fairly",
            roles=["planner"],
            submitted_by="cli-user-123",
        ))
        await _wait_for_status(runtime, submitted.id, TERMINAL_RUN_STATES)

        run = runtime.get(submitted.id)
        assert run is not None
        assert run.status == RunStatus.COMPLETED
        assert engine.client_ids == ["cli-user-123"]
    finally:
        await runtime.stop()


async def test_runtime_resolves_role_specific_models(tmp_path: Path) -> None:
    engine = FakeEngine(loaded_models=["model-a", "model-b"])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="multi model",
            roles=["planner", "coder"],
            model="model-a",
            role_models={"coder": "model-b"},
        ))
        await _wait_for_status(runtime, submitted.id, TERMINAL_RUN_STATES)

        run = runtime.get(submitted.id)
        assert run is not None
        assert run.status == RunStatus.COMPLETED
        assert engine.model_calls == ["model-a", "model-b"]
    finally:
        await runtime.stop()


async def test_runtime_interactive_priority_maps_to_high_inference_priority(
    tmp_path: Path,
) -> None:
    engine = FakeEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="priority test",
            roles=["planner"],
            priority="interactive",
        ))
        await _wait_for_status(runtime, submitted.id, TERMINAL_RUN_STATES)
        assert engine.priorities[-1] == "high"
    finally:
        await runtime.stop()


async def test_runtime_emits_trace_context_metadata(tmp_path: Path) -> None:
    engine = FakeEngine(loaded_models=["model-a"])
    tracer = CollectingTracer()
    runtime = _make_runtime(tmp_path, engine=engine, tracer=tracer)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="trace",
            roles=["planner"],
            traceparent="00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
            tracestate="vendor=value",
            submitted_by="qa-user",
        ))
        await _wait_for_status(runtime, submitted.id, TERMINAL_RUN_STATES)
    finally:
        await runtime.stop()

    assert tracer.events
    run_events = [event for event in tracer.events if event.run_id == submitted.id]
    assert run_events
    assert any(event.metadata.get("traceparent") for event in run_events)
    assert any(event.metadata.get("tracestate") == "vendor=value" for event in run_events)


async def test_runtime_idempotency_returns_existing_run(tmp_path: Path) -> None:
    engine = FakeEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        request = AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="same",
            roles=["planner"],
        )
        first = await runtime.submit(
            request,
            idempotency_key="key-1",
            idempotency_fingerprint="fp-1",
        )
        second = await runtime.submit(
            request,
            idempotency_key="key-1",
            idempotency_fingerprint="fp-1",
        )
    finally:
        await runtime.stop()

    assert first.id == second.id


async def test_runtime_idempotency_conflict_raises(tmp_path: Path) -> None:
    engine = FakeEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        request = AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="same",
            roles=["planner"],
        )
        await runtime.submit(
            request,
            idempotency_key="key-2",
            idempotency_fingerprint="fp-a",
        )
        try:
            await runtime.submit(
                request,
                idempotency_key="key-2",
                idempotency_fingerprint="fp-b",
            )
            raised = False
        except ValueError:
            raised = True
    finally:
        await runtime.stop()

    assert raised is True


async def test_runtime_retries_transient_step_failures(tmp_path: Path) -> None:
    class FlakyEngine(FakeEngine):
        def __init__(self) -> None:
            super().__init__(loaded_models=["model-a"])
            self.remaining_failures = 1

        async def generate(
            self,
            model_id: str,
            messages: list[ChatMessage],
            priority: str = "normal",
            **kwargs: object,
        ) -> ChatCompletionResponse:
            if self.remaining_failures > 0:
                self.remaining_failures -= 1
                raise RuntimeError("Server is busy — all inference slots occupied.")
            return await super().generate(model_id, messages, priority=priority, **kwargs)

    engine = FlakyEngine()
    runtime = _make_runtime(
        tmp_path,
        engine=engine,
        runtime_overrides={
            "step_retry_attempts": 1,
            "step_retry_backoff_sec": 0.0,
        },
    )
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="retry test",
            roles=["planner"],
        ))
        await _wait_for_status(runtime, submitted.id, TERMINAL_RUN_STATES)
        run = runtime.get(submitted.id)
    finally:
        await runtime.stop()

    assert run is not None
    assert run.status == RunStatus.COMPLETED
    assert engine.remaining_failures == 0


async def test_runtime_applies_role_prompts_and_tools(tmp_path: Path) -> None:
    engine = FakeEngine(loaded_models=["model-a"])
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="tools",
            roles=["planner"],
            role_system_prompts={"planner": "You are a strict planner."},
            role_tools={
                "planner": [
                    {
                        "type": "function",
                        "function": {"name": "lookup"},
                    }
                ]
            },
        ))
        await _wait_for_status(runtime, submitted.id, TERMINAL_RUN_STATES)
        run = runtime.get(submitted.id)
    finally:
        await runtime.stop()

    assert run is not None
    assert run.status == RunStatus.COMPLETED
    assert engine.system_prompts[0] == "You are a strict planner."
    assert engine.tools_payloads[0] is not None


class HighUsageEngine(FakeEngine):
    """Engine that reports high token usage per step."""

    def __init__(
        self,
        *,
        loaded_models: list[str],
        prompt_tokens: int = 10,
        completion_tokens: int = 10,
    ) -> None:
        super().__init__(loaded_models=loaded_models)
        self._prompt_tokens = prompt_tokens
        self._completion_tokens = completion_tokens

    async def generate(
        self,
        model_id: str,
        messages: list[ChatMessage],
        priority: str = "normal",
        **kwargs: object,
    ) -> ChatCompletionResponse:
        resp = await super().generate(model_id, messages, priority=priority, **kwargs)
        total = self._prompt_tokens + self._completion_tokens
        resp.usage = Usage(
            prompt_tokens=self._prompt_tokens,
            completion_tokens=self._completion_tokens,
            total_tokens=total,
        )
        return resp


async def test_runtime_enforces_token_budget(tmp_path: Path) -> None:
    """A run with token_budget should fail when accumulated usage exceeds the limit."""
    engine = HighUsageEngine(
        loaded_models=["model-a"],
        prompt_tokens=10,
        completion_tokens=10,
    )
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="budget test",
            roles=["alpha", "beta"],
            token_budget=10,
        ))
        await _wait_for_status(runtime, submitted.id, TERMINAL_RUN_STATES)
        run = runtime.get(submitted.id)
    finally:
        await runtime.stop()

    assert run is not None
    assert run.status == RunStatus.FAILED
    assert run.error is not None
    assert "Budget exhausted" in run.error
    assert "token" in run.error


async def test_runtime_enforces_cost_budget(tmp_path: Path) -> None:
    """A run with cost_budget_usd should fail when estimated cost exceeds the limit."""

    class CostTrackingEngine(HighUsageEngine):
        """Engine that also sets estimated_cost_usd on the run."""

        async def generate(
            self,
            model_id: str,
            messages: list[ChatMessage],
            priority: str = "normal",
            **kwargs: object,
        ) -> ChatCompletionResponse:
            return await super().generate(model_id, messages, priority=priority, **kwargs)

    engine = CostTrackingEngine(
        loaded_models=["model-a"],
        prompt_tokens=5,
        completion_tokens=5,
    )
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        # Submit a two-step run with a tiny cost budget.
        # We inject estimated_cost_usd on the run after the first step
        # by using a wrapper that mutates the run.
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="cost test",
            roles=["alpha", "beta"],
            cost_budget_usd=0.001,
        ))

        # Manually set estimated_cost_usd high on the run to trigger budget check
        # before the second step executes.  Access the internal run directly.
        internal_run = runtime._runs.get(submitted.id)
        if internal_run is not None:
            internal_run.estimated_cost_usd = 0.01  # over budget

        await _wait_for_status(runtime, submitted.id, TERMINAL_RUN_STATES)
        run = runtime.get(submitted.id)
    finally:
        await runtime.stop()

    assert run is not None
    assert run.status == RunStatus.FAILED
    assert run.error is not None
    assert "Budget exhausted" in run.error
    assert "cost" in run.error


async def test_runtime_tracks_token_usage(tmp_path: Path) -> None:
    """tokens_used should accumulate across steps in a multi-step run."""
    engine = HighUsageEngine(
        loaded_models=["model-a"],
        prompt_tokens=5,
        completion_tokens=3,
    )
    runtime = _make_runtime(tmp_path, engine=engine)
    await runtime.start()
    try:
        submitted = await runtime.submit(AgentRequest(
            strategy=ExecutionStrategy.HANDOFF,
            prompt="accumulate",
            roles=["alpha", "beta", "gamma"],
        ))
        await _wait_for_status(runtime, submitted.id, TERMINAL_RUN_STATES)
        run = runtime.get(submitted.id)
    finally:
        await runtime.stop()

    assert run is not None
    assert run.status == RunStatus.COMPLETED
    # 3 steps * (5 prompt + 3 completion) = 24 tokens
    assert run.tokens_used == 24
