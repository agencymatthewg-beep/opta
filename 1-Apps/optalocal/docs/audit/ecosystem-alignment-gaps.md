# Ecosystem Alignment Gaps (2026-03)

## Gap 1 — Contract source of truth not fully explicit
- 1D acts as daemon contract authority, but ecosystem-level docs do not centrally codify this.
- Impact: medium; onboarding and integration decisions can fork.

## Gap 2 — Operation parity lifecycle incomplete
- Desktop parity passes required checks but still leaves unmatched operation (`ceo.benchmark`).
- Impact: medium-high; parity confidence diluted.

## Gap 3 — Multi-version API strategy under-documented
- Daemon `v3` and LMX `v1` are valid separate domains, but adapter responsibilities are implicit.
- Impact: medium; harder evolution governance.

## Gap 4 — Code concentration hotspots
- Very large files across all three apps increase change risk and review cost.
- Impact: high for long-term velocity/reliability.

## Gap 5 — Dead-export noise and duplicate artifacts
- Repeated ts-prune signals + duplicate schema/docs increase maintenance overhead.
- Impact: medium.

## Alignment score
- Current ecosystem alignment: **6.8/10**
- Primary gap to close: explicit contract/ownership governance + parity dispositioning.
