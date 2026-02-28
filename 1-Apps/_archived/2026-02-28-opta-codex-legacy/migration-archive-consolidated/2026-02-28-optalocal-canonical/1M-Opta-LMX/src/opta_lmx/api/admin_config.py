"""Admin configuration routes — config reload, status."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.responses import Response

from opta_lmx.api.deps import (
    AdminAuth,
    Events,
    Memory,
    Presets,
    Router,
)
from opta_lmx.api.errors import internal_error
from opta_lmx.inference.schema import ErrorResponse
from opta_lmx.security.jwt_verifier import SupabaseJWTVerifier

logger = logging.getLogger(__name__)


def _get_journal_manager(request: Request) -> object | None:
    """Return runtime journal manager if available."""
    manager = getattr(request.app.state, "journal_manager", None)
    if manager is None or not hasattr(manager, "write_update_log"):
        return None
    return manager


def _write_update_journal(
    request: Request,
    *,
    title: str,
    summary: str,
    category: str,
    promoted: bool | None = None,
    command_inputs: dict[str, Any] | None = None,
    steps: list[dict[str, Any]] | None = None,
) -> None:
    """Request-aware helper for numbered update journaling."""
    journal_manager = _get_journal_manager(request)
    if journal_manager is None:
        return
    try:
        journal_manager.write_update_log(  # type: ignore[union-attr]
            title=title,
            summary=summary,
            category=category,
            promoted=promoted,
            command_inputs=command_inputs,
            steps=steps,
        )
    except Exception:
        logger.warning(
            "update_journal_write_failed",
            extra={"title": title, "category": category},
        )


admin_config_router = APIRouter()


@admin_config_router.post(
    "/admin/config/reload",
    response_model=None,
    responses={403: {"model": ErrorResponse}},
)
async def reload_config(
    _auth: AdminAuth,
    task_router: Router,
    memory: Memory,
    event_bus: Events,
    preset_mgr: Presets,
    request: Request,
) -> Response:
    """Hot-reload configuration from disk without restarting.

    Re-reads the YAML config file and updates runtime state:
    - Routing aliases and default model
    - Memory thresholds
    - Logging level
    - Admin key

    Does NOT unload/reload models or change server bind address.
    """
    # Import load_config from the composing admin module so that
    # test patches on ``opta_lmx.api.admin.load_config`` take effect.
    from opta_lmx.api.admin import load_config as _load_config

    try:
        new_config = _load_config()
    except Exception as e:
        logger.error("config_reload_failed", extra={"error": str(e)})
        return internal_error(f"Failed to parse config: {e}")

    # Update routing
    task_router.update_config(new_config.routing)

    # Update memory threshold
    memory.threshold_percent = new_config.memory.max_memory_percent

    # Update auth settings
    request.app.state.admin_key = new_config.security.admin_key
    request.app.state.inference_api_key = new_config.security.inference_api_key
    request.app.state.supabase_jwt_enabled = new_config.security.supabase_jwt_enabled
    request.app.state.supabase_jwt_require = new_config.security.supabase_jwt_require
    request.app.state.supabase_jwt_verifier = (
        SupabaseJWTVerifier(
            issuer=new_config.security.supabase_jwt_issuer,
            audience=new_config.security.supabase_jwt_audience,
            jwks_url=new_config.security.supabase_jwt_jwks_url,
            user_id_claim=new_config.security.supabase_jwt_claim_user_id,
        )
        if new_config.security.supabase_jwt_enabled
        else None
    )

    # Update logging level
    import logging as _logging

    root = _logging.getLogger()
    root.setLevel(getattr(_logging, new_config.logging.level.upper(), _logging.INFO))

    # Store updated config
    request.app.state.config = new_config

    logger.info(
        "config_reloaded",
        extra={
            "routing_aliases": len(new_config.routing.aliases),
            "memory_threshold": new_config.memory.max_memory_percent,
            "log_level": new_config.logging.level,
        },
    )

    # Publish config_reloaded event
    from opta_lmx.monitoring.events import ServerEvent

    await event_bus.publish(
        ServerEvent(
            event_type="config_reloaded",
            data={
                "routing_aliases": len(new_config.routing.aliases),
                "memory_threshold": new_config.memory.max_memory_percent,
                "log_level": new_config.logging.level,
            },
        )
    )

    # Reload presets and merge routing aliases
    if new_config.presets.enabled:
        preset_mgr.reload()
        preset_aliases = preset_mgr.get_routing_aliases()
        if preset_aliases:
            for alias, models in preset_aliases.items():
                existing = new_config.routing.aliases.get(alias, [])
                merged = list(dict.fromkeys(existing + models))
                new_config.routing.aliases[alias] = merged
            task_router.update_config(new_config.routing)

    _write_update_journal(
        request,
        title="Reload LMX Config",
        summary="Reloaded runtime configuration via /admin/config/reload.",
        category="sync",
        promoted=True,
        command_inputs={
            "routing_aliases": len(new_config.routing.aliases),
            "memory_threshold": new_config.memory.max_memory_percent,
            "log_level": new_config.logging.level,
            "presets_enabled": new_config.presets.enabled,
        },
        steps=[
            {
                "target": "lmx",
                "component": "config",
                "step": "routing",
                "status": "ok",
                "message": f"aliases={len(new_config.routing.aliases)}",
            },
            {
                "target": "lmx",
                "component": "config",
                "step": "memory-threshold",
                "status": "ok",
                "message": f"max_memory_percent={new_config.memory.max_memory_percent}",
            },
            {
                "target": "lmx",
                "component": "config",
                "step": "logging",
                "status": "ok",
                "message": f"level={new_config.logging.level}",
            },
        ],
    )

    # Determine reload scope for user feedback
    applied = ["routing", "memory", "security", "logging", "presets"]
    restart_required = []

    # Middleware-level settings cannot be hot-reloaded
    old_cors = (
        getattr(request.app.state.config, "security", None)
        and getattr(request.app.state.config.security, "cors_allowed_origins", [])
        or []
    )
    new_cors = getattr(new_config.security, "cors_allowed_origins", [])
    if old_cors != new_cors:
        restart_required.append("cors_allowed_origins")

    # Rate limiter internals are set at startup
    old_rate_limit = getattr(request.app.state.config, "security", None) and getattr(
        request.app.state.config.security, "rate_limit", None
    )
    new_rate_limit = new_config.security.rate_limit
    if old_rate_limit and new_rate_limit:
        if old_rate_limit.enabled != new_rate_limit.enabled:
            restart_required.append("rate_limit.enabled")

    # mTLS policy is set at startup
    old_mtls = (
        getattr(request.app.state.config, "security", None)
        and getattr(request.app.state.config.security, "mtls_mode", "off")
        or "off"
    )
    new_mtls = new_config.security.mtls_mode
    if old_mtls != new_mtls:
        restart_required.append("mtls_mode")

    return JSONResponse(
        content={
            "success": True,
            "updated": applied,
            "restart_required": restart_required,
            "message": (
                f"Configuration hot-reloaded successfully. "
                f"{len(applied)} sections updated."
                + (
                    f" Restart required for: {', '.join(restart_required)}"
                    if restart_required
                    else ""
                )
            ),
        }
    )
