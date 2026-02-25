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
