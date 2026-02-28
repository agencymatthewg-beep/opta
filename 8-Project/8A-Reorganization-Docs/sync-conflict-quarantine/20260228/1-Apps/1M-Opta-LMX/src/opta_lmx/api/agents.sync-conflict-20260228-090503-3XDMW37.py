"""Agent runtime API routes: /v1/agents/runs*."""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
import time
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from starlette.responses import Response

from opta_lmx.agents.models import (
    TERMINAL_RUN_STATES,
    AgentRequest,
    AgentRun,
    AgentStep,
    ExecutionStrategy,
    RunPriority,
    RunStatus,
)
from opta_lmx.api.deps import AgentRuntimeDep, verify_inference_key

router = APIRouter(tags=["agents"], dependencies=[Depends(verify_inference_key)])
_TRACEPARENT_PATTERN = re.compile(r"^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$")


class AgentRunCreateRequest(BaseModel):
    """Create request for an agent run.

    Supports native multi-agent requests and a legacy agent/input shape.
    """

    request: AgentRequest | None = Field(
        None,
        description="Native multi-agent request payload",
    )
    agent: str | None = Field(
        None,
        min_length=1,
        description="Legacy single-agent identifier (maps to one role)",
    )
    input: dict[str, Any] = Field(
        default_factory=dict,
        description="Legacy structured input payload",
    )
    metadata: dict[str, Any] = Field(default_factory=dict, description="Optional run metadata")


class AgentRunResponse(BaseModel):
    """Serialized agent run state."""

    object: str = "agent.run"
    id: str
    status: RunStatus
    request: AgentRequest
    steps: list[AgentStep]
    result: Any | None = None
    output: Any | None = None
    error: str | None = None
    resolved_model: str | None = None
    created_at: float
    updated_at: float


class AgentRunListResponse(BaseModel):
    """Paginated list response for agent runs."""

    object: str = "list"
    data: list[AgentRunResponse]
    total: int


def _serialize_run(run: AgentRun) -> AgentRunResponse:
    """Convert runtime record to response model."""
    return AgentRunResponse(
        id=run.id,
        status=run.status,
        request=run.request,
        steps=run.steps,
        result=run.result,
        output=run.result,
        error=run.error,
        resolved_model=run.resolved_model,
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


def _default_agent_from_request(request: Request) -> str:
    """Resolve default role/agent from app config with safe fallback."""
    config = getattr(request.app.state, "config", None)
    if config is None:
        return "default"

    agents_config = getattr(config, "agents", None)
    default_agent = getattr(agents_config, "default_agent", None)
    if isinstance(default_agent, str) and default_agent:
        return default_agent
    return "default"


def _coerce_legacy_request(body: AgentRunCreateRequest, request: Request) -> AgentRequest:
    payload = body.input
    default_agent = _default_agent_from_request(request)

    strategy = ExecutionStrategy.HANDOFF
    strategy_raw = payload.get("strategy")
    if isinstance(strategy_raw, str):
        with_value_error = strategy_raw.strip().lower()
        try:
            strategy = ExecutionStrategy(with_value_error)
        except ValueError:
            strategy = ExecutionStrategy.HANDOFF

    prompt_raw = payload.get("prompt")
    if isinstance(prompt_raw, str) and prompt_raw.strip():
        prompt = prompt_raw
    else:
        message_raw = payload.get("message")
        if isinstance(message_raw, str) and message_raw.strip():
            prompt = message_raw
        elif payload:
            prompt = json.dumps(payload, sort_keys=True)
        else:
            prompt = "Run task"

    roles_raw = payload.get("roles")
    roles: list[str]
    if isinstance(roles_raw, list):
        roles = [item.strip() for item in roles_raw if isinstance(item, str) and item.strip()]
    else:
        roles = []
    if not roles:
        roles = [body.agent or default_agent]

    model_raw = payload.get("model")
    model = model_raw if isinstance(model_raw, str) and model_raw.strip() else "auto"

    max_parallelism_raw = payload.get("max_parallelism")
    max_parallelism = max_parallelism_raw if isinstance(max_parallelism_raw, int) else 4

    priority = RunPriority.NORMAL
    priority_raw = payload.get("priority")
    if isinstance(priority_raw, str):
        try:
            priority = RunPriority(priority_raw.strip().lower())
        except ValueError:
            priority = RunPriority.NORMAL

    role_models_raw = payload.get("role_models")
    role_models = role_models_raw if isinstance(role_models_raw, dict) else {}

    timeout_sec_raw = payload.get("timeout_sec")
    timeout_sec: float | None
    if isinstance(timeout_sec_raw, (int, float)) and timeout_sec_raw > 0:
        timeout_sec = float(timeout_sec_raw)
    else:
        timeout_sec = None

    metadata = dict(body.metadata)
    payload_metadata = payload.get("metadata")
    if isinstance(payload_metadata, dict):
        metadata = {**payload_metadata, **metadata}

    return AgentRequest(
        strategy=strategy,
        prompt=prompt,
        roles=roles,
        model=model,
        role_models=role_models,
        max_parallelism=max_parallelism,
        timeout_sec=timeout_sec,
        priority=priority,
        metadata=metadata,
        approval_required=bool(payload.get("approval_required", False)),
    )


def _build_request(body: AgentRunCreateRequest, request: Request) -> AgentRequest:
    if body.request is None:
        return _coerce_legacy_request(body, request)

    if not body.metadata:
        return body.request

    merged = {**body.request.metadata, **body.metadata}
    return body.request.model_copy(update={"metadata": merged})


def _is_valid_traceparent(value: str) -> bool:
    lowered = value.lower()
    if not _TRACEPARENT_PATTERN.fullmatch(lowered):
        return False
    _, trace_id, parent_id, _ = lowered.split("-")
    if trace_id == "0" * 32:
        return False
    return parent_id != "0" * 16


def _agent_limits(request: Request) -> tuple[int, float]:
    config = getattr(request.app.state, "config", None)
    agents_cfg = getattr(config, "agents", None)
    max_steps = getattr(agents_cfg, "max_steps_per_run", 32)
    default_timeout = getattr(agents_cfg, "default_timeout_sec", 120.0)
    return int(max_steps), float(default_timeout)


def _agent_error(
    *,
    status_code: int,
    message: str,
    code: str,
    retry_after: int | None = None,
) -> JSONResponse:
    """Return machine-readable agent API error payloads."""
    headers: dict[str, str] = {}
    if retry_after is not None:
        headers["Retry-After"] = str(retry_after)
    payload: dict[str, Any] = {
        "error": {
            "message": message,
            "type": "server_error",
            "code": code,
        }
    }
    if retry_after is not None:
        payload["error"]["retry_after"] = retry_after
    return JSONResponse(status_code=status_code, content=payload, headers=headers)


def _fingerprint_request(request: AgentRequest) -> str:
    """Build a stable request fingerprint for idempotency checks."""
    raw = json.dumps(
        request.model_dump(mode="json", exclude_none=False),
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _run_snapshot_payload(run: AgentRun) -> dict[str, Any]:
    return {
        "id": run.id,
        "status": run.status.value,
        "error": run.error,
        "updated_at": run.updated_at,
        "result": run.result,
        "steps": [
            {
                "id": step.id,
                "role": step.role,
                "status": step.status.value,
                "error": step.error,
                "completed_at": step.completed_at,
            }
            for step in run.steps
        ],
    }


async def _run_events_stream(
    runtime: AgentRuntimeDep,
    run_id: str,
    *,
    poll_interval_sec: float = 0.25,
    heartbeat_interval_sec: float = 10.0,
) -> AsyncIterator[str]:
    """SSE stream of run snapshots until terminal state."""
    started = time.monotonic()
    next_heartbeat = started + heartbeat_interval_sec
    last_payload: dict[str, Any] | None = None

    while True:
        run = runtime.get(run_id)
        if run is None:
            error_payload: dict[str, Any] = {
                "type": "run.error",
                "run_id": run_id,
                "error": "Run not found",
                "code": "run_not_found",
            }
            yield f"event: run.error\ndata: {json.dumps(error_payload)}\n\n"
            break

        snapshot = _run_snapshot_payload(run)
        if snapshot != last_payload:
            update_payload: dict[str, Any] = {"type": "run.update", "run": snapshot}
            yield f"event: run.update\ndata: {json.dumps(update_payload)}\n\n"
            last_payload = snapshot

        if run.status in TERMINAL_RUN_STATES:
            done_payload: dict[str, Any] = {"type": "run.completed", "run": snapshot}
            yield f"event: run.completed\ndata: {json.dumps(done_payload)}\n\n"
            break

        now = time.monotonic()
        if now >= next_heartbeat:
            yield ": keep-alive\n\n"
            next_heartbeat = now + heartbeat_interval_sec
        await asyncio.sleep(poll_interval_sec)

    yield "data: [DONE]\n\n"


@router.post("/v1/agents/runs", response_model=AgentRunResponse, status_code=201)
async def create_agent_run(
    body: AgentRunCreateRequest,
    request: Request,
    runtime: AgentRuntimeDep,
    traceparent: Annotated[str | None, Header()] = None,
    tracestate: Annotated[str | None, Header()] = None,
    x_priority: Annotated[str | None, Header()] = None,
    x_user_id: Annotated[str | None, Header()] = None,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> Response:
    """Create and start an agent run."""
    agent_request = _build_request(body, request)

    max_steps, default_timeout = _agent_limits(request)
    if len(agent_request.roles) > max_steps:
        raise HTTPException(
            status_code=400,
            detail=f"Run has {len(agent_request.roles)} steps but max is {max_steps}",
        )
    if agent_request.timeout_sec is None:
        agent_request = agent_request.model_copy(update={"timeout_sec": default_timeout})

    if x_priority is not None and x_priority.strip():
        try:
            priority = RunPriority(x_priority.strip().lower())
            agent_request = agent_request.model_copy(update={"priority": priority})
        except ValueError:
            pass

    if traceparent is not None:
        candidate = traceparent.strip().lower()
        if not _is_valid_traceparent(candidate):
            raise HTTPException(status_code=400, detail="Invalid traceparent header")
        agent_request = agent_request.model_copy(update={"traceparent": candidate})
    if tracestate is not None:
        agent_request = agent_request.model_copy(update={"tracestate": tracestate.strip()})
    if x_user_id is not None and x_user_id.strip():
        agent_request = agent_request.model_copy(update={"submitted_by": x_user_id.strip()})

    try:
        run = await runtime.submit(
            agent_request,
            idempotency_key=idempotency_key,
            idempotency_fingerprint=_fingerprint_request(agent_request),
        )
    except ValueError as exc:
        message = str(exc)
        if "Idempotency key" in message:
            return _agent_error(
                status_code=409,
                message=message,
                code="idempotency_conflict",
            )
        raise HTTPException(status_code=400, detail=message) from exc
    except RuntimeError as exc:
        return _agent_error(
            status_code=503,
            message=str(exc),
            code="runtime_unavailable",
        )

    if run.status == RunStatus.FAILED and run.error and "Run queue is full" in run.error:
        return _agent_error(
            status_code=429,
            message=run.error,
            code="queue_saturated",
            retry_after=5,
        )

    return JSONResponse(
        status_code=201,
        content=_serialize_run(run).model_dump(mode="json"),
    )


@router.get("/v1/agents/runs", response_model=AgentRunListResponse)
async def list_agent_runs(
    runtime: AgentRuntimeDep,
    limit: Annotated[int, Query(ge=1, le=200, description="Maximum runs to return")] = 50,
    offset: Annotated[int, Query(ge=0, description="Number of runs to skip")] = 0,
    status: Annotated[RunStatus | None, Query(description="Filter by run status")] = None,
) -> AgentRunListResponse:
    """List runs by recency."""
    runs = runtime.list(status=status)
    total = len(runs)
    page = runs[offset : offset + limit]
    return AgentRunListResponse(data=[_serialize_run(run) for run in page], total=total)


@router.get("/v1/agents/runs/{run_id}", response_model=AgentRunResponse)
async def get_agent_run(run_id: str, runtime: AgentRuntimeDep) -> AgentRunResponse:
    """Get a single run by ID."""
    run = runtime.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return _serialize_run(run)


@router.post("/v1/agents/runs/{run_id}/cancel", response_model=AgentRunResponse)
async def cancel_agent_run(run_id: str, runtime: AgentRuntimeDep) -> AgentRunResponse:
    """Cancel a queued or running run."""
    run = runtime.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    await runtime.cancel(run_id)
    refreshed = runtime.get(run_id)
    if refreshed is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return _serialize_run(refreshed)


@router.get("/v1/agents/runs/{run_id}/events")
async def stream_agent_run_events(run_id: str, runtime: AgentRuntimeDep) -> Response:
    """Stream run lifecycle updates as SSE events."""
    run = runtime.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    return StreamingResponse(
        _run_events_stream(runtime, run_id),
        media_type="text/event-stream",
    )
