"""On-device model quantization via mlx-lm.

Wraps mlx_lm.convert() in async-compatible background tasks for
quantizing HuggingFace models to MLX format on Apple Silicon.
The quantization is CPU/GPU-intensive and runs in a ThreadPoolExecutor.
"""

from __future__ import annotations

import asyncio
import logging
import secrets
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

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
    out = Path(output_path)
    if out.exists():
        raise FileExistsError(f"Output path already exists: {output_path}")

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
) -> QuantizeJob:
    """Start an async quantization job.

    Args:
        source_model: HuggingFace repo ID or local path.
        output_path: Where to save the quantized model. Auto-generated if None.
        bits: Quantization bits (2, 4, or 8).
        group_size: Quantization group size.
        mode: Quantization mode (affine, mxfp4, nvfp4, mxfp8).

    Returns:
        QuantizeJob with tracking info.
    """
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
    task = asyncio.create_task(_run_quantize(job))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

    return job


async def _run_quantize(job: QuantizeJob) -> None:
    """Run quantization in executor and update job status."""
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
