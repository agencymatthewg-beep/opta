"""Admin API routes — /admin/* endpoints for model management.

This module composes sub-routers from focused modules and defines
remaining admin routes (status, memory, benchmark, presets, stack,
quantize, predictor, helpers).
"""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.responses import Response

from opta_lmx import __version__
from opta_lmx.api.admin_config import admin_config_router
from opta_lmx.api.admin_metrics import admin_metrics_router
from opta_lmx.api.admin_models import _human_size as _human_size
from opta_lmx.api.admin_models import admin_models_router
from opta_lmx.api.deps import (
    AdminAuth,
    Engine,
    Memory,
    Metrics,
    Presets,
    RemoteEmbedding,
    RemoteReranking,
    Router,
    StartTime,
)
from opta_lmx.api.errors import (
    internal_error,
    model_not_found,
)
from opta_lmx.config import load_config as load_config
from opta_lmx.inference.schema import (
    AdminMemoryResponse,
    AdminStatusResponse,
    BenchmarkRequest,
    BenchmarkResponse,
    BenchmarkResult,
    ChatMessage,
    ErrorResponse,
    PresetListResponse,
    PresetResponse,
    QuantizeRequest,
    SpeculativeBenchmarkStats,
)
from opta_lmx.monitoring.metrics import speculative_metric_kwargs

logger = logging.getLogger(__name__)


# ─── Compose the admin router from sub-routers ──────────────────────────────

router = APIRouter()
router.include_router(admin_models_router)
router.include_router(admin_metrics_router)
router.include_router(admin_config_router)


# ─── Status & Memory ────────────────────────────────────────────────────────


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
                prompt_profiles=p.prompt_profiles,
                default_prompt_profile=p.default_prompt_profile,
                routing_alias=p.routing_alias,
                auto_load=p.auto_load,
                performance=p.performance,
                chat_template=p.chat_template,
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
        prompt_profiles=preset.prompt_profiles,
        default_prompt_profile=preset.default_prompt_profile,
        routing_alias=preset.routing_alias,
        auto_load=preset.auto_load,
        performance=preset.performance,
        chat_template=preset.chat_template,
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
