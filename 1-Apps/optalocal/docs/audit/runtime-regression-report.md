# Runtime Regression Report (2026-03)

## Baseline source
- `docs/audit/perf-baseline.json`
- Non-destructive command set only (type checks, contract tests, parity tests).

## Results snapshot
- 1D `npm run -s typecheck`: 2.862s, exit 0
- 1D `npm run -s test:contract`: 1.116s, exit 0 (16 tests pass)
- 1M `pytest -q tests/test_discovery_contract.py tests/test_quantize_schema.py`: 5.282s, exit 0 (10 tests pass)
- 1P `npm run -s typecheck`: 2.170s, exit 0
- 1P `npm run -s parity:check`: 0.219s, exit 0

## Regression interpretation
- No runtime regressions detected in sampled contract-critical suites.
- One structural parity warning persists: `ceo.benchmark` unmatched operation (not test-failing).

## Coverage limitations
- No long-running latency/load benchmark executed for LMX inference runtime.
- No daemon soak/reconnect endurance run in this pass.
- UI e2e and tauri packaging not exercised in this audit baseline.

## Recommendations (not applied)
1. Add daily baseline capture for these 5 commands and compare p50/p95 deltas.
2. Add optional nightly LMX synthetic inference benchmark (fixed prompt/model set).
3. Add daemon reconnection soak test (>=30 min) to catch event-stream regressions.
