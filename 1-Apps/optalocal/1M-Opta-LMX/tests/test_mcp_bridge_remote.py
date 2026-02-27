"""Tests for remote MCP bridge resilience behavior."""

from __future__ import annotations

from unittest.mock import AsyncMock

import httpx
import pytest

from opta_lmx.skills.mcp_bridge import RemoteMCPBridge


@pytest.mark.asyncio
async def test_remote_mcp_retries_transient_failures() -> None:
    """Transient request failures should be retried before failing."""
    bridge = RemoteMCPBridge(
        base_url="http://remote",
        timeout_sec=1.0,
        max_retries=2,
        failure_threshold=3,
    )
    bridge._client = AsyncMock()
    bridge._client.get = AsyncMock(side_effect=[
        httpx.ConnectError("boom", request=httpx.Request("GET", "http://remote/v1/skills/mcp/tools")),
        httpx.ConnectError("boom", request=httpx.Request("GET", "http://remote/v1/skills/mcp/tools")),
        httpx.Response(
            200,
            json={"ok": True, "tools": []},
            request=httpx.Request("GET", "http://remote/v1/skills/mcp/tools"),
        ),
    ])

    payload = await bridge.tools_list()
    assert payload["ok"] is True
    assert bridge._client.get.await_count == 3


@pytest.mark.asyncio
async def test_remote_mcp_opens_circuit_after_repeated_failures() -> None:
    """After threshold failures, subsequent calls short-circuit until reset."""
    bridge = RemoteMCPBridge(
        base_url="http://remote",
        timeout_sec=1.0,
        max_retries=0,
        failure_threshold=1,
        reset_timeout_sec=60.0,
    )
    bridge._client = AsyncMock()
    bridge._client.get = AsyncMock(side_effect=httpx.ConnectError(
        "down",
        request=httpx.Request("GET", "http://remote/v1/skills/mcp/tools"),
    ))

    first = await bridge.tools_list()
    second = await bridge.tools_list()

    assert first["ok"] is False
    assert second["ok"] is False
    assert "circuit open" in str(second["error"]).lower()
    assert bridge._client.get.await_count == 1
