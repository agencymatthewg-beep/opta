# AUDIT BACKLOG (prioritized)

## P0 (reliability-critical)
1. Resolve parity drift for `ceo.benchmark` (implement or explicitly deprecate/unmap).
2. Introduce contract compatibility matrix (`daemon v3` vs `lmx discovery schema`).
3. Add CI guard to fail on undocumented contract version/schema changes.

## P1 (high leverage)
4. Break down top monolith files (>1000 LOC) in 1D/1M/1P.
5. Establish dead-export triage workflow for ts-prune output.
6. Consolidate duplicate generated schema artifacts in 1P.
7. Consolidate duplicated ANALYSIS-REPORT doc in 1M.

## P2 (optimization)
8. Add continuous perf baseline collection and threshold alerts.
9. Add daemon reconnect soak + LMX synthetic inference benchmark.
10. Add architecture docs for adapter boundary between daemon and LMX APIs.

## Impact/Effort quick scoring
- P0 items: impact 8-9/10, effort 3-5/10
- P1 items: impact 6-8/10, effort 4-7/10
- P2 items: impact 5-7/10, effort 5-8/10
