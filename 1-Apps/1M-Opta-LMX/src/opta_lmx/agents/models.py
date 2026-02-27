"""Pydantic models for multi-agent runtime runs, steps, and requests."""

from __future__ import annotations

import time
import uuid
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class RunStatus(StrEnum):
    """Lifecycle states for a run."""

    QUEUED = "queued"
    RUNNING = "running"
    WAITING_APPROVAL = "waiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepStatus(StrEnum):
    """Lifecycle states for an individual step."""

    QUEUED = "queued"
    RUNNING = "running"
    WAITING_APPROVAL = "waiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ExecutionStrategy(StrEnum):
    """Execution topology for the run graph."""

    PARALLEL_MAP = "parallel_map"
    ROUTER = "router"
    HANDOFF = "handoff"


class RunPriority(StrEnum):
    """Queue priority for an agent run."""

    INTERACTIVE = "interactive"
    NORMAL = "normal"
    BATCH = "batch"


class AgentRequest(BaseModel):
    """A request for a multi-agent run."""

    strategy: ExecutionStrategy
    prompt: str = Field(min_length=1)
    roles: list[str] = Field(min_length=1)
    model: str = "auto"
    role_models: dict[str, str] = Field(default_factory=dict)
    role_system_prompts: dict[str, str] = Field(default_factory=dict)
    role_tools: dict[str, list[dict[str, Any]]] = Field(default_factory=dict)
    max_parallelism: int = Field(default=4, ge=1, le=64)
    timeout_sec: float | None = Field(default=None, gt=0.0, le=3600.0)
    priority: RunPriority = RunPriority.NORMAL
    metadata: dict[str, Any] = Field(default_factory=dict)
    traceparent: str | None = None
    tracestate: str | None = None
    submitted_by: str | None = None
    approval_required: bool = False
    token_budget: int | None = Field(
        default=None,
        gt=0,
        description="Max total tokens (prompt + completion) for this run",
    )
    cost_budget_usd: float | None = Field(
        default=None,
        gt=0.0,
        description="Max estimated cost in USD for this run",
    )

    @field_validator("roles")
    @classmethod
    def _normalize_roles(cls, value: list[str]) -> list[str]:
        normalized = [role.strip() for role in value if role.strip()]
        if not normalized:
            raise ValueError("roles must contain at least one non-empty role")
        return normalized

    @field_validator("role_models")
    @classmethod
    def _normalize_role_models(cls, value: dict[str, str]) -> dict[str, str]:
        normalized: dict[str, str] = {}
        for role, model in value.items():
            role_name = role.strip()
            model_name = model.strip()
            if role_name and model_name:
                normalized[role_name] = model_name
        return normalized

    @field_validator("role_system_prompts")
    @classmethod
    def _normalize_role_prompts(cls, value: dict[str, str]) -> dict[str, str]:
        normalized: dict[str, str] = {}
        for role, prompt in value.items():
            role_name = role.strip()
            prompt_text = prompt.strip()
            if role_name and prompt_text:
                normalized[role_name] = prompt_text
        return normalized

    @field_validator("role_tools")
    @classmethod
    def _normalize_role_tools(
        cls,
        value: dict[str, list[dict[str, Any]]],
    ) -> dict[str, list[dict[str, Any]]]:
        normalized: dict[str, list[dict[str, Any]]] = {}
        for role, tools in value.items():
            role_name = role.strip()
            if not role_name:
                continue
            filtered = [tool for tool in tools if isinstance(tool, dict)]
            normalized[role_name] = filtered
        return normalized


class AgentStep(BaseModel):
    """A single unit of work performed by one role."""

    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    role: str
    order: int = 0
    status: StepStatus = StepStatus.QUEUED
    input: str = ""
    output: str | None = None
    error: str | None = None
    created_at: float = Field(default_factory=time.time)
    started_at: float | None = None
    completed_at: float | None = None


RunResult = str | dict[str, str]


class AgentRun(BaseModel):
    """A run and its step-level execution state."""

    id: str
    request: AgentRequest
    status: RunStatus = RunStatus.QUEUED
    steps: list[AgentStep] = Field(default_factory=list)
    result: RunResult | None = None
    error: str | None = None
    resolved_model: str | None = None
    checkpoint_pointer: str | None = Field(default=None, description="Last completed step ID for resumable recovery")
    tokens_used: int = Field(default=0, ge=0)
    estimated_cost_usd: float = Field(default=0.0, ge=0.0)
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)


TERMINAL_RUN_STATES: set[RunStatus] = {
    RunStatus.COMPLETED,
    RunStatus.FAILED,
    RunStatus.CANCELLED,
}


class BudgetExhaustedError(RuntimeError):
    """Raised when a run exceeds its configured token or cost budget."""

    def __init__(self, *, budget_type: str, used: float, limit: float) -> None:
        self.budget_type = budget_type
        self.used = used
        self.limit = limit
        super().__init__(f"{budget_type} budget exhausted: {used:.2f}/{limit:.2f}")


def build_steps_for_request(request: AgentRequest) -> list[AgentStep]:
    """Create initial queued steps from request roles."""
    return [
        AgentStep(role=role, order=index, input=request.prompt)
        for index, role in enumerate(request.roles)
    ]
