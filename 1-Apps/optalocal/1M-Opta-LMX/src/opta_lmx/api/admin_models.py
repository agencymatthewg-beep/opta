"""Admin model management routes — load, unload, list, download, delete, probe, autotune."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import secrets
import time
from typing import TYPE_CHECKING, Any, cast

if TYPE_CHECKING:
    from opta_lmx.inference.engine import InferenceEngine
    from opta_lmx.manager.model import ModelManager
    from opta_lmx.monitoring.journal import RuntimeJournalManager

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from opta_lmx.api.deps import (
    AdminAuth,
    Engine,
    Manager,
    Metrics,
    Presets,
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
from opta_lmx.inference.autotune_scoring import score_profile
from opta_lmx.inference.engine import ModelRuntimeCompatibilityError
from opta_lmx.inference.schema import (
    AdminAutotuneRecordResponse,
    AdminAutotuneRequest,
    AdminAutotuneResponse,
    AdminCompatibilityResponse,
    AdminDeleteResponse,
    AdminDownloadRequest,
    AdminDownloadResponse,
    AdminLoadRequest,
    AdminLoadResponse,
    AdminModelDetail,
    AdminModelPerformanceResponse,
    AdminModelsResponse,
    AdminProbeRequest,
    AdminProbeResponse,
    AdminUnloadRequest,
    AdminUnloadResponse,
    AutoDownloadResponse,
    AvailableModel,
    BenchmarkRequest,
    ConfirmLoadRequest,
    DownloadProgressResponse,
    ErrorResponse,
)
from opta_lmx.model_safety import AdmissionFailure, ErrorCodes, validate_architecture
from opta_lmx.monitoring.benchmark import benchmark_summary_to_autotune_metrics

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
    for unit in ("B", "KB", "MB", "GB", "TB", "PB"):
        if abs(value) < 1024:
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} EB"  # safety fallback, unreachable for realistic sizes


def _get_journal_manager(request: Request) -> RuntimeJournalManager | None:
    """Return runtime journal manager if available."""
    manager = getattr(request.app.state, "journal_manager", None)
    if manager is None or not hasattr(manager, "write_update_log"):
        return None
    return cast("RuntimeJournalManager", manager)


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
    allow_unsupported_runtime: bool = False,
    preferred_backend: str | None = None,
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
                allow_unsupported_runtime=allow_unsupported_runtime,
                preferred_backend=preferred_backend,
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
                    "allow_unsupported_runtime": allow_unsupported_runtime,
                    "backend": preferred_backend,
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


admin_models_router = APIRouter()


@admin_models_router.get("/admin/models", responses={403: {"model": ErrorResponse}})
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


@admin_models_router.get(
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


@admin_models_router.post(
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
            allow_backend_switch = False
            if body.backend:
                failed_backend: str | None = None
                with contextlib.suppress(Exception):
                    failed_rows = engine._compatibility.list_records(
                        model_id=body.model_id,
                        outcome="fail",
                        limit=1,
                    )
                    if failed_rows and isinstance(failed_rows[0], dict):
                        candidate_backend = failed_rows[0].get("backend")
                        if isinstance(candidate_backend, str):
                            failed_backend = candidate_backend
                allow_backend_switch = bool(
                    failed_backend and body.backend != failed_backend
                )

            if allow_backend_switch:
                logger.info(
                    "quarantine_override_backend_switch",
                    extra={
                        "model_id": body.model_id,
                        "requested_backend": body.backend,
                    },
                )
            else:
                return openai_error(
                    status_code=409,
                    message=(
                        f"Model '{body.model_id}' is quarantined after instability. "
                        "Use a supported variant, switch backend, or pass "
                        "allow_unsupported_runtime=true to override."
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
        tuned = engine.get_tuned_profile(
            body.model_id,
            allow_failed=body.allow_unsupported_runtime,
        )
        tuned_profile = tuned.get("profile") if isinstance(tuned, dict) else None
        perf = preset_mgr.compose_performance_for_load(
            body.model_id,
            tuned=tuned_profile if isinstance(tuned_profile, dict) else None,
            explicit=body.performance_overrides,
        )
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
                allow_unsupported_runtime=body.allow_unsupported_runtime,
                preferred_backend=body.backend,
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
    tuned = engine.get_tuned_profile(
        body.model_id,
        allow_failed=body.allow_unsupported_runtime,
    )
    tuned_profile = tuned.get("profile") if isinstance(tuned, dict) else None
    perf = preset_mgr.compose_performance_for_load(
        body.model_id,
        tuned=tuned_profile if isinstance(tuned_profile, dict) else None,
        explicit=body.performance_overrides,
    )
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
            preferred_backend=body.backend,
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
    except ValueError as e:
        message = str(e)
        param = "backend" if "backend" in message.lower() else "model_id"
        return openai_error(
            status_code=400,
            message=message,
            error_type="invalid_request_error",
            param=param,
            code="invalid_value",
        )
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
            "backend": body.backend,
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


@admin_models_router.post(
    "/admin/models/probe",
    response_model=AdminProbeResponse,
    responses={403: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
async def probe_model(
    body: AdminProbeRequest,
    _auth: AdminAuth,
    engine: Engine,
) -> AdminProbeResponse | JSONResponse:
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


@admin_models_router.get(
    "/admin/models/compatibility",
    response_model=AdminCompatibilityResponse,
    responses={403: {"model": ErrorResponse}},
)
async def list_model_compatibility(
    _auth: AdminAuth,
    engine: Engine,
    model_id: str | None = None,
    backend: str | None = None,
    outcome: str | None = None,
    since_ts: float | None = None,
    limit: int = 200,
    include_summary: bool = False,
) -> AdminCompatibilityResponse:
    """List compatibility registry rows with optional filtering."""
    bounded_limit = max(1, min(limit, 2000))
    rows = engine._compatibility.list_records(
        model_id=model_id,
        backend=backend,
        outcome=outcome,
        since_ts=since_ts,
        limit=bounded_limit,
    )
    payload: dict[str, Any] = {
        "total": len(rows),
        "rows": rows,
    }
    if include_summary:
        payload["summary"] = engine._compatibility.summary_by_model()
    return AdminCompatibilityResponse.model_validate(payload)


@admin_models_router.post(
    "/admin/models/autotune",
    response_model=None,
    responses={
        200: {"model": AdminAutotuneResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
async def autotune_model(
    body: AdminAutotuneRequest,
    _auth: AdminAuth,
    engine: Engine,
    metrics: Metrics,
    preset_mgr: Presets,
) -> AdminAutotuneResponse | JSONResponse:
    """Benchmark candidate load profiles and persist best profile for this model/backend."""
    # Import benchmark_model from the admin module to avoid circular dependency.
    # This function is defined in admin.py (the composing module) and re-exported.
    from opta_lmx.api.admin import benchmark_model as _benchmark_model

    candidate_inputs = list(body.profiles or [{}])
    original_loaded = engine.is_model_loaded(body.model_id)
    original_perf: dict[str, Any] | None = None
    if original_loaded:
        try:
            original_perf = dict(engine.get_model(body.model_id).performance_overrides or {})
        except Exception:
            original_perf = None

    candidates: list[dict[str, Any]] = []
    best_row: dict[str, Any] | None = None
    best_sort_key: tuple[float, float, float] | None = None
    backend_name = engine.resolve_autotune_backend(
        body.model_id,
        allow_failed=body.allow_unsupported_runtime,
    )
    backend_version_value = engine.autotune_backend_version(backend_name)

    try:
        for candidate in candidate_inputs:
            if engine.is_model_loaded(body.model_id):
                await engine.unload_model(body.model_id, reason="autotune_candidate_swap")

            explicit = candidate if isinstance(candidate, dict) else {}
            effective_profile = preset_mgr.compose_performance_for_load(
                body.model_id,
                tuned=None,
                explicit=explicit,
            )

            try:
                await engine.load_model(
                    body.model_id,
                    performance_overrides=effective_profile or None,
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
                return openai_error(
                    status_code=409,
                    message=str(e),
                    error_type="invalid_request_error",
                    param="model_id",
                    code=ErrorCodes.MODEL_PROBE_FAILED,
                )

            benchmark_payload = await _benchmark_model(
                BenchmarkRequest(
                    model_id=body.model_id,
                    prompt=body.prompt,
                    max_tokens=body.max_tokens,
                    temperature=body.temperature,
                    runs=body.runs,
                ),
                _auth,
                engine,
                metrics,
            )
            if isinstance(benchmark_payload, JSONResponse):
                return benchmark_payload

            # Re-resolve after load: the active backend may differ from the pre-load candidate.
            backend_name = engine.resolve_autotune_backend(
                body.model_id,
                allow_failed=body.allow_unsupported_runtime,
            )
            backend_version_value = engine.autotune_backend_version(backend_name)

            metrics_payload = benchmark_summary_to_autotune_metrics(
                {
                    "avg_tokens_per_second": benchmark_payload.avg_tokens_per_second,
                    "avg_ttft_ms": benchmark_payload.avg_time_to_first_token_ms,
                    "avg_total_time_ms": benchmark_payload.avg_total_time_ms,
                    "error_rate": 0.0,
                    "queue_wait_ms": 0.0,
                },
            )
            score_result = score_profile(
                avg_tokens_per_second=metrics_payload["avg_tokens_per_second"],
                avg_ttft_ms=metrics_payload["avg_ttft_ms"],
                error_rate=metrics_payload["error_rate"],
                avg_total_ms=metrics_payload["avg_total_ms"],
                queue_wait_ms=metrics_payload["queue_wait_ms"],
            )
            score_value = engine.save_tuned_profile(
                model_id=body.model_id,
                backend=backend_name,
                backend_version_value=backend_version_value,
                profile=effective_profile,
                metrics=metrics_payload,
            )

            row = {
                "profile": effective_profile,
                "metrics": metrics_payload,
                "score": score_value,
            }
            candidates.append(row)
            if best_sort_key is None or score_result.sort_key < best_sort_key:
                best_sort_key = score_result.sort_key
                best_row = row
    finally:
        if engine.is_model_loaded(body.model_id):
            with contextlib.suppress(Exception):
                await engine.unload_model(body.model_id, reason="autotune_cleanup")
        if original_loaded:
            try:
                await engine.load_model(
                    body.model_id,
                    performance_overrides=original_perf or None,
                    allow_unsupported_runtime=body.allow_unsupported_runtime,
                )
            except Exception as _restore_exc:
                logger.warning(
                    "autotune_model_restore_failed",
                    extra={"model_id": body.model_id, "error": str(_restore_exc)},
                )

    if not candidates or best_row is None:
        return internal_error("Autotune did not produce benchmark results.")

    return AdminAutotuneResponse.model_validate(
        {
            "model_id": body.model_id,
            "backend": backend_name,
            "backend_version": backend_version_value,
            "best_profile": best_row["profile"],
            "best_metrics": best_row["metrics"],
            "best_score": best_row["score"],
            "candidates": candidates,
        },
    )


@admin_models_router.get(
    "/admin/models/{model_id:path}/autotune",
    response_model=None,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def get_model_autotune(
    model_id: str,
    _auth: AdminAuth,
    engine: Engine,
    backend: str | None = None,
    backend_version: str | None = None,
) -> AdminAutotuneRecordResponse | JSONResponse:
    """Return best-known autotune profile for a model/backend."""
    record = engine.get_tuned_profile(
        model_id,
        backend=backend,
        backend_version_value=backend_version,
    )
    if not isinstance(record, dict):
        return openai_error(
            status_code=404,
            message=f"No autotune profile found for model '{model_id}'.",
            error_type="invalid_request_error",
            param="model_id",
            code="autotune_not_found",
        )

    return AdminAutotuneRecordResponse.model_validate(record)


@admin_models_router.post(
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

    tuned = engine.get_tuned_profile(model_id)
    tuned_profile = tuned.get("profile") if isinstance(tuned, dict) else None
    perf = preset_mgr.compose_performance_for_load(
        model_id,
        tuned=tuned_profile if isinstance(tuned_profile, dict) else None,
        explicit=None,
    )
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


@admin_models_router.post(
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


@admin_models_router.get("/admin/models/available", responses={403: {"model": ErrorResponse}})
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


@admin_models_router.post(
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


@admin_models_router.get(
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


@admin_models_router.delete(
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
