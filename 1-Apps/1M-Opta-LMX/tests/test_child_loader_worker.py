"""Tests for isolated child loader worker behavior."""

from __future__ import annotations

import pytest

from opta_lmx.runtime.child_loader_worker import LoaderWorkerError, execute_load_spec
from opta_lmx.runtime.loader_protocol import LoadSpec


@pytest.mark.asyncio
async def test_worker_returns_structured_failure_on_invalid_backend() -> None:
    spec = LoadSpec(
        model_id="test/model",
        backend="invalid-backend",
        use_batching=True,
        performance_overrides={},
    )

    with pytest.raises(LoaderWorkerError) as exc_info:
        await execute_load_spec(spec)

    failure = exc_info.value.failure
    assert failure.code == "model_probe_failed"
    assert "unsupported backend" in failure.message.lower()
    assert failure.metadata["backend"] == "invalid-backend"


@pytest.mark.asyncio
async def test_worker_returns_success_for_mocked_backend_constructor() -> None:
    spec = LoadSpec(
        model_id="test/model",
        backend="vllm-mlx",
        use_batching=False,
        performance_overrides={"kv_bits": 8},
    )

    async def fake_probe(load_spec: LoadSpec) -> dict[str, object]:
        assert load_spec.model_id == "test/model"
        assert load_spec.backend == "vllm-mlx"
        return {"canary": "ok", "backend_created": True}

    result = await execute_load_spec(spec, backend_probes={"vllm-mlx": fake_probe})
    assert result.ok is True
    assert result.backend == "vllm-mlx"
    assert result.telemetry["canary"] == "ok"
