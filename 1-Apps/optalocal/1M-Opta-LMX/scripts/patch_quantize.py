import sys
from pathlib import Path

def patch_quantize_events():
    path = "1M-Opta-LMX/src/opta_lmx/manager/quantize.py"
    with open(path, "r") as f:
        content = f.read()

    # Add EventBus type import at the top
    if "from opta_lmx.monitoring.events import EventBus" not in content:
        content = content.replace("from pathlib import Path
", "from pathlib import Path
from opta_lmx.monitoring.events import EventBus
")

    # Update start_quantize signature
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
    content = content.replace(old_sig, new_sig)

    # Update task creation
    old_task = "task = asyncio.create_task(_run_quantize(job))"
    new_task = "task = asyncio.create_task(_run_quantize(job, event_bus))"
    content = content.replace(old_task, new_task)

    # Update _run_quantize signature
    old_run_sig = "async def _run_quantize(job: QuantizeJob) -> None:"
    new_run_sig = "async def _run_quantize(job: QuantizeJob, event_bus: EventBus | None = None) -> None:"
    content = content.replace(old_run_sig, new_run_sig)

    # Add event emit before try block
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
    content = content.replace(old_try, new_try)

    # Add event emit on success
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
    content = content.replace(old_success, new_success)

    # Add event emit on failure
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
    content = content.replace(old_fail, new_fail)

    with open(path, "w") as f:
        f.write(content)

if __name__ == "__main__":
    patch_quantize_events()
