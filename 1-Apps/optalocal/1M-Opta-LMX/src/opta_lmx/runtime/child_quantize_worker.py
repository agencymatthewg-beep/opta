"""Isolated child-process worker for model quantization."""

from __future__ import annotations

import asyncio
import json
import shutil
import sys
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from opta_lmx.manager.quantize import validate_quantize_settings
from opta_lmx.runtime.loader_protocol import LoaderFailure, QuantizeResult, QuantizeSpec

QuantizeImpl = Callable[[QuantizeSpec], Awaitable[int]]


class QuantizeWorkerError(Exception):
    """Structured worker error carrying a failure payload for stderr emission."""

    def __init__(self, failure: LoaderFailure) -> None:
        super().__init__(failure.message)
        self.failure = failure


def _sync_quantize(spec: QuantizeSpec) -> int:
    bits, group_size, mode = validate_quantize_settings(spec.bits, spec.group_size, spec.mode)
    out = Path(spec.output_path)
    if out.exists():
        raise FileExistsError(f"Output path already exists: {spec.output_path}")

    out.parent.mkdir(parents=True, exist_ok=True)

    from mlx_lm import convert

    convert(
        hf_path=spec.source_model,
        mlx_path=str(out),
        quantize=True,
        q_bits=bits,
        q_group_size=group_size,
        q_mode=mode,
    )
    return sum(f.stat().st_size for f in out.rglob("*") if f.is_file())


async def _default_quantize_impl(spec: QuantizeSpec) -> int:
    return _sync_quantize(spec)


async def execute_quantize_spec(
    spec: QuantizeSpec,
    *,
    quantize_impl: QuantizeImpl | None = None,
) -> QuantizeResult:
    """Run quantization and return success payload or structured failure."""
    impl = quantize_impl or _default_quantize_impl
    try:
        size = await impl(spec)
    except FileExistsError as exc:
        raise QuantizeWorkerError(LoaderFailure(
            code="output_path_exists",
            message=str(exc),
            metadata={"output_path": spec.output_path},
        )) from exc
    except Exception as exc:
        # Best-effort cleanup for partially-written output on worker-side failures.
        out = Path(spec.output_path)
        if await asyncio.to_thread(out.exists):
            await asyncio.to_thread(lambda: shutil.rmtree(out, ignore_errors=True))
        raise QuantizeWorkerError(LoaderFailure(
            code="quantize_failed",
            message=str(exc) or exc.__class__.__name__,
            metadata={"output_path": spec.output_path, "source_model": spec.source_model},
        )) from exc

    return QuantizeResult(ok=True, output_path=spec.output_path, output_size_bytes=size)


def _write_json_line(stream: Any, payload: dict[str, Any]) -> None:
    stream.write(json.dumps(payload, sort_keys=True))
    stream.write("\n")
    stream.flush()


def _failure_for_exception(exc: Exception) -> LoaderFailure:
    if isinstance(exc, QuantizeWorkerError):
        return exc.failure
    return LoaderFailure(
        code="quantize_failed",
        message=str(exc) or exc.__class__.__name__,
        metadata={},
    )


def main() -> int:
    """Read one JSON QuantizeSpec payload from stdin and emit one JSON response line."""
    raw = sys.stdin.read()
    if not raw.strip():
        _write_json_line(sys.stderr, LoaderFailure(
            code="quantize_failed",
            message="missing_quantize_spec",
        ).to_dict())
        return 2

    try:
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError("quantize spec payload must be a JSON object")
        spec = QuantizeSpec.from_dict(payload)
        result = asyncio.run(execute_quantize_spec(spec))
    except Exception as exc:
        _write_json_line(sys.stderr, _failure_for_exception(exc).to_dict())
        return 1

    _write_json_line(sys.stdout, result.to_dict())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
