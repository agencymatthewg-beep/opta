"""On-device model quantization via mlx-lm.

Wraps mlx_lm.convert() in async-compatible background tasks for
quantizing HuggingFace models to MLX format on Apple Silicon.
The quantization is CPU/GPU-intensive and runs in a ThreadPoolExecutor.
"""

from __future__ import annotations

import asyncio
import inspect
import json
import logging
import os
import secrets
import time
from collections.abc import Awaitable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, cast

from opta_lmx.monitoring.events import EventBus, ServerEvent

logger = logging.getLogger(__name__)

# mlx/core quantize supports these modes and mode-specific bits/group sizes.
_MODE_CONSTRAINTS: dict[str, dict[str, frozenset[int]]] = {
    "affine": {
        "bits": frozenset({2, 3, 4, 5, 6, 8}),
        "group_sizes": frozenset({32, 64, 128}),
    },
    "mxfp4": {
        "bits": frozenset({4}),
        "group_sizes": frozenset({32}),
    },
    "mxfp8": {
        "bits": frozenset({8}),
        "group_sizes": frozenset({32}),
    },
    "nvfp4": {
        "bits": frozenset({4}),
        "group_sizes": frozenset({16}),
    },
}

SUPPORTED_QUANT_MODES: tuple[str, ...] = tuple(sorted(_MODE_CONSTRAINTS))
SUPPORTED_QUANT_BITS: tuple[int, ...] = tuple(
    sorted({bit for cfg in _MODE_CONSTRAINTS.values() for bit in cfg["bits"]})
)

DEFAULT_JOBS_REGISTRY_PATH = Path.home() / ".opta-lmx" / "quantize-jobs.json"
_TERMINAL_STATUSES = frozenset({"completed", "failed", "cancelled"})


def validate_quantize_settings(
    bits: int,
    group_size: int,
    mode: str,
) -> tuple[int, int, str]:
    """Validate quantization settings against mlx/core quantize support."""
    normalized_mode = mode.strip().lower()
    if normalized_mode not in _MODE_CONSTRAINTS:
        allowed_modes = ", ".join(SUPPORTED_QUANT_MODES)
        raise ValueError(f"mode must be one of [{allowed_modes}] (got {mode!r})")
    if group_size < 1:
        raise ValueError(f"group_size must be >= 1 (got {group_size})")

    allowed_bits = _MODE_CONSTRAINTS[normalized_mode]["bits"]
    allowed_group_sizes = _MODE_CONSTRAINTS[normalized_mode]["group_sizes"]

    if bits not in allowed_bits:
        allowed = ", ".join(str(v) for v in sorted(allowed_bits))
        raise ValueError(
            f"bits={bits} is not supported for mode={normalized_mode!r}; "
            f"supported bits: [{allowed}]"
        )
    if group_size not in allowed_group_sizes:
        allowed = ", ".join(str(v) for v in sorted(allowed_group_sizes))
        raise ValueError(
            f"group_size={group_size} is not supported for mode={normalized_mode!r}; "
            f"supported group_size values: [{allowed}]"
        )
    return bits, group_size, normalized_mode


# Single-threaded executor for quantization (one job at a time)
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="quantize")
_quantize_slot = asyncio.Lock()

# Strong references to background tasks to prevent GC during execution
_background_tasks: set[asyncio.Task[None]] = set()


@dataclass
class QuantizeJob:
    """Tracks a running or completed quantization job."""

    job_id: str
    source_model: str
    output_path: str
    bits: int = 4
    group_size: int = 64
    mode: str = "affine"
    status: str = "pending"  # pending, queued, running, completed, failed, cancelled
    started_at: float = 0.0
    completed_at: float = 0.0
    error: str | None = None
    output_size_bytes: int = 0
    cancel_requested: bool = False
    queue_position: int | None = None
    updated_at: float = 0.0


# Active and completed jobs (in-memory registry)
_jobs: dict[str, QuantizeJob] = {}
_job_tasks: dict[str, asyncio.Task[None]] = {}
_registry_initialized = False


def _jobs_registry_path() -> Path:
    custom = os.environ.get("OPTA_LMX_QUANTIZE_JOBS_PATH")
    return Path(custom).expanduser() if custom else DEFAULT_JOBS_REGISTRY_PATH


def _should_persist_jobs() -> bool:
    # Keep unit tests isolated and free of host-level side effects.
    return not os.environ.get("PYTEST_CURRENT_TEST")


def _touch(job: QuantizeJob) -> None:
    job.updated_at = time.time()


def _set_terminal(
    job: QuantizeJob,
    status: str,
    *,
    error: str | None = None,
) -> None:
    job.status = status
    job.error = error
    if job.completed_at == 0.0:
        job.completed_at = time.time()
    job.queue_position = None
    _touch(job)


def _recompute_queue_positions() -> None:
    queued = sorted(
        (job for job in _jobs.values() if job.status in {"pending", "queued"}),
        key=lambda j: j.started_at,
    )
    for idx, job in enumerate(queued, start=1):
        job.status = "queued"
        job.queue_position = idx
        _touch(job)


def _job_from_dict(raw: dict[str, Any]) -> QuantizeJob | None:
    try:
        return QuantizeJob(
            job_id=str(raw["job_id"]),
            source_model=str(raw["source_model"]),
            output_path=str(raw["output_path"]),
            bits=int(raw.get("bits", 4)),
            group_size=int(raw.get("group_size", 64)),
            mode=str(raw.get("mode", "affine")),
            status=str(raw.get("status", "failed")),
            started_at=float(raw.get("started_at", 0.0)),
            completed_at=float(raw.get("completed_at", 0.0)),
            error=(str(raw["error"]) if raw.get("error") is not None else None),
            output_size_bytes=int(raw.get("output_size_bytes", 0)),
            cancel_requested=bool(raw.get("cancel_requested", False)),
            queue_position=(
                int(raw["queue_position"])
                if raw.get("queue_position") is not None
                else None
            ),
            updated_at=float(raw.get("updated_at", 0.0)),
        )
    except Exception:
        return None


def _persist_jobs() -> None:
    if not _should_persist_jobs():
        return

    path = _jobs_registry_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = sorted(_jobs.values(), key=lambda j: j.started_at, reverse=True)
    payload = {
        "version": 1,
        "saved_at": time.time(),
        "jobs": [asdict(job) for job in ordered],
    }

    tmp_path = path.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    tmp_path.replace(path)


def _load_jobs_from_disk() -> None:
    if not _should_persist_jobs():
        return

    path = _jobs_registry_path()
    if not path.exists():
        return

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("quantize_jobs_load_failed", extra={"error": str(exc), "path": str(path)})
        return

    raw_jobs = payload.get("jobs") if isinstance(payload, dict) else None
    if not isinstance(raw_jobs, list):
        return

    recovered = False
    for item in raw_jobs:
        if not isinstance(item, dict):
            continue
        job = _job_from_dict(item)
        if job is None:
            continue

        if job.status in {"pending", "queued", "running"}:
            # Quantization isn't resumable mid-conversion; mark interrupted jobs as failed.
            _set_terminal(job, "failed", error="Interrupted by process restart")
            recovered = True

        _jobs[job.job_id] = job

    _recompute_queue_positions()
    if recovered:
        _persist_jobs()


def _ensure_registry_loaded() -> None:
    global _registry_initialized
    if _registry_initialized:
        return
    _registry_initialized = True
    _load_jobs_from_disk()


async def _safe_publish_event(
    event_bus: EventBus | None,
    *,
    event_type: str,
    data: dict[str, Any],
) -> None:
    """Publish a quantize event without failing the quantization workflow.

    Uses the current EventBus contract (publish(ServerEvent)).
    Falls back to a legacy publish(event_type, data) signature for compatibility.
    """
    if event_bus is None:
        return

    publish_result: object
    try:
        publish_result = event_bus.publish(ServerEvent(event_type=event_type, data=data))
    except TypeError:
        # Backward-compatible fallback for older publish(event_type, data) buses.
        try:
            publish_result = cast(Any, event_bus).publish(event_type, data)
        except Exception as exc:
            logger.warning(
                "quantize_event_publish_failed",
                extra={"event_type": event_type, "error": str(exc)},
            )
            return
    except Exception as exc:
        logger.warning(
            "quantize_event_publish_failed",
            extra={"event_type": event_type, "error": str(exc)},
        )
        return

    if inspect.isawaitable(publish_result):
        try:
            await cast(Awaitable[object], publish_result)
        except Exception as exc:
            logger.warning(
                "quantize_event_publish_failed",
                extra={"event_type": event_type, "error": str(exc)},
            )


def _do_quantize(
    source_model: str,
    output_path: str,
    bits: int,
    group_size: int,
    mode: str,
) -> int:
    """Synchronous quantization — runs in executor thread.

    Returns output directory size in bytes.
    """
    bits, group_size, mode = validate_quantize_settings(bits, group_size, mode)

    out = Path(output_path)
    if out.exists():
        raise FileExistsError(f"Output path already exists: {output_path}")
    out.parent.mkdir(parents=True, exist_ok=True)

    from mlx_lm import convert

    convert(
        hf_path=source_model,
        mlx_path=str(out),
        quantize=True,
        q_bits=bits,
        q_group_size=group_size,
        q_mode=mode,
    )

    # Calculate output size
    return sum(f.stat().st_size for f in out.rglob("*") if f.is_file())


async def start_quantize(
    source_model: str,
    output_path: str | None = None,
    bits: int = 4,
    group_size: int = 64,
    mode: str = "affine",
    event_bus: EventBus | None = None,
) -> QuantizeJob:
    """Start an async quantization job.

    Args:
        source_model: HuggingFace repo ID or local path.
        output_path: Where to save the quantized model. Auto-generated if None.
        bits: Quantization bits. Mode-specific mlx/core constraints apply.
        group_size: Quantization group size. Mode-specific constraints apply.
        mode: Quantization mode (affine, mxfp4, mxfp8, nvfp4).
        event_bus: Optional event bus to emit progress events to.

    Returns:
        QuantizeJob with tracking info.
    """
    _ensure_registry_loaded()
    bits, group_size, mode = validate_quantize_settings(bits, group_size, mode)

    job_id = secrets.token_hex(6)

    # Auto-generate output path
    if output_path is None:
        safe_name = source_model.replace("/", "--")
        output_path = str(
            Path.home() / ".opta-lmx" / "quantized" / f"{safe_name}-{bits}bit"
        )

    now = time.time()
    job = QuantizeJob(
        job_id=job_id,
        source_model=source_model,
        output_path=output_path,
        bits=bits,
        group_size=group_size,
        mode=mode,
        status="queued",
        started_at=now,
        updated_at=now,
    )
    _jobs[job_id] = job
    _recompute_queue_positions()
    _persist_jobs()

    logger.info(
        "quantize_queued",
        extra={
            "job_id": job_id,
            "source": source_model,
            "output": output_path,
            "bits": bits,
            "group_size": group_size,
            "mode": mode,
            "queue_position": job.queue_position,
        },
    )

    task = asyncio.create_task(_run_quantize(job, event_bus))
    _job_tasks[job_id] = task
    _background_tasks.add(task)

    def _cleanup_task(completed: asyncio.Task[None]) -> None:
        _background_tasks.discard(completed)
        _job_tasks.pop(job_id, None)

    task.add_done_callback(_cleanup_task)
    return job


async def _run_quantize(job: QuantizeJob, event_bus: EventBus | None = None) -> None:
    """Run quantization in executor and update job status."""
    if job.status in _TERMINAL_STATUSES:
        return

    try:
        async with _quantize_slot:
            if job.cancel_requested or job.status == "cancelled":
                if job.status != "cancelled":
                    _set_terminal(job, "cancelled", error="Cancelled before execution")
                _recompute_queue_positions()
                _persist_jobs()
                await _safe_publish_event(
                    event_bus,
                    event_type="quantize_progress",
                    data={
                        "model_id": job.source_model,
                        "status": "cancelled",
                        "percent": 0,
                    },
                )
                return

            job.status = "running"
            job.queue_position = 0
            _touch(job)
            _recompute_queue_positions()
            _persist_jobs()

            await _safe_publish_event(
                event_bus,
                event_type="quantize_progress",
                data={
                    "model_id": job.source_model,
                    "status": "quantizing",
                    "percent": 0,
                },
            )

            loop = asyncio.get_running_loop()
            size_bytes = await loop.run_in_executor(
                _executor,
                _do_quantize,
                job.source_model,
                job.output_path,
                job.bits,
                job.group_size,
                job.mode,
            )

            job.status = "completed"
            job.completed_at = time.time()
            job.output_size_bytes = size_bytes
            job.queue_position = None
            _touch(job)
            elapsed = job.completed_at - job.started_at
            _recompute_queue_positions()
            _persist_jobs()

            await _safe_publish_event(
                event_bus,
                event_type="quantize_progress",
                data={
                    "model_id": job.source_model,
                    "status": "completed",
                    "percent": 100,
                },
            )
            logger.info(
                "quantize_completed",
                extra={
                    "job_id": job.job_id,
                    "source": job.source_model,
                    "output": job.output_path,
                    "size_bytes": size_bytes,
                    "duration_sec": round(elapsed, 1),
                },
            )

    except asyncio.CancelledError:
        if job.status not in _TERMINAL_STATUSES and job.status != "running":
            _set_terminal(job, "cancelled", error="Cancelled before execution")
            _recompute_queue_positions()
            _persist_jobs()
            await _safe_publish_event(
                event_bus,
                event_type="quantize_progress",
                data={
                    "model_id": job.source_model,
                    "status": "cancelled",
                    "percent": 0,
                },
            )
        return
    except Exception as e:
        _set_terminal(job, "failed", error=str(e))
        _recompute_queue_positions()
        _persist_jobs()
        await _safe_publish_event(
            event_bus,
            event_type="quantize_progress",
            data={
                "model_id": job.source_model,
                "status": f"failed: {e}",
                "percent": 0,
            },
        )
        logger.error(
            "quantize_failed",
            extra={
                "job_id": job.job_id,
                "source": job.source_model,
                "error": str(e),
            },
        )


async def cancel_quantize(
    job_id: str,
    *,
    event_bus: EventBus | None = None,
) -> tuple[bool, str, QuantizeJob | None]:
    """Cancel a queued quantization job.

    Returns:
        (cancelled, reason, job)
        - cancelled: True when cancellation was applied or already terminal.
        - reason: one of "not_found", "cancelled", "already_terminal",
          "running_cannot_cancel".
    """
    _ensure_registry_loaded()
    job = _jobs.get(job_id)
    if job is None:
        return False, "not_found", None

    if job.status in _TERMINAL_STATUSES:
        return True, "already_terminal", job

    if job.status == "running":
        job.cancel_requested = True
        _touch(job)
        _persist_jobs()
        return False, "running_cannot_cancel", job

    job.cancel_requested = True
    _set_terminal(job, "cancelled", error="Cancelled by user")
    _recompute_queue_positions()
    _persist_jobs()

    task = _job_tasks.get(job_id)
    if task and not task.done():
        task.cancel()

    await _safe_publish_event(
        event_bus,
        event_type="quantize_progress",
        data={
            "model_id": job.source_model,
            "status": "cancelled",
            "percent": 0,
        },
    )
    logger.info("quantize_cancelled", extra={"job_id": job_id, "source": job.source_model})
    return True, "cancelled", job


def get_job(job_id: str) -> QuantizeJob | None:
    """Get a quantization job by ID."""
    _ensure_registry_loaded()
    return _jobs.get(job_id)


def list_jobs() -> list[QuantizeJob]:
    """List all quantization jobs (most recent first)."""
    _ensure_registry_loaded()
    return sorted(_jobs.values(), key=lambda j: j.started_at, reverse=True)
