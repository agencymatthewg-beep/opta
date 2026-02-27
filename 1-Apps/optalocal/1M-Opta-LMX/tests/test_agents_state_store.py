"""Tests for agents runtime state store persistence."""

from __future__ import annotations

from pathlib import Path

from opta_lmx.agents.models import AgentRequest, AgentRun, ExecutionStrategy, RunStatus
from opta_lmx.agents.state_store import AgentsStateStore


def _make_run(run_id: str, *, status: RunStatus = RunStatus.QUEUED) -> AgentRun:
    request = AgentRequest(
        strategy=ExecutionStrategy.HANDOFF,
        prompt="Draft a plan",
        roles=["planner"],
    )
    return AgentRun(id=run_id, request=request, status=status)


def test_state_store_persists_and_loads_runs(tmp_path: Path) -> None:
    path = tmp_path / "agent-runs.json"
    store = AgentsStateStore(path=path)
    run = _make_run("run-1")
    store.upsert_run(run)

    reloaded = AgentsStateStore(path=path)
    loaded = reloaded.get_run("run-1")
    assert loaded is not None
    assert loaded.id == "run-1"
    assert loaded.status == RunStatus.QUEUED
    assert loaded.request.strategy == ExecutionStrategy.HANDOFF


def test_state_store_updates_existing_run(tmp_path: Path) -> None:
    path = tmp_path / "agent-runs.json"
    store = AgentsStateStore(path=path)
    run = _make_run("run-2")
    store.upsert_run(run)

    run.status = RunStatus.COMPLETED
    run.result = "done"
    store.upsert_run(run)

    loaded = store.get_run("run-2")
    assert loaded is not None
    assert loaded.status == RunStatus.COMPLETED
    assert loaded.result == "done"


def test_state_store_handles_invalid_json(tmp_path: Path) -> None:
    path = tmp_path / "agent-runs.json"
    path.write_text("not valid json", encoding="utf-8")

    store = AgentsStateStore(path=path)
    assert store.list_runs() == []


def test_state_store_persists_idempotency_index(tmp_path: Path) -> None:
    path = tmp_path / "agent-runs.json"
    store = AgentsStateStore(path=path)
    run = _make_run("run-idem")
    store.upsert_run(run)
    store.bind_idempotency("key-1", run.id, "fingerprint-1")

    reloaded = AgentsStateStore(path=path)
    resolved = reloaded.get_idempotency("key-1")
    assert resolved == ("run-idem", "fingerprint-1")


def test_state_store_clears_idempotency_on_delete(tmp_path: Path) -> None:
    path = tmp_path / "agent-runs.json"
    store = AgentsStateStore(path=path)
    run = _make_run("run-delete")
    store.upsert_run(run)
    store.bind_idempotency("key-delete", run.id, "fingerprint-delete")

    store.delete_run(run.id)
    assert store.get_idempotency("key-delete") is None
