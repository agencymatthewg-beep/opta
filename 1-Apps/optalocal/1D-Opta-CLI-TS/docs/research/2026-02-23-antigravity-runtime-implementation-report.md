# Antigravity Browser Runtime Implementation Report
Date: 2026-02-24
Plan: `docs/plans/2026-02-23-opta-cli-antigravity-browser-runtime-plan.md`

## Outcome Summary
Execution completed for the requested scope.

Delivered:
1. Always-on Browser Manager rail with non-modal controls, approvals visibility, and risk telemetry.
2. Deterministic closed-loop run-corpus adaptation into intent/policy, feature-flagged OFF by default.
3. Safety hardening with deterministic retry taxonomy, richer policy risk evidence, property-style host/origin coverage, host/origin re-check on sensitive session actions, and kill-driven in-flight action cancellation.
4. Runtime data lifecycle hardening with automatic run-corpus refresh and configurable artifact retention pruning.
5. Release hardening with CI regression/canary jobs and automated canary+rollback proof tests.
6. Any-model robustness hardening with per-model tool-call compatibility telemetry and explicit pseudo-protocol retry coverage.
7. Plan/report docs updated with exact command evidence.

## Implemented Scope
### 1) Always-on Browser Manager rail
- Added always-visible runtime rail and telemetry panel.
- Added non-modal runtime controls (`Ctrl+P` pause/resume, `Ctrl+X` kill, `Ctrl+R` refresh).
- Surfaced pending approval risk distribution and latest decision context outside modal overlays.

Key files:
- `src/tui/BrowserManagerRail.tsx`
- `src/tui/App.tsx`
- `src/tui/StatusBar.tsx`
- `src/tui/BrowserControlOverlay.tsx`
- `src/tui/keybindings.ts`
- `src/tui/hooks/useKeyboard.ts`

### 2) Deterministic closed-loop adaptation (OFF by default)
- Added adaptation model derived from run-corpus summary.
- Wired deterministic hint propagation into:
  - intent routing (route penalty)
  - policy evaluation (risk escalation)
- Added runtime lifecycle refresh of run-corpus summary (`startup`, session close, stop/kill) with in-flight de-duplication.
- Default remains disabled (`browser.adaptation.enabled=false`) to preserve current behavior unless explicitly enabled.

Key files:
- `src/browser/adaptation.ts`
- `src/browser/run-corpus.ts`
- `src/browser/intent-router.ts`
- `src/browser/policy-engine.ts`
- `src/core/config.ts`
- `src/core/agent.ts`
- `src/core/tools/executors.ts`
- `src/core/agent-permissions.ts`
- `src/core/tool-compatibility.ts`
- `tests/core/tool-compatibility.test.ts`

### 3) Safety hardening
- Added deterministic retry taxonomy and attached retry metadata to runtime/tool error envelopes.
- Expanded policy decision outputs with structured `riskEvidence` (signals + classifier + adaptation reason).
- Added deterministic property-style host/origin tests to enforce strict allow/block semantics.
- Added host/origin URL re-check on sensitive `browser_click`/`browser_type` actions using active session URL when explicit URL arguments are absent.
- Added in-flight action cancellation on runtime kill and fail-closed `ACTION_CANCELLED` retry metadata normalization.
- Added deterministic pseudo-protocol retry path test for plain-text pseudo tool directives.
- Added daemon-start-before-health in permission-layer session scanning so recovered persisted sessions are reusable before first browser tool execution.
- Added configurable artifact retention pruning for browser session artifact directories (disabled by default for behavior preservation).

Key files:
- `src/browser/retry-taxonomy.ts`
- `src/browser/native-session-manager.ts`
- `src/browser/runtime-daemon.ts`
- `src/browser/artifacts.ts`
- `src/browser/types.ts`
- `src/core/tools/executors.ts`
- `src/browser/policy-engine.ts`
- `src/core/agent-permissions.ts`
- `src/core/tool-protocol.ts`
- `tests/browser/policy-engine.test.ts`
- `tests/browser/intent-router.test.ts`
- `tests/browser/runtime-daemon.concurrency.test.ts`
- `tests/browser/artifacts-retention.test.ts`
- `tests/core/agent-permissions.browser-session.test.ts`
- `tests/core/agent-protocol-retry.test.ts`

### 4) Release hardening and canary/rollback proof
- Added runtime regression and canary-proof scripts.
- Added CI workflow jobs for regression and canary proof, and wired them into parity strict gate dependencies.
- Extended `/browser` outputs for richer approvals telemetry and canary evidence byte-size proof.

Key files:
- `package.json`
- `.github/workflows/parity-macos-codex.yml`
- `src/commands/slash/browser.ts`
- `tests/commands/slash-browser.test.ts`
- `tests/browser/canary-evidence.test.ts`
- `tests/browser/quality-gates.test.ts`
- `tests/browser/replay.test.ts`
- `tests/browser/run-corpus.test.ts`

## Additional Changed Files (within this scope)
- `src/browser/approval-log.ts`
- `src/browser/control-surface.ts`
- `src/browser/profile-store.ts`
- `src/browser/session-store.ts`
- `src/browser/canary-evidence.ts`
- `src/browser/quality-gates.ts`
- `src/browser/replay.ts`
- `src/browser/run-corpus.ts`
- `src/browser/artifacts.ts`
- `src/core/agent.ts`
- `src/core/agent-permissions.ts`
- `src/core/tool-compatibility.ts`
- `src/core/tools/executors.ts`
- `src/browser/policy-engine.ts`
- `src/browser/native-session-manager.ts`
- `src/browser/runtime-daemon.ts`
- `src/tui/App.tsx`
- `src/core/config.ts`
- `src/browser/control-surface.ts`
- `tests/browser/runtime-daemon.test.ts`
- `tests/browser/runtime-daemon.concurrency.test.ts`
- `tests/browser/artifacts-retention.test.ts`
- `tests/browser/run-corpus.test.ts`
- `tests/core/config.test.ts`
- `tests/integration/browser-autonomous-flow.test.ts`
- `tests/core/tool-compatibility.test.ts`
- `tests/core/agent-protocol-retry.test.ts`
- `tests/core/agent-permissions.browser-session.test.ts`
- `tests/tui/App.test.tsx`
- `tests/tui/StatusBar.test.tsx`

## Commands Run
Required validations:
1. `npm run typecheck`
2. `CI=1 npm test -- tests/browser/runtime-daemon.test.ts tests/browser/intent-router.test.ts`
3. `CI=1 npm test -- tests/integration/browser-autonomous-flow.test.ts`
4. `CI=1 npm test -- tests/browser/policy-engine.test.ts tests/browser/replay.test.ts tests/browser/quality-gates.test.ts tests/browser/canary-evidence.test.ts tests/browser/run-corpus.test.ts tests/commands/slash-browser.test.ts tests/tui/App.test.tsx tests/tui/StatusBar.test.tsx`

Additional hardening proofs:
5. `CI=1 npm run test:browser:runtime-regression`
6. `CI=1 npm run test:browser:canary-proof`
7. `CI=1 npm test -- tests/core/tool-compatibility.test.ts tests/core/agent-protocol-retry.test.ts tests/core/agent-permissions.browser-session.test.ts tests/browser/runtime-daemon.concurrency.test.ts tests/integration/browser-autonomous-flow.test.ts`

## Test Output Summary
- `npm run typecheck`: PASS (`tsc --noEmit` clean)
- Runtime daemon + intent router suite: PASS (2 files, 21 tests)
- Browser autonomous integration suite: PASS (1 file, 6 tests)
- Policy/replay/gates/canary/run-corpus/slash/tui suite: PASS (8 files, 99 tests)
- Browser runtime regression CI script: PASS (15 files, 139 tests)
- Browser canary-proof CI script: PASS (2 files, 16 tests)
- Hardening-focused any-model suite: PASS (5 files, 18 tests)

## Determinism / Safety Constraints Check
- Preserve behavior unless changed: maintained; adaptation defaults OFF.
- High-risk browser actions require approval: enforced and covered.
- Host allow/block strictness: enforced and property-tested.
- Kill/pause path immediate and reachable: non-modal bindings active and tested.
- New behavior deterministic and reversible: deterministic scoring/taxonomy and feature flags.

## Known Gaps
1. Branch protection policy wiring for new CI jobs is an external repository configuration step.
2. Live staging 24h canary evidence is still an operational runbook action outside unit/integration automation.

## Go / No-Go Recommendation
Go for merge and controlled rollout.

Rationale:
- All required validation commands pass.
- Regression and canary-proof CI scripts pass.
- Safety-critical invariants (approval gate, strict host/origin enforcement, immediate kill/pause) remain intact with added test coverage.
