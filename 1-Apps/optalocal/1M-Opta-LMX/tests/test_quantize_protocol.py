"""Tests for quantization IPC protocol objects."""

from __future__ import annotations

from opta_lmx.runtime.loader_protocol import LoaderFailure, QuantizeResult, QuantizeSpec


def test_quantize_spec_round_trip() -> None:
    spec = QuantizeSpec(
        job_id="job-1",
        source_model="mlx-community/model",
        output_path="/tmp/out",
        bits=4,
        group_size=64,
        mode="affine",
    )
    assert QuantizeSpec.from_dict(spec.to_dict()) == spec


def test_quantize_result_round_trip() -> None:
    result = QuantizeResult(
        ok=True,
        output_path="/tmp/out",
        output_size_bytes=1234,
    )
    assert QuantizeResult.from_dict(result.to_dict()) == result


def test_loader_failure_parses_exit_code_and_signal() -> None:
    failure = LoaderFailure.from_dict(
        {
            "code": "worker_crashed",
            "message": "crashed",
            "exit_code": None,
            "signal": 6,
        }
    )
    assert failure.code == "worker_crashed"
    assert failure.signal == 6
    assert failure.exit_code is None
