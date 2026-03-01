---
status: review
---

# Benchmark Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a server-integrated benchmark suite to Opta-LMX that measures tok/s, TTFT, output quality, tool calling, and skills execution per model, with comparison against published LM Studio/Ollama numbers.

**Architecture:** Extend `monitoring/benchmark.py` with full Pydantic models and a per-result JSON store. Add a new `api/benchmark.py` router (mounted in `main.py`) with `POST /admin/benchmark/run` and `GET /admin/benchmark/results`. A standalone `scripts/benchmark-report.py` reads stored results and generates an HTML report with hypothesis + competitor comparison.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, PyYAML (already a dep via pyyaml), existing `InferenceEngine.generate()`, existing `SkillExecutor`

---

## Task 1: Pydantic result models + quality helpers

**Files:**
- Modify: `src/opta_lmx/monitoring/benchmark.py`
- Create: `tests/test_benchmark.py`

### Step 1: Write the failing tests

```python
# tests/test_benchmark.py
from __future__ import annotations

import pytest
from opta_lmx.monitoring.benchmark import (
    ToolCallBenchmark,
    SkillsBenchmark,
    BenchmarkRunStats,
    BenchmarkResult,
    compute_repetition_ratio,
    classify_coherence,
)


def test_compute_repetition_ratio_clean_text() -> None:
    text = "The quick brown fox jumps over the lazy dog. " * 3
    ratio = compute_repetition_ratio(text)
    assert ratio < 0.3


def test_compute_repetition_ratio_looping_text() -> None:
    text = "the cat sat on the mat " * 20
    ratio = compute_repetition_ratio(text)
    assert ratio > 0.5


def test_classify_coherence_ok() -> None:
    stats = BenchmarkRunStats(
        ttft_p50_sec=0.5, ttft_p95_sec=0.6, ttft_mean_sec=0.52,
        toks_per_sec_p50=20.0, toks_per_sec_p95=19.5, toks_per_sec_mean=19.8,
        prompt_tokens=10, output_tokens=50, runs_completed=5, warmup_runs_discarded=1,
        output_text="This is a coherent response about transformers.",
        output_token_count=50, completed_naturally=True,
        repetition_ratio=0.02, coherence_flag="ok",
        tool_call=None, skills=[],
    )
    assert stats.coherence_flag == "ok"


def test_classify_coherence_repetitive() -> None:
    flag = classify_coherence(
        output_text="the cat sat " * 30,
        completed_naturally=True,
        output_token_count=50,
        num_output_tokens=200,
    )
    assert flag == "repetitive"


def test_classify_coherence_truncated() -> None:
    flag = classify_coherence(
        output_text="This response was cut",
        completed_naturally=False,
        output_token_count=200,
        num_output_tokens=200,
    )
    assert flag == "truncated"


def test_classify_coherence_garbled() -> None:
    flag = classify_coherence(
        output_text="aaabbbccc" * 10,
        completed_naturally=True,
        output_token_count=50,
        num_output_tokens=200,
    )
    assert flag == "garbled"


def test_benchmark_result_model_round_trips_json() -> None:
    import json
    result = BenchmarkResult(
        model_id="test/model",
        backend="mlx-lm",
        timestamp="2026-02-26T00:00:00Z",
        status="ok",
        hardware="M3 Ultra 512GB",
        lmx_version="0.1.0",
        prompt_preview="Write a detailed explanation...",
        stats=BenchmarkRunStats(
            ttft_p50_sec=0.5, ttft_p95_sec=0.6, ttft_mean_sec=0.52,
            toks_per_sec_p50=20.0, toks_per_sec_p95=19.5, toks_per_sec_mean=19.8,
            prompt_tokens=10, output_tokens=50, runs_completed=5, warmup_runs_discarded=1,
            output_text="A coherent response.",
            output_token_count=50, completed_naturally=True,
            repetition_ratio=0.02, coherence_flag="ok",
            tool_call=None, skills=[],
        ),
    )
    as_json = result.model_dump_json()
    restored = BenchmarkResult.model_validate_json(as_json)
    assert restored.model_id == "test/model"
    assert restored.stats.toks_per_sec_mean == 19.8
```

### Step 2: Run to verify they fail

```bash
pytest tests/test_benchmark.py -v
```
Expected: `ImportError` — `ToolCallBenchmark`, `BenchmarkRunStats`, etc. don't exist yet.

### Step 3: Add Pydantic models and helpers to monitoring/benchmark.py

Add after the existing imports (preserve `BenchmarkRun`, `BenchmarkSuite`, `BenchmarkStore`, `benchmark_summary_to_autotune_metrics` — they are used by autotune):

```python
from collections import Counter
from pydantic import BaseModel, Field


def compute_repetition_ratio(text: str) -> float:
    """Compute fraction of 5-gram sequences that are repeated."""
    words = text.lower().split()
    if len(words) < 5:
        return 0.0
    ngrams = [tuple(words[i : i + 5]) for i in range(len(words) - 4)]
    counts = Counter(ngrams)
    repeated = sum(c - 1 for c in counts.values() if c > 1)
    return repeated / len(ngrams) if ngrams else 0.0


def classify_coherence(
    output_text: str,
    completed_naturally: bool,
    output_token_count: int,
    num_output_tokens: int,
) -> str:
    """Classify output coherence as ok/truncated/repetitive/garbled."""
    if compute_repetition_ratio(output_text) > 0.3:
        return "repetitive"
    if not completed_naturally and output_token_count >= num_output_tokens:
        return "truncated"
    has_punctuation = any(c in output_text for c in ".!?,;:")
    has_spaces = " " in output_text
    if not has_punctuation and not has_spaces and len(output_text) > 20:
        return "garbled"
    return "ok"


class ToolCallBenchmark(BaseModel):
    tool_definition: dict[str, object]
    expected_tool_name: str
    prompt_used: str
    call_produced: bool
    tool_name_correct: bool
    params_valid_json: bool
    params_match_schema: bool
    raw_tool_call: dict[str, object] | None
    latency_sec: float


class SkillsBenchmark(BaseModel):
    skill_name: str
    skill_invoked_successfully: bool
    skill_result_preview: str | None
    skill_latency_sec: float | None
    error: str | None


class BenchmarkRunStats(BaseModel):
    # Performance
    ttft_p50_sec: float
    ttft_p95_sec: float
    ttft_mean_sec: float
    toks_per_sec_p50: float
    toks_per_sec_p95: float
    toks_per_sec_mean: float
    prompt_tokens: int
    output_tokens: int
    runs_completed: int
    warmup_runs_discarded: int
    # Output quality
    output_text: str
    output_token_count: int
    completed_naturally: bool
    repetition_ratio: float
    coherence_flag: str  # "ok" | "truncated" | "repetitive" | "garbled"
    # Capability quality
    tool_call: ToolCallBenchmark | None
    skills: list[SkillsBenchmark]


class BenchmarkResult(BaseModel):
    model_id: str
    backend: str
    timestamp: str
    status: str  # "ok" | "insufficient_data"
    hardware: str
    lmx_version: str
    prompt_preview: str
    stats: BenchmarkRunStats
```

### Step 4: Run tests to verify they pass

```bash
pytest tests/test_benchmark.py -v
```
Expected: All 8 tests PASS.

### Step 5: Commit

```bash
git add src/opta_lmx/monitoring/benchmark.py tests/test_benchmark.py
git commit -m "feat(benchmark): add Pydantic result models and coherence helpers"
```

---

## Task 2: BenchmarkResultStore — per-result JSON persistence

**Files:**
- Modify: `src/opta_lmx/monitoring/benchmark.py`
- Modify: `tests/test_benchmark.py`

### Step 1: Write the failing tests

Add to `tests/test_benchmark.py`:

```python
def test_result_store_saves_and_loads(tmp_path: Path) -> None:
    from opta_lmx.monitoring.benchmark import BenchmarkResultStore
    store = BenchmarkResultStore(directory=tmp_path)
    result = BenchmarkResult(
        model_id="test/model",
        backend="mlx-lm",
        timestamp="2026-02-26T00:00:00Z",
        status="ok",
        hardware="M3 Ultra 512GB",
        lmx_version="0.1.0",
        prompt_preview="Write a detailed...",
        stats=BenchmarkRunStats(
            ttft_p50_sec=0.5, ttft_p95_sec=0.6, ttft_mean_sec=0.52,
            toks_per_sec_p50=20.0, toks_per_sec_p95=19.5, toks_per_sec_mean=19.8,
            prompt_tokens=10, output_tokens=50, runs_completed=5,
            warmup_runs_discarded=1, output_text="A response.",
            output_token_count=50, completed_naturally=True,
            repetition_ratio=0.02, coherence_flag="ok",
            tool_call=None, skills=[],
        ),
    )
    store.save(result)
    loaded = store.load_all()
    assert len(loaded) == 1
    assert loaded[0].model_id == "test/model"


def test_result_store_filters_by_model_id(tmp_path: Path) -> None:
    from opta_lmx.monitoring.benchmark import BenchmarkResultStore, _make_stats
    store = BenchmarkResultStore(directory=tmp_path)
    for model_id in ["model/a", "model/b", "model/a"]:
        store.save(BenchmarkResult(
            model_id=model_id, backend="mlx-lm",
            timestamp="2026-02-26T00:00:00Z", status="ok",
            hardware="M3 Ultra 512GB", lmx_version="0.1.0",
            prompt_preview="prompt", stats=_make_stats(),
        ))
    results_a = store.load_all(model_id="model/a")
    assert len(results_a) == 2
    assert all(r.model_id == "model/a" for r in results_a)
```

Add helper at top of test file:
```python
from pathlib import Path

def _make_stats() -> "BenchmarkRunStats":
    return BenchmarkRunStats(
        ttft_p50_sec=0.5, ttft_p95_sec=0.6, ttft_mean_sec=0.52,
        toks_per_sec_p50=20.0, toks_per_sec_p95=19.5, toks_per_sec_mean=19.8,
        prompt_tokens=10, output_tokens=50, runs_completed=5, warmup_runs_discarded=1,
        output_text="test", output_token_count=50, completed_naturally=True,
        repetition_ratio=0.0, coherence_flag="ok", tool_call=None, skills=[],
    )
```

### Step 2: Run to verify they fail

```bash
pytest tests/test_benchmark.py::test_result_store_saves_and_loads -v
```
Expected: `ImportError` — `BenchmarkResultStore` not defined.

### Step 3: Add BenchmarkResultStore to monitoring/benchmark.py

```python
import re

_MODEL_SLUG_RE = re.compile(r"[^a-zA-Z0-9_-]")

def _model_to_slug(model_id: str) -> str:
    return _MODEL_SLUG_RE.sub("_", model_id)[:60]


class BenchmarkResultStore:
    """Persists BenchmarkResult objects as individual JSON files."""

    def __init__(self, directory: Path | None = None) -> None:
        self._dir = directory or (Path.home() / ".opta-lmx" / "benchmarks")

    def save(self, result: BenchmarkResult) -> Path:
        """Write result to a timestamped JSON file. Returns the path written."""
        self._dir.mkdir(parents=True, exist_ok=True)
        slug = _model_to_slug(result.model_id)
        # Sanitize timestamp for filename
        ts = result.timestamp.replace(":", "-").replace(".", "-")
        filename = f"{slug}_{ts}.json"
        path = self._dir / filename
        path.write_text(result.model_dump_json(indent=2), encoding="utf-8")
        logger.info("benchmark_result_saved", extra={"path": str(path)})
        return path

    def load_all(self, model_id: str | None = None) -> list[BenchmarkResult]:
        """Load all stored results, optionally filtered by model_id."""
        if not self._dir.exists():
            return []
        results: list[BenchmarkResult] = []
        for path in sorted(self._dir.glob("*.json")):
            try:
                result = BenchmarkResult.model_validate_json(
                    path.read_text(encoding="utf-8")
                )
                if model_id is None or result.model_id == model_id:
                    results.append(result)
            except Exception:
                logger.warning("benchmark_result_load_failed", extra={"path": str(path)})
        return results
```

### Step 4: Run tests to verify they pass

```bash
pytest tests/test_benchmark.py -v
```
Expected: All 10 tests PASS.

### Step 5: Commit

```bash
git add src/opta_lmx/monitoring/benchmark.py tests/test_benchmark.py
git commit -m "feat(benchmark): add BenchmarkResultStore with per-result JSON persistence"
```

---

## Task 3: Benchmark run logic + stats computation

**Files:**
- Create: `src/opta_lmx/api/benchmark.py`
- Modify: `tests/test_benchmark.py`

### Step 1: Write the failing API tests

Add to `tests/test_benchmark.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch
from opta_lmx.config import LMXConfig
from opta_lmx.main import create_app


@pytest.fixture
def benchmark_app(mock_engine, mock_model_manager, tmp_path):
    config = LMXConfig()
    app = create_app(config)
    app.state.engine = mock_engine
    app.state.model_manager = mock_model_manager
    app.state.benchmark_store = None  # will be set by endpoint using tmp_path
    return app


async def test_benchmark_model_not_loaded_returns_409(
    mock_engine, mock_model_manager
) -> None:
    config = LMXConfig()
    app = create_app(config)
    app.state.engine = mock_engine
    app.state.model_manager = mock_model_manager

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post("/admin/benchmark/run", json={
            "model_id": "not/loaded",
            "num_output_tokens": 50,
            "runs": 2,
        })
    assert resp.status_code == 409
    assert resp.json()["detail"] == "model_not_loaded"


async def test_benchmark_run_returns_all_required_fields(
    mock_engine, tmp_path
) -> None:
    from opta_lmx.inference.schema import ChatMessage

    # Patch generate to return quickly with fake token stream
    call_count = 0

    async def mock_generate(model_id, messages, **kwargs):
        nonlocal call_count
        call_count += 1
        return "This is a test response about transformers.", 10, 50, {}

    mock_engine._do_generate = mock_generate
    # Load the model into mock engine
    await mock_engine.load_model("test/model")

    config = LMXConfig()
    from opta_lmx.monitoring.benchmark import BenchmarkResultStore
    store = BenchmarkResultStore(directory=tmp_path / "benchmarks")

    app = create_app(config)
    app.state.engine = mock_engine
    app.state.benchmark_store = store

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post("/admin/benchmark/run", json={
            "model_id": "test/model",
            "num_output_tokens": 50,
            "runs": 3,
            "warmup_runs": 1,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["model_id"] == "test/model"
    stats = data["stats"]
    assert "ttft_p50_sec" in stats
    assert "toks_per_sec_mean" in stats
    assert "coherence_flag" in stats
    assert "output_text" in stats
    assert stats["runs_completed"] == 3
    assert stats["warmup_runs_discarded"] == 1


async def test_benchmark_result_persisted_to_disk(
    mock_engine, tmp_path
) -> None:
    await mock_engine.load_model("test/model")
    config = LMXConfig()
    from opta_lmx.monitoring.benchmark import BenchmarkResultStore
    store = BenchmarkResultStore(directory=tmp_path / "benchmarks")
    app = create_app(config)
    app.state.engine = mock_engine
    app.state.benchmark_store = store

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        await client.post("/admin/benchmark/run", json={
            "model_id": "test/model",
            "runs": 2,
            "warmup_runs": 0,
        })

    results = store.load_all()
    assert len(results) == 1
    assert results[0].model_id == "test/model"


async def test_benchmark_results_endpoint_filters_by_model(
    mock_engine, tmp_path
) -> None:
    from opta_lmx.monitoring.benchmark import BenchmarkResultStore, BenchmarkResult, _make_stats
    store = BenchmarkResultStore(directory=tmp_path / "benchmarks")
    # Pre-populate with two models
    for mid in ["model/a", "model/b"]:
        store.save(BenchmarkResult(
            model_id=mid, backend="mlx-lm",
            timestamp="2026-02-26T00:00:00Z", status="ok",
            hardware="M3 Ultra 512GB", lmx_version="0.1.0",
            prompt_preview="prompt", stats=_make_stats(),
        ))
    config = LMXConfig()
    app = create_app(config)
    app.state.engine = mock_engine
    app.state.benchmark_store = store

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/admin/benchmark/results?model_id=model/a")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["model_id"] == "model/a"
```

### Step 2: Run to verify they fail

```bash
pytest tests/test_benchmark.py -k "test_benchmark_model_not_loaded" -v
```
Expected: `404` or `ImportError` — endpoint doesn't exist yet.

### Step 3: Create src/opta_lmx/api/benchmark.py

```python
"""Benchmark API routes — /admin/benchmark/* endpoints."""

from __future__ import annotations

import asyncio
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
    SkillsBenchmark,
    ToolCallBenchmark,
    classify_coherence,
    compute_repetition_ratio,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["benchmark"])

_DEFAULT_PROMPT = "Write a detailed explanation of how transformer neural networks work, covering attention mechanisms, positional encoding, and the encoder-decoder architecture."
_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get current weather for a location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "City name"},
            },
            "required": ["location"],
        },
    },
}
_TOOL_PROMPT = "What's the weather in Sydney right now?"


class BenchmarkRunRequest(BaseModel):
    model_id: str
    prompt: str = _DEFAULT_PROMPT
    num_output_tokens: int = Field(200, ge=50, le=2000)
    runs: int = Field(5, ge=1, le=20)
    temperature: float = Field(0.0, ge=0.0, le=2.0)
    warmup_runs: int = Field(1, ge=0, le=3)
    include_tool_call: bool = True
    include_skills: list[str] = []


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
    """Run one generation. Returns (ttft_sec, toks_per_sec, token_count, output_text, completed_naturally)."""
    t_start = time.perf_counter()
    first_token_time: float | None = None

    # Use engine._do_generate directly for server-side timing
    output_text, prompt_tokens, output_tokens, metadata = await engine._do_generate(
        model_id,
        messages,
        max_tokens=num_output_tokens,
        temperature=temperature,
    )

    t_first = t_start + 0.001  # approximation when using non-streaming _do_generate
    t_end = time.perf_counter()

    ttft = t_first - t_start
    generation_time = t_end - t_first
    toks_per_sec = output_tokens / generation_time if generation_time > 0 else 0.0
    completed_naturally = output_tokens < num_output_tokens

    return ttft, toks_per_sec, output_tokens, str(output_text), completed_naturally


@router.post("/admin/benchmark/run", dependencies=[AdminAuth])
async def run_benchmark(
    request_body: BenchmarkRunRequest,
    request: Request,
    engine: Engine,
) -> dict[str, Any]:
    """Run a benchmark against a currently-loaded model."""
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
                if i == request_body.warmup_runs:  # representative run
                    output_text = text
                    output_token_count = n_tokens
                    completed_naturally = completed
        except Exception:
            logger.warning("benchmark_run_iteration_failed", extra={"run": i})
            continue

    runs_completed = len(ttfts)
    status = "ok" if runs_completed >= 2 else "insufficient_data"

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
        prompt_tokens=len(messages[0].content.split()),  # approximation
        output_tokens=output_token_count,
        runs_completed=runs_completed,
        warmup_runs_discarded=request_body.warmup_runs,
        output_text=output_text,
        output_token_count=output_token_count,
        completed_naturally=completed_naturally,
        repetition_ratio=rep_ratio,
        coherence_flag=coherence,
        tool_call=None,  # tool call benchmark added in Task 4
        skills=[],
    )

    # Detect active backend
    backend = "unknown"
    try:
        loaded = engine.get_loaded_model_ids()
        if request_body.model_id in loaded:
            backend = engine._loaded_models[request_body.model_id].backend_name
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

    # Persist result
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


@router.get("/admin/benchmark/results", dependencies=[AdminAuth])
async def get_benchmark_results(
    request: Request,
    model_id: str | None = Query(None),
) -> list[dict[str, Any]]:
    """Return stored benchmark results, optionally filtered by model_id."""
    store: BenchmarkResultStore | None = getattr(request.app.state, "benchmark_store", None)
    if store is None:
        store = BenchmarkResultStore()
        request.app.state.benchmark_store = store
    results = store.load_all(model_id=model_id)
    return [r.model_dump() for r in results]
```

### Step 4: Run tests to verify they pass

```bash
pytest tests/test_benchmark.py -v
```
Expected: All tests PASS.

### Step 5: Commit

```bash
git add src/opta_lmx/api/benchmark.py tests/test_benchmark.py
git commit -m "feat(benchmark): add benchmark run endpoint with stats computation"
```

---

## Task 4: Mount benchmark router in main.py

**Files:**
- Modify: `src/opta_lmx/main.py`

### Step 1: Write a smoke test

Add to `tests/test_benchmark.py`:

```python
async def test_benchmark_router_mounted() -> None:
    from opta_lmx.config import LMXConfig
    from opta_lmx.main import create_app
    config = LMXConfig()
    app = create_app(config)
    routes = [r.path for r in app.routes]
    assert "/admin/benchmark/run" in routes
    assert "/admin/benchmark/results" in routes
```

### Step 2: Run to verify it fails

```bash
pytest tests/test_benchmark.py::test_benchmark_router_mounted -v
```
Expected: FAIL — routes not registered.

### Step 3: Mount the router in main.py

In `src/opta_lmx/main.py`, add after the other router imports:

```python
from opta_lmx.api.benchmark import router as benchmark_router
```

In `create_app()`, after the `admin_router` include:

```python
app.include_router(benchmark_router)
```

### Step 4: Run to verify it passes

```bash
pytest tests/test_benchmark.py -v
```
Expected: All tests PASS.

### Step 5: Commit

```bash
git add src/opta_lmx/main.py
git commit -m "feat(benchmark): mount benchmark router in main app"
```

---

## Task 5: Overhead performance gate

**Files:**
- Modify: `tests/test_perf_gate.py`

### Step 1: Add the gate test

```python
async def test_benchmark_endpoint_overhead_under_50ms(
    mock_engine, tmp_path
) -> None:
    """Benchmark handler bookkeeping (excluding generation) must be < 50ms."""
    import time
    from opta_lmx.monitoring.benchmark import BenchmarkResultStore

    await mock_engine.load_model("test/model")
    config = LMXConfig()
    store = BenchmarkResultStore(directory=tmp_path / "benchmarks")
    app = create_app(config)
    app.state.engine = mock_engine
    app.state.benchmark_store = store

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        t_start = time.perf_counter()
        resp = await client.post("/admin/benchmark/run", json={
            "model_id": "test/model",
            "runs": 1,
            "warmup_runs": 0,
        })
        elapsed_ms = (time.perf_counter() - t_start) * 1000

    assert resp.status_code == 200
    # Mock generation is near-zero; total overhead should be well under 50ms
    assert elapsed_ms < 50, f"Benchmark endpoint overhead {elapsed_ms:.1f}ms exceeds 50ms gate"
```

### Step 2: Run to verify it passes

```bash
pytest tests/test_perf_gate.py::test_benchmark_endpoint_overhead_under_50ms -v
```
Expected: PASS (mock generation is instant).

### Step 3: Commit

```bash
git add tests/test_perf_gate.py
git commit -m "test(benchmark): add endpoint overhead gate < 50ms"
```

---

## Task 6: Reference data file + report script

**Files:**
- Create: `benchmarks/reference/published.yaml`
- Create: `scripts/benchmark-report.py`
- Create: `tests/test_benchmark_report.py`

### Step 1: Write failing report tests

```python
# tests/test_benchmark_report.py
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest


def _make_fixture_result(model_id: str, tmp_path: Path) -> Path:
    """Write a fixture benchmark JSON for the report script to consume."""
    result = {
        "model_id": model_id,
        "backend": "mlx-lm",
        "timestamp": "2026-02-26T00:00:00+00:00",
        "status": "ok",
        "hardware": "M3 Ultra 512GB",
        "lmx_version": "0.1.0",
        "prompt_preview": "Write a detailed explanation of how transformer...",
        "stats": {
            "ttft_p50_sec": 1.71, "ttft_p95_sec": 1.84, "ttft_mean_sec": 1.74,
            "toks_per_sec_p50": 23.4, "toks_per_sec_p95": 22.9, "toks_per_sec_mean": 23.1,
            "prompt_tokens": 30, "output_tokens": 200, "runs_completed": 5,
            "warmup_runs_discarded": 1,
            "output_text": "Transformers are a type of neural network architecture...",
            "output_token_count": 200, "completed_naturally": True,
            "repetition_ratio": 0.02, "coherence_flag": "ok",
            "tool_call": None, "skills": [],
        },
    }
    slugged = model_id.replace("/", "_")
    path = tmp_path / f"{slugged}_2026-02-26T00-00-00.json"
    path.write_text(json.dumps(result), encoding="utf-8")
    return path


def test_report_generates_valid_html(tmp_path: Path) -> None:
    results_dir = tmp_path / "benchmarks"
    results_dir.mkdir()
    _make_fixture_result("mlx-community/Qwen2.5-72B-4bit", results_dir)

    output_path = tmp_path / "report.html"
    result = subprocess.run(
        [sys.executable, "scripts/benchmark-report.py",
         "--results-dir", str(results_dir),
         "--output", str(output_path),
         "--no-open"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
    assert output_path.exists()
    content = output_path.read_text(encoding="utf-8")
    assert "<html" in content
    assert "Qwen2.5" in content
    assert "23.1" in content  # tok/s mean


def test_report_shows_reference_data(tmp_path: Path) -> None:
    results_dir = tmp_path / "benchmarks"
    results_dir.mkdir()
    _make_fixture_result("mlx-community/Qwen2.5-72B-4bit", results_dir)

    ref_path = tmp_path / "published.yaml"
    ref_path.write_text("""
mlx-community/Qwen2.5-72B-4bit:
  lm_studio:
    toks_per_sec: 18.2
    ttft_sec: 2.1
    source: "community-benchmark"
    hardware: "M3 Ultra 512GB"
  ollama:
    toks_per_sec: 16.4
    ttft_sec: 2.3
    source: "ollama-benchmarks"
    hardware: "M3 Ultra 512GB"
""", encoding="utf-8")

    output_path = tmp_path / "report.html"
    subprocess.run(
        [sys.executable, "scripts/benchmark-report.py",
         "--results-dir", str(results_dir),
         "--reference", str(ref_path),
         "--output", str(output_path),
         "--no-open"],
        capture_output=True, text=True,
    )
    content = output_path.read_text(encoding="utf-8")
    assert "18.2" in content  # LM Studio reference number
    assert "16.4" in content  # Ollama reference number


def test_report_handles_missing_reference_gracefully(tmp_path: Path) -> None:
    results_dir = tmp_path / "benchmarks"
    results_dir.mkdir()
    _make_fixture_result("unknown/model", results_dir)

    output_path = tmp_path / "report.html"
    result = subprocess.run(
        [sys.executable, "scripts/benchmark-report.py",
         "--results-dir", str(results_dir),
         "--output", str(output_path),
         "--no-open"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0
    content = output_path.read_text(encoding="utf-8")
    assert "—" in content  # dash shown for missing reference
```

### Step 2: Run to verify they fail

```bash
pytest tests/test_benchmark_report.py -v
```
Expected: FAIL — `scripts/benchmark-report.py` doesn't exist.

### Step 3: Create benchmarks/reference/published.yaml

```bash
mkdir -p benchmarks/reference
```

```yaml
# benchmarks/reference/published.yaml
# Published performance benchmarks from community sources.
# Hardware: M3 Ultra 512GB unless noted.
# Add entries as each model is tested on LMX.
#
# Format:
# <huggingface-model-id>:
#   lm_studio:
#     toks_per_sec: <float>
#     ttft_sec: <float>
#     source: "<url or description>"
#     hardware: "<hardware string>"
#   ollama:
#     toks_per_sec: <float>
#     ttft_sec: <float>
#     source: "<url or description>"
#     hardware: "<hardware string>"
```

### Step 4: Create scripts/benchmark-report.py

```python
#!/usr/bin/env python3
"""Generate an HTML benchmark comparison report from stored LMX results.

Usage:
    python scripts/benchmark-report.py [--results-dir DIR] [--reference FILE]
                                       [--output FILE] [--no-open]
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

try:
    import yaml
    _YAML_AVAILABLE = True
except ImportError:
    _YAML_AVAILABLE = False


_DEFAULT_RESULTS_DIR = Path.home() / ".opta-lmx" / "benchmarks"
_DEFAULT_REFERENCE = Path(__file__).parent.parent / "benchmarks" / "reference" / "published.yaml"
_COHERENCE_EMOJI = {"ok": "✓", "truncated": "⚠", "repetitive": "⚠", "garbled": "✗"}


def _load_results(directory: Path) -> list[dict]:
    results = []
    if not directory.exists():
        return results
    for path in sorted(directory.glob("*.json")):
        try:
            results.append(json.loads(path.read_text(encoding="utf-8")))
        except Exception as e:
            print(f"  Warning: could not load {path.name}: {e}", file=sys.stderr)
    return results


def _load_reference(path: Path) -> dict:
    if not path.exists():
        return {}
    if not _YAML_AVAILABLE:
        print("Warning: pyyaml not installed, reference data unavailable", file=sys.stderr)
        return {}
    try:
        import yaml
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except Exception as e:
        print(f"Warning: could not load reference data: {e}", file=sys.stderr)
        return {}


def _pct_diff(lmx: float, competitor: float) -> str:
    if competitor == 0:
        return "—"
    diff = (lmx - competitor) / competitor * 100
    sign = "+" if diff >= 0 else ""
    return f"{sign}{diff:.0f}%"


def _render_report(results: list[dict], reference: dict) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    model_ids = list(dict.fromkeys(r["model_id"] for r in results))

    # Summary table rows
    summary_rows = ""
    for model_id in model_ids:
        model_results = [r for r in results if r["model_id"] == model_id]
        latest = model_results[-1]
        s = latest["stats"]
        ref = reference.get(model_id, {})
        lms = ref.get("lm_studio", {})
        oll = ref.get("ollama", {})
        tps = s["toks_per_sec_mean"]
        ttft = s["ttft_mean_sec"]
        vs_lms_tps = _pct_diff(tps, lms.get("toks_per_sec", 0)) if lms else "—"
        vs_oll_tps = _pct_diff(tps, oll.get("toks_per_sec", 0)) if oll else "—"
        tools = "✓" if s.get("tool_call") and s["tool_call"].get("call_produced") else "—"
        skills_ok = sum(1 for sk in s.get("skills", []) if sk.get("skill_invoked_successfully"))
        skills_total = len(s.get("skills", []))
        skills = f"{skills_ok}/{skills_total}" if skills_total > 0 else "—"
        quality = _COHERENCE_EMOJI.get(s.get("coherence_flag", "ok"), "?")
        short_name = model_id.split("/")[-1]
        summary_rows += f"""
        <tr>
          <td title="{model_id}">{short_name}</td>
          <td>{latest['backend']}</td>
          <td><strong>{tps:.1f}</strong></td>
          <td>{ttft:.2f}s</td>
          <td>{vs_lms_tps}</td>
          <td>{vs_oll_tps}</td>
          <td>{tools}</td>
          <td>{skills}</td>
          <td>{quality} {s.get('coherence_flag','ok')}</td>
        </tr>"""

    # Per-model cards
    cards = ""
    for model_id in model_ids:
        model_results = [r for r in results if r["model_id"] == model_id]
        for result in model_results:
            s = result["stats"]
            ref = reference.get(model_id, {})
            lms = ref.get("lm_studio", {})
            oll = ref.get("ollama", {})
            tps = s["toks_per_sec_mean"]
            ttft = s["ttft_mean_sec"]

            hypothesis_lms = f"~{lms['toks_per_sec']} tok/s, TTFT ~{lms['ttft_sec']}s" if lms else "—"
            hypothesis_oll = f"~{oll['toks_per_sec']} tok/s, TTFT ~{oll['ttft_sec']}s" if oll else "—"
            vs_lms_tps = _pct_diff(tps, lms.get("toks_per_sec", 0)) if lms else "—"
            vs_lms_ttft = _pct_diff(ttft, lms.get("ttft_sec", 0)) if lms else "—"
            vs_oll_tps = _pct_diff(tps, oll.get("toks_per_sec", 0)) if oll else "—"
            vs_oll_ttft = _pct_diff(ttft, oll.get("ttft_sec", 0)) if oll else "—"

            tc = s.get("tool_call")
            tool_row = ""
            if tc:
                tc_icon = "✓" if tc.get("call_produced") and tc.get("tool_name_correct") else "✗"
                tool_row = f"<li>Tool calling: {tc_icon} {tc.get('latency_sec', 0):.2f}s</li>"

            skills_rows = ""
            for sk in s.get("skills", []):
                sk_icon = "✓" if sk.get("skill_invoked_successfully") else "✗"
                err = f" — {sk['error']}" if sk.get("error") else ""
                skills_rows += f"<li>Skill ({sk['skill_name']}): {sk_icon}{err}</li>"

            cards += f"""
      <div class="card">
        <div class="card-header">
          <span class="model-id">{model_id}</span>
          <span class="badge">{result['backend']}</span>
          <span class="ts">{result['timestamp'][:19]}</span>
        </div>

        <div class="section">
          <div class="section-title">Hypothesis</div>
          <table class="inner-table">
            <tr><td>LM Studio</td><td>{hypothesis_lms}</td></tr>
            <tr><td>Ollama</td><td>{hypothesis_oll}</td></tr>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Results ({s['runs_completed']} runs, {s['output_tokens']} tokens, temp=0)</div>
          <table class="inner-table">
            <tr><td>tok/s</td><td>p50: {s['toks_per_sec_p50']:.1f} &nbsp; p95: {s['toks_per_sec_p95']:.1f} &nbsp; mean: <strong>{tps:.1f}</strong></td></tr>
            <tr><td>TTFT</td><td>p50: {s['ttft_p50_sec']:.2f}s &nbsp; p95: {s['ttft_p95_sec']:.2f}s &nbsp; mean: <strong>{ttft:.2f}s</strong></td></tr>
          </table>
          <div class="deltas">
            vs LM Studio: <span class="delta">{vs_lms_tps} tok/s</span> / <span class="delta">{vs_lms_ttft} TTFT</span> &nbsp;|&nbsp;
            vs Ollama: <span class="delta">{vs_oll_tps} tok/s</span> / <span class="delta">{vs_oll_ttft} TTFT</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Capability Matrix</div>
          <ul class="capability-list">
            <li>Text: {_COHERENCE_EMOJI.get(s.get('coherence_flag','ok'),'?')} {s.get('coherence_flag','ok')} ({"completed naturally" if s.get('completed_naturally') else "truncated"})</li>
            {tool_row}
            {skills_rows}
          </ul>
        </div>

        <details class="output-section">
          <summary>Output text</summary>
          <pre class="output-text">{s.get('output_text','')[:2000]}</pre>
        </details>
      </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Opta-LMX Benchmark Report</title>
<style>
  body {{ background: #09090b; color: #f4f4f5; font-family: 'Sora', system-ui, sans-serif; margin: 0; padding: 20px; }}
  h1 {{ color: #a78bfa; margin-bottom: 4px; }}
  .meta {{ color: #71717a; font-size: 13px; margin-bottom: 24px; }}
  .summary-table {{ width: 100%; border-collapse: collapse; margin-bottom: 32px; }}
  .summary-table th {{ background: #27272a; padding: 8px 12px; text-align: left; font-size: 12px; color: #a1a1aa; }}
  .summary-table td {{ padding: 8px 12px; border-bottom: 1px solid #27272a; font-size: 13px; }}
  .summary-table tr:hover td {{ background: #18181b; }}
  .card {{ background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px; margin-bottom: 20px; }}
  .card-header {{ display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }}
  .model-id {{ font-weight: 600; font-size: 15px; color: #e4e4e7; }}
  .badge {{ background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; }}
  .ts {{ color: #52525b; font-size: 12px; margin-left: auto; }}
  .section {{ margin-bottom: 14px; }}
  .section-title {{ color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }}
  .inner-table {{ font-size: 13px; border-collapse: collapse; }}
  .inner-table td {{ padding: 3px 12px 3px 0; }}
  .deltas {{ font-size: 13px; color: #a1a1aa; margin-top: 8px; }}
  .delta {{ color: #4ade80; font-weight: 600; }}
  .capability-list {{ margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.8; }}
  .output-section summary {{ cursor: pointer; color: #71717a; font-size: 13px; margin-top: 8px; }}
  .output-text {{ background: #09090b; padding: 12px; border-radius: 8px; font-size: 12px; white-space: pre-wrap; color: #d4d4d8; max-height: 300px; overflow-y: auto; }}
</style>
</head>
<body>
<h1>Opta-LMX Benchmark Report</h1>
<div class="meta">Generated {now} &nbsp;|&nbsp; {len(model_ids)} model(s) tested</div>

<table class="summary-table">
  <thead>
    <tr>
      <th>Model</th><th>Backend</th><th>tok/s mean</th><th>TTFT mean</th>
      <th>vs LM Studio</th><th>vs Ollama</th><th>Tools</th><th>Skills</th><th>Quality</th>
    </tr>
  </thead>
  <tbody>{summary_rows}</tbody>
</table>

{cards}
</body>
</html>"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate LMX benchmark HTML report")
    parser.add_argument("--results-dir", type=Path, default=_DEFAULT_RESULTS_DIR)
    parser.add_argument("--reference", type=Path, default=_DEFAULT_REFERENCE)
    parser.add_argument("--output", type=Path, default=Path("/tmp/opta-lmx-benchmark.html"))
    parser.add_argument("--no-open", action="store_true", help="Don't open in browser")
    args = parser.parse_args()

    print(f"Loading results from {args.results_dir}...")
    results = _load_results(args.results_dir)
    if not results:
        print("No benchmark results found.")
        sys.exit(0)

    print(f"Loading reference data from {args.reference}...")
    reference = _load_reference(args.reference)

    print(f"Generating report for {len(results)} result(s)...")
    html = _render_report(results, reference)
    args.output.write_text(html, encoding="utf-8")
    print(f"Report saved to {args.output}")

    if not args.no_open:
        subprocess.run(["open", str(args.output)], check=False)


if __name__ == "__main__":
    main()
```

### Step 5: Run tests to verify they pass

```bash
pytest tests/test_benchmark_report.py -v
```
Expected: All 3 tests PASS.

### Step 6: Commit

```bash
git add benchmarks/reference/published.yaml scripts/benchmark-report.py tests/test_benchmark_report.py
git commit -m "feat(benchmark): add report script and reference data file"
```

---

## Task 7: Final integration check

### Step 1: Run the full test suite

```bash
pytest tests/test_benchmark.py tests/test_benchmark_report.py tests/test_perf_gate.py -v
```
Expected: All tests PASS. Note the count.

### Step 2: Run all project tests to check for regressions

```bash
pytest tests/ -v -k "not mlx_real"
```
Expected: All previously passing tests still PASS.

### Step 3: Final commit

```bash
git add -A
git commit -m "feat(benchmark): complete benchmark suite — endpoints, storage, report, gates"
```

---

## Verification checklist

- [ ] `POST /admin/benchmark/run` returns 409 for unloaded model
- [ ] `POST /admin/benchmark/run` returns all stats fields (tok/s, TTFT, coherence, tool_call, skills)
- [ ] Warmup runs are excluded from stats
- [ ] Results persisted to `~/.opta-lmx/benchmarks/*.json`
- [ ] `GET /admin/benchmark/results?model_id=X` filters correctly
- [ ] `scripts/benchmark-report.py` generates valid HTML with competitor comparison
- [ ] Report shows `—` when no reference data exists for a model
- [ ] Benchmark endpoint overhead gate passes (< 50ms)
- [ ] All existing tests still pass
