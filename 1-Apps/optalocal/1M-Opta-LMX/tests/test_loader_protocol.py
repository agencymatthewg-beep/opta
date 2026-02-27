"""Tests for child loader IPC protocol payload types."""

from __future__ import annotations

from opta_lmx.runtime.loader_protocol import LoaderFailure, LoadResult, LoadSpec


def test_load_spec_roundtrip_payload() -> None:
    spec = LoadSpec(
        model_id="inferencerlabs/GLM-5-MLX-4.8bit",
        backend="vllm-mlx",
        use_batching=True,
        performance_overrides={"kv_bits": 8},
        probe_only=True,
    )

    restored = LoadSpec.from_dict(spec.to_dict())
    assert restored == spec


def test_load_result_roundtrip_payload() -> None:
    result = LoadResult(
        ok=True,
        backend="mlx-lm",
        reason=None,
        telemetry={"ttft_ms": 123.4},
    )

    restored = LoadResult.from_dict(result.to_dict())
    assert restored == result


def test_loader_failure_roundtrip_payload() -> None:
    failure = LoaderFailure(
        code="model_loader_crashed",
        message="child exited with signal 6",
        exit_code=134,
        signal=6,
        metadata={"stderr": "abort"},
    )

    restored = LoaderFailure.from_dict(failure.to_dict())
    assert restored == failure
