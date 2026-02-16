"""Admin API routes — /admin/* endpoints for model management."""

from __future__ import annotations

import asyncio
import json
import logging
import secrets
import time
import uuid
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from opta_lmx.inference.engine import InferenceEngine
    from opta_lmx.manager.model import ModelManager

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse

from opta_lmx import __version__
from opta_lmx.api.deps import (
    get_engine,
    get_event_bus,
    get_memory,
    get_metrics,
    get_model_manager,
    get_preset_manager,
    get_router,
    get_start_time,
    verify_admin_key,
)
from opta_lmx.config import load_config
from opta_lmx.api.errors import (
    download_not_found,
    insufficient_memory,
    internal_error,
    model_in_use,
    model_not_found,
    openai_error,
)
from opta_lmx.inference.schema import (
    AdminDeleteResponse,
    AdminDownloadRequest,
    AdminDownloadResponse,
    AdminLoadRequest,
    AdminLoadResponse,
    AdminMemoryResponse,
    AdminModelDetail,
    AdminModelsResponse,
    AdminStatusResponse,
    AdminUnloadRequest,
    AdminUnloadResponse,
    AutoDownloadResponse,
    AvailableModel,
    ConfirmLoadRequest,
    DownloadProgressResponse,
    ErrorResponse,
    PresetListResponse,
    PresetResponse,
)

logger = logging.getLogger(__name__)

# Token expiry for pending download confirmations (seconds)
_TOKEN_EXPIRY_SEC = 600  # 10 minutes

# Lock for pending_downloads dict (single-threaded async concurrency)
_pending_lock = asyncio.Lock()


def _human_size(size_bytes: int) -> str:
    """Convert bytes to human-readable string (e.g. '37.5 GB')."""
    if size_bytes <= 0:
        return "unknown"
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(size_bytes) < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024  # type: ignore[assignment]
    return f"{size_bytes:.1f} PB"


async def _load_after_download(
    download_id: str,
    model_id: str,
    manager: "ModelManager",
    engine: "InferenceEngine",
) -> None:
    """Wait for a download to complete, then auto-load the model."""
    while True:
        task = manager.get_download_progress(download_id)
        if task is None or task.status in ("completed", "failed"):
            break
        await asyncio.sleep(2)

    if task and task.status == "completed":
        try:
            await engine.load_model(model_id)
            logger.info("auto_load_after_download", extra={"model_id": model_id})
        except Exception as e:
            logger.error(
                "auto_load_after_download_failed",
                extra={"model_id": model_id, "error": str(e)},
            )
    elif task:
        logger.warning(
            "download_failed_no_auto_load",
            extra={"model_id": model_id, "download_id": download_id, "error": task.error},
        )


router = APIRouter()


@router.get("/admin/models", responses={403: {"model": ErrorResponse}})
async def list_admin_models(request: Request, x_admin_key: str | None = Header(None)) -> AdminModelsResponse:
    """List all loaded models with detailed statistics."""
    verify_admin_key(request, x_admin_key)
    engine = get_engine(request)

    loaded = engine.get_loaded_models_detailed()
    return AdminModelsResponse(
        loaded=[
            AdminModelDetail(
                id=m.model_id,
                loaded=True,
                memory_gb=m.estimated_memory_gb,
                loaded_at=m.loaded_at,
                use_batching=m.use_batching,
                request_count=m.request_count,
                last_used_at=m.last_used_at,
            )
            for m in loaded
        ],
        count=len(loaded),
    )


@router.post(
    "/admin/models/load",
    response_model=None,
    responses={
        200: {"model": AdminLoadResponse},
        202: {"model": AutoDownloadResponse},
        403: {"model": ErrorResponse},
        507: {"model": ErrorResponse},
    },
)
async def load_model(body: AdminLoadRequest, request: Request, x_admin_key: str | None = Header(None)):
    """Load a model into memory.

    If the model is not on disk:
    - Returns 202 with a confirmation token (user must confirm download)
    - If auto_download=True, skips confirmation and starts download immediately
    """
    verify_admin_key(request, x_admin_key)
    engine = get_engine(request)
    manager = get_model_manager(request)

    # Check if model is already loaded
    if engine.is_model_loaded(body.model_id):
        return AdminLoadResponse(success=True, model_id=body.model_id)

    # Check if model is on disk
    is_available = await manager.is_model_available(body.model_id)

    if not is_available:
        # Estimate download size
        estimated = await manager._estimate_size(body.model_id, None, None, None)

        if not body.auto_download:
            # Two-phase: return confirmation prompt
            token = f"dl-{secrets.token_urlsafe(16)}"
            async with _pending_lock:
                pending: dict = getattr(request.app.state, "pending_downloads", {})

                # Clean up expired pending downloads
                now = time.time()
                expired = [k for k, v in pending.items()
                           if now - v["created_at"] > _TOKEN_EXPIRY_SEC]
                for k in expired:
                    pending.pop(k, None)

                pending[token] = {
                    "model_id": body.model_id,
                    "estimated_bytes": estimated,
                    "created_at": time.time(),
                }
                request.app.state.pending_downloads = pending

            return JSONResponse(
                status_code=202,
                content=AutoDownloadResponse(
                    status="download_required",
                    model_id=body.model_id,
                    estimated_size_bytes=estimated if estimated > 0 else None,
                    estimated_size_human=_human_size(estimated) if estimated > 0 else None,
                    confirmation_token=token,
                    message="Model not found locally. Confirm download?",
                    confirm_url="/admin/models/load/confirm",
                ).model_dump(),
            )

        # auto_download=True: skip confirmation, start download + auto-load
        task = await manager.start_download(repo_id=body.model_id)
        asyncio.create_task(_load_after_download(task.download_id, body.model_id, manager, engine))

        return JSONResponse(
            status_code=202,
            content=AutoDownloadResponse(
                status="downloading",
                model_id=body.model_id,
                download_id=task.download_id,
                estimated_size_bytes=estimated if estimated > 0 else None,
                estimated_size_human=_human_size(estimated) if estimated > 0 else None,
                message="Download started. Model will auto-load when complete.",
                progress_url=f"/admin/models/download/{task.download_id}/progress",
            ).model_dump(),
        )

    # Model is on disk — load immediately
    start = time.monotonic()
    try:
        info = await engine.load_model(body.model_id)
    except MemoryError as e:
        return insufficient_memory(str(e))
    except RuntimeError as e:
        return internal_error(str(e))

    elapsed_ms = (time.monotonic() - start) * 1000

    return AdminLoadResponse(
        success=True,
        model_id=body.model_id,
        memory_after_load_gb=info.memory_used_gb,
        time_to_load_ms=round(elapsed_ms, 1),
    )


@router.post(
    "/admin/models/load/confirm",
    response_model=None,
    responses={
        202: {"model": AutoDownloadResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
async def confirm_and_load(
    body: ConfirmLoadRequest, request: Request, x_admin_key: str | None = Header(None),
):
    """Confirm a pending download and start download + auto-load.

    Uses the confirmation_token returned by the load endpoint when
    a model was not found locally.
    """
    verify_admin_key(request, x_admin_key)

    async with _pending_lock:
        pending: dict = getattr(request.app.state, "pending_downloads", {})
        entry = pending.pop(body.confirmation_token, None)

    if entry is None:
        return openai_error(
            status_code=404,
            message="Confirmation token expired or invalid",
            error_type="invalid_request_error",
            code="token_not_found",
        )

    # Check token age (10 minute expiry)
    if time.time() - entry["created_at"] > _TOKEN_EXPIRY_SEC:
        return openai_error(
            status_code=404,
            message="Confirmation token expired (10 minute limit)",
            error_type="invalid_request_error",
            code="token_expired",
        )

    manager = get_model_manager(request)
    engine = get_engine(request)
    model_id = entry["model_id"]

    task = await manager.start_download(repo_id=model_id)
    asyncio.create_task(_load_after_download(task.download_id, model_id, manager, engine))

    return JSONResponse(
        status_code=202,
        content=AutoDownloadResponse(
            status="downloading",
            model_id=model_id,
            download_id=task.download_id,
            message="Download started. Model will auto-load when complete.",
            progress_url=f"/admin/models/download/{task.download_id}/progress",
        ).model_dump(),
    )


@router.post(
    "/admin/models/unload",
    response_model=None,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def unload_model(body: AdminUnloadRequest, request: Request, x_admin_key: str | None = Header(None)):
    """Unload a model and free memory."""
    verify_admin_key(request, x_admin_key)
    engine = get_engine(request)

    try:
        freed = await engine.unload_model(body.model_id)
    except KeyError:
        return model_not_found(body.model_id)

    return AdminUnloadResponse(
        success=True,
        model_id=body.model_id,
        memory_freed_gb=round(freed, 2),
    )


@router.get("/admin/status", responses={403: {"model": ErrorResponse}})
async def get_status(request: Request, x_admin_key: str | None = Header(None)) -> AdminStatusResponse:
    """Full system status: version, uptime, models, memory."""
    verify_admin_key(request, x_admin_key)
    engine = get_engine(request)
    memory = get_memory(request)
    start_time = get_start_time(request)

    models = engine.get_loaded_models()
    return AdminStatusResponse(
        version=__version__,
        uptime_seconds=round(time.time() - start_time, 1),
        loaded_models=len(models),
        models=[m.model_id for m in models],
        memory=memory.get_status(),
    )


@router.get("/admin/memory", responses={403: {"model": ErrorResponse}})
async def memory_status(request: Request, x_admin_key: str | None = Header(None)) -> AdminMemoryResponse:
    """Detailed memory breakdown including per-model usage."""
    verify_admin_key(request, x_admin_key)
    engine = get_engine(request)
    memory = get_memory(request)

    models = engine.get_loaded_models()
    model_details = {
        m.model_id: {
            "memory_gb": m.memory_used_gb,
            "loaded": m.loaded,
        }
        for m in models
    }

    return AdminMemoryResponse(
        total_unified_memory_gb=memory.total_memory_gb(),
        used_gb=memory.used_memory_gb(),
        available_gb=memory.available_memory_gb(),
        threshold_percent=memory.threshold_percent,
        models=model_details,
    )


@router.get("/admin/models/available", responses={403: {"model": ErrorResponse}})
async def list_available_models(
    request: Request, x_admin_key: str | None = Header(None),
) -> list[AvailableModel]:
    """List all models available on disk (downloaded but not necessarily loaded)."""
    verify_admin_key(request, x_admin_key)
    manager = get_model_manager(request)

    models = await manager.list_available()
    return [
        AvailableModel(
            repo_id=m["repo_id"],
            local_path=m["local_path"],
            size_bytes=m["size_bytes"],
            downloaded_at=m["downloaded_at"],
        )
        for m in models
    ]


# ─── Phase 3: Download / Delete Endpoints ────────────────────────────────────


@router.post(
    "/admin/models/download",
    response_model=None,
    responses={403: {"model": ErrorResponse}},
)
async def start_download(
    body: AdminDownloadRequest,
    request: Request,
    x_admin_key: str | None = Header(None),
):
    """Start an async model download from HuggingFace Hub."""
    verify_admin_key(request, x_admin_key)
    manager = get_model_manager(request)

    try:
        task = await manager.start_download(
            repo_id=body.repo_id,
            revision=body.revision,
            allow_patterns=body.allow_patterns,
            ignore_patterns=body.ignore_patterns,
        )
    except Exception as e:
        return internal_error(f"Failed to start download: {e}")

    return AdminDownloadResponse(
        download_id=task.download_id,
        repo_id=task.repo_id,
        estimated_size_bytes=task.total_bytes if task.total_bytes > 0 else None,
        status=task.status,
    )


@router.get(
    "/admin/models/download/{download_id}/progress",
    response_model=None,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def get_download_progress(
    download_id: str,
    request: Request,
    x_admin_key: str | None = Header(None),
):
    """Get the progress of a model download."""
    verify_admin_key(request, x_admin_key)
    manager = get_model_manager(request)

    task = manager.get_download_progress(download_id)
    if task is None:
        return download_not_found(download_id)

    return DownloadProgressResponse(
        download_id=task.download_id,
        repo_id=task.repo_id,
        status=task.status,
        progress_percent=task.progress_percent,
        downloaded_bytes=task.downloaded_bytes,
        total_bytes=task.total_bytes,
        files_completed=task.files_completed,
        files_total=task.files_total,
        error=task.error,
    )


@router.delete(
    "/admin/models/{model_id:path}",
    response_model=None,
    responses={
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
    },
)
async def delete_model(
    model_id: str,
    request: Request,
    x_admin_key: str | None = Header(None),
):
    """Delete a model from disk. Returns 409 if the model is currently loaded."""
    verify_admin_key(request, x_admin_key)

    # Path traversal validation
    if ".." in model_id or model_id.startswith("/"):
        return openai_error(400, "Invalid model_id format", "invalid_request_error", "model_id")

    engine = get_engine(request)
    manager = get_model_manager(request)

    # Safety check: don't delete a loaded model
    if engine.is_model_loaded(model_id):
        return model_in_use(model_id)

    try:
        freed_bytes = await manager.delete_model(model_id)
    except KeyError:
        return model_not_found(model_id)
    except RuntimeError as e:
        return internal_error(str(e))

    return AdminDeleteResponse(
        success=True,
        model_id=model_id,
        freed_bytes=freed_bytes,
    )


# ─── Phase 4: Metrics & Monitoring ──────────────────────────────────────────


@router.get(
    "/admin/metrics",
    response_class=PlainTextResponse,
    responses={403: {"model": ErrorResponse}},
)
async def prometheus_metrics(
    request: Request, x_admin_key: str | None = Header(None),
) -> PlainTextResponse:
    """Prometheus-compatible metrics endpoint.

    Returns metrics in Prometheus text exposition format for scraping.
    """
    verify_admin_key(request, x_admin_key)
    metrics = get_metrics(request)
    return PlainTextResponse(
        content=metrics.prometheus(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@router.get("/admin/metrics/json", responses={403: {"model": ErrorResponse}})
async def metrics_json(
    request: Request, x_admin_key: str | None = Header(None),
) -> dict:
    """JSON metrics summary for admin dashboards."""
    verify_admin_key(request, x_admin_key)
    metrics = get_metrics(request)
    return metrics.summary()


# ─── Phase 4: Config Reload ─────────────────────────────────────────────────


@router.post(
    "/admin/config/reload",
    response_model=None,
    responses={403: {"model": ErrorResponse}},
)
async def reload_config(
    request: Request, x_admin_key: str | None = Header(None),
) -> dict:
    """Hot-reload configuration from disk without restarting.

    Re-reads the YAML config file and updates runtime state:
    - Routing aliases and default model
    - Memory thresholds
    - Logging level
    - Admin key

    Does NOT unload/reload models or change server bind address.
    """
    verify_admin_key(request, x_admin_key)

    try:
        new_config = load_config()
    except Exception as e:
        logger.error("config_reload_failed", extra={"error": str(e)})
        return internal_error(f"Failed to parse config: {e}")

    # Update routing
    task_router = get_router(request)
    task_router.update_config(new_config.routing)

    # Update memory threshold
    memory = get_memory(request)
    memory.threshold_percent = new_config.memory.max_memory_percent

    # Update admin key
    request.app.state.admin_key = new_config.security.admin_key

    # Update logging level
    import logging as _logging

    root = _logging.getLogger()
    root.setLevel(getattr(_logging, new_config.logging.level.upper(), _logging.INFO))

    # Store updated config
    request.app.state.config = new_config

    logger.info("config_reloaded", extra={
        "routing_aliases": len(new_config.routing.aliases),
        "memory_threshold": new_config.memory.max_memory_percent,
        "log_level": new_config.logging.level,
    })

    # Publish config_reloaded event
    from opta_lmx.monitoring.events import ServerEvent
    event_bus = get_event_bus(request)
    await event_bus.publish(ServerEvent(
        event_type="config_reloaded",
        data={
            "routing_aliases": len(new_config.routing.aliases),
            "memory_threshold": new_config.memory.max_memory_percent,
            "log_level": new_config.logging.level,
        },
    ))

    # Reload presets
    preset_mgr = get_preset_manager(request)
    if new_config.presets.enabled:
        preset_mgr.reload()

    return {
        "success": True,
        "updated": ["routing", "memory", "security", "logging", "presets"],
    }


# ─── Phase 6: Presets ─────────────────────────────────────────────────────


@router.get("/admin/presets", responses={403: {"model": ErrorResponse}})
async def list_presets(
    request: Request, x_admin_key: str | None = Header(None),
) -> PresetListResponse:
    """List all loaded presets."""
    verify_admin_key(request, x_admin_key)
    preset_mgr = get_preset_manager(request)

    presets = preset_mgr.list_all()
    return PresetListResponse(
        presets=[
            PresetResponse(
                name=p.name,
                description=p.description,
                model=p.model,
                parameters=p.parameters,
                system_prompt=p.system_prompt,
                routing_alias=p.routing_alias,
                auto_load=p.auto_load,
            )
            for p in presets
        ],
        count=len(presets),
    )


@router.get(
    "/admin/presets/{name}",
    response_model=None,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def get_preset(
    name: str, request: Request, x_admin_key: str | None = Header(None),
):
    """Get full details for a single preset."""
    verify_admin_key(request, x_admin_key)
    preset_mgr = get_preset_manager(request)

    preset = preset_mgr.get(name)
    if preset is None:
        return model_not_found(f"preset:{name}")

    return PresetResponse(
        name=preset.name,
        description=preset.description,
        model=preset.model,
        parameters=preset.parameters,
        system_prompt=preset.system_prompt,
        routing_alias=preset.routing_alias,
        auto_load=preset.auto_load,
    )


@router.post(
    "/admin/presets/reload",
    responses={403: {"model": ErrorResponse}},
)
async def reload_presets(
    request: Request, x_admin_key: str | None = Header(None),
) -> dict:
    """Re-read preset files from disk."""
    verify_admin_key(request, x_admin_key)
    preset_mgr = get_preset_manager(request)

    count = preset_mgr.reload()
    return {"success": True, "presets_loaded": count}


# ─── Phase 6: SSE Events Feed ──────────────────────────────────────────────


@router.get("/admin/events", responses={403: {"model": ErrorResponse}})
async def admin_event_stream(
    request: Request, x_admin_key: str | None = Header(None),
):
    """Server-Sent Events feed for real-time admin monitoring.

    Streams events for: model_loaded, model_unloaded, download_progress,
    download_completed, download_failed, request_completed, memory_warning,
    config_reloaded. Sends heartbeat every 30 seconds.
    """
    verify_admin_key(request, x_admin_key)
    event_bus = get_event_bus(request)
    heartbeat_sec = getattr(request.app.state.config.server, "sse_heartbeat_interval_sec", 30)

    async def generate():
        queue = event_bus.subscribe()
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=heartbeat_sec)
                    yield (
                        f"event: {event.event_type}\n"
                        f"data: {json.dumps(event.data)}\n\n"
                    )
                except asyncio.TimeoutError:
                    yield f"event: heartbeat\ndata: {json.dumps({'timestamp': time.time()})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            event_bus.unsubscribe(queue)

    return StreamingResponse(generate(), media_type="text/event-stream")
