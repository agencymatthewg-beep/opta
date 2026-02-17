"""Per-request metrics collection and Prometheus exposition."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any


@dataclass
class RequestMetric:
    """A single completed request's metrics."""

    model_id: str
    latency_sec: float
    prompt_tokens: int
    completion_tokens: int
    stream: bool
    error: bool = False


class MetricsCollector:
    """Collects per-request metrics and exposes Prometheus text format.

    Thread-safe — uses a lock around all mutations.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._total_requests: int = 0
        self._total_errors: int = 0
        self._total_prompt_tokens: int = 0
        self._total_completion_tokens: int = 0
        self._total_stream_requests: int = 0
        self._model_requests: dict[str, int] = {}
        self._model_errors: dict[str, int] = {}
        self._model_tokens: dict[str, int] = {}
        # Latency histogram buckets (seconds)
        self._latency_buckets = [0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0]
        self._latency_bucket_counts: dict[str, list[int]] = {}
        self._latency_sum: dict[str, float] = {}
        self._started_at: float = time.time()

    def record(self, metric: RequestMetric) -> None:
        """Record a completed request's metrics."""
        with self._lock:
            self._total_requests += 1
            if metric.stream:
                self._total_stream_requests += 1
            if metric.error:
                self._total_errors += 1
                self._model_errors[metric.model_id] = (
                    self._model_errors.get(metric.model_id, 0) + 1
                )

            self._total_prompt_tokens += metric.prompt_tokens
            self._total_completion_tokens += metric.completion_tokens

            self._model_requests[metric.model_id] = (
                self._model_requests.get(metric.model_id, 0) + 1
            )
            self._model_tokens[metric.model_id] = (
                self._model_tokens.get(metric.model_id, 0)
                + metric.completion_tokens
            )

            # Latency histogram — store in the single correct bucket
            if metric.model_id not in self._latency_bucket_counts:
                self._latency_bucket_counts[metric.model_id] = [0] * len(self._latency_buckets)
                self._latency_sum[metric.model_id] = 0.0

            self._latency_sum[metric.model_id] += metric.latency_sec
            for i, boundary in enumerate(self._latency_buckets):
                if metric.latency_sec <= boundary:
                    self._latency_bucket_counts[metric.model_id][i] += 1
                    break
            # If latency exceeds all buckets, it only appears in +Inf

    def prometheus(
        self,
        loaded_model_count: int = 0,
        memory_used_gb: float = 0.0,
        memory_total_gb: float = 0.0,
    ) -> str:
        """Render metrics in Prometheus text exposition format.

        Args:
            loaded_model_count: Number of currently loaded models.
            memory_used_gb: Current unified memory usage in GB.
            memory_total_gb: Total unified memory in GB.
        """
        with self._lock:
            lines: list[str] = []

            # --- Counters ---
            lines.append("# HELP lmx_requests_total Total inference requests.")
            lines.append("# TYPE lmx_requests_total counter")
            lines.append(f"lmx_requests_total {self._total_requests}")

            lines.append("# HELP lmx_errors_total Total failed inference requests.")
            lines.append("# TYPE lmx_errors_total counter")
            lines.append(f"lmx_errors_total {self._total_errors}")

            lines.append("# HELP lmx_stream_requests_total Total streaming requests.")
            lines.append("# TYPE lmx_stream_requests_total counter")
            lines.append(f"lmx_stream_requests_total {self._total_stream_requests}")

            lines.append("# HELP lmx_prompt_tokens_total Total prompt tokens processed.")
            lines.append("# TYPE lmx_prompt_tokens_total counter")
            lines.append(f"lmx_prompt_tokens_total {self._total_prompt_tokens}")

            lines.append("# HELP lmx_completion_tokens_total Total completion tokens generated.")
            lines.append("# TYPE lmx_completion_tokens_total counter")
            lines.append(f"lmx_completion_tokens_total {self._total_completion_tokens}")

            # --- Per-model counters ---
            lines.append("# HELP lmx_model_requests_total Requests per model.")
            lines.append("# TYPE lmx_model_requests_total counter")
            for model_id, count in sorted(self._model_requests.items()):
                lines.append(f'lmx_model_requests_total{{model="{model_id}"}} {count}')

            lines.append("# HELP lmx_model_errors_total Errors per model.")
            lines.append("# TYPE lmx_model_errors_total counter")
            for model_id, count in sorted(self._model_errors.items()):
                lines.append(f'lmx_model_errors_total{{model="{model_id}"}} {count}')

            lines.append("# HELP lmx_model_tokens_total Completion tokens per model.")
            lines.append("# TYPE lmx_model_tokens_total counter")
            for model_id, count in sorted(self._model_tokens.items()):
                lines.append(f'lmx_model_tokens_total{{model="{model_id}"}} {count}')

            # --- Latency histogram ---
            lines.append("# HELP lmx_request_duration_seconds Request latency histogram.")
            lines.append("# TYPE lmx_request_duration_seconds histogram")
            for model_id in sorted(self._latency_bucket_counts.keys()):
                cumulative = 0
                for i, boundary in enumerate(self._latency_buckets):
                    cumulative += self._latency_bucket_counts[model_id][i]
                    lines.append(
                        f'lmx_request_duration_seconds_bucket'
                        f'{{model="{model_id}",le="{boundary}"}} {cumulative}'
                    )
                lines.append(
                    f'lmx_request_duration_seconds_bucket{{model="{model_id}",le="+Inf"}} '
                    f"{self._model_requests.get(model_id, 0)}"
                )
                lines.append(
                    f'lmx_request_duration_seconds_sum{{model="{model_id}"}} '
                    f"{self._latency_sum[model_id]:.6f}"
                )
                lines.append(
                    f'lmx_request_duration_seconds_count{{model="{model_id}"}} '
                    f"{self._model_requests.get(model_id, 0)}"
                )

            # --- Uptime gauge ---
            lines.append("# HELP lmx_uptime_seconds Server uptime.")
            lines.append("# TYPE lmx_uptime_seconds gauge")
            lines.append(f"lmx_uptime_seconds {time.time() - self._started_at:.1f}")

            # --- Loaded models gauge ---
            lines.append("# HELP lmx_loaded_models Number of currently loaded models.")
            lines.append("# TYPE lmx_loaded_models gauge")
            lines.append(f"lmx_loaded_models {loaded_model_count}")

            # --- Memory gauges ---
            lines.append("# HELP lmx_memory_used_gb Unified memory used in GB.")
            lines.append("# TYPE lmx_memory_used_gb gauge")
            lines.append(f"lmx_memory_used_gb {memory_used_gb:.2f}")

            lines.append("# HELP lmx_memory_total_gb Total unified memory in GB.")
            lines.append("# TYPE lmx_memory_total_gb gauge")
            lines.append(f"lmx_memory_total_gb {memory_total_gb:.2f}")

            lines.append("")  # trailing newline
            return "\n".join(lines)

    def summary(self) -> dict[str, Any]:
        """Return a JSON-friendly summary for admin endpoints."""
        with self._lock:
            return {
                "total_requests": self._total_requests,
                "total_errors": self._total_errors,
                "total_stream_requests": self._total_stream_requests,
                "total_prompt_tokens": self._total_prompt_tokens,
                "total_completion_tokens": self._total_completion_tokens,
                "per_model": {
                    model_id: {
                        "requests": self._model_requests.get(model_id, 0),
                        "errors": self._model_errors.get(model_id, 0),
                        "completion_tokens": self._model_tokens.get(model_id, 0),
                    }
                    for model_id in sorted(self._model_requests.keys())
                },
                "uptime_seconds": round(time.time() - self._started_at, 1),
            }
