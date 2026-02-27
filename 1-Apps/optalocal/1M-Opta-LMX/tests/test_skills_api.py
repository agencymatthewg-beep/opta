"""Tests for /v1/skills API routes."""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from opta_lmx.config import LMXConfig
from opta_lmx.main import create_app
from opta_lmx.skills.dispatch import SkillDispatchOverloadedError
from opta_lmx.skills.executors import SkillExecutionResult, SkillExecutor
from opta_lmx.skills.manifest import SkillManifest
from opta_lmx.skills.registry import SkillsRegistry


@pytest.fixture
async def skills_client() -> AsyncIterator[AsyncClient]:
    """HTTP client with in-memory skill registry and executor."""
    test_app = create_app(LMXConfig(skills={"enabled": True}))

    registry = SkillsRegistry()
    registry.register_from_data(
        {
            "schema": "opta.skills.manifest/v1",
            "name": "echo",
            "description": "Echo back input arguments.",
            "kind": "entrypoint",
            "entrypoint": "opta_lmx.skills.builtins:echo",
            "input_schema": {
                "type": "object",
                "properties": {"topic": {"type": "string"}},
                "required": ["topic"],
                "additionalProperties": False,
            },
        }
    )
    registry.register_from_data(
        {
            "schema": "opta.skills.manifest/v1",
            "name": "add",
            "description": "Add two numbers.",
            "kind": "entrypoint",
            "entrypoint": "opta_lmx.skills.builtins:add",
        }
    )
    registry.register_from_data(
        {
            "schema": "opta.skills.manifest/v1",
            "namespace": "openclaw",
            "name": "planner",
            "version": "2.0.0",
            "description": "OpenClaw planner prompt.",
            "kind": "prompt",
            "prompt_template": "Plan {goal}",
            "input_schema": {
                "type": "object",
                "properties": {"goal": {"type": "string"}},
                "required": ["goal"],
            },
        }
    )
    registry.register_from_data(
        {
            "schema": "opta.skills.manifest/v1",
            "name": "file-reader",
            "description": "Read files from workspace.",
            "kind": "entrypoint",
            "entrypoint": "opta_lmx.skills.builtins:echo",
            "roots": ["/tmp/workspace"],
        }
    )

    executor = SkillExecutor()
    test_app.state.skill_registry = registry
    test_app.state.skill_executor = executor

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as http_client:
        yield http_client


async def test_list_and_get_skills(skills_client: AsyncClient) -> None:
    """List skills and fetch a single skill definition."""
    list_resp = await skills_client.get("/v1/skills")
    assert list_resp.status_code == 200
    names = {item["name"] for item in list_resp.json()["data"]}
    assert names == {"echo", "add", "planner", "file-reader"}

    get_resp = await skills_client.get("/v1/skills/echo")
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "echo"


async def test_execute_skill(skills_client: AsyncClient) -> None:
    """Execute a registered skill by name."""
    exec_resp = await skills_client.post(
        "/v1/skills/add/execute",
        json={"arguments": {"left": 2, "right": 5}},
    )
    assert exec_resp.status_code == 200
    assert exec_resp.json()["ok"] is True
    assert exec_resp.json()["output"]["sum"] == 7.0


async def test_execute_skill_rejects_invalid_arguments(skills_client: AsyncClient) -> None:
    exec_resp = await skills_client.post(
        "/v1/skills/echo/execute",
        json={"arguments": {"topic": 42}},
    )
    assert exec_resp.status_code == 400
    assert exec_resp.json()["error"]["code"] == "invalid_arguments"


async def test_mcp_adapter_list_and_call(skills_client: AsyncClient) -> None:
    """MCP-style list/call adapter returns tools and executes calls."""
    tools_resp = await skills_client.get("/v1/skills/mcp/tools")
    assert tools_resp.status_code == 200
    tool_names = {tool["name"] for tool in tools_resp.json()["tools"]}
    assert "echo" in tool_names
    assert "openclaw/planner@2.0.0" in tool_names

    call_resp = await skills_client.post(
        "/v1/skills/mcp/call",
        json={"name": "echo", "arguments": {"topic": "mcp"}},
    )
    assert call_resp.status_code == 200
    assert call_resp.json()["output"]["echo"]["topic"] == "mcp"


async def test_mcp_call_accepts_json_string_arguments(skills_client: AsyncClient) -> None:
    call_resp = await skills_client.post(
        "/v1/skills/mcp/call",
        json={"name": "echo", "arguments": "{\"topic\":\"json\"}"},
    )
    assert call_resp.status_code == 200
    assert call_resp.json()["output"]["echo"]["topic"] == "json"


async def test_get_namespaced_skill_reference(skills_client: AsyncClient) -> None:
    resp = await skills_client.get("/v1/skills/openclaw/planner@2.0.0")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["namespace"] == "openclaw"
    assert payload["reference"] == "openclaw/planner@2.0.0"


async def test_openclaw_invoke_shim(skills_client: AsyncClient) -> None:
    resp = await skills_client.post(
        "/v1/skills/openclaw/invoke",
        json={"tool": "add", "arguments": "{\"left\":3,\"right\":4}"},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert payload["result"]["sum"] == 7.0


async def test_missing_skill_returns_404(skills_client: AsyncClient) -> None:
    """Unknown skills should return 404 on detail and execute routes."""
    get_resp = await skills_client.get("/v1/skills/missing")
    assert get_resp.status_code == 404

    exec_resp = await skills_client.post(
        "/v1/skills/missing/execute",
        json={"arguments": {}},
    )
    assert exec_resp.status_code == 404


async def test_execute_skill_uses_configured_dispatcher() -> None:
    test_app = create_app(LMXConfig(skills={"enabled": True}))
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
    test_app.state.skill_registry = registry
    test_app.state.skill_executor = SkillExecutor()

    class FakeDispatcher:
        async def execute(
            self,
            manifest: SkillManifest,
            *,
            arguments: dict[str, object] | None = None,
            approved: bool = False,
            timeout_sec: float | None = None,
        ) -> SkillExecutionResult:
            return SkillExecutionResult(
                skill_name=manifest.name,
                kind=manifest.kind.value,
                ok=True,
                output={"dispatched": True, "arguments": arguments or {}},
                duration_ms=0,
            )

    test_app.state.skill_dispatcher = FakeDispatcher()

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as http_client:
        resp = await http_client.post(
            "/v1/skills/echo/execute",
            json={"arguments": {"topic": "dispatcher"}},
        )

    assert resp.status_code == 200
    assert resp.json()["output"]["dispatched"] is True


async def test_execute_skill_returns_structured_overload() -> None:
    test_app = create_app(LMXConfig(skills={"enabled": True}))
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
    test_app.state.skill_registry = registry
    test_app.state.skill_executor = SkillExecutor()

    class OverloadedDispatcher:
        async def execute(
            self,
            manifest: SkillManifest,
            *,
            arguments: dict[str, object] | None = None,
            approved: bool = False,
            timeout_sec: float | None = None,
        ) -> SkillExecutionResult:
            raise SkillDispatchOverloadedError(size=1, capacity=1, retry_after=7)

    test_app.state.skill_dispatcher = OverloadedDispatcher()

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as http_client:
        resp = await http_client.post(
            "/v1/skills/echo/execute",
            json={"arguments": {"topic": "dispatcher"}},
        )

    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "skill_queue_saturated"
    assert resp.headers["retry-after"] == "7"


async def test_mcp_prompts_list_returns_prompt_skills(skills_client: AsyncClient) -> None:
    """MCP prompts/list should return only prompt-kind skills."""
    resp = await skills_client.get("/v1/skills/mcp/prompts")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert len(payload["prompts"]) == 1

    prompt = payload["prompts"][0]
    assert prompt["name"] == "planner"
    assert prompt["description"] == "OpenClaw planner prompt."
    assert len(prompt["arguments"]) == 1
    assert prompt["arguments"][0]["name"] == "goal"
    assert prompt["arguments"][0]["required"] is True


async def test_mcp_prompts_get_renders_template(skills_client: AsyncClient) -> None:
    """MCP prompts/get should render prompt_template with provided arguments."""
    resp = await skills_client.post(
        "/v1/skills/mcp/prompts/get",
        json={"name": "planner", "arguments": {"goal": "conquer the world"}},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert len(payload["messages"]) == 1
    msg = payload["messages"][0]
    assert msg["role"] == "user"
    assert msg["content"]["type"] == "text"
    assert msg["content"]["text"] == "Plan conquer the world"


async def test_mcp_resources_list_returns_roots(skills_client: AsyncClient) -> None:
    """MCP resources/list should return skills that define filesystem roots."""
    resp = await skills_client.get("/v1/skills/mcp/resources")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert len(payload["resources"]) == 1

    resource = payload["resources"][0]
    assert resource["uri"] == "file:///tmp/workspace"
    assert "file-reader" in resource["name"]
    assert resource["mimeType"] == "application/octet-stream"


async def test_mcp_capabilities_includes_list_changed(skills_client: AsyncClient) -> None:
    """MCP capabilities should report listChanged support for all primitives."""
    resp = await skills_client.get("/v1/skills/mcp/capabilities")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True

    caps = payload["capabilities"]
    assert caps["tools"]["listChanged"] is True
    assert caps["prompts"]["listChanged"] is True
    assert caps["resources"]["listChanged"] is True
