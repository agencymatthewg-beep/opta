# 90-Day Remediation Roadmap (Audit-driven)

## Days 0-30 (Stabilize contracts)
- Close `ceo.benchmark` parity disposition.
- Ship `contract-compat.json` + CI validation.
- Document interface ownership (`OWNERSHIP.md`, CODEOWNERS touchpoints).
- Success criteria:
  - 0 unmatched required operations.
  - Contract changes blocked unless matrix updated.

## Days 31-60 (Reduce structural risk)
- Refactor top 3 largest files per repo into bounded modules.
- Dead-export cleanup pass (warn-only -> enforce budget).
- Remove/merge duplicate docs and generated schema strategy.
- Success criteria:
  - >=20% reduction in files >1000 LOC.
  - >=30% reduction in ts-prune flagged exports.

## Days 61-90 (Operationalize quality)
- Add nightly perf baseline trend job + thresholds.
- Add daemon reconnect soak test and LMX synthetic throughput benchmark.
- Add monthly drift report auto-generation into `docs/audit/`.
- Success criteria:
  - Baseline trend dashboard with p50/p95 deltas.
  - Regression alerts integrated in CI/nightly.

## Dependencies
- CI access for new gates.
- Agreement on contract ownership and deprecation policy.
- Model benchmark fixture selection for repeatability.
