"""Tests for on-device model quantization manager (manager/quantize.py)."""

from __future__ import annotations

import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from opta_lmx.manager.quantize import (
    QuantizeJob,
    _do_quantize,
    _jobs,
    get_job,
    list_jobs,
    start_quantize,
)


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
            group_size=128,
            mode="mxfp4",
            status="running",
            started_at=100.0,
        )
        assert job.bits == 8
        assert job.group_size == 128
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

    @patch("mlx_lm.convert", create=True)
    def test_calls_convert_with_correct_args(
        self, mock_convert: MagicMock, tmp_path: Path
    ) -> None:
        out = tmp_path / "output"
        # Create a fake output after convert is called
        def fake_convert(**kwargs: object) -> None:
            Path(kwargs["mlx_path"]).mkdir(parents=True)
            (Path(kwargs["mlx_path"]) / "weights.bin").write_bytes(b"x" * 100)

        mock_convert.side_effect = fake_convert
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

    @patch("mlx_lm.convert", create=True)
    def test_calculates_output_size(
        self, mock_convert: MagicMock, tmp_path: Path
    ) -> None:
        out = tmp_path / "sized"

        def fake_convert(**kwargs: object) -> None:
            p = Path(kwargs["mlx_path"])
            p.mkdir(parents=True)
            (p / "weights.safetensors").write_bytes(b"a" * 500)
            (p / "config.json").write_bytes(b"b" * 50)
            sub = p / "subdir"
            sub.mkdir()
            (sub / "nested.bin").write_bytes(b"c" * 200)

        mock_convert.side_effect = fake_convert
        size = _do_quantize("org/model", str(out), 8, 128, "mxfp8")
        assert size == 500 + 50 + 200


# ─── get_job / list_jobs ──────────────────────────────────────────────────────


class TestJobRegistry:
    def setup_method(self) -> None:
        _jobs.clear()

    def teardown_method(self) -> None:
        _jobs.clear()

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

    def teardown_method(self) -> None:
        _jobs.clear()

    @pytest.mark.asyncio
    @patch("opta_lmx.manager.quantize._do_quantize", return_value=0)
    async def test_creates_job_with_running_status(
        self, mock_quant: MagicMock
    ) -> None:
        job = await start_quantize("org/model", "/tmp/out")
        assert job.status == "running"
        assert job.source_model == "org/model"
        assert job.output_path == "/tmp/out"
        assert job.started_at > 0

    @pytest.mark.asyncio
    @patch("opta_lmx.manager.quantize._do_quantize", return_value=0)
    async def test_registers_job(self, mock_quant: MagicMock) -> None:
        job = await start_quantize("org/model", "/tmp/out")
        assert get_job(job.job_id) is job

    @pytest.mark.asyncio
    @patch("opta_lmx.manager.quantize._do_quantize", return_value=0)
    async def test_auto_generates_output_path(self, mock_quant: MagicMock) -> None:
        job = await start_quantize("org/my-model")
        assert "org--my-model-4bit" in job.output_path

    @pytest.mark.asyncio
    @patch("opta_lmx.manager.quantize._do_quantize", return_value=0)
    async def test_custom_bits_and_group_size(self, mock_quant: MagicMock) -> None:
        job = await start_quantize("m", "/tmp/o", bits=8, group_size=128, mode="mxfp8")
        assert job.bits == 8
        assert job.group_size == 128
        assert job.mode == "mxfp8"

    @pytest.mark.asyncio
    @patch("opta_lmx.manager.quantize._do_quantize", return_value=0)
    async def test_unique_job_ids(self, mock_quant: MagicMock) -> None:
        j1 = await start_quantize("m", "/tmp/o1")
        j2 = await start_quantize("m", "/tmp/o2")
        assert j1.job_id != j2.job_id
