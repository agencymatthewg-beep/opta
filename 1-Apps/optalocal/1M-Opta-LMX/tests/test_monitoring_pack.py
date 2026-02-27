"""Validate versioned monitoring pack artifacts for OC-043."""

from __future__ import annotations

import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
MONITORING_DIR = ROOT / "docs" / "ops" / "monitoring"


def test_prometheus_alert_pack_parses_and_has_expected_alerts() -> None:
    alerts_path = MONITORING_DIR / "prometheus-alerts.yaml"
    with alerts_path.open("r", encoding="utf-8") as handle:
        payload = yaml.safe_load(handle)

    groups = payload.get("groups")
    assert isinstance(groups, list) and groups

    rules = groups[0].get("rules")
    assert isinstance(rules, list)

    alert_names = {rule.get("alert") for rule in rules}
    assert {
        "OptaLMXHighErrorRate",
        "OptaLMXHighP95Latency",
        "OptaLMXQueueSaturation",
        "OptaLMXMemoryPressure",
        "OptaLMXPerModelHighErrorRate",
        "OptaLMXPerModelHighQueueWait",
        "OptaLMXPerModelSlowLoad",
        "OptaLMXPerModelThroughputDrop",
        "OptaLMXPerModelEvictionThrash",
        "OptaLMXAgentFailureRatioHigh",
    }.issubset(alert_names)

    for rule in rules:
        expr = str(rule.get("expr", ""))
        assert "lmx_" in expr


def test_grafana_dashboard_pack_parses_and_targets_core_metrics() -> None:
    dashboard_path = MONITORING_DIR / "grafana-openclaw-dashboard.json"
    with dashboard_path.open("r", encoding="utf-8") as handle:
        dashboard = json.load(handle)

    assert dashboard["uid"] == "opta-lmx-openclaw"
    assert dashboard["title"] == "Opta LMX OpenClaw Fleet"

    panels = dashboard.get("panels", [])
    assert len(panels) >= 6

    panel_titles = {panel.get("title") for panel in panels}
    assert "Request Throughput" in panel_titles
    assert "p95 Request Latency" in panel_titles
    assert "Queue and Concurrency" in panel_titles
    assert "Per-Model Queue Wait" in panel_titles
    assert "Per-Model Error Rate" in panel_titles
    assert "Per-Model Tokens/sec" in panel_titles
    assert "Per-Model Load Duration" in panel_titles
    assert "Per-Model Evictions (30m)" in panel_titles

    panel_queries = [
        target.get("expr", "")
        for panel in panels
        for target in panel.get("targets", [])
    ]
    assert any("lmx_request_latency_p95_seconds" in query for query in panel_queries)
    assert any("lmx_queued_requests" in query for query in panel_queries)
    assert any("lmx_agent_runs_total" in query for query in panel_queries)
    assert any("lmx_model_queue_wait_seconds" in query for query in panel_queries)
    assert any("lmx_model_error_rate" in query for query in panel_queries)
    assert any("lmx_model_tokens_per_second" in query for query in panel_queries)
    assert any("lmx_model_load_duration_seconds" in query for query in panel_queries)
    assert any("lmx_model_evictions_total" in query for query in panel_queries)
