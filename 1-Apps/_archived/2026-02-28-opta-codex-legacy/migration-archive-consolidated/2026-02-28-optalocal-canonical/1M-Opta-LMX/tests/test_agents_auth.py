from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

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
    def __init__(self) -> None:
        self._loaded_models=["model-a"]

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
        user_input = next(
            (m.content for m in messages if m.role == "user" and isinstance(m.content, str)),
            "",
        )
        return ChatCompletionResponse(
            id="run-test",
            created=0,
            model=model_id,
            choices=[
                Choice(
                    message=ResponseMessage(content=f"demo:{user_input}"),
                    finish_reason="stop",
                )
            ],
            usage=Usage(prompt_tokens=1, completion_tokens=1, total_tokens=2),
        )


@pytest.fixture
async def client(tmp_path: Path) -> AsyncIterator[AsyncClient]:
    app = create_app(
        LMXConfig(agents={"enabled": True}, security={"inference_api_key": "test-key"})
    )
    runtime = AgentsRuntime(
        engine=FakeEngine(),
        router=TaskRouter(RoutingConfig(aliases={}, default_model=None)),
        state_store=AgentsStateStore(path=tmp_path / "agents-auth-runs.json"),
        scheduler=RunScheduler(max_queue_size=8, worker_count=1),
    )
    await runtime.start()
    app.state.agent_runtime = runtime
    app.state.inference_api_key = "test-key"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    await runtime.stop()


async def test_agents_requires_api_key(client: AsyncClient) -> None:
    resp = await client.get("/v1/agents/runs")
    assert resp.status_code == 401


async def test_agents_accepts_api_key(client: AsyncClient) -> None:
    resp = await client.post(
        "/v1/agents/runs",
        headers={"X-Api-Key": "test-key"},
        json={"request": {"strategy": "handoff", "prompt": "hello", "roles": ["demo"]}},
    )
    assert resp.status_code == 201
