"""Tests for parent-side quantize child supervisor."""

from __future__ import annotations

import asyncio
import json
import os
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
    captured_kwargs: dict[str, Any] = {}

    async def fake_create_subprocess_exec(*_args: Any, **_kwargs: Any) -> _FakeProcess:
        captured_kwargs.update(_kwargs)
        return process

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)
    spec = QuantizeSpec("job-1", "org/model", "/tmp/out", 4, 64, "affine")
    handle = await spawn_quantize_process(spec)
    assert handle.pid == 9999
    if os.name == "nt":
        assert "start_new_session" not in captured_kwargs
    else:
        assert captured_kwargs.get("start_new_session") is True


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
async def test_wait_outcome_success_uses_last_json_line_when_noisy_stdout() -> None:
    payload = {"ok": True, "output_path": "/tmp/out", "output_size_bytes": 42}
    stdout = b"INFO converting...\n" + (json.dumps(payload) + "\n").encode("utf-8")
    process = _FakeProcess(returncode=0, stdout=stdout)
    handle = QuantizeProcessHandle(
        proc=process,
        _communicate_task=asyncio.create_task(process.communicate()),
    )
    outcome = await handle.wait_outcome()
    assert outcome.ok is True
    assert outcome.result is not None
    assert outcome.result.output_size_bytes == 42


@pytest.mark.asyncio
async def test_wait_outcome_failure_uses_last_json_line_when_noisy_stderr() -> None:
    structured = {"code": "worker_exit_nonzero", "message": "bad thing happened"}
    stderr = b"warning: noisy line\n" + (json.dumps(structured) + "\n").encode("utf-8")
    process = _FakeProcess(returncode=1, stderr=stderr)
    handle = QuantizeProcessHandle(
        proc=process,
        _communicate_task=asyncio.create_task(process.communicate()),
    )
    outcome = await handle.wait_outcome()
    assert outcome.ok is False
    assert outcome.failure is not None
    assert outcome.failure.code == "worker_exit_nonzero"
    assert "bad thing happened" in outcome.failure.message


@pytest.mark.asyncio
async def test_cancel_escalates_terminate_then_kill_on_timeout() -> None:
    process = _FakeProcess(delay_sec=0.1, wait_delay_sec=0.1)
    handle = QuantizeProcessHandle(
        proc=process,
        _communicate_task=asyncio.create_task(process.communicate()),
    )
    original = QuantizeProcessHandle._signal_process_group
    QuantizeProcessHandle._signal_process_group = lambda self, _sig: False  # type: ignore[assignment]
    try:
        cancelled = await handle.cancel(grace_sec=0.01, kill_timeout_sec=0.2)
    finally:
        QuantizeProcessHandle._signal_process_group = original
    assert cancelled is True
    assert process.terminated is True
    assert process.killed is True
