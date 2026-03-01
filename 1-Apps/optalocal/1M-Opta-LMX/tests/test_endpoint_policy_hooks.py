"""Tests for sensitive endpoint policy hook scaffolding."""

from __future__ import annotations

import pytest
from fastapi import FastAPI, HTTPException
from starlette.requests import Request

from opta_lmx.api.deps import (
    verify_admin_key,
    verify_sensitive_agents_policy,
    verify_sensitive_skills_policy,
)
from opta_lmx.config import LMXConfig
from opta_lmx.security.policy_hooks import PolicyHookContext, PolicyHookDecision


def _request(
    app: FastAPI,
    *,
    path: str,
    method: str = "POST",
    headers: dict[str, str] | None = None,
) -> Request:
    raw_headers = []
    for key, value in (headers or {}).items():
        raw_headers.append((key.lower().encode("latin-1"), value.encode("latin-1")))
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "path": path,
        "raw_path": path.encode("ascii"),
        "scheme": "http",
        "headers": raw_headers,
        "query_string": b"",
        "client": ("127.0.0.1", 1234),
        "server": ("test", 80),
        "app": app,
    }
    return Request(scope)


def test_skills_policy_guard_audit_mode_allows_and_records_denial() -> None:
    app = FastAPI()
    app.state.config = LMXConfig(
        security={
            "endpoint_policy_hooks": {
                "enabled": True,
                "mode": "audit",
                "skills_sensitive_enabled": True,
                "require_account": True,
            }
        }
    )

    request = _request(app, path="/v1/skills/echo/execute")
    verify_sensitive_skills_policy(request)

    decision = request.state.endpoint_policy_decision
    assert decision.allowed is False
    assert decision.reason == "missing_account_id"


def test_skills_policy_guard_enforce_mode_blocks_missing_account() -> None:
    app = FastAPI()
    app.state.config = LMXConfig(
        security={
            "endpoint_policy_hooks": {
                "enabled": True,
                "mode": "enforce",
                "skills_sensitive_enabled": True,
                "require_account": True,
            }
        }
    )

    request = _request(app, path="/v1/skills/echo/execute")
    with pytest.raises(HTTPException, match="Policy hook denied request"):
        verify_sensitive_skills_policy(request)


def test_admin_sensitive_guard_checks_capabilities_without_breaking_non_sensitive() -> None:
    app = FastAPI()
    app.state.config = LMXConfig(
        security={
            "endpoint_policy_hooks": {
                "enabled": True,
                "mode": "enforce",
                "admin_sensitive_enabled": True,
                "required_capabilities": ["admin:models:write"],
            }
        }
    )
    app.state.admin_key = None

    blocked = _request(app, path="/admin/models/load", method="POST")
    with pytest.raises(HTTPException, match="Policy hook denied request"):
        verify_admin_key(blocked, x_admin_key=None)

    allowed_non_sensitive = _request(app, path="/admin/status", method="GET")
    verify_admin_key(allowed_non_sensitive, x_admin_key=None)


class _DenyAllAgentsHook:
    def evaluate(self, context: PolicyHookContext) -> PolicyHookDecision:
        assert context.surface == "agents"
        return PolicyHookDecision(allowed=False, reason="custom_hook_denied")


def test_agents_policy_guard_supports_custom_hook_interface() -> None:
    app = FastAPI()
    app.state.config = LMXConfig(
        security={
            "endpoint_policy_hooks": {
                "enabled": True,
                "mode": "enforce",
                "agents_sensitive_enabled": True,
            }
        }
    )
    app.state.endpoint_policy_hook = _DenyAllAgentsHook()

    request = _request(app, path="/v1/agents/runs")
    with pytest.raises(HTTPException, match="custom_hook_denied"):
        verify_sensitive_agents_policy(request)
