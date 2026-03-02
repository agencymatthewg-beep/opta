"""On-device model quantization via mlx-lm.

Wraps mlx_lm.convert() in async-compatible background tasks for
quantizing HuggingFace models to MLX format on Apple Silicon.
The quantization is CPU/GPU-intensive and runs in a ThreadPoolExecutor.
"""

from __future__ import annotations

import asyncio
import inspect
import logging
import secrets
import time
from collections.abc import Awaitable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
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
    status: str = "pending"  # pending, running, completed, failed
    started_at: float = 0.0
    completed_at: float = 0.0
    error: str | None = None
    output_size_bytes: int = 0


# Active and completed jobs (in-memory registry)
_jobs: dict[str, QuantizeJob] = {}


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
    total_bytes = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
    return total_bytes


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
    bits, group_size, mode = validate_quantize_settings(bits, group_size, mode)

    job_id = secrets.token_hex(6)

    # Auto-generate output path
    if output_path is None:
        safe_name = source_model.replace("/", "--")
        output_path = str(
            Path.home() / ".opta-lmx" / "quantized" / f"{safe_name}-{bits}bit"
        )

    job = QuantizeJob(
        job_id=job_id,
        source_model=source_model,
        output_path=output_path,
        bits=bits,
        group_size=group_size,
        mode=mode,
        status="running",
        started_at=time.time(),
    )
    _jobs[job_id] = job

    logger.info("quantize_started", extra={
        "job_id": job_id,
        "source": source_model,
        "output": output_path,
        "bits": bits,
        "group_size": group_size,
        "mode": mode,
    })

    # Run in background thread — strong reference prevents GC
    task = asyncio.create_task(_run_quantize(job, event_bus))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

    return job


async def _run_quantize(job: QuantizeJob, event_bus: EventBus | None = None) -> None:
    """Run quantization in executor and update job status."""
    await _safe_publish_event(
        event_bus,
        event_type="quantize_progress",
        data={
            "model_id": job.source_model,
            "status": "quantizing",
            "percent": 0,
        },
    )
    try:
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
        elapsed = job.completed_at - job.started_at
        await _safe_publish_event(
            event_bus,
            event_type="quantize_progress",
            data={
                "model_id": job.source_model,
                "status": "completed",
                "percent": 100,
            },
        )
        logger.info("quantize_completed", extra={
            "job_id": job.job_id,
            "source": job.source_model,
            "output": job.output_path,
            "size_bytes": size_bytes,
            "duration_sec": round(elapsed, 1),
        })
    except Exception as e:
        job.status = "failed"
        job.completed_at = time.time()
        job.error = str(e)
        await _safe_publish_event(
            event_bus,
            event_type="quantize_progress",
            data={
                "model_id": job.source_model,
                "status": f"failed: {e}",
                "percent": 0,
            },
        )
        logger.error("quantize_failed", extra={
            "job_id": job.job_id,
            "source": job.source_model,
            "error": str(e),
        })


def get_job(job_id: str) -> QuantizeJob | None:
    """Get a quantization job by ID."""
    return _jobs.get(job_id)


def list_jobs() -> list[QuantizeJob]:
    """List all quantization jobs (most recent first)."""
    return sorted(_jobs.values(), key=lambda j: j.started_at, reverse=True)
