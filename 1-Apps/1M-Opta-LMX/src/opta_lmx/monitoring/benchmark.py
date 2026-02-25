"""Automated benchmark runner for Opta-LMX inference performance.

Provides reproducible performance testing across models with standardized
prompts, measuring TTFT (time to first token), throughput (tok/s), and
total latency. Results are stored for trend analysis.
"""

from __future__ import annotations

import json
import logging
import re
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Standard benchmark prompts (varying complexity)
STANDARD_PROMPTS = {
    "short": "What is 2 + 2?",
    "medium": "Explain the theory of relativity in simple terms.",
    "long": (
        "Write a detailed comparison of Python and Rust for systems programming, "
        "covering performance, safety, ecosystem, learning curve, and real-world "
        "use cases. Include code examples where helpful."
    ),
    "code": (
        "Write a Python function that implements a binary search tree with "
        "insert, delete, and search operations. Include type hints and docstrings."
    ),
    "reasoning": (
        "A farmer has 17 sheep. All but 9 run away. How many sheep does the "
        "farmer have left? Explain your reasoning step by step."
    ),
}


@dataclass
class BenchmarkRun:
    """Result of a single benchmark run."""

    model_id: str
    prompt_name: str
    prompt: str
    max_tokens: int
    tokens_generated: int
    time_to_first_token_ms: float
    total_time_ms: float
    tokens_per_second: float
    temperature: float = 0.7
    timestamp: float = field(default_factory=time.time)


@dataclass
class BenchmarkSuite:
    """Collection of benchmark results for a model."""

    model_id: str
    runs: list[BenchmarkRun] = field(default_factory=list)
    started_at: float = field(default_factory=time.time)
    completed_at: float = 0.0

    def summary(self) -> dict[str, Any]:
        """Compute aggregate statistics across all runs."""
        if not self.runs:
            return {"model_id": self.model_id, "runs": 0}

        ttfts = [r.time_to_first_token_ms for r in self.runs]
        tok_rates = [r.tokens_per_second for r in self.runs]
        total_times = [r.total_time_ms for r in self.runs]

        return {
            "model_id": self.model_id,
            "runs": len(self.runs),
            "avg_ttft_ms": round(sum(ttfts) / len(ttfts), 1),
            "min_ttft_ms": round(min(ttfts), 1),
            "max_ttft_ms": round(max(ttfts), 1),
            "avg_tokens_per_second": round(sum(tok_rates) / len(tok_rates), 1),
            "max_tokens_per_second": round(max(tok_rates), 1),
            "avg_total_time_ms": round(sum(total_times) / len(total_times), 1),
            "total_tokens_generated": sum(r.tokens_generated for r in self.runs),
            "duration_sec": (
                round(self.completed_at - self.started_at, 1) if self.completed_at else 0
            ),
        }


class BenchmarkStore:
    """Stores benchmark results with optional JSON persistence."""

    def __init__(self, persist_path: Path | None = None) -> None:
        self._suites: list[BenchmarkSuite] = []
        self._persist_path = persist_path

    def add_suite(self, suite: BenchmarkSuite) -> None:
        """Add a completed benchmark suite."""
        self._suites.append(suite)

    def get_latest(self, model_id: str | None = None) -> BenchmarkSuite | None:
        """Get the most recent benchmark suite, optionally filtered by model."""
        for suite in reversed(self._suites):
            if model_id is None or suite.model_id == model_id:
                return suite
        return None

    def get_all(self) -> list[dict[str, Any]]:
        """Get summaries for all stored benchmark suites."""
        return [s.summary() for s in self._suites]

    def save(self) -> None:
        """Persist benchmark results to JSON."""
        if self._persist_path is None:
            return

        self._persist_path.parent.mkdir(parents=True, exist_ok=True)
        data = []
        for suite in self._suites:
            suite_data = {
                "model_id": suite.model_id,
                "started_at": suite.started_at,
                "completed_at": suite.completed_at,
                "runs": [
                    {
                        "model_id": r.model_id,
                        "prompt_name": r.prompt_name,
                        "max_tokens": r.max_tokens,
                        "tokens_generated": r.tokens_generated,
                        "time_to_first_token_ms": r.time_to_first_token_ms,
                        "total_time_ms": r.total_time_ms,
                        "tokens_per_second": r.tokens_per_second,
                        "temperature": r.temperature,
                        "timestamp": r.timestamp,
                    }
                    for r in suite.runs
                ],
            }
            data.append(suite_data)

        with open(self._persist_path, "w") as f:
            json.dump(data, f, indent=2)

        logger.info("benchmarks_saved", extra={
            "path": str(self._persist_path),
            "suites": len(self._suites),
        })

    def load(self) -> int:
        """Load benchmark results from JSON. Returns count of suites loaded."""
        if self._persist_path is None or not self._persist_path.exists():
            return 0

        with open(self._persist_path) as f:
            data = json.load(f)

        self._suites.clear()
        for suite_data in data:
            suite = BenchmarkSuite(
                model_id=suite_data["model_id"],
                started_at=suite_data.get("started_at", 0),
                completed_at=suite_data.get("completed_at", 0),
            )
            for run_data in suite_data.get("runs", []):
                suite.runs.append(BenchmarkRun(
                    model_id=run_data["model_id"],
                    prompt_name=run_data.get("prompt_name", "unknown"),
                    prompt="",  # Don't store full prompts
                    max_tokens=run_data.get("max_tokens", 128),
                    tokens_generated=run_data["tokens_generated"],
                    time_to_first_token_ms=run_data["time_to_first_token_ms"],
                    total_time_ms=run_data["total_time_ms"],
                    tokens_per_second=run_data["tokens_per_second"],
                    temperature=run_data.get("temperature", 0.7),
                    timestamp=run_data.get("timestamp", 0),
                ))
            self._suites.append(suite)

        return len(self._suites)


def benchmark_summary_to_autotune_metrics(summary: dict[str, Any]) -> dict[str, float]:
    """Normalize benchmark summary fields into autotune scoring metrics."""
    return {
        "avg_tokens_per_second": float(summary.get("avg_tokens_per_second", 0.0) or 0.0),
        "avg_ttft_ms": float(summary.get("avg_ttft_ms", 0.0) or 0.0),
        "avg_total_ms": float(summary.get("avg_total_time_ms", 0.0) or 0.0),
        "error_rate": float(summary.get("error_rate", 0.0) or 0.0),
        "queue_wait_ms": float(summary.get("queue_wait_ms", 0.0) or 0.0),
    }


def compute_repetition_ratio(text: str) -> float:
    """Compute fraction of 5-gram sequences that are excessively repeated.

    A 5-gram must appear more than twice to count as pathological repetition.
    This allows natural sentence repetition (e.g. 2-3 repetitions of a phrase)
    while flagging looping/degenerate outputs where the same n-gram appears
    many times in a row.
    """
    words = text.lower().split()
    if len(words) < 5:
        return 0.0
    ngrams = [tuple(words[i : i + 5]) for i in range(len(words) - 4)]
    counts = Counter(ngrams)
    # Only count occurrences beyond the second as "excess" repetition
    repeated = sum(c - 2 for c in counts.values() if c > 2)
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
    tool_definition: dict[str, Any]
    expected_tool_name: str
    prompt_used: str
    call_produced: bool
    tool_name_correct: bool
    params_valid_json: bool
    params_match_schema: bool
    raw_tool_call: dict[str, Any] | None
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
    coherence_flag: Literal["ok", "truncated", "repetitive", "garbled"]
    # Capability quality
    tool_call: ToolCallBenchmark | None
    skills: list[SkillsBenchmark]


class BenchmarkResult(BaseModel):
    model_id: str
    backend: str
    timestamp: str
    status: Literal["ok", "insufficient_data"]
    hardware: str
    lmx_version: str
    prompt_preview: str
    stats: BenchmarkRunStats


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
        ts = result.timestamp.replace(":", "-").replace(".", "-")
        base = f"{slug}_{ts}"
        path = self._dir / f"{base}.json"
        # Avoid overwriting existing files with the same name (e.g. same model +
        # timestamp called twice in the same test or rapid successive saves).
        idx = 1
        while path.exists():
            path = self._dir / f"{base}_{idx}.json"
            idx += 1
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
