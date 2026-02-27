"""MCP adapter helpers for skills registry and executor."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping
from typing import Any

import httpx

from opta_lmx.helpers.circuit_breaker import CircuitBreaker
from opta_lmx.skills.executors import SkillExecutionResult, SkillExecutor
from opta_lmx.skills.manifest import SkillKind
from opta_lmx.skills.registry import SkillsRegistry

logger = logging.getLogger(__name__)


class SkillsMCPBridge:
    """Expose skill manifests and execution in an MCP-friendly shape."""

    def __init__(self, registry: SkillsRegistry, executor: SkillExecutor) -> None:
        self._registry = registry
        self._executor = executor

    def dispatch(
        self,
        method: str,
        params: Mapping[str, object] | None = None,
    ) -> dict[str, object]:
        """Dispatch MCP calls to tools, prompts, resources, or capabilities."""
        if method == "tools/list":
            return self.tools_list()

        if method == "tools/call":
            request = params or {}
            return self.tools_call(
                name=request.get("name"),
                arguments=request.get("arguments"),
                approved=request.get("approved", False),
            )

        if method == "prompts/list":
            return self.prompts_list()

        if method == "prompts/get":
            request = params or {}
            return self.prompts_get(
                name=str(request.get("name", "")),
                arguments=request.get("arguments"),
            )

        if method == "resources/list":
            return self.resources_list()

        if method == "resources/read":
            request = params or {}
            return self.resources_read(uri=str(request.get("uri", "")))

        if method == "capabilities":
            return self.capabilities()

        return {"ok": False, "error": f"unsupported method: {method}"}

    def tools_list(self) -> dict[str, object]:
        """Return available skills as MCP tools metadata."""
        tools: list[dict[str, object]] = []

        for manifest in self._registry.list_latest():
            tool_name = manifest.name if manifest.namespace == "default" else manifest.reference
            tools.append({
                "name": tool_name,
                "short_name": manifest.name,
                "namespace": manifest.namespace,
                "version": manifest.version,
                "description": manifest.description,
                "input_schema": manifest.input_schema,
                "kind": manifest.kind.value,
                "permission_tags": [tag.value for tag in manifest.permission_tags],
                "risk_tags": [tag.value for tag in manifest.risk_tags],
            })

        return {
            "ok": True,
            "tools": tools,
            "list_changed_at": self._registry.list_changed_at.isoformat(),
        }

    def tools_call(
        self,
        *,
        name: object,
        arguments: object,
        approved: object,
    ) -> dict[str, object]:
        """Execute a named skill manifest with optional arguments."""
        if not isinstance(name, str) or not name:
            return {
                "ok": False,
                "error": "tools/call requires non-empty string field 'name'",
            }

        manifest = self._registry.get(name)
        if manifest is None:
            return {"ok": False, "error": f"unknown tool: {name}"}

        if arguments is None:
            call_args: dict[str, object] = {}
        elif isinstance(arguments, Mapping):
            call_args = {str(key): cast_value for key, cast_value in arguments.items()}
        else:
            return {"ok": False, "error": "tools/call field 'arguments' must be an object"}

        if not isinstance(approved, bool):
            return {
                "ok": False,
                "error": "tools/call field 'approved' must be boolean when provided",
            }

        result = self._executor.execute(manifest, arguments=call_args, approved=approved)
        return _result_to_response(result)

    # ── Prompts ──────────────────────────────────────────────────────────

    def prompts_list(self) -> dict[str, object]:
        """Return prompt-kind skills as MCP prompts metadata."""
        prompts: list[dict[str, object]] = []
        for manifest in self._registry.list_latest():
            if manifest.kind != SkillKind.PROMPT:
                continue
            prompts.append({
                "name": manifest.name,
                "description": manifest.description,
                "arguments": [
                    {
                        "name": key,
                        "required": key in manifest.input_schema.get("required", []),
                    }
                    for key in manifest.input_schema.get("properties", {})
                ],
            })
        return {"ok": True, "prompts": prompts}

    def prompts_get(
        self,
        *,
        name: str,
        arguments: object | None = None,
    ) -> dict[str, object]:
        """Get a rendered prompt by name."""
        if not name:
            return {"ok": False, "error": "prompts/get requires non-empty 'name'"}

        manifest = self._registry.get(name)
        if manifest is None:
            return {"ok": False, "error": f"unknown prompt: {name}"}
        if manifest.kind != SkillKind.PROMPT:
            return {"ok": False, "error": f"{name} is not a prompt skill"}

        args: dict[str, object] = {}
        if isinstance(arguments, Mapping):
            args = {str(k): v for k, v in arguments.items()}

        try:
            rendered = manifest.prompt_template.format_map(args)  # type: ignore[union-attr]
        except (KeyError, ValueError) as exc:
            return {"ok": False, "error": f"prompt rendering failed: {exc}"}

        return {
            "ok": True,
            "messages": [
                {"role": "user", "content": {"type": "text", "text": rendered}},
            ],
        }

    # ── Resources ────────────────────────────────────────────────────────

    def resources_list(self) -> dict[str, object]:
        """Return skills with roots as MCP resource templates."""
        resources: list[dict[str, object]] = []
        for manifest in self._registry.list_latest():
            roots = getattr(manifest, "roots", None) or []
            if not roots:
                continue
            for root in roots:
                resources.append({
                    "uri": f"file://{root}",
                    "name": f"{manifest.name} ({root})",
                    "description": f"Filesystem access for {manifest.name}",
                    "mimeType": "application/octet-stream",
                })
        return {"ok": True, "resources": resources}

    def resources_read(self, *, uri: str) -> dict[str, object]:
        """Read a resource by URI.

        Currently supports ``lmx://model/<model_name>`` for model metadata and
        ``lmx://metrics`` for server-level metrics. ``file://`` URIs from skill
        roots return a directory listing stub (actual file content is out of
        scope for the skills bridge layer).
        """
        if not uri:
            return {"ok": False, "error": "resources/read requires non-empty 'uri'"}

        # Built-in model info resources
        if uri == "lmx://models":
            models: list[dict[str, object]] = []
            for manifest in self._registry.list_latest():
                models.append({
                    "name": manifest.name,
                    "namespace": manifest.namespace,
                    "version": manifest.version,
                    "kind": manifest.kind.value,
                    "description": manifest.description,
                })
            import json

            return {
                "ok": True,
                "contents": [
                    {
                        "uri": uri,
                        "mimeType": "application/json",
                        "text": json.dumps({"skills": models}, indent=2),
                    }
                ],
            }

        if uri == "lmx://metrics":
            import json

            metrics_data = {
                "registered_skills": len(list(self._registry.list_latest())),
                "list_changed_at": self._registry.list_changed_at.isoformat(),
            }
            return {
                "ok": True,
                "contents": [
                    {
                        "uri": uri,
                        "mimeType": "application/json",
                        "text": json.dumps(metrics_data, indent=2),
                    }
                ],
            }

        # file:// URIs from skill roots — return stub metadata
        if uri.startswith("file://"):
            path = uri[len("file://"):]
            # Verify this URI is from a registered skill root
            for manifest in self._registry.list_latest():
                roots = getattr(manifest, "roots", None) or []
                for root in roots:
                    if path == root or path.startswith(f"{root}/"):
                        return {
                            "ok": True,
                            "contents": [
                                {
                                    "uri": uri,
                                    "mimeType": "application/octet-stream",
                                    "text": f"Resource root: {root} (skill: {manifest.name})",
                                }
                            ],
                        }
            return {"ok": False, "error": f"resource URI not found: {uri}"}

        return {"ok": False, "error": f"unsupported resource URI scheme: {uri}"}

    # ── Capabilities ─────────────────────────────────────────────────────

    def capabilities(self) -> dict[str, object]:
        """Return MCP server capabilities including change notification support."""
        return {
            "ok": True,
            "capabilities": {
                "tools": {"listChanged": True},
                "prompts": {"listChanged": True},
                "resources": {"listChanged": True},
            },
        }


def _result_to_response(result: SkillExecutionResult) -> dict[str, object]:
    payload: dict[str, Any] = result.model_dump()
    return payload


class RemoteMCPBridge:
    """Async client bridge to a remote MCP-compatible skills endpoint."""

    def __init__(
        self,
        *,
        base_url: str,
        timeout_sec: float = 15.0,
        api_key: str | None = None,
        max_retries: int = 1,
        retry_backoff_sec: float = 0.25,
        failure_threshold: int = 3,
        reset_timeout_sec: float = 30.0,
    ) -> None:
        headers: dict[str, str] = {}
        if isinstance(api_key, str) and api_key.strip():
            headers["Authorization"] = f"Bearer {api_key.strip()}"
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout_sec,
            headers=headers,
        )
        self._max_retries = max(0, max_retries)
        self._retry_backoff_sec = max(0.0, retry_backoff_sec)
        self._circuit_breaker = CircuitBreaker(
            failure_threshold=max(1, failure_threshold),
            reset_timeout_sec=max(0.0, reset_timeout_sec),
        )

    async def tools_list(self) -> dict[str, object]:
        """Fetch tool metadata from a remote host."""
        payload = await self._request_json(
            method="GET",
            path="/v1/skills/mcp/tools",
        )
        if payload.get("ok") is False:
            logger.warning("remote_mcp_tools_list_failed", extra={"error": payload.get("error")})
        return payload

    async def tools_call(
        self,
        *,
        name: str,
        arguments: dict[str, object] | None = None,
        approved: bool = False,
    ) -> dict[str, object]:
        """Dispatch a remote tools/call request."""
        payload = {
            "name": name,
            "arguments": arguments or {},
            "approved": approved,
        }
        result = await self._request_json(
            method="POST",
            path="/v1/skills/mcp/call",
            json_payload=payload,
        )
        if result.get("ok") is False:
            logger.warning("remote_mcp_tools_call_failed", extra={"error": result.get("error")})
        return result

    async def close(self) -> None:
        """Release remote HTTP resources."""
        await self._client.aclose()

    async def _request_json(
        self,
        *,
        method: str,
        path: str,
        json_payload: dict[str, object] | None = None,
    ) -> dict[str, object]:
        if not self._circuit_breaker.allows_request:
            return {"ok": False, "error": "remote MCP circuit open"}

        attempts = self._max_retries + 1
        for attempt in range(attempts):
            try:
                if method == "GET":
                    response = await self._client.get(path)
                else:
                    response = await self._client.post(path, json=json_payload)
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, dict):
                    raise ValueError("remote MCP returned invalid payload")
                self._circuit_breaker.record_success()
                return payload
            except Exception as exc:
                is_last_attempt = attempt >= attempts - 1
                retryable = self._is_retryable_exception(exc)
                if is_last_attempt or not retryable:
                    self._circuit_breaker.record_failure()
                    return {"ok": False, "error": str(exc)}
                await asyncio.sleep(self._retry_backoff_sec * (2 ** attempt))

        self._circuit_breaker.record_failure()
        return {"ok": False, "error": "remote MCP request failed"}

    @staticmethod
    def _is_retryable_exception(exc: Exception) -> bool:
        if isinstance(exc, httpx.HTTPStatusError):
            status_code = exc.response.status_code
            return status_code == 429 or status_code >= 500
        return isinstance(exc, (httpx.TimeoutException, httpx.NetworkError))
