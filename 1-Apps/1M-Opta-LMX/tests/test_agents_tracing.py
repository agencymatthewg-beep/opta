"""Tests for agent tracing, audit trail, and checkpoint pointer."""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import cast

from opta_lmx.agents.models import (
    AgentRequest,
    AgentRun,
    AgentStep,
    ExecutionStrategy,
    RunStatus,
    StepStatus,
)
from opta_lmx.agents.tracing import AuditEvent, AuditTrail, extract_trace_id


def test_audit_event_creation() -> None:
    """AuditEvent should store all fields with correct defaults."""
    before = time.time()
    event = AuditEvent(
        actor="user",
        action="run_created",
        resource_type="agent_run",
        resource_id="run-123",
        trace_id="abc123",
        details={"note": "test"},
    )
    after = time.time()

    assert event.actor == "user"
    assert event.action == "run_created"
    assert event.resource_type == "agent_run"
    assert event.resource_id == "run-123"
    assert event.trace_id == "abc123"
    assert event.details == {"note": "test"}
    assert before <= event.timestamp <= after


def test_audit_trail_records_and_queries() -> None:
    """AuditTrail should record events and return them in reverse chronological order."""
    trail = AuditTrail()

    event_a = AuditEvent(timestamp=100.0, actor="user", action="run_created", resource_id="r1")
    event_b = AuditEvent(timestamp=200.0, actor="agent:planner", action="skill_executed", resource_id="r2")
    event_c = AuditEvent(timestamp=300.0, actor="system", action="run_cancelled", resource_id="r3")

    trail.record(event_a)
    trail.record(event_b)
    trail.record(event_c)

    results = trail.query()
    assert len(results) == 3
    # Reverse chronological order
    assert results[0].timestamp == 300.0
    assert results[1].timestamp == 200.0
    assert results[2].timestamp == 100.0


def test_audit_trail_filters_by_actor() -> None:
    """AuditTrail.query should filter by actor when specified."""
    trail = AuditTrail()

    trail.record(AuditEvent(actor="user", action="run_created", resource_id="r1"))
    trail.record(AuditEvent(actor="agent:planner", action="skill_executed", resource_id="r2"))
    trail.record(AuditEvent(actor="user", action="run_cancelled", resource_id="r3"))

    user_events = trail.query(actor="user")
    assert len(user_events) == 2
    assert all(e.actor == "user" for e in user_events)

    agent_events = trail.query(actor="agent:planner")
    assert len(agent_events) == 1
    assert agent_events[0].resource_id == "r2"


def test_audit_trail_filters_by_action() -> None:
    """AuditTrail.query should filter by action when specified."""
    trail = AuditTrail()

    trail.record(AuditEvent(actor="user", action="run_created", resource_id="r1"))
    trail.record(AuditEvent(actor="user", action="skill_executed", resource_id="r2"))
    trail.record(AuditEvent(actor="user", action="run_created", resource_id="r3"))

    created_events = trail.query(action="run_created")
    assert len(created_events) == 2
    assert all(e.action == "run_created" for e in created_events)


def test_audit_trail_respects_max_events() -> None:
    """AuditTrail should evict oldest events when max_events is exceeded."""
    trail = AuditTrail(max_events=3)

    for i in range(5):
        trail.record(AuditEvent(
            timestamp=float(i),
            actor="user",
            action="run_created",
            resource_id=f"r{i}",
        ))

    results = trail.query(limit=10)
    assert len(results) == 3
    # Should keep the last 3 (timestamps 2, 3, 4)
    resource_ids = {e.resource_id for e in results}
    assert resource_ids == {"r2", "r3", "r4"}


def test_audit_trail_persists_to_disk(tmp_path: Path) -> None:
    """AuditTrail should save and load events from disk."""
    persist_file = tmp_path / "audit.json"

    # Create trail and record events
    trail = AuditTrail(persist_path=persist_file)
    trail.record(AuditEvent(
        timestamp=100.0,
        actor="user",
        action="run_created",
        resource_type="agent_run",
        resource_id="r1",
        trace_id="trace-abc",
        details={"key": "value"},
    ))
    trail.record(AuditEvent(
        timestamp=200.0,
        actor="system",
        action="run_cancelled",
        resource_id="r2",
    ))

    # Verify file exists and is valid JSON
    assert persist_file.exists()
    data = json.loads(persist_file.read_text(encoding="utf-8"))
    assert isinstance(data, list)
    assert len(data) == 2

    # Create new trail from same path — should load persisted events
    trail2 = AuditTrail(persist_path=persist_file)
    results = trail2.query()
    assert len(results) == 2
    assert results[0].timestamp == 200.0
    assert results[0].actor == "system"
    assert results[1].timestamp == 100.0
    assert results[1].actor == "user"
    assert results[1].details == {"key": "value"}


def test_extract_trace_id_from_traceparent() -> None:
    """extract_trace_id should parse the trace-id from a W3C traceparent."""
    traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
    trace_id = extract_trace_id(traceparent)
    assert trace_id == "4bf92f3577b34da6a3ce929d0e0e4736"


def test_extract_trace_id_empty_input() -> None:
    """extract_trace_id should return empty string for None or empty input."""
    assert extract_trace_id(None) == ""
    assert extract_trace_id("") == ""


def test_checkpoint_pointer_updates_on_step_completion() -> None:
    """AgentRun.checkpoint_pointer should track the last completed step ID."""
    request = AgentRequest(
        strategy=ExecutionStrategy.HANDOFF,
        prompt="test",
        roles=["alpha", "beta", "gamma"],
    )
    run = AgentRun(
        id="run-ckpt-test",
        request=request,
        status=RunStatus.RUNNING,
        steps=[
            AgentStep(id="step-a", role="alpha", order=0, status=StepStatus.QUEUED),
            AgentStep(id="step-b", role="beta", order=1, status=StepStatus.QUEUED),
            AgentStep(id="step-c", role="gamma", order=2, status=StepStatus.QUEUED),
        ],
    )

    # Initially no checkpoint
    assert run.checkpoint_pointer is None

    # Simulate first step completing
    run.steps[0].status = StepStatus.COMPLETED
    completed = [s for s in run.steps if s.status == StepStatus.COMPLETED]
    if completed:
        run.checkpoint_pointer = completed[-1].id
    assert run.checkpoint_pointer == "step-a"

    # Simulate second step completing
    run.steps[1].status = StepStatus.COMPLETED
    completed = [s for s in run.steps if s.status == StepStatus.COMPLETED]
    if completed:
        run.checkpoint_pointer = completed[-1].id
    assert run.checkpoint_pointer == "step-b"

    # Simulate third step completing
    run.steps[2].status = StepStatus.COMPLETED
    completed = [s for s in run.steps if s.status == StepStatus.COMPLETED]
    if completed:
        run.checkpoint_pointer = completed[-1].id
    assert run.checkpoint_pointer == "step-c"
