# Stale / Dead Code Inventory (2026-03)

## Method
- `ts-prune` export-usage scan for TS repos.
- Heuristic orphan scan from `docs/audit/static-analysis.json`.
- TODO/FIXME/HACK pattern count across src/tests/docs.

## Findings

### A) Unused export signals (high volume)
- 1D `ts-prune`: large volume of exported symbols only used in-module or not referenced externally.
- 1P `ts-prune`: similar pattern across UI helpers/types and some page/component exports.
- Many entries are type-only or barrel exports; not all are truly dead, but signal **API surface bloat**.

### B) Potentially stale or underused modules
- 1D orphan candidates include:
  - `src/journal/session-log.ts`
  - `src/ui/html-report.ts`
  - `src/browser/sub-agent-delegator.ts` (parallel variant flagged)
  - multiple daemon/browser helper modules flagged as low-reference
- 1P orphan candidates include:
  - `src/pages/OnboardingPage.tsx`
  - `src/lib/secureConnectionStore.ts`
  - `src/hooks/daemonSessions/connectionStorage.ts`
  - several `*.test.tsx` files flagged by heuristic (false-positive prone)

### C) Technical debt markers
- TODO/FIXME/HACK count:
  - 1D: 18
  - 1M: 2
  - 1P: 4

## Risk interpretation
- **Risk = Medium**: high-export surfaces increase cognitive load and contract confusion, even if runtime-safe.
- **Confidence = Medium**: static dead-code detection has false positives; requires owner triage.

## Recommended triage process (not applied)
1. Auto-classify `ts-prune` output into `internal-only`, `intentional-public`, `remove`.
2. Add `@public` annotation convention for real exported API.
3. Introduce weekly dead-export budget gate (warn-only first).
