"""Tests for /v1/agents/runs API routes."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from opta_lmx.agents.models import RunStatus
from opta_lmx.agents.runtime import AgentsRuntime
from opta_lmx.agents.scheduler import RunScheduler
from opta_lmx.agents.state_store import AgentsStateStore
from opta_lmx.config import LMXConfig, RoutingConfig
from opta_lmx.inference.schema import (
    ChatCompletionResponse,
    ChatMessage,
    Choice,
    ResponseMessage,
    Usage,
)
from opta_lmx.main import create_app
from opta_lmx.router.strategy import TaskRouter


class FakeEngine:
    """Small in-memory engine stub for API tests."""

    def __init__(self) -> None:
        self._loaded_models = ["model-a"]

    def get_loaded_model_ids(self) -> list[str]:
        return list(self._loaded_models)

    def is_model_loaded(self, model_id: str) -> bool:
        return model_id in self._loaded_models

    async def generate(
        self,
        model_id: str,
        messages: list[ChatMessage],
        **_: object,
    ) -> ChatCompletionResponse:
        role = "assistant"
        user_input = ""
        for message in messages:
            if message.role == "system" and isinstance(message.content, str):
                prefix = "You are acting as the "
                suffix = " agent."
                if message.content.startswith(prefix) and message.content.endswith(suffix):
                    role = message.content[len(prefix) : -len(suffix)]
            if message.role == "user" and isinstance(message.content, str):
                user_input = message.content

        if user_input.startswith("sleep:"):
            delay_ms = int(user_input.split(":", maxsplit=1)[1])
            await asyncio.sleep(delay_ms / 1000)

        content = f"{role}:{user_input}"
        return ChatCompletionResponse(
            id="run-test",
            created=0,
            model=model_id,
            choices=[Choice(message=ResponseMessage(content=content), finish_reason="stop")],
            usage=Usage(prompt_tokens=1, completion_tokens=1, total_tokens=2),
        )


@pytest.fixture
async def agents_client(tmp_path: Path) -> AsyncIterator[AsyncClient]:
    """HTTP client with a real in-memory agents runtime wired into app.state."""
    config = LMXConfig(agents={"enabled": True})
    test_app = create_app(config)

    runtime = AgentsRuntime(
        engine=FakeEngine(),
        router=TaskRouter(RoutingConfig(aliases={}, default_model=None)),
        state_store=AgentsStateStore(path=tmp_path / "agents-runs.json"),
        scheduler=RunScheduler(max_queue_size=32, worker_count=2),
    )
    await runtime.start()
    test_app.state.agent_runtime = runtime

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as http_client:
        yield http_client

    await runtime.stop()


async def test_create_get_and_list_agent_runs(agents_client: AsyncClient) -> None:
    """POST create run, GET by id, and list runs."""
    create_resp = await agents_client.post(
        "/v1/agents/runs",
        json={
            "request": {
                "strategy": "handoff",
                "prompt": "hello",
                "roles": ["demo"],
            }
        },
    )
    assert create_resp.status_code == 201
    run_id = create_resp.json()["id"]

    run_status = ""
    run_data: dict[str, object] = {}
    for _ in range(50):
        get_resp = await agents_client.get(f"/v1/agents/runs/{run_id}")
        assert get_resp.status_code == 200
        run_data = get_resp.json()
        run_status = str(run_data["status"])
        if run_status == "completed":
            break
        await asyncio.sleep(0.01)

    assert run_status == "completed"
    assert run_data["result"] == "demo:hello"

    list_resp = await agents_client.get("/v1/agents/runs")
    assert list_resp.status_code == 200
    listed_ids = {item["id"] for item in list_resp.json()["data"]}
    assert run_id in listed_ids


async def test_cancel_agent_run(agents_client: AsyncClient) -> None:
    """POST cancel transitions a long-running run to cancelled."""
    create_resp = await agents_client.post(
        "/v1/agents/runs",
        json={
            "request": {
                "strategy": "handoff",
                "prompt": "sleep:250",
                "roles": ["slow"],
            }
        },
    )
    run_id = create_resp.json()["id"]

    cancel_resp = await agents_client.post(f"/v1/agents/runs/{run_id}/cancel")
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == RunStatus.CANCELLED

    get_resp = await agents_client.get(f"/v1/agents/runs/{run_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["status"] == RunStatus.CANCELLED


async def test_get_unknown_agent_run_returns_404(agents_client: AsyncClient) -> None:
    """GET for an unknown run id returns 404."""
    resp = await agents_client.get("/v1/agents/runs/run_missing")
    assert resp.status_code == 404


async def test_create_agent_run_accepts_trace_and_audit_headers(
    agents_client: AsyncClient,
) -> None:
    resp = await agents_client.post(
        "/v1/agents/runs",
        headers={
            "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
            "tracestate": "rojo=00f067aa0ba902b7,congo=t61rcWkgMzE",
            "x-priority": "interactive",
            "x-user-id": "qa-user",
        },
        json={
            "request": {
                "strategy": "handoff",
                "prompt": "trace test",
                "roles": ["planner"],
            }
        },
    )
    assert resp.status_code == 201
    payload = resp.json()
    assert payload["request"]["traceparent"] == (
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
    )
    assert payload["request"]["tracestate"] == "rojo=00f067aa0ba902b7,congo=t61rcWkgMzE"
    assert payload["request"]["priority"] == "interactive"
    assert payload["request"]["submitted_by"] == "qa-user"


async def test_create_agent_run_rejects_invalid_traceparent(
    agents_client: AsyncClient,
) -> None:
    resp = await agents_client.post(
        "/v1/agents/runs",
        headers={"traceparent": "invalid"},
        json={
            "request": {
                "strategy": "handoff",
                "prompt": "bad trace",
                "roles": ["planner"],
            }
        },
    )
    assert resp.status_code == 400


async def test_create_agent_run_supports_idempotency_key(agents_client: AsyncClient) -> None:
    payload = {
        "request": {
            "strategy": "handoff",
            "prompt": "idempotent",
            "roles": ["planner"],
        }
    }
    first = await agents_client.post(
        "/v1/agents/runs",
        headers={"Idempotency-Key": "same-key"},
        json=payload,
    )
    second = await agents_client.post(
        "/v1/agents/runs",
        headers={"Idempotency-Key": "same-key"},
        json=payload,
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]


async def test_create_agent_run_rejects_idempotency_reuse_with_different_payload(
    agents_client: AsyncClient,
) -> None:
    first_payload = {
        "request": {
            "strategy": "handoff",
            "prompt": "first",
            "roles": ["planner"],
        }
    }
    second_payload = {
        "request": {
            "strategy": "handoff",
            "prompt": "second",
            "roles": ["planner"],
        }
    }

    first = await agents_client.post(
        "/v1/agents/runs",
        headers={"Idempotency-Key": "conflict-key"},
        json=first_payload,
    )
    assert first.status_code == 201

    second = await agents_client.post(
        "/v1/agents/runs",
        headers={"Idempotency-Key": "conflict-key"},
        json=second_payload,
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "idempotency_conflict"


async def test_agent_queue_saturation_returns_429(tmp_path: Path) -> None:
    config = LMXConfig(agents={"enabled": True})
    test_app = create_app(config)

    class SlowEngine(FakeEngine):
        async def generate(
            self,
            model_id: str,
            messages: list[ChatMessage],
            **_: object,
        ) -> ChatCompletionResponse:
            await asyncio.sleep(0.25)
            return await super().generate(model_id, messages)

    runtime = AgentsRuntime(
        engine=SlowEngine(),
        router=TaskRouter(RoutingConfig(aliases={}, default_model=None)),
        state_store=AgentsStateStore(path=tmp_path / "agents-runs-sat.json"),
        scheduler=RunScheduler(max_queue_size=1, worker_count=1),
    )
    await runtime.start()
    test_app.state.agent_runtime = runtime

    payload = {
        "request": {
            "strategy": "handoff",
            "prompt": "load",
            "roles": ["planner"],
        }
    }

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as client:
        first = await client.post("/v1/agents/runs", json=payload)
        second = await client.post("/v1/agents/runs", json=payload)
        third = await client.post("/v1/agents/runs", json=payload)

    await runtime.stop()

    assert first.status_code == 201
    assert second.status_code in {201, 429}
    assert third.status_code == 429
    assert third.json()["error"]["code"] == "queue_saturated"
    assert third.headers["retry-after"] == "5"


async def test_stream_agent_run_events_endpoint(agents_client: AsyncClient) -> None:
    create_resp = await agents_client.post(
        "/v1/agents/runs",
        json={
            "request": {
                "strategy": "handoff",
                "prompt": "events",
                "roles": ["planner"],
            }
        },
    )
    assert create_resp.status_code == 201
    run_id = create_resp.json()["id"]

    event_names: list[str] = []
    async with agents_client.stream("GET", f"/v1/agents/runs/{run_id}/events") as response:
        assert response.status_code == 200
        async for line in response.aiter_lines():
            if line.startswith("event: "):
                event_names.append(line.removeprefix("event: ").strip())
            if line.strip() == "data: [DONE]":
                break

    assert "run.update" in event_names
    assert "run.completed" in event_names
