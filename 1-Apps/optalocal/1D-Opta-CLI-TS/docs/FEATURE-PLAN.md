---
status: active
---

# Opta CLI — Finish-First Plan

Focus: fully finish `1D-Opta-CLI-TS` before continuing broader Opta Init funnel work.

## Definition of "Fully Finished" (CLI)

- `opta chat`, `opta do`, and `opta daemon` are stable and deterministic in long sessions.
- Default permission model is safe and consistent with policy expectations.
- Packaging/install experience is production-ready for macOS release.
- Critical parity tests and stability suites pass in CI and locally.
- Docs match actual runtime behavior and deployment topology.

## Current Baseline

- Version: `0.5.0-alpha.1`.
- Core smoke parity now green after config/policy default alignment.
- Validation run: `npm run test:parity:core-smoke` -> `52 passed / 584 tests`.

## Immediate Fixes Completed

- Restored SSH defaults for Mono512 deployment path and Python interpreter.
- Set safer browser defaults (`browser_open: ask`, `browser.autoInvoke: false`).
- Restored compatibility for legacy `browser.globalAllowedHosts` in browser policy resolution.

## Finish Sequence

### Phase 1 — Stability Lock (Now)

- [x] Run and pass daemon parity suite: `npm run test:parity:ws9`.
- [ ] Run browser safety/runtime regression suites.
- [x] Run full `npm test` (non-watch) and `npm run typecheck` on a clean tree.
- [ ] Fix any flake in session attach/reconnect/cancel paths before feature work.

### Phase 2 — Runtime Confidence

- [ ] Verify cancellation propagation from CLI -> daemon -> transport under load.
- [ ] Verify replay/reconnect behavior across process restarts.
- [ ] Verify multi-writer determinism (CLI + secondary client attach).
- [ ] Capture p95 latency + event-loop lag from soak runs and store evidence.

### Phase 3 — Release Readiness

- [ ] Finalize macOS packaging artifact naming and signing workflow.
- [ ] Validate post-install binary availability (`opta --help`) on clean machine.
- [ ] Validate first-run connect flow to LMX on LAN defaults.
- [ ] Publish release notes with hardware/runtime constraints and fallback instructions.

### Phase 4 — Documentation Lock

- [x] Align ROADMAP/APP/docs with implemented behavior (no stale defaults).
- [x] Publish a single operator runbook for `opta daemon` start/health/recovery.
- [x] Add "known-good command matrix" for support and debugging.

## Verification Command Set

```bash
npm run typecheck
npm run test:parity:core-smoke
npm run test:parity:ws9
npm test
npm run build
```

## Exit Criteria

- All verification commands pass without local patching.
- No known P0/P1 defects in daemon attach/reconnect/permission flow.
- macOS install path verified on clean machine end to end.
- Opta Init can link to real CLI release artifact confidently.
