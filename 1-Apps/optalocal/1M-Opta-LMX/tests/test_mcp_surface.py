"""Tests for MCP prompts/list, prompts/get, resources/list, resources/read,
and capabilities POST endpoints."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from opta_lmx.config import LMXConfig
from opta_lmx.main import create_app
from opta_lmx.skills.executors import SkillExecutor
from opta_lmx.skills.registry import SkillsRegistry


@pytest.fixture
async def mcp_client() -> AsyncIterator[AsyncClient]:
    """HTTP client with skills registry containing prompt, entrypoint, and root-bearing skills."""
    test_app = create_app(LMXConfig(skills={"enabled": True}))

    registry = SkillsRegistry()

    # Prompt-kind skill with a template and arguments
    registry.register_from_data(
        {
            "schema": "opta.skills.manifest/v1",
            "name": "summarize",
            "description": "Summarize a document on a given topic.",
            "kind": "prompt",
            "prompt_template": "Summarize the following about {topic}: {text}",
            "input_schema": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string"},
                    "text": {"type": "string"},
                },
                "required": ["topic", "text"],
            },
        }
    )

    # Another prompt-kind skill with optional arguments
    registry.register_from_data(
        {
            "schema": "opta.skills.manifest/v1",
            "name": "greet",
            "description": "Generate a greeting message.",
            "kind": "prompt",
            "prompt_template": "Hello, {name}!",
            "input_schema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                },
                "required": ["name"],
            },
        }
    )

    # Entrypoint-kind skill (should NOT appear in prompts/list)
    registry.register_from_data(
        {
            "schema": "opta.skills.manifest/v1",
            "name": "echo",
            "description": "Echo back input arguments.",
            "kind": "entrypoint",
            "entrypoint": "opta_lmx.skills.builtins:echo",
        }
    )

    # Entrypoint with filesystem roots (should appear in resources/list)
    registry.register_from_data(
        {
            "schema": "opta.skills.manifest/v1",
            "name": "workspace-reader",
            "description": "Read project workspace files.",
            "kind": "entrypoint",
            "entrypoint": "opta_lmx.skills.builtins:echo",
            "roots": ["/tmp/project-a", "/tmp/project-b"],
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


# ── POST /mcp/prompts/list ───────────────────────────────────────────────


async def test_mcp_prompts_list_returns_only_prompt_skills(mcp_client: AsyncClient) -> None:
    """POST /mcp/prompts/list returns only prompt-kind skills."""
    resp = await mcp_client.post("/mcp/prompts/list")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True

    prompt_names = {p["name"] for p in payload["prompts"]}
    assert prompt_names == {"summarize", "greet"}
    # entrypoint skills must not appear
    assert "echo" not in prompt_names
    assert "workspace-reader" not in prompt_names


async def test_mcp_prompts_list_includes_argument_metadata(mcp_client: AsyncClient) -> None:
    """Each prompt in prompts/list includes argument descriptors."""
    resp = await mcp_client.post("/mcp/prompts/list")
    payload = resp.json()

    summarize = next(p for p in payload["prompts"] if p["name"] == "summarize")
    assert summarize["description"] == "Summarize a document on a given topic."
    arg_names = {a["name"] for a in summarize["arguments"]}
    assert arg_names == {"topic", "text"}

    # All arguments are required for summarize
    for arg in summarize["arguments"]:
        assert arg["required"] is True


async def test_mcp_prompts_list_empty_when_no_prompts() -> None:
    """Returns empty prompts list when no prompt-kind skills are registered."""
    test_app = create_app(LMXConfig(skills={"enabled": True}))
    registry = SkillsRegistry()
    registry.register_from_data(
        {
            "schema": "opta.skills.manifest/v1",
            "name": "echo",
            "description": "Echo.",
            "kind": "entrypoint",
            "entrypoint": "opta_lmx.skills.builtins:echo",
        }
    )
    test_app.state.skill_registry = registry
    test_app.state.skill_executor = SkillExecutor()

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as client:
        resp = await client.post("/mcp/prompts/list")
    assert resp.status_code == 200
    assert resp.json()["prompts"] == []


# ── POST /mcp/prompts/get ────────────────────────────────────────────────


async def test_mcp_prompts_get_renders_template(mcp_client: AsyncClient) -> None:
    """POST /mcp/prompts/get renders the prompt template with arguments."""
    resp = await mcp_client.post(
        "/mcp/prompts/get",
        json={"name": "summarize", "arguments": {"topic": "AI safety", "text": "Some document"}},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert len(payload["messages"]) == 1

    msg = payload["messages"][0]
    assert msg["role"] == "user"
    assert msg["content"]["type"] == "text"
    assert msg["content"]["text"] == "Summarize the following about AI safety: Some document"


async def test_mcp_prompts_get_simple_template(mcp_client: AsyncClient) -> None:
    """Renders a simple single-argument prompt template."""
    resp = await mcp_client.post(
        "/mcp/prompts/get",
        json={"name": "greet", "arguments": {"name": "Matthew"}},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert payload["messages"][0]["content"]["text"] == "Hello, Matthew!"


async def test_mcp_prompts_get_unknown_prompt(mcp_client: AsyncClient) -> None:
    """Returns error for unknown prompt name."""
    resp = await mcp_client.post(
        "/mcp/prompts/get",
        json={"name": "nonexistent", "arguments": {}},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is False
    assert "unknown prompt" in payload["error"]


async def test_mcp_prompts_get_rejects_entrypoint_skill(mcp_client: AsyncClient) -> None:
    """Returns error when trying to get a non-prompt skill as a prompt."""
    resp = await mcp_client.post(
        "/mcp/prompts/get",
        json={"name": "echo", "arguments": {}},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is False
    assert "not a prompt" in payload["error"]


async def test_mcp_prompts_get_missing_argument(mcp_client: AsyncClient) -> None:
    """Returns error when required template variable is missing."""
    resp = await mcp_client.post(
        "/mcp/prompts/get",
        json={"name": "summarize", "arguments": {"topic": "AI"}},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is False
    assert "rendering failed" in payload["error"]


# ── POST /mcp/resources/list ─────────────────────────────────────────────


async def test_mcp_resources_list_returns_root_based_resources(mcp_client: AsyncClient) -> None:
    """POST /mcp/resources/list returns file:// resources for skills with roots."""
    resp = await mcp_client.post("/mcp/resources/list")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True

    uris = {r["uri"] for r in payload["resources"]}
    assert "file:///tmp/project-a" in uris
    assert "file:///tmp/project-b" in uris
    assert len(payload["resources"]) == 2


async def test_mcp_resources_list_includes_metadata(mcp_client: AsyncClient) -> None:
    """Each resource entry includes name, description, and mimeType."""
    resp = await mcp_client.post("/mcp/resources/list")
    payload = resp.json()

    for resource in payload["resources"]:
        assert "workspace-reader" in resource["name"]
        assert resource["mimeType"] == "application/octet-stream"
        assert "description" in resource


async def test_mcp_resources_list_empty_when_no_roots() -> None:
    """Returns empty resources list when no skills define filesystem roots."""
    test_app = create_app(LMXConfig(skills={"enabled": True}))
    registry = SkillsRegistry()
    registry.register_from_data(
        {
            "schema": "opta.skills.manifest/v1",
            "name": "echo",
            "description": "Echo.",
            "kind": "entrypoint",
            "entrypoint": "opta_lmx.skills.builtins:echo",
        }
    )
    test_app.state.skill_registry = registry
    test_app.state.skill_executor = SkillExecutor()

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as client:
        resp = await client.post("/mcp/resources/list")
    assert resp.status_code == 200
    assert resp.json()["resources"] == []


# ── POST /mcp/resources/read ─────────────────────────────────────────────


async def test_mcp_resources_read_file_uri(mcp_client: AsyncClient) -> None:
    """POST /mcp/resources/read resolves a file:// URI from skill roots."""
    resp = await mcp_client.post(
        "/mcp/resources/read",
        json={"uri": "file:///tmp/project-a"},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert len(payload["contents"]) == 1

    content = payload["contents"][0]
    assert content["uri"] == "file:///tmp/project-a"
    assert "workspace-reader" in content["text"]


async def test_mcp_resources_read_subpath_of_root(mcp_client: AsyncClient) -> None:
    """Resources/read accepts sub-paths within a registered root."""
    resp = await mcp_client.post(
        "/mcp/resources/read",
        json={"uri": "file:///tmp/project-b/src/main.py"},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert payload["contents"][0]["uri"] == "file:///tmp/project-b/src/main.py"


async def test_mcp_resources_read_unknown_file_uri(mcp_client: AsyncClient) -> None:
    """Returns error for file:// URIs that do not match any skill root."""
    resp = await mcp_client.post(
        "/mcp/resources/read",
        json={"uri": "file:///tmp/unknown-dir"},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is False
    assert "not found" in payload["error"]


async def test_mcp_resources_read_lmx_models(mcp_client: AsyncClient) -> None:
    """POST /mcp/resources/read with lmx://models returns skill metadata."""
    resp = await mcp_client.post(
        "/mcp/resources/read",
        json={"uri": "lmx://models"},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert len(payload["contents"]) == 1

    content = payload["contents"][0]
    assert content["uri"] == "lmx://models"
    assert content["mimeType"] == "application/json"

    data = json.loads(content["text"])
    skill_names = {s["name"] for s in data["skills"]}
    assert "summarize" in skill_names
    assert "echo" in skill_names


async def test_mcp_resources_read_lmx_metrics(mcp_client: AsyncClient) -> None:
    """POST /mcp/resources/read with lmx://metrics returns server metrics."""
    resp = await mcp_client.post(
        "/mcp/resources/read",
        json={"uri": "lmx://metrics"},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True

    content = payload["contents"][0]
    assert content["mimeType"] == "application/json"

    data = json.loads(content["text"])
    assert "registered_skills" in data
    assert isinstance(data["registered_skills"], int)
    assert data["registered_skills"] > 0
    assert "list_changed_at" in data


async def test_mcp_resources_read_unsupported_scheme(mcp_client: AsyncClient) -> None:
    """Returns error for unsupported URI schemes."""
    resp = await mcp_client.post(
        "/mcp/resources/read",
        json={"uri": "ftp://example.com/file"},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is False
    assert "unsupported" in payload["error"]


# ── POST /mcp/capabilities ───────────────────────────────────────────────


async def test_mcp_capabilities_includes_all_primitives(mcp_client: AsyncClient) -> None:
    """POST /mcp/capabilities reports tools, prompts, and resources support."""
    resp = await mcp_client.post("/mcp/capabilities")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True

    caps = payload["capabilities"]
    assert "tools" in caps
    assert "prompts" in caps
    assert "resources" in caps


async def test_mcp_capabilities_list_changed_flags(mcp_client: AsyncClient) -> None:
    """Each capability primitive declares listChanged support."""
    resp = await mcp_client.post("/mcp/capabilities")
    payload = resp.json()
    caps = payload["capabilities"]

    assert caps["tools"]["listChanged"] is True
    assert caps["prompts"]["listChanged"] is True
    assert caps["resources"]["listChanged"] is True


# ── MCP disabled ─────────────────────────────────────────────────────────


async def test_mcp_endpoints_return_404_when_disabled() -> None:
    """All MCP POST endpoints return 404 when MCP adapter is disabled."""
    test_app = create_app(LMXConfig(skills={"enabled": True, "mcp_adapter_enabled": False}))
    registry = SkillsRegistry()
    test_app.state.skill_registry = registry
    test_app.state.skill_executor = SkillExecutor()

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as client:
        for path in [
            "/mcp/prompts/list",
            "/mcp/prompts/get",
            "/mcp/resources/list",
            "/mcp/resources/read",
            "/mcp/capabilities",
        ]:
            body: dict = {}
            if path == "/mcp/prompts/get":
                body = {"name": "x"}
            elif path == "/mcp/resources/read":
                body = {"uri": "lmx://models"}
            resp = await client.post(path, json=body)
            assert resp.status_code == 404, f"Expected 404 for {path}, got {resp.status_code}"
