# Opta LMX SLOs And Regression Budgets

Updated: 2026-02-25

This document pins the runtime SLOs and performance regression budgets that Opta LMX
is expected to hold. These values align with:

- `docs/plans/2026-02-23-premium-perfection-roadmap.md`
- `docs/plans/2026-02-21-multi-agent-skills-native-plan.md`

## Runtime SLO Targets

- Request latency p95: `<= 0.60s`
- Queue wait p95: `<= 1.50s`
- Request error rate: `< 1%`
- Throughput floor (perf-gate profile): `>= 20 rps`

## Regression Budgets

- Tuned profile throughput regression budget: `<= 15%` drop vs baseline.

## Metrics To Watch

Primary source: `GET /admin/metrics` (Prometheus)

- `lmx_request_latency_p95_seconds`
- `lmx_model_queue_wait_seconds{model=...}`
- `lmx_model_error_rate{model=...}`
- `lmx_requests_total`
- `lmx_request_duration_seconds_*`

Secondary source: `GET /admin/metrics/json`

- `latency_p95_sec`
- `per_model.<model>.queue_wait_sec`
- `per_model.<model>.error_rate`

## Enforcement Points

- `tests/test_perf_gate.py::test_openclaw_perf_regression_gate`
  - checks p95 latency, throughput, queue-wait p95, and error-rate budget.
- `tests/test_perf_gate.py::test_autotune_perf_regression_gate_uses_15_percent_threshold`
  - checks tuned profile regression budget.

## Operational Rule

If any target is violated:

1. Treat as regression until disproven.
2. Block release/promotion for affected runtime profile.
3. Capture root cause and corrective action in release notes and runbook updates.
