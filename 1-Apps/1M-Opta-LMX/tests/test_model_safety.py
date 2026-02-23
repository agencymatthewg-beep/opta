"""Tests for compatibility registry query helpers."""

from __future__ import annotations

from pathlib import Path

from opta_lmx.model_safety import CompatibilityRegistry


def _registry(tmp_path: Path) -> CompatibilityRegistry:
    return CompatibilityRegistry(path=tmp_path / "compatibility-registry.json")


def test_compatibility_registry_query_filters_by_model_backend_outcome(
    tmp_path: Path,
) -> None:
    registry = _registry(tmp_path)

    registry.record(
        model_id="model-a",
        backend="vllm-mlx",
        backend_version_value="0.2.6",
        outcome="fail",
        reason="loader_crash:signal=6",
        metadata={},
    )
    registry.record(
        model_id="model-a",
        backend="mlx-lm",
        backend_version_value="0.30.7",
        outcome="pass",
        reason="canary_ok",
        metadata={},
    )
    registry.record(
        model_id="model-b",
        backend="vllm-mlx",
        backend_version_value="0.2.6",
        outcome="fail",
        reason="timeout",
        metadata={},
    )

    filtered = registry.list_records(model_id="model-a", backend="vllm-mlx", outcome="fail")
    assert len(filtered) == 1
    assert filtered[0]["model_id"] == "model-a"
    assert filtered[0]["backend"] == "vllm-mlx"
    assert filtered[0]["outcome"] == "fail"


def test_compatibility_registry_latest_returns_newest_record(tmp_path: Path) -> None:
    registry = _registry(tmp_path)

    registry.record(
        model_id="model-a",
        backend="vllm-mlx",
        backend_version_value="0.2.6",
        outcome="fail",
        reason="timeout",
        metadata={},
    )
    registry.record(
        model_id="model-a",
        backend="vllm-mlx",
        backend_version_value="0.2.6",
        outcome="pass",
        reason="canary_ok",
        metadata={},
    )

    latest = registry.latest_record("model-a", backend="vllm-mlx")
    assert latest is not None
    assert latest["outcome"] == "pass"
