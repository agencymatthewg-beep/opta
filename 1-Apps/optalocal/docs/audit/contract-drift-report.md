# Contract Drift Report (2026-03)

## Drift signals detected

### 1) Operation catalog drift (Desktop vs CLI)
- Evidence: `1P/docs/parity/desktop-surface.json`
- `operationScopeCoverage.unmatched = ["ceo.benchmark"]`
- Severity: **7.4/10**
- Reliability risk: medium (feature discoverability + parity confidence erosion).

### 2) Discovery schema version governance gap
- Evidence: `1M/src/opta_lmx/discovery.py` hardcoded `"schema_version": "2026-03-02"`
- No explicit compatibility contract found in ecosystem-level docs.
- Severity: **6.8/10**
- Reliability risk: medium (silent client breakage when schema evolves).

### 3) Version namespace split without explicit adapter contract doc
- Daemon/UI contracts on `/v3/*`; LMX discovery/inference contracts on `/v1/*`.
- Split is valid architecturally, but explicit adapter ownership/compat policy is under-documented.
- Severity: **5.9/10**
- Reliability risk: medium-low, primarily integration complexity.

## Positive controls observed
- 1D contract suite pass: `tests/protocol/operations-contract.test.ts`, daemon client/server contract tests.
- 1M discovery contract tests pass.
- 1P parity check required failures = 0.

## Remediation proposals (not applied)
- Add compatibility matrix and CI gate for (`daemon_contract_version`, `lmx_discovery_schema_version`).
- Require explicit disposition for unmatched operations (`supported/deprecated/intentionally-unmapped`).
- Define schema deprecation policy (minimum overlap windows, fallback rules, test fixtures).
