"""Graph executor for multi-agent strategies."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable, Mapping

from opta_lmx.agents.models import (
    AgentRun,
    AgentStep,
    ExecutionStrategy,
    RunResult,
    StepStatus,
    build_steps_for_request,
)
from opta_lmx.agents.tracing import NullTracer, TraceEvent, Tracer

StepRunner = Callable[[str, str], Awaitable[str]]
StepUpdateHook = Callable[[AgentStep], Awaitable[None]]
CancelCheck = Callable[[], bool]

_ROLE_ORDER = {
    "planner": 0,
    "coder": 1,
    "researcher": 2,
    "reviewer": 3,
}


class GraphExecutor:
    """Execute run steps according to the selected strategy."""

    def __init__(self, *, tracer: Tracer | None = None) -> None:
        self._tracer: Tracer = tracer or NullTracer()

    def build_steps(self, run: AgentRun) -> list[AgentStep]:
        """Create initial steps when a run is submitted."""
        if run.steps:
            return run.steps
        return build_steps_for_request(run.request)

    async def execute(
        self,
        run: AgentRun,
        *,
        runner: StepRunner,
        on_step_update: StepUpdateHook | None = None,
        should_cancel: CancelCheck | None = None,
        trace_metadata: Mapping[str, str] | None = None,
    ) -> RunResult:
        update_hook = on_step_update or _noop_update
        cancel_check = should_cancel or _never_cancel
        inherited_metadata = dict(trace_metadata or {})

        if not run.steps:
            run.steps = build_steps_for_request(run.request)

        if run.request.strategy == ExecutionStrategy.PARALLEL_MAP:
            return await self._parallel_map(
                run,
                runner,
                update_hook,
                cancel_check,
                inherited_metadata,
            )
        if run.request.strategy == ExecutionStrategy.ROUTER:
            return await self._router(
                run,
                runner,
                update_hook,
                cancel_check,
                inherited_metadata,
            )
        return await self._handoff(run, runner, update_hook, cancel_check, inherited_metadata)

    async def _parallel_map(
        self,
        run: AgentRun,
        runner: StepRunner,
        update_hook: StepUpdateHook,
        cancel_check: CancelCheck,
        trace_metadata: Mapping[str, str],
    ) -> dict[str, str]:
        semaphore = asyncio.Semaphore(run.request.max_parallelism)
        outputs: dict[str, str] = {}

        async def _run(step: AgentStep) -> None:
            async with semaphore:
                output = await self._execute_step(
                    run_id=run.id,
                    step=step,
                    input_text=run.request.prompt,
                    runner=runner,
                    update_hook=update_hook,
                    cancel_check=cancel_check,
                    trace_metadata=trace_metadata,
                )
                outputs[step.role] = output

        async with asyncio.TaskGroup() as task_group:
            for step in run.steps:
                task_group.create_task(_run(step))

        return outputs

    async def _router(
        self,
        run: AgentRun,
        runner: StepRunner,
        update_hook: StepUpdateHook,
        cancel_check: CancelCheck,
        trace_metadata: Mapping[str, str],
    ) -> dict[str, str]:
        ordered = sorted(run.steps, key=_router_sort_key)
        outputs: dict[str, str] = {}
        for step in ordered:
            outputs[step.role] = await self._execute_step(
                run_id=run.id,
                step=step,
                input_text=run.request.prompt,
                runner=runner,
                update_hook=update_hook,
                cancel_check=cancel_check,
                trace_metadata=trace_metadata,
            )
        return outputs

    async def _handoff(
        self,
        run: AgentRun,
        runner: StepRunner,
        update_hook: StepUpdateHook,
        cancel_check: CancelCheck,
        trace_metadata: Mapping[str, str],
    ) -> str:
        next_input = run.request.prompt
        for step in run.steps:
            next_input = await self._execute_step(
                run_id=run.id,
                step=step,
                input_text=next_input,
                runner=runner,
                update_hook=update_hook,
                cancel_check=cancel_check,
                trace_metadata=trace_metadata,
            )
        return next_input

    async def _execute_step(
        self,
        *,
        run_id: str,
        step: AgentStep,
        input_text: str,
        runner: StepRunner,
        update_hook: StepUpdateHook,
        cancel_check: CancelCheck,
        trace_metadata: Mapping[str, str],
    ) -> str:
        if cancel_check():
            raise asyncio.CancelledError

        step.input = input_text
        step.status = StepStatus.RUNNING
        step.started_at = time.time()
        await update_hook(step)
        self._tracer.emit(TraceEvent(
            run_id=run_id,
            step_id=step.id,
            event="step_started",
            metadata=dict(trace_metadata),
        ))

        try:
            output = await runner(step.role, input_text)
            step.output = output
            step.status = StepStatus.COMPLETED
            return output
        except asyncio.CancelledError:
            step.status = StepStatus.CANCELLED
            step.error = "Step cancelled"
            raise
        except Exception as exc:
            step.status = StepStatus.FAILED
            step.error = str(exc)
            raise
        finally:
            step.completed_at = time.time()
            await update_hook(step)
            self._tracer.emit(TraceEvent(
                run_id=run_id,
                step_id=step.id,
                event="step_finished",
                status=step.status,
                metadata=dict(trace_metadata),
            ))


async def _noop_update(step: AgentStep) -> None:
    return


def _never_cancel() -> bool:
    return False


def _router_sort_key(step: AgentStep) -> tuple[int, int]:
    return (_ROLE_ORDER.get(step.role.lower(), len(_ROLE_ORDER)), step.order)
