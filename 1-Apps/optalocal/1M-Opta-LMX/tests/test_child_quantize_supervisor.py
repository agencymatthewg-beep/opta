"""Tests for parent-side quantize child supervisor."""

from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest

from opta_lmx.runtime.child_quantize_supervisor import QuantizeProcessHandle, spawn_quantize_process
from opta_lmx.runtime.loader_protocol import QuantizeSpec


class _FakeProcess:
    def __init__(
        self,
        *,
        returncode: int | None = None,
        stdout: bytes = b"",
        stderr: bytes = b"",
        delay_sec: float = 0.0,
        wait_delay_sec: float = 0.0,
    ) -> None:
        self.returncode = returncode
        self._stdout = stdout
        self._stderr = stderr
        self._delay_sec = delay_sec
        self._wait_delay_sec = wait_delay_sec
        self.terminated = False
        self.killed = False
        self.pid = 9999

    async def communicate(self, _input: bytes | None = None) -> tuple[bytes, bytes]:
        if self._delay_sec > 0:
            await asyncio.sleep(self._delay_sec)
        return self._stdout, self._stderr

    def terminate(self) -> None:
        self.terminated = True

    def kill(self) -> None:
        self.killed = True

    async def wait(self) -> int:
        if self._wait_delay_sec > 0:
            await asyncio.sleep(self._wait_delay_sec)
        return 0 if self.returncode is None else self.returncode


@pytest.mark.asyncio
async def test_spawn_quantize_process_returns_handle(monkeypatch: pytest.MonkeyPatch) -> None:
    process = _FakeProcess()

    async def fake_create_subprocess_exec(*_args: Any, **_kwargs: Any) -> _FakeProcess:
        return process

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)
    spec = QuantizeSpec("job-1", "org/model", "/tmp/out", 4, 64, "affine")
    handle = await spawn_quantize_process(spec)
    assert handle.pid == 9999


@pytest.mark.asyncio
async def test_wait_outcome_success_parses_payload() -> None:
    payload = {"ok": True, "output_path": "/tmp/out", "output_size_bytes": 42}
    process = _FakeProcess(returncode=0, stdout=(json.dumps(payload) + "\n").encode("utf-8"))
    handle = QuantizeProcessHandle(
        proc=process,
        _communicate_task=asyncio.create_task(process.communicate()),
    )
    outcome = await handle.wait_outcome()
    assert outcome.ok is True
    assert outcome.result is not None
    assert outcome.result.output_size_bytes == 42


@pytest.mark.asyncio
async def test_cancel_escalates_terminate_then_kill_on_timeout() -> None:
    process = _FakeProcess(delay_sec=0.1, wait_delay_sec=0.1)
    handle = QuantizeProcessHandle(
        proc=process,
        _communicate_task=asyncio.create_task(process.communicate()),
    )
    cancelled = await handle.cancel(grace_sec=0.01, kill_timeout_sec=0.2)
    assert cancelled is True
    assert process.terminated is True
    assert process.killed is True
