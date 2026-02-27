"""Unit tests for MetricsCollector — counters, histograms, exposition."""

from __future__ import annotations

from opta_lmx.monitoring.metrics import MetricsCollector, RequestMetric


def test_empty_metrics_has_zero_counters() -> None:
    """Fresh collector returns all zeros."""
    mc = MetricsCollector()
    summary = mc.summary()
    assert summary["total_requests"] == 0
    assert summary["total_errors"] == 0
    assert summary["per_model"] == {}


def test_record_increments_counters() -> None:
    """Recording a request increments total and per-model counts."""
    mc = MetricsCollector()
    mc.record(RequestMetric(
        model_id="test-model",
        latency_sec=0.5,
        prompt_tokens=10,
        completion_tokens=20,
        stream=False,
    ))
    summary = mc.summary()
    assert summary["total_requests"] == 1
    assert summary["total_prompt_tokens"] == 10
    assert summary["total_completion_tokens"] == 20
    assert summary["per_model"]["test-model"]["requests"] == 1
    assert summary["per_model"]["test-model"]["completion_tokens"] == 20


def test_record_stream_request() -> None:
    """Streaming requests are counted separately."""
    mc = MetricsCollector()
    mc.record(RequestMetric(
        model_id="test-model",
        latency_sec=0.1,
        prompt_tokens=5,
        completion_tokens=0,
        stream=True,
    ))
    summary = mc.summary()
    assert summary["total_stream_requests"] == 1


def test_record_error() -> None:
    """Errors increment both total and per-model error counts."""
    mc = MetricsCollector()
    mc.record(RequestMetric(
        model_id="test-model",
        latency_sec=0.1,
        prompt_tokens=5,
        completion_tokens=0,
        stream=False,
        error=True,
    ))
    summary = mc.summary()
    assert summary["total_errors"] == 1
    assert summary["per_model"]["test-model"]["errors"] == 1


def test_multiple_models_tracked_separately() -> None:
    """Per-model metrics are independent."""
    mc = MetricsCollector()
    mc.record(RequestMetric("model-a", 0.1, 10, 20, False))
    mc.record(RequestMetric("model-a", 0.2, 10, 30, False))
    mc.record(RequestMetric("model-b", 0.3, 5, 10, False))

    summary = mc.summary()
    assert summary["total_requests"] == 3
    assert summary["per_model"]["model-a"]["requests"] == 2
    assert summary["per_model"]["model-a"]["completion_tokens"] == 50
    assert summary["per_model"]["model-b"]["requests"] == 1


def test_prometheus_format() -> None:
    """Prometheus output contains expected metric names and labels."""
    mc = MetricsCollector()
    mc.record(RequestMetric("test-model", 0.5, 10, 20, False))

    output = mc.prometheus()
    assert "lmx_requests_total 1" in output
    assert 'lmx_model_requests_total{model="test-model"} 1' in output
    assert "lmx_request_duration_seconds_bucket" in output
    assert "lmx_uptime_seconds" in output
    assert "# TYPE lmx_requests_total counter" in output
    assert "# TYPE lmx_request_duration_seconds histogram" in output


def test_queued_requests_gauge() -> None:
    """Prometheus output includes lmx_queued_requests gauge."""
    collector = MetricsCollector()
    output = collector.prometheus(queued_requests=3)
    assert "lmx_queued_requests 3" in output


def test_latency_histogram_buckets() -> None:
    """Latency histogram correctly buckets requests."""
    mc = MetricsCollector()
    # Request at 0.05s — should fall in 0.1 bucket
    mc.record(RequestMetric("m", 0.05, 0, 0, False))
    # Request at 3.0s — should fall in 5.0 bucket
    mc.record(RequestMetric("m", 3.0, 0, 0, False))

    output = mc.prometheus()
    # Cumulative: 0.1 bucket should have 1, 5.0 bucket should have 2
    assert 'lmx_request_duration_seconds_bucket{model="m",le="0.1"} 1' in output
    assert 'lmx_request_duration_seconds_bucket{model="m",le="5.0"} 2' in output
