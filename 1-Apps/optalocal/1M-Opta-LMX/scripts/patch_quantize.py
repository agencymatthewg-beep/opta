"""Patch quantize manager to emit EventBus progress updates.

This helper is intentionally idempotent and can be run multiple times safely.
"""

from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
TARGET = REPO_ROOT / "src" / "opta_lmx" / "manager" / "quantize.py"


def _replace_once(content: str, old: str, new: str, label: str) -> str:
    if old not in content:
        raise RuntimeError(f"Expected block not found for {label}")
    return content.replace(old, new, 1)


def patch_quantize_events() -> None:
    content = TARGET.read_text(encoding="utf-8")

    # Add EventBus import (once).
    event_import = "from opta_lmx.monitoring.events import EventBus\n"
    if event_import not in content:
        marker = "from pathlib import Path\n"
        if marker not in content:
            raise RuntimeError("Could not locate import marker in quantize.py")
        content = content.replace(marker, marker + event_import, 1)

    old_sig = """async def start_quantize(
    source_model: str,
    output_path: str | None = None,
    bits: int = 4,
    group_size: int = 64,
    mode: str = "affine",
) -> QuantizeJob:"""
    new_sig = """async def start_quantize(
    source_model: str,
    output_path: str | None = None,
    bits: int = 4,
    group_size: int = 64,
    mode: str = "affine",
    event_bus: EventBus | None = None,
) -> QuantizeJob:"""
    if "event_bus: EventBus | None = None" not in content:
        content = _replace_once(content, old_sig, new_sig, "start_quantize signature")

    if "_run_quantize(job, event_bus)" not in content:
        content = _replace_once(
            content,
            "task = asyncio.create_task(_run_quantize(job))",
            "task = asyncio.create_task(_run_quantize(job, event_bus))",
            "task creation",
        )

    old_run_sig = "async def _run_quantize(job: QuantizeJob) -> None:"
    new_run_sig = "async def _run_quantize(job: QuantizeJob, event_bus: EventBus | None = None) -> None:"
    if new_run_sig not in content:
        content = _replace_once(content, old_run_sig, new_run_sig, "_run_quantize signature")

    if '"status": "quantizing"' not in content:
        old_try = """    try:
        loop = asyncio.get_running_loop()"""
        new_try = """    if event_bus:
        event_bus.publish("quantize_progress", {
            "model_id": job.source_model,
            "status": "quantizing",
            "percent": 0,
        })
    try:
        loop = asyncio.get_running_loop()"""
        content = _replace_once(content, old_try, new_try, "pre-try progress event")

    if '"status": "completed"' not in content:
        old_success = """        job.output_size_bytes = size_bytes
        elapsed = job.completed_at - job.started_at
        logger.info("quantize_completed","""
        new_success = """        job.output_size_bytes = size_bytes
        elapsed = job.completed_at - job.started_at
        if event_bus:
            event_bus.publish("quantize_progress", {
                "model_id": job.source_model,
                "status": "completed",
                "percent": 100,
            })
        logger.info("quantize_completed","""
        content = _replace_once(content, old_success, new_success, "success progress event")

    if '"status": f"failed: {e}"' not in content:
        old_fail = """        job.error = str(e)
        logger.error("quantize_failed","""
        new_fail = """        job.error = str(e)
        if event_bus:
            event_bus.publish("quantize_progress", {
                "model_id": job.source_model,
                "status": f"failed: {e}",
                "percent": 0,
            })
        logger.error("quantize_failed","""
        content = _replace_once(content, old_fail, new_fail, "failure progress event")

    TARGET.write_text(content, encoding="utf-8")
    print(f"Patched {TARGET}")


if __name__ == "__main__":
    patch_quantize_events()
