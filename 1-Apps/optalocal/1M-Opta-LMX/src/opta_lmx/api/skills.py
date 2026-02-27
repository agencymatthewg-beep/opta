"""Skill registry API routes: /v1/skills* plus MCP/OpenClaw adapters."""

from __future__ import annotations

import asyncio
import json
from collections.abc import Mapping
from typing import Any, cast

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.responses import Response

from opta_lmx.api.deps import SkillExecutorDep, SkillRegistryDep
from opta_lmx.skills.dispatch import SkillDispatchOverloadedError
from opta_lmx.skills.executors import SkillExecutionResult
from opta_lmx.skills.manifest import SkillManifest, validate_skill_arguments
from opta_lmx.skills.mcp_bridge import RemoteMCPBridge, SkillsMCPBridge

router = APIRouter(tags=["skills"])


class SkillResponse(BaseModel):
    """Serialized skill metadata."""

    model_config = ConfigDict(populate_by_name=True)

    manifest_schema: str = Field(alias="schema", serialization_alias="schema")
    name: str
    namespace: str
    version: str
    qualified_name: str
    reference: str
    description: str
    kind: str
    timeout_sec: float
    permission_tags: list[str]
    risk_tags: list[str]
    input_schema: dict[str, Any]


class SkillListResponse(BaseModel):
    """Paginated-style skill list payload."""

    object: str = "list"
    data: list[SkillResponse]


class SkillExecuteRequest(BaseModel):
    """Execute request for a skill."""

    arguments: object = Field(default_factory=dict)
    approved: bool = False
    timeout_sec: float | None = Field(default=None, gt=0.0, le=600.0)


class SkillExecuteResponse(BaseModel):
    """Execute response for a skill."""

    skill: str
    ok: bool
    output: Any | None = None
    error: str | None = None
    duration_ms: int
    timed_out: bool = False
    denied: bool = False
    requires_approval: bool = False


class MCPTool(BaseModel):
    """MCP-compatible tool descriptor."""

    model_config = ConfigDict(populate_by_name=True)

    name: str
    description: str
    input_schema: dict[str, Any] = Field(alias="inputSchema")
    namespace: str | None = None
    version: str | None = None
    aliases: list[str] = Field(default_factory=list)


class MCPToolsResponse(BaseModel):
    """MCP-style list tools response."""

    tools: list[MCPTool]
    list_changed_at: str


class MCPToolCallRequest(BaseModel):
    """MCP-style call request."""

    name: str = Field(..., min_length=1)
    arguments: object = Field(default_factory=dict)
    approved: bool = False


class MCPToolCallResponse(BaseModel):
    """MCP-style call result."""

    skill_name: str
    kind: str
    ok: bool
    output: Any | None = None
    error: str | None = None
    duration_ms: int
    timed_out: bool = False
    denied: bool = False
    requires_approval: bool = False


class MCPPromptArgument(BaseModel):
    """Single prompt argument descriptor."""

    name: str
    required: bool = False


class MCPPrompt(BaseModel):
    """MCP-compatible prompt descriptor."""

    name: str
    description: str
    arguments: list[MCPPromptArgument] = Field(default_factory=list)


class MCPPromptsResponse(BaseModel):
    """MCP-style prompts/list response."""

    ok: bool = True
    prompts: list[MCPPrompt]


class MCPPromptGetRequest(BaseModel):
    """MCP-style prompts/get request."""

    name: str = Field(..., min_length=1)
    arguments: dict[str, Any] | None = None


class MCPPromptMessage(BaseModel):
    """Single rendered prompt message."""

    role: str
    content: dict[str, Any]


class MCPPromptGetResponse(BaseModel):
    """MCP-style prompts/get response."""

    ok: bool
    messages: list[MCPPromptMessage] | None = None
    error: str | None = None


class MCPResource(BaseModel):
    """MCP-compatible resource descriptor."""

    model_config = {"populate_by_name": True}

    uri: str
    name: str
    description: str
    mime_type: str = Field(
        "application/octet-stream", alias="mimeType",
    )


class MCPResourcesResponse(BaseModel):
    """MCP-style resources/list response."""

    ok: bool = True
    resources: list[MCPResource]


class MCPCapabilitiesResponse(BaseModel):
    """MCP-style capabilities response."""

    ok: bool = True
    capabilities: dict[str, Any]


class MCPResourceReadRequest(BaseModel):
    """MCP-style resources/read request."""

    uri: str = Field(..., min_length=1)


class MCPResourceContent(BaseModel):
    """Single resource content item."""

    model_config = {"populate_by_name": True}

    uri: str
    mime_type: str = Field(
        "application/octet-stream", alias="mimeType",
    )
    text: str


class MCPResourceReadResponse(BaseModel):
    """MCP-style resources/read response."""

    ok: bool
    contents: list[MCPResourceContent] | None = None
    error: str | None = None


class OpenClawInvokeRequest(BaseModel):
    """Compatibility shim for OpenClaw tool invoke payload variants."""

    name: str | None = None
    tool: str | None = None
    tool_name: str | None = None
    arguments: object | None = None
    input: object | None = None
    params: object | None = None
    approved: bool = False
    timeout_sec: float | None = Field(default=None, gt=0.0, le=600.0)


class OpenClawInvokeResponse(BaseModel):
    """OpenClaw-compatible tool invoke response shape."""

    object: str = "openclaw.tool_result"
    tool: str
    ok: bool
    result: Any | None = None
    error: str | None = None
    duration_ms: int
    timed_out: bool = False
    denied: bool = False
    requires_approval: bool = False


def _serialize_skill(skill: SkillManifest) -> SkillResponse:
    """Convert internal skill manifest to API response."""
    return SkillResponse(
        schema=skill.schema_version,
        name=skill.name,
        namespace=skill.namespace,
        version=skill.version,
        qualified_name=skill.qualified_name,
        reference=skill.reference,
        description=skill.description,
        kind=skill.kind.value,
        timeout_sec=skill.timeout_sec,
        permission_tags=[tag.value for tag in skill.permission_tags],
        risk_tags=[tag.value for tag in skill.risk_tags],
        input_schema=skill.input_schema,
    )


def _require_skill(skill_name: str, registry: SkillRegistryDep) -> SkillManifest:
    """Fetch a skill or raise 404."""
    skill = registry.get(skill_name)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


def _allow_execute(request: Request) -> bool:
    """Read execution toggle from config with permissive fallback."""
    config = getattr(request.app.state, "config", None)
    if config is None:
        return True
    skills_cfg = getattr(config, "skills", None)
    allow_execute = getattr(skills_cfg, "allow_execute", True)
    return bool(allow_execute)


def _mcp_enabled(request: Request) -> bool:
    """Read MCP adapter toggle from config with permissive fallback."""
    config = getattr(request.app.state, "config", None)
    if config is None:
        return True
    skills_cfg = getattr(config, "skills", None)
    mcp_enabled = getattr(skills_cfg, "mcp_adapter_enabled", True)
    return bool(mcp_enabled)


def _remote_mcp_preferred(request: Request) -> bool:
    config = getattr(request.app.state, "config", None)
    if config is None:
        return False
    skills_cfg = getattr(config, "skills", None)
    preferred = getattr(skills_cfg, "remote_mcp_prefer_remote", False)
    return bool(preferred)


def _remote_bridge(request: Request) -> RemoteMCPBridge | None:
    bridge = getattr(request.app.state, "remote_mcp_bridge", None)
    if bridge is None:
        return None
    return cast(RemoteMCPBridge, bridge)


def _parse_arguments(
    arguments: object,
    *,
    fallback: object | None = None,
) -> dict[str, Any]:
    source = arguments if arguments is not None else fallback
    if source is None:
        return {}
    if isinstance(source, Mapping):
        return {str(key): value for key, value in source.items()}
    if isinstance(source, str):
        token = source.strip()
        if not token:
            return {}
        try:
            parsed = json.loads(token)
        except json.JSONDecodeError as exc:
            raise ValueError("arguments string must be valid JSON object") from exc
        if not isinstance(parsed, dict):
            raise ValueError("arguments string must decode to JSON object")
        return {str(key): value for key, value in parsed.items()}
    raise ValueError("arguments must be an object or JSON object string")


async def _dispatch_execute(
    request: Request,
    executor: SkillExecutorDep,
    *,
    skill: SkillManifest,
    arguments: dict[str, Any],
    approved: bool,
    timeout_sec: float | None,
) -> dict[str, Any]:
    validation_error = validate_skill_arguments(arguments, skill.input_schema)
    if validation_error is not None:
        raise ValueError(validation_error)

    dispatcher_raw = getattr(request.app.state, "skill_dispatcher", None)
    if dispatcher_raw is not None and hasattr(dispatcher_raw, "execute"):
        result = await dispatcher_raw.execute(
            skill,
            arguments=arguments,
            approved=approved,
            timeout_sec=timeout_sec,
        )
    else:
        result = await asyncio.to_thread(
            executor.execute,
            skill,
            arguments=arguments,
            approved=approved,
            timeout_sec=timeout_sec,
        )
    execution_result = cast(SkillExecutionResult, result)
    return execution_result.model_dump()


def _skill_error(
    *,
    status_code: int,
    message: str,
    code: str,
    retry_after: int | None = None,
) -> JSONResponse:
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


def _coerce_remote_call_result(name: str, payload: dict[str, object]) -> MCPToolCallResponse:
    if "skill_name" in payload and "duration_ms" in payload:
        return MCPToolCallResponse.model_validate(payload)
    return MCPToolCallResponse(
        skill_name=str(payload.get("skill_name") or payload.get("name") or name),
        kind=str(payload.get("kind") or "entrypoint"),
        ok=bool(payload.get("ok", False)),
        output=payload.get("output"),
        error=cast(str | None, payload.get("error")),
        duration_ms=int(cast(Any, payload.get("duration_ms", 0))),
        timed_out=bool(payload.get("timed_out", False)),
        denied=bool(payload.get("denied", False)),
        requires_approval=bool(payload.get("requires_approval", False)),
    )


async def _call_remote_bridge(
    request: Request,
    *,
    name: str,
    arguments: dict[str, Any],
    approved: bool,
) -> MCPToolCallResponse | None:
    bridge = _remote_bridge(request)
    if bridge is None:
        return None
    payload = await bridge.tools_call(name=name, arguments=arguments, approved=approved)
    if not payload:
        return None
    return _coerce_remote_call_result(name, payload)


@router.get("/v1/skills/mcp/tools", response_model=MCPToolsResponse)
async def list_mcp_tools(request: Request, registry: SkillRegistryDep) -> MCPToolsResponse:
    """List tools in an MCP-compatible shape."""
    if not _mcp_enabled(request):
        raise HTTPException(status_code=404, detail="MCP adapter disabled")

    local_tools = [
        MCPTool(
            name=skill.name if skill.namespace == "default" else skill.reference,
            description=skill.description,
            inputSchema=skill.input_schema,
            namespace=skill.namespace,
            version=skill.version,
            aliases=list(skill.aliases()),
        )
        for skill in registry.list_latest()
    ]

    remote_tools: list[MCPTool] = []
    bridge = _remote_bridge(request)
    if bridge is not None:
        remote_payload = await bridge.tools_list()
        tools_raw = remote_payload.get("tools")
        if isinstance(tools_raw, list):
            for item in tools_raw:
                if not isinstance(item, Mapping):
                    continue
                remote_tools.append(
                    MCPTool(
                        name=str(item.get("name", "")),
                        description=str(item.get("description", "")),
                        inputSchema=cast(dict[str, Any], item.get("input_schema", {})),
                        namespace=cast(str | None, item.get("namespace")),
                        version=cast(str | None, item.get("version")),
                        aliases=[
                            str(alias)
                            for alias in cast(list[object], item.get("aliases", []))
                            if isinstance(alias, str)
                        ],
                    )
                )

    ordered_tools = (
        remote_tools + local_tools
        if _remote_mcp_preferred(request)
        else local_tools + remote_tools
    )
    deduped: list[MCPTool] = []
    seen: set[str] = set()
    for tool in ordered_tools:
        name = tool.name.strip()
        if not name or name in seen:
            continue
        deduped.append(tool)
        seen.add(name)

    return MCPToolsResponse(tools=deduped, list_changed_at=registry.list_changed_at.isoformat())


@router.post("/v1/skills/mcp/call", response_model=MCPToolCallResponse)
async def call_mcp_tool(
    body: MCPToolCallRequest,
    request: Request,
    registry: SkillRegistryDep,
    executor: SkillExecutorDep,
) -> Response:
    """Execute a tool call in an MCP-compatible shape."""
    if not _mcp_enabled(request):
        raise HTTPException(status_code=404, detail="MCP adapter disabled")
    if not _allow_execute(request):
        raise HTTPException(status_code=403, detail="Skill execution disabled")

    try:
        arguments = _parse_arguments(body.arguments)
    except ValueError as exc:
        return _skill_error(status_code=400, message=str(exc), code="invalid_arguments")

    if _remote_mcp_preferred(request):
        remote_result = await _call_remote_bridge(
            request,
            name=body.name,
            arguments=arguments,
            approved=body.approved,
        )
        if remote_result is not None and (remote_result.ok or registry.get(body.name) is None):
            return JSONResponse(content=remote_result.model_dump(mode="json"))

    skill = registry.get(body.name)
    if skill is None:
        remote_result = await _call_remote_bridge(
            request,
            name=body.name,
            arguments=arguments,
            approved=body.approved,
        )
        if remote_result is not None:
            return JSONResponse(content=remote_result.model_dump(mode="json"))
        raise HTTPException(status_code=404, detail="Skill not found")

    try:
        response = await _dispatch_execute(
            request,
            executor,
            skill=skill,
            arguments=arguments,
            approved=body.approved,
            timeout_sec=None,
        )
    except ValueError as exc:
        return _skill_error(
            status_code=400,
            message=str(exc),
            code="invalid_arguments",
        )
    except SkillDispatchOverloadedError as exc:
        return _skill_error(
            status_code=429,
            message=str(exc),
            code="skill_queue_saturated",
            retry_after=exc.retry_after,
        )
    validated = MCPToolCallResponse.model_validate(response)
    return JSONResponse(content=validated.model_dump(mode="json"))


def _get_mcp_bridge(
    request: Request,
    registry: SkillRegistryDep,
    executor: SkillExecutorDep,
) -> SkillsMCPBridge:
    """Build a SkillsMCPBridge from request-scoped dependencies."""
    return SkillsMCPBridge(registry=registry, executor=executor)


@router.get("/v1/skills/mcp/prompts", response_model=MCPPromptsResponse)
async def mcp_list_prompts(
    request: Request,
    registry: SkillRegistryDep,
    executor: SkillExecutorDep,
) -> MCPPromptsResponse:
    """List prompt-kind skills in an MCP-compatible shape."""
    if not _mcp_enabled(request):
        raise HTTPException(status_code=404, detail="MCP adapter disabled")
    bridge = _get_mcp_bridge(request, registry, executor)
    payload = bridge.prompts_list()
    return MCPPromptsResponse.model_validate(payload)


@router.post("/v1/skills/mcp/prompts/get", response_model=MCPPromptGetResponse)
async def mcp_get_prompt(
    body: MCPPromptGetRequest,
    request: Request,
    registry: SkillRegistryDep,
    executor: SkillExecutorDep,
) -> MCPPromptGetResponse:
    """Render a prompt-kind skill by name with optional arguments."""
    if not _mcp_enabled(request):
        raise HTTPException(status_code=404, detail="MCP adapter disabled")
    bridge = _get_mcp_bridge(request, registry, executor)
    payload = bridge.prompts_get(name=body.name, arguments=body.arguments)
    return MCPPromptGetResponse.model_validate(payload)


@router.get("/v1/skills/mcp/resources", response_model=MCPResourcesResponse)
async def mcp_list_resources(
    request: Request,
    registry: SkillRegistryDep,
    executor: SkillExecutorDep,
) -> MCPResourcesResponse:
    """List resource-bearing skills in an MCP-compatible shape."""
    if not _mcp_enabled(request):
        raise HTTPException(status_code=404, detail="MCP adapter disabled")
    bridge = _get_mcp_bridge(request, registry, executor)
    payload = bridge.resources_list()
    return MCPResourcesResponse.model_validate(payload)


@router.get("/v1/skills/mcp/capabilities", response_model=MCPCapabilitiesResponse)
async def mcp_capabilities(
    request: Request,
    registry: SkillRegistryDep,
    executor: SkillExecutorDep,
) -> MCPCapabilitiesResponse:
    """Return MCP server capabilities including change notification support."""
    if not _mcp_enabled(request):
        raise HTTPException(status_code=404, detail="MCP adapter disabled")
    bridge = _get_mcp_bridge(request, registry, executor)
    payload = bridge.capabilities()
    return MCPCapabilitiesResponse.model_validate(payload)


# ── Standard MCP POST endpoints (/mcp/*) ────────────────────────────────


@router.post("/mcp/prompts/list", response_model=MCPPromptsResponse)
async def mcp_post_prompts_list(
    request: Request,
    registry: SkillRegistryDep,
    executor: SkillExecutorDep,
) -> MCPPromptsResponse:
    """MCP spec POST endpoint: list registered skill prompts."""
    if not _mcp_enabled(request):
        raise HTTPException(status_code=404, detail="MCP adapter disabled")
    bridge = _get_mcp_bridge(request, registry, executor)
    payload = bridge.prompts_list()
    return MCPPromptsResponse.model_validate(payload)


@router.post("/mcp/prompts/get", response_model=MCPPromptGetResponse)
async def mcp_post_prompts_get(
    body: MCPPromptGetRequest,
    request: Request,
    registry: SkillRegistryDep,
    executor: SkillExecutorDep,
) -> MCPPromptGetResponse:
    """MCP spec POST endpoint: resolve a prompt by name with arguments."""
    if not _mcp_enabled(request):
        raise HTTPException(status_code=404, detail="MCP adapter disabled")
    bridge = _get_mcp_bridge(request, registry, executor)
    payload = bridge.prompts_get(name=body.name, arguments=body.arguments)
    return MCPPromptGetResponse.model_validate(payload)


@router.post("/mcp/resources/list", response_model=MCPResourcesResponse)
async def mcp_post_resources_list(
    request: Request,
    registry: SkillRegistryDep,
    executor: SkillExecutorDep,
) -> MCPResourcesResponse:
    """MCP spec POST endpoint: list available resources."""
    if not _mcp_enabled(request):
        raise HTTPException(status_code=404, detail="MCP adapter disabled")
    bridge = _get_mcp_bridge(request, registry, executor)
    payload = bridge.resources_list()
    return MCPResourcesResponse.model_validate(payload)


@router.post("/mcp/resources/read", response_model=MCPResourceReadResponse)
async def mcp_post_resources_read(
    body: MCPResourceReadRequest,
    request: Request,
    registry: SkillRegistryDep,
    executor: SkillExecutorDep,
) -> MCPResourceReadResponse:
    """MCP spec POST endpoint: read a resource by URI."""
    if not _mcp_enabled(request):
        raise HTTPException(status_code=404, detail="MCP adapter disabled")
    bridge = _get_mcp_bridge(request, registry, executor)
    payload = bridge.resources_read(uri=body.uri)
    return MCPResourceReadResponse.model_validate(payload)


@router.post("/mcp/capabilities", response_model=MCPCapabilitiesResponse)
async def mcp_post_capabilities(
    request: Request,
    registry: SkillRegistryDep,
    executor: SkillExecutorDep,
) -> MCPCapabilitiesResponse:
    """MCP spec POST endpoint: return server capabilities declaration."""
    if not _mcp_enabled(request):
        raise HTTPException(status_code=404, detail="MCP adapter disabled")
    bridge = _get_mcp_bridge(request, registry, executor)
    payload = bridge.capabilities()
    return MCPCapabilitiesResponse.model_validate(payload)


@router.get("/v1/skills", response_model=SkillListResponse)
async def list_skills(
    registry: SkillRegistryDep,
    latest_only: bool = Query(True, description="Return latest version per namespace/name only"),
) -> SkillListResponse:
    """List registered skills."""
    manifests = registry.list_latest() if latest_only else registry.list()
    return SkillListResponse(data=[_serialize_skill(skill) for skill in manifests])


@router.get("/v1/skills/{skill_name:path}", response_model=SkillResponse)
async def get_skill(skill_name: str, registry: SkillRegistryDep) -> SkillResponse:
    """Get one skill definition by reference or name alias."""
    return _serialize_skill(_require_skill(skill_name, registry))


@router.post("/v1/skills/{skill_name:path}/execute", response_model=SkillExecuteResponse)
async def execute_skill(
    skill_name: str,
    body: SkillExecuteRequest,
    request: Request,
    registry: SkillRegistryDep,
    executor: SkillExecutorDep,
) -> Response:
    """Execute one skill with structured arguments."""
    if not _allow_execute(request):
        raise HTTPException(status_code=403, detail="Skill execution disabled")

    try:
        arguments = _parse_arguments(body.arguments)
    except ValueError as exc:
        return _skill_error(status_code=400, message=str(exc), code="invalid_arguments")

    skill = registry.get(skill_name)
    if skill is None:
        remote_result = await _call_remote_bridge(
            request,
            name=skill_name,
            arguments=arguments,
            approved=body.approved,
        )
        if remote_result is None:
            raise HTTPException(status_code=404, detail="Skill not found")
        payload = remote_result.model_dump(mode="json")
        payload["skill"] = remote_result.skill_name
        validated = SkillExecuteResponse.model_validate(payload)
        return JSONResponse(content=validated.model_dump(mode="json"))

    try:
        payload = await _dispatch_execute(
            request,
            executor,
            skill=skill,
            arguments=arguments,
            approved=body.approved,
            timeout_sec=body.timeout_sec,
        )
    except ValueError as exc:
        return _skill_error(
            status_code=400,
            message=str(exc),
            code="invalid_arguments",
        )
    except SkillDispatchOverloadedError as exc:
        return _skill_error(
            status_code=429,
            message=str(exc),
            code="skill_queue_saturated",
            retry_after=exc.retry_after,
        )
    payload["skill"] = skill.reference
    validated = SkillExecuteResponse.model_validate(payload)
    return JSONResponse(content=validated.model_dump(mode="json"))


@router.post("/v1/skills/openclaw/invoke", response_model=OpenClawInvokeResponse)
async def openclaw_invoke(
    body: OpenClawInvokeRequest,
    request: Request,
    registry: SkillRegistryDep,
    executor: SkillExecutorDep,
) -> Response:
    """OpenClaw compatibility shim for tool invocation payload variants."""
    if not _allow_execute(request):
        raise HTTPException(status_code=403, detail="Skill execution disabled")

    tool_name = (body.name or body.tool or body.tool_name or "").strip()
    if not tool_name:
        return _skill_error(
            status_code=400,
            message="Missing tool identifier (name/tool/tool_name)",
            code="invalid_tool_name",
        )

    try:
        arguments = _parse_arguments(body.arguments, fallback=body.input or body.params)
    except ValueError as exc:
        return _skill_error(status_code=400, message=str(exc), code="invalid_arguments")

    skill = registry.get(tool_name)
    payload: dict[str, Any]
    if skill is None:
        remote_result = await _call_remote_bridge(
            request,
            name=tool_name,
            arguments=arguments,
            approved=body.approved,
        )
        if remote_result is None:
            raise HTTPException(status_code=404, detail="Skill not found")
        payload = remote_result.model_dump(mode="json")
    else:
        try:
            payload = await _dispatch_execute(
                request,
                executor,
                skill=skill,
                arguments=arguments,
                approved=body.approved,
                timeout_sec=body.timeout_sec,
            )
        except ValueError as exc:
            return _skill_error(
                status_code=400,
                message=str(exc),
                code="invalid_arguments",
            )
        except SkillDispatchOverloadedError as exc:
            return _skill_error(
                status_code=429,
                message=str(exc),
                code="skill_queue_saturated",
                retry_after=exc.retry_after,
            )

    response = OpenClawInvokeResponse(
        tool=tool_name,
        ok=bool(payload.get("ok", False)),
        result=payload.get("output"),
        error=cast(str | None, payload.get("error")),
        duration_ms=int(payload.get("duration_ms", 0)),
        timed_out=bool(payload.get("timed_out", False)),
        denied=bool(payload.get("denied", False)),
        requires_approval=bool(payload.get("requires_approval", False)),
    )
    return JSONResponse(content=response.model_dump(mode="json"))
