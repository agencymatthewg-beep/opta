from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from opta_lmx.config import LMXConfig
from opta_lmx.main import create_app
from opta_lmx.skills.executors import SkillExecutor
from opta_lmx.skills.registry import SkillsRegistry


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    app = create_app(
        LMXConfig(skills={"enabled": True}, security={"inference_api_key": "test-key"})
    )
    registry = SkillsRegistry()
    registry.register_from_data(
        {
            "schema": "opta.skills.manifest/v1",
            "name": "echo",
            "description": "Echo back input arguments.",
            "kind": "entrypoint",
            "entrypoint": "opta_lmx.skills.builtins:echo",
        }
    )
    app.state.skill_registry = registry
    app.state.skill_executor = SkillExecutor()
    app.state.inference_api_key = "test-key"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_skills_requires_api_key(client: AsyncClient) -> None:
    resp = await client.get("/v1/skills")
    assert resp.status_code == 401


async def test_skills_accepts_api_key(client: AsyncClient) -> None:
    resp = await client.get("/v1/skills", headers={"X-Api-Key": "test-key"})
    assert resp.status_code == 200
    assert resp.json()["object"] == "list"
