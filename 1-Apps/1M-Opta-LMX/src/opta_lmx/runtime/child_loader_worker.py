"""Isolated child-process worker for backend load probing."""

from __future__ import annotations

import asyncio
import json
import sys
from collections.abc import Awaitable, Callable, Mapping
from typing import Any

from opta_lmx.model_safety import ErrorCodes
from opta_lmx.runtime.loader_protocol import LoadResult, LoadSpec, LoaderFailure

BackendProbe = Callable[[LoadSpec], Awaitable[dict[str, Any]]]


class LoaderWorkerError(Exception):
    """Structured worker error carrying a failure payload for stderr emission."""

    def __init__(self, failure: LoaderFailure) -> None:
        super().__init__(failure.message)
        self.failure = failure


async def _probe_vllm_mlx(spec: LoadSpec) -> dict[str, Any]:
    if not spec.model_id.strip():
        raise ValueError("model_id is required")
    return {"probe": "ok", "backend": "vllm-mlx", "canary": "ok"}


async def _probe_mlx_lm(spec: LoadSpec) -> dict[str, Any]:
    if not spec.model_id.strip():
        raise ValueError("model_id is required")
    return {"probe": "ok", "backend": "mlx-lm", "canary": "ok"}


async def _probe_gguf(spec: LoadSpec) -> dict[str, Any]:
    if not spec.model_id.strip():
        raise ValueError("model_id is required")
    return {"probe": "ok", "backend": "gguf", "canary": "ok"}


def _default_backend_probes() -> dict[str, BackendProbe]:
    return {
        "vllm-mlx": _probe_vllm_mlx,
        "mlx-lm": _probe_mlx_lm,
        "gguf": _probe_gguf,
    }


async def execute_load_spec(
    spec: LoadSpec,
    *,
    backend_probes: Mapping[str, BackendProbe] | None = None,
) -> LoadResult:
    """Run one backend probe and return success payload or structured failure."""
    probes = dict(backend_probes) if backend_probes is not None else _default_backend_probes()
    probe = probes.get(spec.backend)
    if probe is None:
        raise LoaderWorkerError(LoaderFailure(
            code=ErrorCodes.MODEL_PROBE_FAILED,
            message=f"Unsupported backend '{spec.backend}'",
            metadata={"backend": spec.backend, "model_id": spec.model_id},
        ))

    try:
        telemetry = await probe(spec)
    except LoaderWorkerError:
        raise
    except Exception as exc:
        raise LoaderWorkerError(LoaderFailure(
            code=ErrorCodes.MODEL_PROBE_FAILED,
            message=f"Probe failed for backend '{spec.backend}': {exc}",
            metadata={"backend": spec.backend, "model_id": spec.model_id},
        )) from exc

    return LoadResult(ok=True, backend=spec.backend, telemetry=telemetry)


def _write_json_line(stream: Any, payload: dict[str, Any]) -> None:
    stream.write(json.dumps(payload, sort_keys=True))
    stream.write("\n")
    stream.flush()


def _failure_for_exception(exc: Exception) -> LoaderFailure:
    if isinstance(exc, LoaderWorkerError):
        return exc.failure
    return LoaderFailure(
        code=ErrorCodes.MODEL_PROBE_FAILED,
        message=str(exc) or exc.__class__.__name__,
        metadata={},
    )


def main() -> int:
    """Read one JSON LoadSpec payload from stdin and emit one JSON response line."""
    raw = sys.stdin.read()
    if not raw.strip():
        _write_json_line(sys.stderr, LoaderFailure(
            code=ErrorCodes.MODEL_PROBE_FAILED,
            message="missing_load_spec",
        ).to_dict())
        return 2

    try:
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError("load spec payload must be a JSON object")
        spec = LoadSpec.from_dict(payload)
        result = asyncio.run(execute_load_spec(spec))
    except Exception as exc:
        _write_json_line(sys.stderr, _failure_for_exception(exc).to_dict())
        return 1

    _write_json_line(sys.stdout, result.to_dict())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

