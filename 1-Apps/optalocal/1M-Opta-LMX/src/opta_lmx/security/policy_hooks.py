"""Endpoint policy hook scaffolding for sensitive API surfaces.

This module is intentionally lightweight and non-breaking:
- Disabled by default.
- Missing hook implementation always allows requests.
- Supports audit mode for dry-run rollout.

TODO(opta-security): plug account/device/capability identity into trusted
identity provider claims (JWT/session), rather than direct request headers.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from fastapi import HTTPException, Request


@dataclass(slots=True, frozen=True)
class PolicyHookContext:
    """Structured context passed into custom endpoint policy hooks."""

    surface: str
    action: str
    path: str
    method: str
    account_id: str | None
    device_id: str | None
    capabilities: frozenset[str] = field(default_factory=frozenset)


@dataclass(slots=True, frozen=True)
class PolicyHookDecision:
    """Hook decision container.

    reason is expected to be operator-facing (safe to log).
    """

    allowed: bool
    reason: str = ""


class EndpointPolicyHook(Protocol):
    """Policy hook integration interface.

    Implementers can be attached via ``app.state.endpoint_policy_hook``.
    """

    def evaluate(self, context: PolicyHookContext) -> PolicyHookDecision: ...


def parse_capabilities(raw: str | None) -> frozenset[str]:
    if not raw:
        return frozenset()
    values = {part.strip().lower() for part in raw.split(",") if part.strip()}
    return frozenset(values)


def _config(request: Request) -> object | None:
    config = getattr(request.app.state, "config", None)
    security = getattr(config, "security", None)
    return getattr(security, "endpoint_policy_hooks", None)


def is_sensitive_admin_request(path: str, method: str) -> bool:
    """Best-effort sensitive-route matcher for /admin surface.

    TODO(opta-security): replace path heuristics with explicit per-route metadata.
    """

    normalized_path = path.rstrip("/") or "/"
    is_mutation = method.upper() in {"POST", "PUT", "PATCH", "DELETE"}
    if normalized_path.startswith("/admin/models") and is_mutation:
        return True
    return normalized_path in {
        "/admin/config/reload",
        "/admin/quantize",
        "/admin/presets/reload",
    }


def enforce_sensitive_endpoint_policy(
    request: Request,
    *,
    surface: str,
    action: str,
) -> None:
    """Evaluate optional policy hooks for sensitive endpoints.

    Non-breaking behavior:
    - If hooks config is absent/disabled => allow.
    - If hook object absent => allow.
    - If mode=audit and denied => record decision on request.state, allow.
    """

    cfg = _config(request)
    if cfg is None or not bool(getattr(cfg, "enabled", False)):
        return

    enabled_for_surface = {
        "admin": bool(getattr(cfg, "admin_sensitive_enabled", False)),
        "skills": bool(getattr(cfg, "skills_sensitive_enabled", False)),
        "agents": bool(getattr(cfg, "agents_sensitive_enabled", False)),
    }.get(surface, False)
    if not enabled_for_surface:
        return

    account_header = getattr(cfg, "account_id_header", "X-Account-Id")
    device_header = getattr(cfg, "device_id_header", "X-Device-Id")
    capabilities_header = getattr(cfg, "capabilities_header", "X-Capabilities")

    account_id = request.headers.get(account_header)
    device_id = request.headers.get(device_header)
    capabilities = parse_capabilities(request.headers.get(capabilities_header))

    required_capabilities_raw = getattr(cfg, "required_capabilities", [])
    required_capabilities = {
        str(item).strip().lower() for item in required_capabilities_raw if str(item).strip()
    }

    denied_reason: str | None = None
    if bool(getattr(cfg, "require_account", False)) and not account_id:
        denied_reason = "missing_account_id"
    elif bool(getattr(cfg, "require_device", False)) and not device_id:
        denied_reason = "missing_device_id"
    elif required_capabilities and not required_capabilities.issubset(capabilities):
        denied_reason = "missing_capabilities"

    decision = PolicyHookDecision(allowed=denied_reason is None, reason=denied_reason or "")
    hook = getattr(request.app.state, "endpoint_policy_hook", None)
    if hook is not None and hasattr(hook, "evaluate"):
        context = PolicyHookContext(
            surface=surface,
            action=action,
            path=request.url.path,
            method=request.method,
            account_id=account_id,
            device_id=device_id,
            capabilities=capabilities,
        )
        custom_decision = hook.evaluate(context)
        if isinstance(custom_decision, PolicyHookDecision):
            decision = custom_decision

    request.state.endpoint_policy_decision = decision

    if decision.allowed:
        return

    mode = str(getattr(cfg, "mode", "audit")).strip().lower()
    if mode != "enforce":
        return

    raise HTTPException(status_code=403, detail=f"Policy hook denied request: {decision.reason}")
