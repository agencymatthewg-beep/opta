"""Admin API routes — /admin/* endpoints for model management."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import secrets
import time
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from opta_lmx.inference.engine import InferenceEngine
    from opta_lmx.manager.model import ModelManager
    from opta_lmx.monitoring.journal import RuntimeJournalManager

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from starlette.responses import Response

from opta_lmx import __version__
from opta_lmx.api.deps import (
    AdminAuth,
    Engine,
    Events,
    Manager,
    Memory,
    Metrics,
    Presets,
    RemoteEmbedding,
    RemoteReranking,
    Router,
    StartTime,
)
from opta_lmx.api.errors import (
    download_not_found,
    insufficient_disk,
    insufficient_memory,
    internal_error,
    model_in_use,
    model_not_found,
    openai_error,
)
from opta_lmx.config import load_config
from opta_lmx.inference.engine import ModelRuntimeCompatibilityError
from opta_lmx.inference.schema import (
    AdminDeleteResponse,
    AdminDownloadRequest,
    AdminDownloadResponse,
    AdminLoadRequest,
    AdminLoadResponse,
    AdminMemoryResponse,
    AdminModelDetail,
    AdminModelPerformanceResponse,
    AdminModelsResponse,
    AdminProbeRequest,
    AdminProbeResponse,
    AdminStatusResponse,
    AdminUnloadRequest,
    AdminUnloadResponse,
    AutoDownloadResponse,
    AvailableModel,
    BenchmarkRequest,
    BenchmarkResponse,
    BenchmarkResult,
    ChatMessage,
    ConfirmLoadRequest,
    DownloadProgressResponse,
    ErrorResponse,
    PresetListResponse,
    PresetResponse,
    QuantizeRequest,
    SpeculativeBenchmarkStats,
)
from opta_lmx.model_safety import AdmissionFailure, ErrorCodes, validate_architecture
from opta_lmx.monitoring.metrics import speculative_metric_kwargs
from opta_lmx.security.jwt_verifier import SupabaseJWTVerifier

logger = logging.getLogger(__name__)


# Token expiry for pending download confirmations (seconds)
_TOKEN_EXPIRY_SEC = 600  # 10 minutes

# Lock for pending_downloads dict (single-threaded async concurrency)
_pending_lock = asyncio.Lock()

# Strong references to background tasks (prevents GC before completion)
_background_tasks: set[asyncio.Task[None]] = set()


def _human_size(size_bytes: int) -> str:
    """Convert bytes to human-readable string (e.g. '37.5 GB')."""
    if size_bytes <= 0:
        return "unknown"
    value = float(size_bytes)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(value) < 1024:
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} PB"


def _get_journal_manager(request: Request) -> RuntimeJournalManager | None:
    """Return runtime journal manager if available."""
    manager = getattr(request.app.state, "journal_manager", None)
    if manager is None or not hasattr(manager, "write_update_log"):
        return None
    return manager


def _write_update_journal_with_manager(
    journal_manager: RuntimeJournalManager | None,
    *,
    title: str,
    summary: str,
    category: str,
    promoted: bool | None = None,
    command_inputs: dict[str, Any] | None = None,
    steps: list[dict[str, Any]] | None = None,
) -> None:
    """Write numbered update log and fail-open on journaling errors."""
    if journal_manager is None:
        return
    try:
        journal_manager.write_update_log(
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
    _write_update_journal_with_manager(
        _get_journal_manager(request),
        title=title,
        summary=summary,
        category=category,
        promoted=promoted,
        command_inputs=command_inputs,
        steps=steps,
    )


async def _load_after_download(
    download_id: str,
    model_id: str,
    manager: ModelManager,
    engine: InferenceEngine,
    performance_overrides: dict[str, Any] | None = None,
    keep_alive_sec: int | None = None,
    journal_manager: RuntimeJournalManager | None = None,
) -> None:
    """Wait for a download to complete, then auto-load the model."""
    while True:
        task = manager.get_download_progress(download_id)
        if task is None or task.status in ("completed", "failed"):
            break
        await asyncio.sleep(2)

    if task and task.status == "completed":
        # Pre-load readiness guard: ensure local cache is still complete before load.
        is_ready = await manager.is_local_snapshot_complete(model_id)
        if not is_ready:
            logger.warning(
                "auto_load_skipped_snapshot_incomplete",
                extra={"model_id": model_id, "download_id": download_id},
            )
            return

        try:
            await engine.load_model(
                model_id,
                performance_overrides=performance_overrides,
                keep_alive_sec=keep_alive_sec,
            )
            logger.info("auto_load_after_download", extra={"model_id": model_id})
            _write_update_journal_with_manager(
                journal_manager,
                title=f"Load {model_id}",
                summary=f"Auto-loaded {model_id} after download completion.",
                category="sync",
                promoted=True,
                command_inputs={
                    "model_id": model_id,
                    "download_id": download_id,
                    "auto_download": True,
                    "keep_alive_sec": keep_alive_sec,
                    "performance_overrides": performance_overrides or {},
                },
                steps=[
                    {
                        "target": "lmx",
                        "component": "model",
                        "step": "auto-load-after-download",
                        "status": "ok",
                        "message": "download completed and model loaded",
                    }
                ],
            )
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
async def list_admin_models(
    _auth: AdminAuth, engine: Engine,
) -> AdminModelsResponse:
    """List all loaded models with detailed statistics."""
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
                context_length=m.context_length,
                performance=m.performance_overrides,
                speculative={
                    "requested": m.speculative_requested,
                    "active": m.speculative_active,
                    "reason": m.speculative_reason,
                    "draft_model": m.speculative_draft_model,
                    "num_tokens": m.speculative_num_tokens,
                    "telemetry": "unavailable",
                },
                readiness={
                    "state": getattr(m, "readiness_state", "routable"),
                    "reason": getattr(m, "readiness_reason", None),
                    "crash_count": getattr(m, "crash_count", 0),
                },
            )
            for m in loaded
        ],
        count=len(loaded),
    )


@router.get(
    "/admin/models/{model_id:path}/performance",
    response_model=None,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def get_model_performance(
    model_id: str, _auth: AdminAuth, engine: Engine,
) -> AdminModelPerformanceResponse | JSONResponse:
    """Get active performance configuration for a loaded model."""
    if not engine.is_model_loaded(model_id):
        return model_not_found(model_id)

    loaded = engine.get_model(model_id)
    return AdminModelPerformanceResponse(
        model_id=loaded.model_id,
        backend_type=loaded.backend_type,
        loaded_at=loaded.loaded_at,
        request_count=loaded.request_count,
        last_used_at=loaded.last_used_at,
        memory_gb=loaded.estimated_memory_gb,
        context_length=loaded.context_length,
        use_batching=loaded.use_batching,
        performance=loaded.performance_overrides,
        speculative={
            "requested": loaded.speculative_requested,
            "active": loaded.speculative_active,
            "reason": loaded.speculative_reason,
            "draft_model": loaded.speculative_draft_model,
            "num_tokens": loaded.speculative_num_tokens,
            "telemetry": "unavailable",
        },
        readiness={
            "state": getattr(loaded, "readiness_state", "routable"),
            "reason": getattr(loaded, "readiness_reason", None),
            "crash_count": getattr(loaded, "crash_count", 0),
        },
        global_defaults={
            **engine.get_inference_defaults(),
            "max_concurrent_requests": engine.max_concurrent_requests,
        },
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
async def load_model(
    body: AdminLoadRequest, _auth: AdminAuth, engine: Engine, manager: Manager,
    preset_mgr: Presets, request: Request,
) -> AdminLoadResponse | JSONResponse:
    """Load a model into memory.

    If the model is not on disk:
    - Returns 202 with a confirmation token (user must confirm download)
    - If auto_download=True, skips confirmation and starts download immediately
    """
    # Check if model is already loaded
    if engine.is_model_loaded(body.model_id):
        return AdminLoadResponse(success=True, model_id=body.model_id)

    # Admission gate: architecture/backend compatibility.
    try:
        validate_architecture(body.model_id)
    except AdmissionFailure as e:
        return openai_error(
            status_code=e.status_code,
            message=e.message,
            error_type=e.error_type,
            param=e.param,
            code=e.code,
        )

    # Refuse automatic routing reload for quarantined models unless caller
    # explicitly accepts unsupported runtime risk.
    if hasattr(engine, "model_readiness"):
        readiness = engine.model_readiness(body.model_id)
        if readiness.get("state") == "quarantined" and not body.allow_unsupported_runtime:
            return openai_error(
                status_code=409,
                message=(
                    f"Model '{body.model_id}' is quarantined after instability. "
                    "Use a supported variant or pass allow_unsupported_runtime=true to override."
                ),
                error_type="invalid_request_error",
                param="model_id",
                code=ErrorCodes.MODEL_UNSTABLE,
            )

    # max_context_length is reserved for future backend-native support.
    if body.max_context_length is not None:
        return openai_error(
            status_code=400,
            message="The 'max_context_length' parameter is not currently supported.",
            error_type="invalid_request_error",
            param="max_context_length",
            code="not_supported",
        )

    # Check if model is on disk
    is_available = await manager.is_model_available(body.model_id)
    snapshot_incomplete = False
    if is_available:
        # A repo can appear in cache scans while still missing required blobs.
        # Guard this before engine load to avoid opaque 500 errors and crash loops.
        is_complete = await manager.is_local_snapshot_complete(body.model_id)
        if not is_complete:
            snapshot_incomplete = True
            is_available = False
            logger.warning(
                "model_snapshot_incomplete",
                extra={"model_id": body.model_id},
            )

    if not is_available:
        # Estimate download size only for truly missing models.
        # Snapshot-repair flows can avoid this remote metadata call.
        estimated = 0
        if not snapshot_incomplete:
            estimated = await manager.estimate_size(body.model_id, None, None, None)

        if not body.auto_download:
            # Two-phase: return confirmation prompt
            token = f"dl-{secrets.token_urlsafe(16)}"
            async with _pending_lock:
                pending: dict[str, Any] = getattr(request.app.state, "pending_downloads", {})

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
                    message=(
                        "Model cache is incomplete. Confirm download to repair local files?"
                        if snapshot_incomplete
                        else "Model not found locally. Confirm download?"
                    ),
                    confirm_url="/admin/models/load/confirm",
                ).model_dump(),
            )

        # auto_download=True: skip confirmation, start download + auto-load
        perf = preset_mgr.find_performance_for_model(body.model_id) or {}
        if body.performance_overrides:
            perf = {**perf, **body.performance_overrides}
        try:
            task = await manager.start_download(repo_id=body.model_id)
        except OSError as e:
            return insufficient_disk(str(e))
        except Exception as e:
            return internal_error(f"Failed to start download: {e}")
        bg = asyncio.create_task(
            _load_after_download(
                task.download_id,
                body.model_id,
                manager,
                engine,
                perf or None,
                keep_alive_sec=body.keep_alive_sec,
                journal_manager=_get_journal_manager(request),
            ),
        )
        _background_tasks.add(bg)
        bg.add_done_callback(_background_tasks.discard)

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

    # Model is on disk — load immediately (with preset performance if available)
    perf = preset_mgr.find_performance_for_model(body.model_id) or {}
    if body.performance_overrides:
        perf = {**perf, **body.performance_overrides}
    start = time.monotonic()
    previous_hf_offline = os.environ.get("HF_HUB_OFFLINE")
    # Force local-only artifact resolution for "already on disk" loads so
    # engine startup does not silently re-enter network/download flows.
    os.environ["HF_HUB_OFFLINE"] = "1"
    try:
        info = await engine.load_model(
            body.model_id,
            performance_overrides=perf or None,
            keep_alive_sec=body.keep_alive_sec,
            allow_unsupported_runtime=body.allow_unsupported_runtime,
        )
    except ModelRuntimeCompatibilityError as e:
        return openai_error(
            status_code=422,
            message=str(e),
            error_type="not_supported_error",
            param="model_id",
            code=ErrorCodes.MODEL_UNSUPPORTED_BACKEND,
        )
    except MemoryError as e:
        return insufficient_memory(str(e))
    except OSError as e:
        return insufficient_disk(str(e))
    except RuntimeError as e:
        msg = str(e)
        if msg.startswith(f"{ErrorCodes.MODEL_LOAD_TIMEOUT}:"):
            return openai_error(
                status_code=409,
                message=msg,
                error_type="invalid_request_error",
                param="model_id",
                code=ErrorCodes.MODEL_LOAD_TIMEOUT,
            )
        if msg.startswith(f"{ErrorCodes.MODEL_LOADER_CRASHED}:"):
            return openai_error(
                status_code=409,
                message=msg,
                error_type="invalid_request_error",
                param="model_id",
                code=ErrorCodes.MODEL_LOADER_CRASHED,
            )
        if msg.startswith(f"{ErrorCodes.MODEL_PROBE_FAILED}:"):
            return openai_error(
                status_code=409,
                message=msg,
                error_type="invalid_request_error",
                param="model_id",
                code=ErrorCodes.MODEL_PROBE_FAILED,
            )
        if "failed canary" in msg.lower() or "quarantined" in msg.lower():
            return openai_error(
                status_code=409,
                message=msg,
                error_type="invalid_request_error",
                param="model_id",
                code=ErrorCodes.MODEL_CANARY_FAILED,
            )
        return internal_error(str(e))
    finally:
        if previous_hf_offline is None:
            os.environ.pop("HF_HUB_OFFLINE", None)
        else:
            os.environ["HF_HUB_OFFLINE"] = previous_hf_offline

    elapsed_ms = (time.monotonic() - start) * 1000
    _write_update_journal(
        request,
        title=f"Load {body.model_id}",
        summary=f"Loaded {body.model_id} into memory from local artifacts.",
        category="sync",
        promoted=True,
        command_inputs={
            "model_id": body.model_id,
            "auto_download": body.auto_download,
            "keep_alive_sec": body.keep_alive_sec,
            "allow_unsupported_runtime": body.allow_unsupported_runtime,
            "performance_overrides": body.performance_overrides or {},
            "source": "disk",
        },
        steps=[
            {
                "target": "lmx",
                "component": "model",
                "step": "load",
                "status": "ok",
                "message": (
                    f"memory_after_load_gb={round(info.memory_used_gb, 2)} "
                    f"time_to_load_ms={round(elapsed_ms, 1)}"
                ),
            }
        ],
    )

    return AdminLoadResponse(
        success=True,
        model_id=body.model_id,
        memory_after_load_gb=info.memory_used_gb,
        time_to_load_ms=round(elapsed_ms, 1),
    )


@router.post(
    "/admin/models/probe",
    response_model=AdminProbeResponse,
    responses={403: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
async def probe_model(
    body: AdminProbeRequest,
    _auth: AdminAuth,
    engine: Engine,
) -> AdminProbeResponse:
    """Probe candidate backends for a model without fully loading it."""
    try:
        result = await engine.probe_model_backends(
            body.model_id,
            timeout_sec=body.timeout_sec,
            allow_unsupported_runtime=body.allow_unsupported_runtime,
        )
    except AdmissionFailure as exc:
        return openai_error(
            status_code=exc.status_code,
            message=exc.message,
            error_type=exc.error_type,
            param=exc.param,
            code=exc.code,
        )
    except Exception as exc:
        return internal_error(str(exc))

    return AdminProbeResponse.model_validate(result)


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
    body: ConfirmLoadRequest, _auth: AdminAuth, engine: Engine, manager: Manager,
    preset_mgr: Presets, request: Request,
) -> JSONResponse:
    """Confirm a pending download and start download + auto-load.

    Uses the confirmation_token returned by the load endpoint when
    a model was not found locally.
    """
    async with _pending_lock:
        pending: dict[str, Any] = getattr(request.app.state, "pending_downloads", {})
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

    model_id = entry["model_id"]

    perf = preset_mgr.find_performance_for_model(model_id)
    try:
        task = await manager.start_download(repo_id=model_id)
    except OSError as e:
        return insufficient_disk(str(e))
    except Exception as e:
        return internal_error(f"Failed to start download: {e}")
    bg = asyncio.create_task(
        _load_after_download(
            task.download_id,
            model_id,
            manager,
            engine,
            perf,
            journal_manager=_get_journal_manager(request),
        ),
    )
    _background_tasks.add(bg)
    bg.add_done_callback(_background_tasks.discard)

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
async def unload_model(
    body: AdminUnloadRequest, _auth: AdminAuth, engine: Engine, request: Request,
) -> AdminUnloadResponse | JSONResponse:
    """Unload a model and free memory."""
    try:
        freed = await engine.unload_model(body.model_id)
    except KeyError:
        return model_not_found(body.model_id)

    _write_update_journal(
        request,
        title=f"Unload {body.model_id}",
        summary=f"Unloaded {body.model_id} from memory.",
        category="sync",
        promoted=False,
        command_inputs={
            "model_id": body.model_id,
        },
        steps=[
            {
                "target": "lmx",
                "component": "model",
                "step": "unload",
                "status": "ok",
                "message": f"memory_freed_gb={round(freed, 2)}",
            }
        ],
    )

    return AdminUnloadResponse(
        success=True,
        model_id=body.model_id,
        memory_freed_gb=round(freed, 2),
    )


@router.get("/admin/status", responses={403: {"model": ErrorResponse}})
async def get_status(
    _auth: AdminAuth, engine: Engine, memory: Memory, start_time: StartTime,
    request: Request,
) -> AdminStatusResponse:
    """Full system status: version, uptime, models, memory."""
    models = engine.get_loaded_models()
    config = request.app.state.config
    return AdminStatusResponse(
        version=__version__,
        uptime_seconds=round(time.time() - start_time, 1),
        loaded_models=len(models),
        models=[m.model_id for m in models],
        memory=memory.get_status(),
        in_flight_requests=engine.in_flight_count,
        max_concurrent_requests=config.models.max_concurrent_requests,
    )


@router.get("/admin/memory", responses={403: {"model": ErrorResponse}})
async def memory_status(
    _auth: AdminAuth, engine: Engine, memory: Memory,
) -> AdminMemoryResponse:
    """Detailed memory breakdown including per-model usage."""
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
    _auth: AdminAuth, manager: Manager,
) -> list[AvailableModel]:
    """List all models available on disk (downloaded but not necessarily loaded)."""
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
    body: AdminDownloadRequest, _auth: AdminAuth, manager: Manager,
) -> AdminDownloadResponse | JSONResponse:
    """Start an async model download from HuggingFace Hub."""
    try:
        task = await manager.start_download(
            repo_id=body.repo_id,
            revision=body.revision,
            allow_patterns=body.allow_patterns,
            ignore_patterns=body.ignore_patterns,
        )
    except OSError as e:
        return insufficient_disk(str(e))
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
    download_id: str, _auth: AdminAuth, manager: Manager,
) -> DownloadProgressResponse | JSONResponse:
    """Get the progress of a model download."""
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
        error_code=task.error_code,
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
    model_id: str, _auth: AdminAuth, engine: Engine, manager: Manager,
) -> AdminDeleteResponse | JSONResponse:
    """Delete a model from disk. Returns 409 if the model is currently loaded."""
    # Path traversal validation
    if ".." in model_id or model_id.startswith("/"):
        return openai_error(400, "Invalid model_id format", "invalid_request_error", "model_id")

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
    _auth: AdminAuth, metrics: Metrics, engine: Engine, memory: Memory,
) -> PlainTextResponse:
    """Prometheus-compatible metrics endpoint.

    Returns metrics in Prometheus text exposition format for scraping.
    Includes live gauges for loaded model count, memory, and concurrency.
    """
    queued = engine.waiting_queue_count
    return PlainTextResponse(
        content=metrics.prometheus(
            loaded_model_count=len(engine.get_loaded_model_ids()),
            memory_used_gb=memory.used_memory_gb(),
            memory_total_gb=memory.total_memory_gb(),
            in_flight_requests=engine.in_flight_count,
            max_concurrent_requests=engine.max_concurrent_requests,
            queued_requests=queued,
        ),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@router.get("/admin/metrics/json", responses={403: {"model": ErrorResponse}})
async def metrics_json(
    _auth: AdminAuth, metrics: Metrics,
) -> dict[str, Any]:
    """JSON metrics summary for admin dashboards."""
    return metrics.summary()


# ─── Phase 4: Config Reload ─────────────────────────────────────────────────


@router.post(
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
    try:
        new_config = load_config()
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

    logger.info("config_reloaded", extra={
        "routing_aliases": len(new_config.routing.aliases),
        "memory_threshold": new_config.memory.max_memory_percent,
        "log_level": new_config.logging.level,
    })

    # Publish config_reloaded event
    from opta_lmx.monitoring.events import ServerEvent
    await event_bus.publish(ServerEvent(
        event_type="config_reloaded",
        data={
            "routing_aliases": len(new_config.routing.aliases),
            "memory_threshold": new_config.memory.max_memory_percent,
            "log_level": new_config.logging.level,
        },
    ))

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

    return JSONResponse(content={
        "success": True,
        "updated": ["routing", "memory", "security", "logging", "presets"],
    })


# ─── Benchmark ────────────────────────────────────────────────────────────


@router.post(
    "/admin/benchmark",
    response_model=None,
    responses={
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
async def benchmark_model(
    body: BenchmarkRequest, _auth: AdminAuth, engine: Engine, metrics: Metrics,
) -> BenchmarkResponse | JSONResponse:
    """Run an inference benchmark on a loaded model.

    Measures time-to-first-token, total generation time, and tokens/second.
    Runs the benchmark `runs` times and returns individual + averaged results.
    """
    if not engine.is_model_loaded(body.model_id):
        return model_not_found(body.model_id)

    loaded = engine.get_model(body.model_id)
    results: list[BenchmarkResult] = []

    for run_idx in range(body.runs):
        messages = [ChatMessage(role="user", content=body.prompt)]

        # Stream to measure TTFT and per-token timing
        token_count = 0
        ttft_ms: float | None = None
        start = time.monotonic()

        try:
            async for _token in engine.stream_generate(
                model_id=body.model_id,
                messages=messages,
                temperature=body.temperature,
                max_tokens=body.max_tokens,
            ):
                token_count += 1
                if ttft_ms is None:
                    ttft_ms = (time.monotonic() - start) * 1000
        except Exception as e:
            logger.error("benchmark_failed", extra={
                "model_id": body.model_id, "run": run_idx + 1, "error": str(e),
            })
            return internal_error(f"Benchmark failed on run {run_idx + 1}: {e}")

        total_ms = (time.monotonic() - start) * 1000

        if token_count == 0:
            return internal_error(
                f"Model generated 0 tokens on run {run_idx + 1} — "
                "check model health or increase max_tokens"
            )

        generation_time_sec = max(total_ms / 1000, 0.001)
        tok_per_sec = token_count / generation_time_sec
        telemetry = engine.pop_speculative_telemetry() or {
            "requested": loaded.speculative_requested,
            "active": loaded.speculative_active,
            "reason": loaded.speculative_reason,
            "draft_model": loaded.speculative_draft_model,
            "num_tokens": loaded.speculative_num_tokens,
            "accepted_tokens": 0,
            "rejected_tokens": 0,
            "ignored_tokens": token_count if loaded.speculative_active else 0,
            "acceptance_ratio": None,
            "telemetry": "unavailable" if loaded.speculative_active else "not_requested",
        }
        metric_kwargs = speculative_metric_kwargs(telemetry)
        if loaded.speculative_active:
            metrics.record_speculative(
                accepted_tokens=int(metric_kwargs.get("speculative_accepted_tokens", 0)),
                rejected_tokens=int(metric_kwargs.get("speculative_rejected_tokens", 0)),
                ignored_tokens=int(metric_kwargs.get("speculative_ignored_tokens", 0)),
            )

        results.append(BenchmarkResult(
            run=run_idx + 1,
            tokens_generated=token_count,
            time_to_first_token_ms=round(ttft_ms or 0, 2),
            total_time_ms=round(total_ms, 2),
            tokens_per_second=round(tok_per_sec, 2),
            speculative=SpeculativeBenchmarkStats(
                requested=bool(metric_kwargs.get("speculative_requested", False)),
                active=bool(metric_kwargs.get("speculative_active", False)),
                reason=metric_kwargs.get("speculative_reason"),
                draft_model=metric_kwargs.get("speculative_draft_model"),
                num_tokens=metric_kwargs.get("speculative_num_tokens"),
                accepted_tokens=int(metric_kwargs.get("speculative_accepted_tokens", 0)),
                rejected_tokens=int(metric_kwargs.get("speculative_rejected_tokens", 0)),
                ignored_tokens=int(metric_kwargs.get("speculative_ignored_tokens", 0)),
                acceptance_ratio=telemetry.get("acceptance_ratio"),
                telemetry=str(metric_kwargs.get("speculative_telemetry", "unavailable")),
            ),
        ))

    # Compute averages
    avg_tps = sum(r.tokens_per_second for r in results) / len(results)
    avg_ttft = sum(r.time_to_first_token_ms for r in results) / len(results)
    avg_total = sum(r.total_time_ms for r in results) / len(results)

    accepted_total = sum((r.speculative.accepted_tokens if r.speculative else 0) for r in results)
    rejected_total = sum((r.speculative.rejected_tokens if r.speculative else 0) for r in results)
    ignored_total = sum((r.speculative.ignored_tokens if r.speculative else 0) for r in results)
    acceptance_ratio: float | None = None
    denominator = accepted_total + rejected_total
    if denominator > 0:
        acceptance_ratio = round(accepted_total / denominator, 6)

    logger.info("benchmark_complete", extra={
        "model_id": body.model_id,
        "runs": body.runs,
        "avg_tok_per_sec": round(avg_tps, 2),
        "avg_ttft_ms": round(avg_ttft, 2),
    })

    return BenchmarkResponse(
        model_id=body.model_id,
        backend_type=loaded.backend_type,
        prompt=body.prompt,
        max_tokens=body.max_tokens,
        runs=body.runs,
        results=results,
        avg_tokens_per_second=round(avg_tps, 2),
        avg_time_to_first_token_ms=round(avg_ttft, 2),
        avg_total_time_ms=round(avg_total, 2),
        speculative=SpeculativeBenchmarkStats(
            requested=loaded.speculative_requested,
            active=loaded.speculative_active,
            reason=loaded.speculative_reason,
            draft_model=loaded.speculative_draft_model,
            num_tokens=loaded.speculative_num_tokens,
            accepted_tokens=accepted_total,
            rejected_tokens=rejected_total,
            ignored_tokens=ignored_total,
            acceptance_ratio=acceptance_ratio,
            telemetry="unavailable",
        ),
    )


# ─── Phase 6: Presets ─────────────────────────────────────────────────────


@router.get("/admin/presets", responses={403: {"model": ErrorResponse}})
async def list_presets(
    _auth: AdminAuth, preset_mgr: Presets,
) -> PresetListResponse:
    """List all loaded presets."""
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
                performance=p.performance,
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
    name: str, _auth: AdminAuth, preset_mgr: Presets,
) -> PresetResponse | JSONResponse:
    """Get full details for a single preset."""
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
        performance=preset.performance,
    )


@router.post(
    "/admin/presets/reload",
    responses={403: {"model": ErrorResponse}},
)
async def reload_presets(
    _auth: AdminAuth, preset_mgr: Presets,
) -> dict[str, Any]:
    """Re-read preset files from disk."""
    count = preset_mgr.reload()
    return {"success": True, "presets_loaded": count}


# ─── Phase 6: SSE Events Feed ──────────────────────────────────────────────


@router.get("/admin/events", responses={403: {"model": ErrorResponse}})
async def admin_event_stream(
    _auth: AdminAuth, event_bus: Events, request: Request,
) -> StreamingResponse:
    """Server-Sent Events feed for real-time admin monitoring.

    Streams events for: model_loaded, model_unloaded, download_progress,
    download_completed, download_failed, request_completed, memory_warning,
    config_reloaded. Sends heartbeat every 30 seconds.
    """
    heartbeat_sec = getattr(request.app.state.config.server, "sse_heartbeat_interval_sec", 30)

    async def generate() -> AsyncIterator[str]:
        queue = event_bus.subscribe()
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=heartbeat_sec)
                    yield (
                        f"event: {event.event_type}\n"
                        f"data: {json.dumps(event.data)}\n\n"
                    )
                except TimeoutError:
                    yield f"event: heartbeat\ndata: {json.dumps({'timestamp': time.time()})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            event_bus.unsubscribe(queue)

    return StreamingResponse(generate(), media_type="text/event-stream")


# ─── Model Stack Status ──────────────────────────────────────────────────


@router.get("/admin/stack", responses={403: {"model": ErrorResponse}})
async def stack_status(
    _auth: AdminAuth,
    engine: Engine,
    task_router: Router,
    remote_embedding: RemoteEmbedding,
    remote_reranking: RemoteReranking,
    request: Request,
) -> dict[str, Any]:
    """Model Stack overview — roles, loaded models, and helper nodes.

    Returns the current state of each configured stack role:
    which alias maps to which models, which are loaded, and
    the health of helper node endpoints.
    """
    config = request.app.state.config
    loaded_ids = set(engine.get_loaded_model_ids())

    # Build role status from routing aliases
    roles: dict[str, dict[str, Any]] = {}
    load_snapshot = engine.get_model_load_snapshot(list(loaded_ids))
    for alias, preferences in config.routing.aliases.items():
        resolved = task_router.resolve(
            alias,
            list(loaded_ids),
            model_load_snapshot=load_snapshot,
        )
        is_loaded = resolved in loaded_ids
        roles[alias] = {
            "preferences": preferences,
            "resolved_model": resolved if is_loaded else None,
            "loaded": is_loaded,
        }

    # Helper nodes
    helpers: dict[str, dict[str, Any]] = {}
    if remote_embedding is not None:
        helpers["embedding"] = {
            "url": remote_embedding.url,
            "model": remote_embedding.model,
            "healthy": remote_embedding.is_healthy,
            "fallback": remote_embedding.fallback,
            "circuit_state": remote_embedding.circuit_breaker.state.value,
        }
    if remote_reranking is not None:
        helpers["reranking"] = {
            "url": remote_reranking.url,
            "model": remote_reranking.model,
            "healthy": remote_reranking.is_healthy,
            "fallback": remote_reranking.fallback,
            "circuit_state": remote_reranking.circuit_breaker.state.value,
        }

    return {
        "roles": roles,
        "helper_nodes": helpers,
        "loaded_models": sorted(loaded_ids),
        "default_model": config.routing.default_model,
        "backends": {
            name: backend.model_dump()
            for name, backend in config.backends.items()
        },
        "stack_presets": {
            name: preset.model_dump()
            for name, preset in config.stack_presets.items()
        },
    }


# ── Quantization endpoints ──────────────────────────────────────────────


@router.post("/admin/quantize", response_model=None)
async def start_quantize(
    body: QuantizeRequest,
    _auth: AdminAuth,
) -> Response:
    """Start a model quantization job.

    Converts a HuggingFace model to quantized MLX format in the background.
    Returns a job ID for polling progress via GET /admin/quantize/{job_id}.
    """
    from opta_lmx.manager.quantize import start_quantize as _start_quantize

    job = await _start_quantize(
        source_model=body.source_model,
        output_path=body.output_path,
        bits=body.bits,
        group_size=body.group_size,
        mode=body.mode,
    )

    return JSONResponse(content={
        "job_id": job.job_id,
        "source_model": job.source_model,
        "output_path": job.output_path,
        "bits": job.bits,
        "mode": job.mode,
        "status": job.status,
    })


@router.get("/admin/quantize/{job_id}")
async def get_quantize_job(
    job_id: str,
    _auth: AdminAuth,
) -> dict[str, Any]:
    """Get status of a quantization job."""
    from opta_lmx.manager.quantize import get_job

    job = get_job(job_id)
    if job is None:
        return {"error": "Job not found", "job_id": job_id}

    result: dict[str, Any] = {
        "job_id": job.job_id,
        "source_model": job.source_model,
        "output_path": job.output_path,
        "bits": job.bits,
        "group_size": job.group_size,
        "mode": job.mode,
        "status": job.status,
        "started_at": job.started_at,
    }
    if job.completed_at:
        result["completed_at"] = job.completed_at
        result["duration_sec"] = round(job.completed_at - job.started_at, 1)
    if job.output_size_bytes:
        result["output_size_bytes"] = job.output_size_bytes
        result["output_size_gb"] = round(job.output_size_bytes / (1024**3), 2)
    if job.error:
        result["error"] = job.error
    return result


@router.get("/admin/quantize")
async def list_quantize_jobs(
    _auth: AdminAuth,
) -> dict[str, Any]:
    """List all quantization jobs."""
    from opta_lmx.manager.quantize import list_jobs

    jobs = list_jobs()
    return {
        "jobs": [
            {
                "job_id": j.job_id,
                "source_model": j.source_model,
                "bits": j.bits,
                "status": j.status,
                "started_at": j.started_at,
            }
            for j in jobs
        ],
        "count": len(jobs),
    }


# ── Predictor stats endpoint ───────────────────────────────────────────


@router.get("/admin/predictor")
async def predictor_stats(
    engine: Engine,
    _auth: AdminAuth,
) -> dict[str, Any]:
    """Get model usage prediction statistics."""
    stats = engine.predictor.get_stats()
    predicted = engine.predict_next_model()
    return {
        **stats,
        "predicted_next": predicted,
    }


# ── Helper node health dashboard ────────────────────────────────────────


@router.get("/admin/helpers")
async def helpers_health(
    remote_embedding: RemoteEmbedding,
    remote_reranking: RemoteReranking,
    _auth: AdminAuth,
) -> dict[str, Any]:
    """Health dashboard for helper node endpoints.

    Returns detailed metrics for each configured helper node:
    latency stats, success rates, request counts, and health status.
    """
    helpers: dict[str, dict[str, Any]] = {}

    if remote_embedding is not None:
        helpers["embedding"] = remote_embedding.get_health_stats()
    if remote_reranking is not None:
        helpers["reranking"] = remote_reranking.get_health_stats()

    # Run live health checks
    check_results: dict[str, bool] = {}
    if remote_embedding is not None:
        check_results["embedding"] = await remote_embedding.health_check()
    if remote_reranking is not None:
        check_results["reranking"] = await remote_reranking.health_check()

    return {
        "helpers": helpers,
        "live_checks": check_results,
        "configured_count": len(helpers),
        "all_healthy": all(
            h.get("healthy", False) for h in helpers.values()
        ) if helpers else True,
    }
