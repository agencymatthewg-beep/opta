# OpenClaw Monitoring Pack (OC-043)

Updated: 2026-02-22

This pack provides versioned, deployable monitoring assets for Opta LMX OpenClaw-style bot fleets.

## Included Artifacts

- `docs/ops/monitoring/prometheus-alerts.yaml`
- `docs/ops/monitoring/grafana-openclaw-dashboard.json`

## Metrics Source

Expose Prometheus metrics from Opta LMX:

- Endpoint: `GET /admin/metrics`
- Auth: `X-Admin-Key` only when `security.admin_key` is configured

## Prometheus Rule Installation

1. Copy `docs/ops/monitoring/prometheus-alerts.yaml` into your Prometheus rule directory.
2. Reference it from `prometheus.yml` under `rule_files`.
3. Reload Prometheus.

Example:

```yaml
rule_files:
  - /etc/prometheus/rules/opta-lmx/prometheus-alerts.yaml
```

## Grafana Dashboard Installation

1. Import `docs/ops/monitoring/grafana-openclaw-dashboard.json` in Grafana.
2. Map the Prometheus datasource if prompted.
3. Save the dashboard.

## Baseline Alerts

- High request error ratio.
- Sustained p95 latency regression.
- Queue saturation under full concurrency.
- Memory pressure above 90%.
- High failed/cancelled agent run ratio.

## Operating Guidance

- Treat warning alerts as optimization signals first, paging events second.
- Calibrate thresholds per hardware profile (M3 Ultra vs M4 class hardware).
- Keep this pack versioned with app releases; update dashboard and rules when metric names change.
