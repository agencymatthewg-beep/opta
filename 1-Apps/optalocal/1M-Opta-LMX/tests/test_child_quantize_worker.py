"""Tests for isolated child quantize worker behavior."""

from __future__ import annotations

from pathlib import Path

import pytest

from opta_lmx.runtime.child_quantize_worker import QuantizeWorkerError, execute_quantize_spec
from opta_lmx.runtime.loader_protocol import QuantizeSpec


@pytest.mark.asyncio
async def test_worker_success_returns_size(tmp_path: Path) -> None:
    out = tmp_path / "model"
    spec = QuantizeSpec(
        job_id="job-1",
        source_model="org/model",
        output_path=str(out),
        bits=4,
        group_size=64,
        mode="affine",
    )

    async def fake_convert(_: QuantizeSpec) -> int:
        out.mkdir(parents=True)
        (out / "weights.bin").write_bytes(b"x" * 10)
        return 10

    result = await execute_quantize_spec(spec, quantize_impl=fake_convert)
    assert result.ok is True
    assert result.output_size_bytes == 10
    assert result.output_path == str(out)


@pytest.mark.asyncio
async def test_worker_returns_structured_failure_for_existing_output(tmp_path: Path) -> None:
    out = tmp_path / "existing"
    out.mkdir()
    spec = QuantizeSpec(
        job_id="job-2",
        source_model="org/model",
        output_path=str(out),
        bits=4,
        group_size=64,
        mode="affine",
    )

    async def fake_convert(_: QuantizeSpec) -> int:
        raise FileExistsError(f"Output path already exists: {out}")

    with pytest.raises(QuantizeWorkerError) as exc_info:
        await execute_quantize_spec(spec, quantize_impl=fake_convert)

    failure = exc_info.value.failure
    assert failure.code == "output_path_exists"
    assert "already exists" in failure.message

