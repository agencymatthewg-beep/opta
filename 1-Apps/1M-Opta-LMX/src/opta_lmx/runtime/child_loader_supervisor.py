"""Parent-side supervisor for isolated child loader execution."""

from __future__ import annotations

import asyncio
import json
import sys
from dataclasses import dataclass
from typing import Any

from opta_lmx.model_safety import ErrorCodes
from opta_lmx.runtime.loader_protocol import LoadResult, LoadSpec, LoaderFailure


@dataclass(slots=True)
class LoaderSupervisorOutcome:
    """Structured parent-side outcome from a child loader invocation."""

    ok: bool
    result: LoadResult | None = None
    failure: LoaderFailure | None = None


def _decode_lines(payload: bytes) -> list[str]:
    text = payload.decode("utf-8", errors="replace")
    return [line.strip() for line in text.splitlines() if line.strip()]


def _parse_worker_failure(stderr: bytes, *, default_code: str) -> LoaderFailure:
    lines = _decode_lines(stderr)
    if lines:
        try:
            data = json.loads(lines[0])
            if isinstance(data, dict):
                return LoaderFailure.from_dict(data)
        except Exception:
            pass
        return LoaderFailure(code=default_code, message=lines[0])
    return LoaderFailure(code=default_code, message=default_code)


async def run_loader_supervisor(
    spec: LoadSpec,
    *,
    timeout_sec: float = 90.0,
    python_executable: str | None = None,
    worker_module: str = "opta_lmx.runtime.child_loader_worker",
) -> LoaderSupervisorOutcome:
    """Run one child loader worker call with timeout and crash classification."""
    executable = python_executable or sys.executable
    proc = await asyncio.create_subprocess_exec(
        executable,
        "-m",
        worker_module,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    payload = json.dumps(spec.to_dict(), sort_keys=True).encode("utf-8")

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(payload), timeout=timeout_sec)
    except TimeoutError:
        try:
            proc.terminate()
        except ProcessLookupError:
            pass
        try:
            await asyncio.wait_for(proc.wait(), timeout=1.0)
        except TimeoutError:
            try:
                proc.kill()
            except ProcessLookupError:
                pass
            await proc.wait()
        return LoaderSupervisorOutcome(
            ok=False,
            failure=LoaderFailure(
                code=ErrorCodes.MODEL_LOAD_TIMEOUT,
                message=f"Loader timed out after {timeout_sec}s",
                metadata={"timeout_sec": timeout_sec, "model_id": spec.model_id},
            ),
        )

    rc = proc.returncode if proc.returncode is not None else 1

    if rc == 0:
        lines = _decode_lines(stdout)
        if not lines:
            return LoaderSupervisorOutcome(
                ok=False,
                failure=LoaderFailure(
                    code=ErrorCodes.MODEL_PROBE_FAILED,
                    message="Worker produced no stdout payload",
                ),
            )
        try:
            data = json.loads(lines[0])
            if not isinstance(data, dict):
                raise ValueError("worker stdout payload must be a JSON object")
            return LoaderSupervisorOutcome(ok=True, result=LoadResult.from_dict(data))
        except Exception as exc:
            return LoaderSupervisorOutcome(
                ok=False,
                failure=LoaderFailure(
                    code=ErrorCodes.MODEL_PROBE_FAILED,
                    message=f"Invalid worker stdout payload: {exc}",
                ),
            )

    if rc < 0:
        signal = abs(rc)
        return LoaderSupervisorOutcome(
            ok=False,
            failure=LoaderFailure(
                code=ErrorCodes.MODEL_LOADER_CRASHED,
                message=f"Child loader crashed with signal {signal}",
                signal=signal,
            ),
        )

    failure = _parse_worker_failure(stderr, default_code=ErrorCodes.MODEL_PROBE_FAILED)
    if failure.exit_code is None:
        failure.exit_code = rc
    return LoaderSupervisorOutcome(ok=False, failure=failure)

