"""Scoring utilities for model/backend autotuning results."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ScoreResult:
    score: float
    sort_key: tuple[float, float, float]


def score_profile(
    *,
    avg_tokens_per_second: float,
    avg_ttft_ms: float,
    error_rate: float,
    avg_total_ms: float,
    queue_wait_ms: float = 0.0,
) -> ScoreResult:
    """Compute autotune score + deterministic tie-break sort key.

    v1 formula:
        score = tok_s - 0.015 * ttft_ms - 50.0 * error_rate
    Tie-breakers (lower is better):
        avg_total_ms, then queue_wait_ms
    """
    score = (
        float(avg_tokens_per_second)
        - 0.015 * float(avg_ttft_ms)
        - 50.0 * float(error_rate)
    )
    return ScoreResult(
        score=score,
        sort_key=(-score, float(avg_total_ms), float(queue_wait_ms)),
    )
