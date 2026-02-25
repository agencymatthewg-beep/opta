# tests/test_benchmark.py
from __future__ import annotations

from pathlib import Path

import pytest
from opta_lmx.monitoring.benchmark import (
    ToolCallBenchmark,
    SkillsBenchmark,
    BenchmarkRunStats,
    BenchmarkResult,
    compute_repetition_ratio,
    classify_coherence,
)


def _make_stats() -> "BenchmarkRunStats":
    return BenchmarkRunStats(
        ttft_p50_sec=0.5, ttft_p95_sec=0.6, ttft_mean_sec=0.52,
        toks_per_sec_p50=20.0, toks_per_sec_p95=19.5, toks_per_sec_mean=19.8,
        prompt_tokens=10, output_tokens=50, runs_completed=5, warmup_runs_discarded=1,
        output_text="test", output_token_count=50, completed_naturally=True,
        repetition_ratio=0.0, coherence_flag="ok", tool_call=None, skills=[],
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
    flag = classify_coherence(
        output_text="This is a coherent response about transformers and neural networks.",
        completed_naturally=True,
        output_token_count=50,
        num_output_tokens=200,
    )
    assert flag == "ok"


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
        stats=_make_stats(),
    )
    store.save(result)
    loaded = store.load_all()
    assert len(loaded) == 1
    assert loaded[0].model_id == "test/model"


def test_result_store_filters_by_model_id(tmp_path: Path) -> None:
    from opta_lmx.monitoring.benchmark import BenchmarkResultStore
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


import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, MagicMock


async def test_benchmark_model_not_loaded_returns_409(mock_engine) -> None:
    from opta_lmx.config import LMXConfig
    from opta_lmx.main import create_app
    config = LMXConfig()
    app = create_app(config)
    app.state.engine = mock_engine

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
    from opta_lmx.config import LMXConfig
    from opta_lmx.main import create_app
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
    from opta_lmx.config import LMXConfig
    from opta_lmx.main import create_app
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
    from opta_lmx.config import LMXConfig
    from opta_lmx.main import create_app
    from opta_lmx.monitoring.benchmark import BenchmarkResultStore, BenchmarkResult

    store = BenchmarkResultStore(directory=tmp_path / "benchmarks")
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


async def test_benchmark_router_mounted() -> None:
    from opta_lmx.config import LMXConfig
    from opta_lmx.main import create_app
    config = LMXConfig()
    app = create_app(config)
    routes = [r.path for r in app.routes]
    assert "/admin/benchmark/run" in routes
    assert "/admin/benchmark/results" in routes
