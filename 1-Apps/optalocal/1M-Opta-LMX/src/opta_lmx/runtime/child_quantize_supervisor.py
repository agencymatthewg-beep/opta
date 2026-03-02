"""Parent-side supervisor for isolated child quantize execution."""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import signal
import sys
from dataclasses import dataclass, field
from typing import Any

from opta_lmx.runtime.loader_protocol import LoaderFailure, QuantizeResult, QuantizeSpec


@dataclass(slots=True)
class QuantizeSupervisorOutcome:
    """Structured parent-side outcome from a child quantize invocation."""

    ok: bool
    result: QuantizeResult | None = None
    failure: LoaderFailure | None = None


def _decode_lines(payload: bytes) -> list[str]:
    text = payload.decode("utf-8", errors="replace")
    return [line.strip() for line in text.splitlines() if line.strip()]


def _decode_last_json_dict(payload: bytes) -> dict[str, Any] | None:
    for line in reversed(_decode_lines(payload)):
        try:
            data = json.loads(line)
        except Exception:
            continue
        if isinstance(data, dict):
            return data
    return None


def _parse_worker_failure(stderr: bytes, *, default_code: str) -> LoaderFailure:
    lines = _decode_lines(stderr)
    json_payload = _decode_last_json_dict(stderr)
    if json_payload is not None:
        return LoaderFailure.from_dict(json_payload)
    if lines:
        return LoaderFailure(code=default_code, message=lines[-1])
    return LoaderFailure(code=default_code, message=default_code)


@dataclass(slots=True)
class QuantizeProcessHandle:
    """Handle for a running quantize child process."""

    proc: asyncio.subprocess.Process
    _communicate_task: asyncio.Task[tuple[bytes, bytes]]
    _cancel_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    @property
    def pid(self) -> int | None:
        return self.proc.pid

    def _signal_process_group(self, sig: int) -> bool:
        if os.name == "nt" or not hasattr(os, "killpg"):
            return False
        pid = self.proc.pid
        if pid is None or pid <= 0:
            return False
        try:
            os.killpg(pid, sig)
            return True
        except ProcessLookupError:
            return True
        except PermissionError:
            return False
        except Exception:
            return False

    async def cancel(self, *, grace_sec: float = 5.0, kill_timeout_sec: float = 2.0) -> bool:
        """Terminate child process with kill escalation. Returns True when process exits."""
        async with self._cancel_lock:
            if self.proc.returncode is not None:
                return True

            if not self._signal_process_group(signal.SIGTERM):
                with contextlib.suppress(ProcessLookupError):
                    self.proc.terminate()
            try:
                await asyncio.wait_for(self.proc.wait(), timeout=grace_sec)
                return True
            except TimeoutError:
                if not self._signal_process_group(signal.SIGKILL):
                    with contextlib.suppress(ProcessLookupError):
                        self.proc.kill()
                try:
                    await asyncio.wait_for(self.proc.wait(), timeout=kill_timeout_sec)
                    return True
                except TimeoutError:
                    return False

    async def wait_outcome(self, *, timeout_sec: float | None = None) -> QuantizeSupervisorOutcome:
        """Wait for process completion and parse worker result/failure payloads."""
        try:
            if timeout_sec is not None:
                stdout, stderr = await asyncio.wait_for(self._communicate_task, timeout=timeout_sec)
            else:
                stdout, stderr = await self._communicate_task
        except TimeoutError:
            await self.cancel()
            return QuantizeSupervisorOutcome(
                ok=False,
                failure=LoaderFailure(
                    code="worker_timeout",
                    message=f"Quantize worker timed out after {timeout_sec}s",
                ),
            )

        rc = self.proc.returncode if self.proc.returncode is not None else 1
        if rc == 0:
            data = _decode_last_json_dict(stdout)
            if data is None:
                return QuantizeSupervisorOutcome(
                    ok=False,
                    failure=LoaderFailure(
                        code="worker_payload_invalid",
                        message="Worker produced no stdout payload",
                    ),
                )
            try:
                return QuantizeSupervisorOutcome(ok=True, result=QuantizeResult.from_dict(data))
            except Exception as exc:
                return QuantizeSupervisorOutcome(
                    ok=False,
                    failure=LoaderFailure(
                        code="worker_payload_invalid",
                        message=f"Invalid worker stdout payload: {exc}",
                    ),
                )

        if rc < 0:
            signal = abs(rc)
            return QuantizeSupervisorOutcome(
                ok=False,
                failure=LoaderFailure(
                    code="worker_crashed",
                    message=f"Child quantize worker crashed with signal {signal}",
                    signal=signal,
                ),
            )

        failure = _parse_worker_failure(stderr, default_code="worker_exit_nonzero")
        if failure.exit_code is None:
            failure.exit_code = rc
        return QuantizeSupervisorOutcome(ok=False, failure=failure)


async def spawn_quantize_process(
    spec: QuantizeSpec,
    *,
    python_executable: str | None = None,
    worker_module: str = "opta_lmx.runtime.child_quantize_worker",
) -> QuantizeProcessHandle:
    """Spawn quantize child worker process and return a handle for control + outcome."""
    executable = python_executable or sys.executable
    spawn_kwargs: dict[str, Any] = {}
    if os.name != "nt":
        spawn_kwargs["start_new_session"] = True
    proc = await asyncio.create_subprocess_exec(
        executable,
        "-m",
        worker_module,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        **spawn_kwargs,
    )
    payload = json.dumps(spec.to_dict(), sort_keys=True).encode("utf-8")
    communicate_task = asyncio.create_task(proc.communicate(payload))
    return QuantizeProcessHandle(proc=proc, _communicate_task=communicate_task)
