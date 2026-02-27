"""Runtime orchestration for multi-agent execution."""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from collections.abc import Mapping
from typing import Any, Protocol

logger = logging.getLogger(__name__)

from opta_lmx.agents.graph import GraphExecutor
from opta_lmx.agents.models import (
    TERMINAL_RUN_STATES,
    AgentRequest,
    AgentRun,
    BudgetExhaustedError,
    RunPriority,
    RunStatus,
    StepStatus,
)
from opta_lmx.agents.scheduler import RunQueueFullError, RunScheduler
from opta_lmx.agents.state_store import AgentsStateStore
from opta_lmx.agents.tracing import NullTracer, TraceEvent, Tracer
from opta_lmx.inference.schema import ChatMessage
from opta_lmx.monitoring.metrics import AgentRunMetric, MetricsCollector

RoleTools = list[dict[str, Any]]


class EngineProtocol(Protocol):
    """Subset of inference engine used by the agents runtime."""

    def get_loaded_model_ids(self) -> list[str]:
        """Return all loaded model IDs."""

    def is_model_loaded(self, model_id: str) -> bool:
        """Return True if model is loaded."""

    def get_model_load_snapshot(self, model_ids: list[str] | None = None) -> dict[str, float]:
        """Return best-effort model load snapshot for routing decisions."""

    async def generate(
        self,
        model_id: str,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        top_p: float = 0.95,
        stop: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
        response_format: dict[str, Any] | None = None,
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0,
        priority: str = "normal",
        num_ctx: int | None = None,
        client_id: str | None = None,
    ) -> object:
        """Generate a non-streaming response."""


class RouterProtocol(Protocol):
    """Subset of router used by the agents runtime."""

    def resolve(
        self,
        model_id: str,
        loaded_model_ids: list[str],
        *,
        client_id: str | None = None,
        model_load_snapshot: Mapping[str, float | int] | None = None,
    ) -> str:
        """Resolve aliases to loaded model IDs."""


class AgentsRuntime:
    """In-process async runtime for multi-agent runs."""

    def __init__(
        self,
        *,
        engine: EngineProtocol,
        router: RouterProtocol,
        state_store: AgentsStateStore | None = None,
        scheduler: RunScheduler | None = None,
        graph_executor: GraphExecutor | None = None,
        tracer: Tracer | None = None,
        metrics_collector: MetricsCollector | None = None,
        max_steps_per_run: int = 32,
        retain_completed_runs: int = 500,
        step_retry_attempts: int = 2,
        step_retry_backoff_sec: float = 0.5,
    ) -> None:
        self._engine = engine
        self._router = router
        self._tracer: Tracer = tracer or NullTracer()
        self._metrics = metrics_collector
        self._state_store = state_store or AgentsStateStore()
        self._scheduler = scheduler or RunScheduler()
        self._graph = graph_executor or GraphExecutor(tracer=self._tracer)
        self._max_steps_per_run = max_steps_per_run
        self._retain_completed_runs = retain_completed_runs
        self._step_retry_attempts = max(0, step_retry_attempts)
        self._step_retry_backoff_sec = max(0.0, step_retry_backoff_sec)
        self._started = False
        self._run_tasks: dict[str, asyncio.Task[None]] = {}
        self._submit_lock = asyncio.Lock()
        self._runs: dict[str, AgentRun] = {
            run.id: run for run in self._state_store.list_runs()
        }
        self._restore_incomplete_runs()

    async def start(self) -> None:
        """Start queue workers."""
        if self._started:
            return
        await self._scheduler.start(self._run_from_queue)
        self._started = True

    async def stop(self) -> None:
        """Stop queue workers."""
        if not self._started:
            return
        await self._scheduler.stop()
        self._started = False

    async def submit(
        self,
        request: AgentRequest,
        *,
        idempotency_key: str | None = None,
        idempotency_fingerprint: str = "",
    ) -> AgentRun:
        """Create and enqueue a new run."""
        if not self._started:
            raise RuntimeError("Agents runtime is not started")
        if len(request.roles) > self._max_steps_per_run:
            raise ValueError(
                f"Run has {len(request.roles)} steps but max_steps_per_run is "
                f"{self._max_steps_per_run}."
            )
        normalized_key = idempotency_key.strip() if isinstance(idempotency_key, str) else ""

        async with self._submit_lock:
            if normalized_key:
                existing = self._state_store.get_idempotency(normalized_key)
                if existing is not None:
                    run_id, fingerprint = existing
                    if (
                        fingerprint
                        and idempotency_fingerprint
                        and fingerprint != idempotency_fingerprint
                    ):
                        raise ValueError(
                            "Idempotency key already used with a different request payload."
                        )
                    existing_run = self._runs.get(run_id)
                    if existing_run is None:
                        existing_run = self._state_store.get_run(run_id)
                        if existing_run is not None:
                            self._runs[run_id] = existing_run
                    if existing_run is not None:
                        return existing_run.model_copy(deep=True)
                    self._state_store.clear_idempotency(normalized_key)

            status = (
                RunStatus.WAITING_APPROVAL
                if request.approval_required
                else RunStatus.QUEUED
            )
            run = AgentRun(
                id=uuid.uuid4().hex,
                request=request,
                status=status,
                steps=[],
            )
            run.steps = self._graph.build_steps(run)
            self._record_run(run)
            if normalized_key:
                self._state_store.bind_idempotency(
                    normalized_key,
                    run.id,
                    idempotency_fingerprint,
                )
            self._tracer.emit(TraceEvent(
                run_id=run.id,
                event="run_submitted",
                status=run.status,
                metadata=self._trace_metadata(run),
            ))

            if run.status == RunStatus.QUEUED:
                try:
                    await self._scheduler.submit(run.id, priority=run.request.priority.value)
                except RunQueueFullError as exc:
                    run.status = RunStatus.FAILED
                    run.error = f"{exc}. Retry when queue pressure drops."
                    run.updated_at = time.time()
                    self._record_run(run)
                    self._tracer.emit(TraceEvent(
                        run_id=run.id,
                        event="run_submission_failed",
                        status=run.status,
                        message=run.error,
                        metadata=self._trace_metadata(run),
                    ))
                except RuntimeError as exc:
                    run.status = RunStatus.FAILED
                    run.error = str(exc)
                    run.updated_at = time.time()
                    self._record_run(run)
                    self._tracer.emit(TraceEvent(
                        run_id=run.id,
                        event="run_submission_failed",
                        status=run.status,
                        message=run.error,
                        metadata=self._trace_metadata(run),
                    ))

            return run.model_copy(deep=True)

    def get(self, run_id: str) -> AgentRun | None:
        """Get one run by ID."""
        run = self._runs.get(run_id)
        if run is None:
            return None
        return run.model_copy(deep=True)

    def list(self, status: RunStatus | None = None) -> list[AgentRun]:
        """List known runs, newest first."""
        runs = [run.model_copy(deep=True) for run in self._runs.values()]
        if status is not None:
            runs = [run for run in runs if run.status == status]
        runs.sort(key=lambda run: run.created_at, reverse=True)
        return runs

    async def cancel(self, run_id: str) -> bool:
        """Cancel a queued or running run."""
        run = self._runs.get(run_id)
        if run is None:
            return False
        if run.status in TERMINAL_RUN_STATES:
            return run.status == RunStatus.CANCELLED

        self._mark_run_cancelled(run, reason="Run cancelled")
        self._record_run(run)
        task = self._run_tasks.get(run_id)
        if task is not None:
            task.cancel()
        self._tracer.emit(TraceEvent(
            run_id=run.id,
            event="run_cancelled",
            status=run.status,
            metadata=self._trace_metadata(run),
        ))
        return True

    async def _run_from_queue(self, run_id: str) -> None:
        run_task = asyncio.create_task(self._execute_run(run_id), name=f"agents-run-{run_id}")
        self._run_tasks[run_id] = run_task
        try:
            await run_task
        finally:
            self._run_tasks.pop(run_id, None)

    async def _execute_run(self, run_id: str) -> None:
        run = self._runs.get(run_id)
        if run is None:
            return
        if run.status in TERMINAL_RUN_STATES:
            return
        if run.status == RunStatus.WAITING_APPROVAL:
            return
        if run.status == RunStatus.CANCELLED:
            return

        run.status = RunStatus.RUNNING
        run.error = None
        run.updated_at = time.time()
        started_at = time.monotonic()
        self._record_run(run)
        self._tracer.emit(TraceEvent(
            run_id=run.id,
            event="run_started",
            status=run.status,
            metadata=self._trace_metadata(run),
        ))

        try:
            run.resolved_model = self._resolve_model_for_requested(run.request.model)
            self._record_run(run)

            graph_coro = self._graph.execute(
                run,
                runner=lambda role, step_input: self._run_step(run, role, step_input),
                on_step_update=lambda _step: self._on_step_update(run),
                should_cancel=lambda: run.status == RunStatus.CANCELLED,
                trace_metadata=self._trace_metadata(run),
            )
            if run.request.timeout_sec is not None:
                result = await asyncio.wait_for(graph_coro, timeout=run.request.timeout_sec)
            else:
                result = await graph_coro
            if run.status != RunStatus.CANCELLED:
                run.result = result
                run.status = RunStatus.COMPLETED
                run.error = None
        except asyncio.CancelledError:
            self._mark_run_cancelled(run, reason="Run cancelled")
        except BudgetExhaustedError as exc:
            if run.status != RunStatus.CANCELLED:
                run.status = RunStatus.FAILED
                run.error = (
                    f"Budget exhausted: {exc.budget_type} "
                    f"used {exc.used:.2f} of {exc.limit:.2f} limit"
                )
        except TimeoutError:
            if run.status != RunStatus.CANCELLED:
                run.status = RunStatus.FAILED
                run.error = "Run exceeded configured timeout"
        except Exception as exc:
            if run.status != RunStatus.CANCELLED:
                run.status = RunStatus.FAILED
                run.error = str(exc)
        finally:
            run.updated_at = time.time()
            self._record_run(run)
            self._tracer.emit(TraceEvent(
                run_id=run.id,
                event="run_finished",
                status=run.status,
                message=run.error,
                metadata=self._trace_metadata(run),
            ))
            if self._metrics is not None and run.status in TERMINAL_RUN_STATES:
                self._metrics.record_agent_run(
                    AgentRunMetric(
                        run_id=run.id,
                        status=run.status.value,
                        duration_sec=max(0.0, time.monotonic() - started_at),
                        model_id=run.resolved_model or run.request.model,
                        role_count=len(run.request.roles),
                    )
                )

    async def _on_step_update(self, run: AgentRun) -> None:
        run.updated_at = time.time()
        # Update checkpoint to last completed step for resumable recovery
        completed_steps = [s for s in run.steps if s.status == StepStatus.COMPLETED]
        if completed_steps:
            run.checkpoint_pointer = completed_steps[-1].id
        self._record_run(run)

    def _check_budget(self, run: AgentRun) -> None:
        """Check if run has exceeded its budget constraints."""
        if run.request.token_budget is not None:
            if run.tokens_used >= run.request.token_budget:
                raise BudgetExhaustedError(
                    budget_type="token",
                    used=float(run.tokens_used),
                    limit=float(run.request.token_budget),
                )
        if run.request.cost_budget_usd is not None:
            if run.estimated_cost_usd >= run.request.cost_budget_usd:
                raise BudgetExhaustedError(
                    budget_type="cost",
                    used=run.estimated_cost_usd,
                    limit=run.request.cost_budget_usd,
                )

    async def _run_step(self, run: AgentRun, role: str, step_input: str) -> str:
        self._check_budget(run)

        model_id = self._resolve_model_for_role(run, role)
        priority = self._inference_priority_for_run(run)
        system_prompt = self._system_prompt_for_role(run, role)
        role_tools = self._tools_for_role(run, role)
        attempts_total = self._step_retry_attempts + 1
        response: object | None = None

        for attempt_index in range(attempts_total):
            try:
                response = await self._engine.generate(
                    model_id=model_id,
                    messages=[
                        ChatMessage(role="system", content=system_prompt),
                        ChatMessage(role="user", content=step_input),
                    ],
                    priority=priority,
                    tools=role_tools,
                    client_id=run.request.submitted_by,
                )
                break
            except Exception as exc:
                is_last_attempt = attempt_index >= attempts_total - 1
                if is_last_attempt or not self._is_retryable_step_error(exc):
                    raise
                delay_sec = self._step_retry_backoff_sec * (2 ** attempt_index)
                metadata = self._trace_metadata(run)
                metadata["retry_attempt"] = str(attempt_index + 1)
                metadata["retry_delay_sec"] = f"{delay_sec:.3f}"
                self._tracer.emit(TraceEvent(
                    run_id=run.id,
                    event="step_retry",
                    status=run.status,
                    message=str(exc),
                    metadata=metadata,
                ))
                await asyncio.sleep(delay_sec)

        if response is not None:
            usage = getattr(response, "usage", None)
            if usage is not None:
                prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
                completion_tokens = getattr(usage, "completion_tokens", 0) or 0
                run.tokens_used += prompt_tokens + completion_tokens
                self._record_run(run)

        if response is None:
            return ""
        choices = getattr(response, "choices", None)
        if not isinstance(choices, list) or not choices:
            return ""
        first = choices[0]
        message = getattr(first, "message", None)
        content = getattr(message, "content", None)
        if isinstance(content, str):
            return content
        return ""

    def _resolve_model_for_role(self, run: AgentRun, role: str) -> str:
        direct = run.request.role_models.get(role)
        if isinstance(direct, str) and direct:
            return self._resolve_model_for_requested(direct)

        role_lower = role.lower()
        for mapped_role, mapped_model in run.request.role_models.items():
            if mapped_role.lower() == role_lower:
                return self._resolve_model_for_requested(mapped_model)

        return self._resolve_model_for_requested(run.request.model)

    @staticmethod
    def _system_prompt_for_role(run: AgentRun, role: str) -> str:
        direct = run.request.role_system_prompts.get(role)
        if isinstance(direct, str) and direct:
            return direct

        role_lower = role.lower()
        for mapped_role, prompt in run.request.role_system_prompts.items():
            if mapped_role.lower() == role_lower and prompt:
                return prompt

        return f"You are acting as the {role} agent."

    @staticmethod
    def _tools_for_role(run: AgentRun, role: str) -> RoleTools | None:
        direct = run.request.role_tools.get(role)
        if direct is not None:
            return direct

        role_lower = role.lower()
        for mapped_role, tools in run.request.role_tools.items():
            if mapped_role.lower() == role_lower:
                return tools
        return None

    @staticmethod
    def _is_retryable_step_error(exc: Exception) -> bool:
        message = str(exc).lower()
        retryable_markers = (
            "timed out",
            "timeout",
            "server is busy",
            "temporarily unavailable",
            "connection reset",
            "rate limit",
        )
        return any(marker in message for marker in retryable_markers)

    def _resolve_model_for_requested(self, requested: str) -> str:
        loaded_models = self._engine.get_loaded_model_ids()
        if not loaded_models:
            raise RuntimeError(
                "No models are currently loaded. "
                "Load a model before submitting agent runs."
            )

        load_snapshot: Mapping[str, float | int] | None = None
        snapshot_provider = getattr(self._engine, "get_model_load_snapshot", None)
        if callable(snapshot_provider):
            maybe_snapshot = snapshot_provider(loaded_models)
            if isinstance(maybe_snapshot, Mapping):
                load_snapshot = maybe_snapshot
        resolved = self._router.resolve(
            requested,
            loaded_models,
            model_load_snapshot=load_snapshot,
        )
        if not self._engine.is_model_loaded(resolved):
            raise RuntimeError(
                f"Resolved model '{resolved}' is not loaded for requested model '{requested}'."
            )
        return resolved

    @staticmethod
    def _inference_priority_for_run(run: AgentRun) -> str:
        if run.request.priority == RunPriority.INTERACTIVE:
            return "high"
        return "normal"

    @staticmethod
    def _trace_metadata(run: AgentRun) -> dict[str, str]:
        metadata: dict[str, str] = {
            "priority": run.request.priority.value,
        }
        if run.request.traceparent:
            metadata["traceparent"] = run.request.traceparent
        if run.request.tracestate:
            metadata["tracestate"] = run.request.tracestate
        if run.request.submitted_by:
            metadata["submitted_by"] = run.request.submitted_by
        return metadata

    def _record_run(self, run: AgentRun) -> None:
        self._runs[run.id] = run
        self._prune_completed_runs()
        self._state_store.upsert_run(run)

    def _prune_completed_runs(self) -> None:
        terminal_runs = [
            run for run in self._runs.values() if run.status in TERMINAL_RUN_STATES
        ]
        overflow = len(terminal_runs) - self._retain_completed_runs
        if overflow <= 0:
            return

        terminal_runs.sort(key=lambda run: run.updated_at)
        for stale in terminal_runs[:overflow]:
            self._runs.pop(stale.id, None)
            self._state_store.delete_run(stale.id)

    def _restore_incomplete_runs(self) -> None:
        for run in self._runs.values():
            if run.status in {RunStatus.QUEUED, RunStatus.RUNNING}:
                run.status = RunStatus.FAILED
                run.error = (
                    "Run was interrupted before completion and was marked failed on startup."
                )
                run.updated_at = time.time()
                self._state_store.upsert_run(run)
                logger.info(
                    "agents_run_restored_as_failed",
                    extra={
                        "run_id": run.id,
                        "checkpoint_pointer": run.checkpoint_pointer,
                    },
                )

    def _mark_run_cancelled(self, run: AgentRun, *, reason: str) -> None:
        run.status = RunStatus.CANCELLED
        run.error = reason
        run.updated_at = time.time()
        for step in run.steps:
            if step.status in {StepStatus.QUEUED, StepStatus.RUNNING, StepStatus.WAITING_APPROVAL}:
                step.status = StepStatus.CANCELLED
                step.error = reason
                step.completed_at = time.time()
