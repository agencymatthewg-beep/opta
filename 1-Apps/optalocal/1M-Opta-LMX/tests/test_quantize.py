"""Tests for on-device model quantization manager (manager/quantize.py)."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from opta_lmx.inference.schema import QuantizeRequest
from opta_lmx.manager.quantize import (
    QuantizeJob,
    _do_quantize,
    _jobs,
    _process_handles,
    _run_quantize,
    cancel_quantize,
    get_job,
    list_jobs,
    start_quantize,
)
from opta_lmx.runtime.child_quantize_supervisor import QuantizeSupervisorOutcome
from opta_lmx.runtime.loader_protocol import LoaderFailure, QuantizeResult


class _NoopTask:
    def add_done_callback(self, _cb: object) -> None:  # pragma: no cover - no-op for tests
        return None

    def done(self) -> bool:
        return False

    def cancel(self) -> None:
        return None


def _stub_create_task(coro: object) -> _NoopTask:
    # start_quantize schedules background work; tests patch create_task to avoid execution.
    close = getattr(coro, "close", None)
    if callable(close):
        close()
    return _NoopTask()


# ─── QuantizeJob dataclass ────────────────────────────────────────────────────


class TestQuantizeJob:
    def test_defaults(self) -> None:
        job = QuantizeJob(
            job_id="abc123",
            source_model="org/model",
            output_path="/tmp/out",
        )
        assert job.bits == 4
        assert job.group_size == 64
        assert job.mode == "affine"
        assert job.status == "pending"
        assert job.started_at == 0.0
        assert job.completed_at == 0.0
        assert job.error is None
        assert job.output_size_bytes == 0

    def test_custom_fields(self) -> None:
        job = QuantizeJob(
            job_id="x",
            source_model="m",
            output_path="/out",
            bits=8,
            group_size=32,
            mode="mxfp4",
            status="running",
            started_at=100.0,
        )
        assert job.bits == 8
        assert job.group_size == 32
        assert job.mode == "mxfp4"
        assert job.status == "running"

    def test_status_transitions(self) -> None:
        job = QuantizeJob(job_id="j", source_model="m", output_path="/o")
        assert job.status == "pending"
        job.status = "running"
        assert job.status == "running"
        job.status = "completed"
        assert job.status == "completed"

    def test_error_field(self) -> None:
        job = QuantizeJob(
            job_id="j",
            source_model="m",
            output_path="/o",
            status="failed",
            error="OOM",
        )
        assert job.error == "OOM"


# ─── _do_quantize ─────────────────────────────────────────────────────────────


class TestDoQuantize:
    def test_raises_if_output_exists(self, tmp_path: Path) -> None:
        out = tmp_path / "existing"
        out.mkdir()
        with pytest.raises(FileExistsError, match="already exists"):
            _do_quantize("org/model", str(out), 4, 64, "affine")

    def test_calls_convert_with_correct_args(self, tmp_path: Path) -> None:
        out = tmp_path / "output"
        mock_convert = MagicMock()

        def fake_convert(**kwargs: object) -> None:
            Path(kwargs["mlx_path"]).mkdir(parents=True)
            (Path(kwargs["mlx_path"]) / "weights.bin").write_bytes(b"x" * 100)

        mock_convert.side_effect = fake_convert
        mock_mlx_lm = MagicMock()
        mock_mlx_lm.convert = mock_convert

        with patch.dict("sys.modules", {"mlx_lm": mock_mlx_lm}):
            size = _do_quantize("org/model", str(out), 4, 64, "affine")

        mock_convert.assert_called_once_with(
            hf_path="org/model",
            mlx_path=str(out),
            quantize=True,
            q_bits=4,
            q_group_size=64,
            q_mode="affine",
        )
        assert size == 100

    def test_creates_output_parent_directory(self, tmp_path: Path) -> None:
        out = tmp_path / "missing-parent" / "output"
        mock_convert = MagicMock()

        def fake_convert(**kwargs: object) -> None:
            p = Path(kwargs["mlx_path"])
            p.mkdir(parents=True)
            (p / "weights.bin").write_bytes(b"x")

        mock_convert.side_effect = fake_convert
        mock_mlx_lm = MagicMock()
        mock_mlx_lm.convert = mock_convert

        with patch.dict("sys.modules", {"mlx_lm": mock_mlx_lm}):
            _do_quantize("org/model", str(out), 4, 64, "affine")

        assert (tmp_path / "missing-parent").exists()

    def test_calculates_output_size(self, tmp_path: Path) -> None:
        out = tmp_path / "sized"
        mock_convert = MagicMock()

        def fake_convert(**kwargs: object) -> None:
            p = Path(kwargs["mlx_path"])
            p.mkdir(parents=True)
            (p / "weights.safetensors").write_bytes(b"a" * 500)
            (p / "config.json").write_bytes(b"b" * 50)
            sub = p / "subdir"
            sub.mkdir()
            (sub / "nested.bin").write_bytes(b"c" * 200)

        mock_convert.side_effect = fake_convert
        mock_mlx_lm = MagicMock()
        mock_mlx_lm.convert = mock_convert

        with patch.dict("sys.modules", {"mlx_lm": mock_mlx_lm}):
            size = _do_quantize("org/model", str(out), 8, 32, "mxfp8")

        assert size == 500 + 50 + 200


# ─── get_job / list_jobs ──────────────────────────────────────────────────────


class TestJobRegistry:
    def setup_method(self) -> None:
        _jobs.clear()
        _process_handles.clear()

    def teardown_method(self) -> None:
        _jobs.clear()
        _process_handles.clear()

    def test_get_job_not_found(self) -> None:
        assert get_job("nonexistent") is None

    def test_get_job_found(self) -> None:
        job = QuantizeJob(job_id="abc", source_model="m", output_path="/o")
        _jobs["abc"] = job
        assert get_job("abc") is job

    def test_list_jobs_empty(self) -> None:
        assert list_jobs() == []

    def test_list_jobs_ordered_by_most_recent(self) -> None:
        j1 = QuantizeJob(
            job_id="old", source_model="m1", output_path="/o1", started_at=100.0
        )
        j2 = QuantizeJob(
            job_id="new", source_model="m2", output_path="/o2", started_at=200.0
        )
        _jobs["old"] = j1
        _jobs["new"] = j2
        result = list_jobs()
        assert len(result) == 2
        assert result[0].job_id == "new"
        assert result[1].job_id == "old"


# ─── start_quantize ──────────────────────────────────────────────────────────


class TestStartQuantize:
    def setup_method(self) -> None:
        _jobs.clear()
        _process_handles.clear()

    def teardown_method(self) -> None:
        _jobs.clear()
        _process_handles.clear()

    @pytest.mark.asyncio
    async def test_creates_job_with_queued_status(self) -> None:
        with patch("opta_lmx.manager.quantize.asyncio.create_task", side_effect=_stub_create_task):
            job = await start_quantize("org/model", "/tmp/out")
        assert job.status == "queued"
        assert job.source_model == "org/model"
        assert job.output_path == "/tmp/out"
        assert job.started_at > 0

    @pytest.mark.asyncio
    async def test_registers_job(self) -> None:
        with patch("opta_lmx.manager.quantize.asyncio.create_task", side_effect=_stub_create_task):
            job = await start_quantize("org/model", "/tmp/out")
        assert get_job(job.job_id) is job

    @pytest.mark.asyncio
    async def test_auto_generates_output_path(self) -> None:
        with patch("opta_lmx.manager.quantize.asyncio.create_task", side_effect=_stub_create_task):
            job = await start_quantize("org/my-model")
        assert "org--my-model-4bit" in job.output_path

    @pytest.mark.asyncio
    async def test_custom_bits_and_group_size(self) -> None:
        with patch("opta_lmx.manager.quantize.asyncio.create_task", side_effect=_stub_create_task):
            job = await start_quantize("m", "/tmp/o", bits=8, group_size=32, mode="mxfp8")
        assert job.bits == 8
        assert job.group_size == 32
        assert job.mode == "mxfp8"

    @pytest.mark.asyncio
    async def test_unique_job_ids(self) -> None:
        with patch("opta_lmx.manager.quantize.asyncio.create_task", side_effect=_stub_create_task):
            j1 = await start_quantize("m", "/tmp/o1")
            j2 = await start_quantize("m", "/tmp/o2")
        assert j1.job_id != j2.job_id

    @pytest.mark.asyncio
    async def test_rejects_unsupported_bits_for_mode(self) -> None:
        with (
            patch("opta_lmx.manager.quantize.asyncio.create_task", side_effect=_stub_create_task),
            pytest.raises(ValueError, match="bits=8 is not supported for mode='mxfp4'"),
        ):
            await start_quantize("m", "/tmp/o", bits=8, group_size=32, mode="mxfp4")

    @pytest.mark.asyncio
    async def test_rejects_unsupported_group_size_for_mode(self) -> None:
        with (
            patch("opta_lmx.manager.quantize.asyncio.create_task", side_effect=_stub_create_task),
            pytest.raises(
                ValueError,
                match="group_size=64 is not supported for mode='nvfp4'",
            ),
        ):
            await start_quantize("m", "/tmp/o", bits=4, group_size=64, mode="nvfp4")


class TestQuantizeRequestValidation:
    def test_affine_accepts_extended_bit_widths(self) -> None:
        req = QuantizeRequest(
            source_model="org/model",
            bits=6,
            group_size=128,
            mode="affine",
        )
        assert req.bits == 6
        assert req.group_size == 128
        assert req.mode == "affine"

    def test_mode_is_normalized_to_lowercase(self) -> None:
        req = QuantizeRequest(
            source_model="org/model",
            bits=4,
            group_size=32,
            mode="MXFP4",
        )
        assert req.mode == "mxfp4"

    def test_rejects_invalid_mode_specific_bits(self) -> None:
        with pytest.raises(
            ValidationError,
            match="bits=8 is not supported for mode='mxfp4'",
        ):
            QuantizeRequest(
                source_model="org/model",
                bits=8,
                group_size=32,
                mode="mxfp4",
            )

    def test_rejects_invalid_mode_specific_group_size(self) -> None:
        with pytest.raises(
            ValidationError,
            match="group_size=64 is not supported for mode='nvfp4'",
        ):
            QuantizeRequest(
                source_model="org/model",
                bits=4,
                group_size=64,
                mode="nvfp4",
            )


# ─── _run_quantize ───────────────────────────────────────────────────────────


class _AwaitableNone:
    def __await__(self):
        if False:  # pragma: no cover
            yield
        return None


class _PublishSpy:
    def __init__(self) -> None:
        self.calls: list[tuple[tuple[object, ...], dict[str, object]]] = []

    def __call__(self, *args: object, **kwargs: object) -> _AwaitableNone:
        self.calls.append((args, kwargs))
        return _AwaitableNone()


class _EventBusSpy:
    def __init__(self) -> None:
        self.publish = _PublishSpy()


def _extract_event(
    call: tuple[tuple[object, ...], dict[str, object]],
) -> tuple[str, dict[str, object]]:
    args, kwargs = call
    assert kwargs == {}
    if len(args) == 1 and hasattr(args[0], "event_type") and hasattr(args[0], "data"):
        event = args[0]
        event_type = event.event_type  # type: ignore[attr-defined]
        data = event.data  # type: ignore[attr-defined]
        assert isinstance(event_type, str)
        assert isinstance(data, dict)
        return event_type, data

    assert len(args) == 2
    event_type, data = args
    assert isinstance(event_type, str)
    assert isinstance(data, dict)
    return event_type, data


class TestRunQuantize:
    @pytest.mark.asyncio
    async def test_success_updates_job_and_publishes_events(self) -> None:
        job = QuantizeJob(
            job_id="job-1",
            source_model="org/model",
            output_path="/tmp/out",
            bits=8,
            group_size=32,
            mode="mxfp8",
            status="queued",
            started_at=10.0,
        )
        fake_handle = MagicMock()
        fake_handle.pid = 1234
        fake_handle.wait_outcome = AsyncMock(return_value=QuantizeSupervisorOutcome(
            ok=True,
            result=QuantizeResult(ok=True, output_path="/tmp/out", output_size_bytes=321),
        ))
        event_bus = _EventBusSpy()

        with (
            patch(
                "opta_lmx.manager.quantize.spawn_quantize_process",
                new=AsyncMock(return_value=fake_handle),
            ),
            patch("opta_lmx.manager.quantize.time.time", return_value=25.0),
        ):
            await _run_quantize(job, event_bus=event_bus)

        assert job.status == "completed"
        assert job.output_size_bytes == 321
        assert job.completed_at == 25.0
        assert job.error is None
        assert job.failure_code is None
        assert job.worker_pid is None

        events = [_extract_event(call) for call in event_bus.publish.calls]
        assert events == [
            (
                "quantize_progress",
                {"model_id": "org/model", "status": "quantizing", "percent": 0},
            ),
            (
                "quantize_progress",
                {"model_id": "org/model", "status": "completed", "percent": 100},
            ),
        ]

    @pytest.mark.asyncio
    async def test_failure_updates_job_and_publishes_failure_event(self) -> None:
        job = QuantizeJob(
            job_id="job-2",
            source_model="org/fail-model",
            output_path="/tmp/out-fail",
            status="queued",
            started_at=3.0,
        )
        fake_handle = MagicMock()
        fake_handle.pid = 777
        fake_handle.wait_outcome = AsyncMock(return_value=QuantizeSupervisorOutcome(
            ok=False,
            failure=LoaderFailure(code="worker_exit_nonzero", message="boom", exit_code=1),
        ))
        event_bus = _EventBusSpy()

        with (
            patch(
                "opta_lmx.manager.quantize.spawn_quantize_process",
                new=AsyncMock(return_value=fake_handle),
            ),
            patch("opta_lmx.manager.quantize.time.time", return_value=9.5),
        ):
            await _run_quantize(job, event_bus=event_bus)

        assert job.status == "failed"
        assert job.completed_at == 9.5
        assert job.error == "boom"
        assert job.failure_code == "worker_exit_nonzero"
        assert job.exit_code == 1
        assert job.output_size_bytes == 0

        events = [_extract_event(call) for call in event_bus.publish.calls]
        assert len(events) == 2
        assert events[0] == (
            "quantize_progress",
            {"model_id": "org/fail-model", "status": "quantizing", "percent": 0},
        )
        assert events[1][0] == "quantize_progress"
        assert events[1][1]["model_id"] == "org/fail-model"
        assert events[1][1]["percent"] == 0
        assert isinstance(events[1][1]["status"], str)
        assert "failed:" in str(events[1][1]["status"])
        assert "boom" in str(events[1][1]["status"])


class _FakeTask:
    def __init__(self) -> None:
        self._done = False
        self.cancelled = False

    def add_done_callback(self, _cb: object) -> None:  # pragma: no cover - no-op for tests
        return None

    def done(self) -> bool:
        return self._done

    def cancel(self) -> None:
        self.cancelled = True


class TestCancelQuantize:
    def setup_method(self) -> None:
        _jobs.clear()
        _process_handles.clear()

    def teardown_method(self) -> None:
        _jobs.clear()
        _process_handles.clear()

    @pytest.mark.asyncio
    async def test_cancel_unknown_job_returns_not_found(self) -> None:
        cancelled, reason, job = await cancel_quantize("missing")
        assert cancelled is False
        assert reason == "not_found"
        assert job is None

    @pytest.mark.asyncio
    async def test_cancel_running_job_sets_cancel_requested(self) -> None:
        job = QuantizeJob(
            job_id="run-1",
            source_model="org/model",
            output_path="/tmp/out",
            status="running",
            started_at=1.0,
        )
        _jobs[job.job_id] = job
        fake_handle = MagicMock()
        fake_handle.cancel = AsyncMock(return_value=True)
        _process_handles[job.job_id] = fake_handle
        cancelled, reason, returned = await cancel_quantize(job.job_id)
        await asyncio.sleep(0)
        assert cancelled is False
        assert reason == "cancelling"
        assert returned is job
        assert job.cancel_requested is True
        assert job.status == "cancelling"
        fake_handle.cancel.assert_awaited()

    @pytest.mark.asyncio
    async def test_cancel_queued_job_marks_cancelled(self) -> None:
        fake_task = _FakeTask()
        def _create_task_and_close(coro: object) -> _FakeTask:
            close = getattr(coro, "close", None)
            if callable(close):
                close()
            return fake_task

        with patch(
            "opta_lmx.manager.quantize.asyncio.create_task",
            side_effect=_create_task_and_close,
        ):
            job = await start_quantize("org/model", "/tmp/out")

        event_bus = _EventBusSpy()
        cancelled, reason, returned = await cancel_quantize(job.job_id, event_bus=event_bus)
        assert cancelled is True
        assert reason == "cancelled"
        assert returned is job
        assert job.status == "cancelled"
        assert job.cancel_requested is True
        assert "Cancelled by user" in str(job.error)
        assert fake_task.cancelled is True

        events = [_extract_event(call) for call in event_bus.publish.calls]
        assert events[-1] == (
            "quantize_progress",
            {"model_id": "org/model", "status": "cancelled", "percent": 0},
        )
