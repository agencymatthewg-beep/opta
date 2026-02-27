"""Tests for parent-side child loader supervisor."""

from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest

from opta_lmx.runtime.child_loader_supervisor import run_loader_supervisor
from opta_lmx.runtime.loader_protocol import LoadResult, LoadSpec


class _FakeProcess:
    def __init__(
        self,
        *,
        returncode: int = 0,
        stdout: bytes = b"",
        stderr: bytes = b"",
        delay_sec: float = 0.0,
    ) -> None:
        self.returncode = returncode
        self._stdout = stdout
        self._stderr = stderr
        self._delay_sec = delay_sec
        self.terminated = False
        self.killed = False

    async def communicate(self, _input: bytes | None = None) -> tuple[bytes, bytes]:
        if self._delay_sec > 0:
            await asyncio.sleep(self._delay_sec)
        return self._stdout, self._stderr

    def terminate(self) -> None:
        self.terminated = True

    def kill(self) -> None:
        self.killed = True

    async def wait(self) -> int:
        return self.returncode


@pytest.mark.asyncio
async def test_supervisor_times_out_and_returns_model_load_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    process = _FakeProcess(delay_sec=0.1)

    async def fake_create_subprocess_exec(*_args: Any, **_kwargs: Any) -> _FakeProcess:
        return process

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)
    spec = LoadSpec("test/model", "vllm-mlx", True, {})
    outcome = await run_loader_supervisor(spec, timeout_sec=0.01)
    assert outcome.ok is False
    assert outcome.failure is not None
    assert outcome.failure.code == "model_load_timeout"
    assert process.terminated or process.killed


@pytest.mark.asyncio
async def test_supervisor_maps_exit_signal_to_model_loader_crashed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    process = _FakeProcess(returncode=-6, stdout=b"", stderr=b"")

    async def fake_create_subprocess_exec(*_args: Any, **_kwargs: Any) -> _FakeProcess:
        return process

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)
    spec = LoadSpec("test/model", "vllm-mlx", True, {})
    outcome = await run_loader_supervisor(spec, timeout_sec=1.0)
    assert outcome.ok is False
    assert outcome.failure is not None
    assert outcome.failure.code == "model_loader_crashed"
    assert outcome.failure.signal == 6


@pytest.mark.asyncio
async def test_supervisor_returns_ok_result_when_worker_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = LoadResult(ok=True, backend="vllm-mlx", telemetry={"canary": "ok"}).to_dict()
    process = _FakeProcess(returncode=0, stdout=(json.dumps(payload) + "\n").encode("utf-8"))

    async def fake_create_subprocess_exec(*_args: Any, **_kwargs: Any) -> _FakeProcess:
        return process

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)
    spec = LoadSpec("test/model", "vllm-mlx", True, {})
    outcome = await run_loader_supervisor(spec, timeout_sec=1.0)
    assert outcome.ok is True
    assert outcome.result is not None
    assert outcome.result.backend == "vllm-mlx"
    assert outcome.result.telemetry["canary"] == "ok"
