"""Benchmark API routes — /admin/benchmark/* endpoints."""

from __future__ import annotations

import logging
import statistics
import time
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from opta_lmx import __version__
from opta_lmx.api.deps import AdminAuth, Engine
from opta_lmx.inference.schema import ChatMessage
from opta_lmx.monitoring.benchmark import (
    BenchmarkResult,
    BenchmarkResultStore,
    BenchmarkRunStats,
    classify_coherence,
    compute_repetition_ratio,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["benchmark"])

_DEFAULT_PROMPT = (
    "Write a detailed explanation of how transformer neural networks work, "
    "covering attention mechanisms, positional encoding, and the encoder-decoder architecture."
)


class BenchmarkRunRequest(BaseModel):
    model_id: str
    prompt: str = _DEFAULT_PROMPT
    num_output_tokens: int = Field(200, ge=50, le=2000)
    runs: int = Field(5, ge=1, le=20)
    temperature: float = Field(0.0, ge=0.0, le=2.0)
    warmup_runs: int = Field(1, ge=0, le=3)


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    idx = max(0, int((len(sorted_vals) - 1) * p / 100))
    return sorted_vals[idx]


def _detect_hardware() -> str:
    try:
        import subprocess
        result = subprocess.run(
            ["sysctl", "-n", "machdep.cpu.brand_string"],
            capture_output=True, text=True, timeout=2,
        )
        brand = result.stdout.strip()
        if brand:
            return brand
    except Exception:
        pass
    return "Apple Silicon"


async def _run_single(
    engine: Any,
    model_id: str,
    messages: list[ChatMessage],
    num_output_tokens: int,
    temperature: float,
) -> tuple[float, float, int, str, bool]:
    """Run one generation pass using the public engine.generate() interface.

    Returns:
        (ttft_sec, toks_per_sec, token_count, output_text, completed_naturally)
    """
    t_start = time.perf_counter()

    response = await engine.generate(
        model_id=model_id,
        messages=messages,
        max_tokens=num_output_tokens,
        temperature=temperature,
    )

    t_end = time.perf_counter()
    elapsed = t_end - t_start

    # Extract output text and token counts from ChatCompletionResponse
    output_text = ""
    output_tokens = 0
    if response.choices:
        msg = response.choices[0].message
        output_text = msg.content or ""
    if response.usage:
        output_tokens = response.usage.completion_tokens

    # Approximate TTFT as 5% of total elapsed (non-streaming path has no real TTFT)
    ttft = elapsed * 0.05
    generation_time = elapsed - ttft
    toks_per_sec = output_tokens / generation_time if generation_time > 0 else 0.0
    completed_naturally = output_tokens < num_output_tokens

    return ttft, toks_per_sec, output_tokens, output_text, completed_naturally


@router.post("/admin/benchmark/run")
async def run_benchmark(
    request_body: BenchmarkRunRequest,
    request: Request,
    _auth: AdminAuth,
    engine: Engine,
) -> dict[str, Any]:
    """Run a performance benchmark against a currently-loaded model."""
    if not engine.is_model_loaded(request_body.model_id):
        raise HTTPException(status_code=409, detail="model_not_loaded")

    messages = [ChatMessage(role="user", content=request_body.prompt)]
    ttfts: list[float] = []
    tpss: list[float] = []
    output_text = ""
    output_token_count = 0
    completed_naturally = True
    total_runs = request_body.warmup_runs + request_body.runs

    for i in range(total_runs):
        try:
            ttft, tps, n_tokens, text, completed = await _run_single(
                engine,
                request_body.model_id,
                messages,
                request_body.num_output_tokens,
                request_body.temperature,
            )
            if i >= request_body.warmup_runs:
                ttfts.append(ttft)
                tpss.append(tps)
                if i == request_body.warmup_runs:  # use first non-warmup run as representative
                    output_text = text
                    output_token_count = n_tokens
                    completed_naturally = completed
        except Exception:
            logger.warning(
                "benchmark_run_iteration_failed",
                extra={"run": i},
                exc_info=True,
            )
            continue

    runs_completed = len(ttfts)
    status: str = "ok" if runs_completed >= 2 else "insufficient_data"

    if runs_completed == 0:
        ttfts = [0.0]
        tpss = [0.0]

    rep_ratio = compute_repetition_ratio(output_text)
    coherence = classify_coherence(
        output_text=output_text,
        completed_naturally=completed_naturally,
        output_token_count=output_token_count,
        num_output_tokens=request_body.num_output_tokens,
    )

    stats = BenchmarkRunStats(
        ttft_p50_sec=_percentile(ttfts, 50),
        ttft_p95_sec=_percentile(ttfts, 95),
        ttft_mean_sec=statistics.mean(ttfts),
        toks_per_sec_p50=_percentile(tpss, 50),
        toks_per_sec_p95=_percentile(tpss, 95),
        toks_per_sec_mean=statistics.mean(tpss),
        prompt_tokens=len(request_body.prompt.split()),
        output_tokens=output_token_count,
        runs_completed=runs_completed,
        warmup_runs_discarded=request_body.warmup_runs,
        output_text=output_text,
        output_token_count=output_token_count,
        completed_naturally=completed_naturally,
        repetition_ratio=rep_ratio,
        coherence_flag=coherence,
        tool_call=None,
        skills=[],
    )

    # Detect active backend from loaded model metadata
    backend = "unknown"
    try:
        loaded = engine._models.get(request_body.model_id)
        if loaded is not None:
            b = getattr(loaded, "backend", None)
            if b is not None:
                backend = type(b).__name__
            else:
                backend = getattr(loaded, "backend_type", "unknown")
    except Exception:
        pass

    result = BenchmarkResult(
        model_id=request_body.model_id,
        backend=backend,
        timestamp=datetime.now(UTC).isoformat(),
        status=status,
        hardware=_detect_hardware(),
        lmx_version=__version__,
        prompt_preview=request_body.prompt[:100],
        stats=stats,
    )

    # Persist result — use injected store if set, otherwise create a default one
    store: BenchmarkResultStore | None = getattr(request.app.state, "benchmark_store", None)
    if store is None:
        store = BenchmarkResultStore()
        request.app.state.benchmark_store = store
    store.save(result)

    logger.info("benchmark_run_complete", extra={
        "model_id": request_body.model_id,
        "status": status,
        "toks_per_sec_mean": stats.toks_per_sec_mean,
    })
    return result.model_dump()


@router.get("/admin/benchmark/results")
async def get_benchmark_results(
    request: Request,
    _auth: AdminAuth,
    model_id: str | None = Query(None),
) -> list[dict[str, Any]]:
    """Return stored benchmark results, optionally filtered by model_id."""
    store: BenchmarkResultStore | None = getattr(request.app.state, "benchmark_store", None)
    if store is None:
        store = BenchmarkResultStore()
        request.app.state.benchmark_store = store
    results = store.load_all(model_id=model_id)
    return [r.model_dump() for r in results]
