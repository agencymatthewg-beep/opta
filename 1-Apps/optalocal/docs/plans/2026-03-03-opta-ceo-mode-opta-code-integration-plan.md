# Opta CEO Mode + Opta Code Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make CEO mode a first-class, always-on background operator flow (CLI + daemon + Opta Code) with clear lifecycle controls, strong safety gates, and competitive observability.

**Architecture:** Keep runtime intelligence in `1D-Opta-CLI-TS` (daemon/session manager/agent loop) and expose CEO orchestration via typed `v3` contracts. Keep `1P-Opta-Code-Universal` as a strict daemon client with a dedicated CEO Control Center page and zero duplicated orchestration logic.

**Tech Stack:** TypeScript, Fastify daemon, shared protocol (`src/protocol/v3/*` + `@opta/protocol-shared`), React 18/Tauri desktop, Vitest, Playwright.

---

## Current Investigation Summary (2026-03-03)

1. CEO foundations exist in CLI runtime:
- `1D-Opta-CLI-TS/src/core/autonomy.ts`
- `1D-Opta-CLI-TS/src/commands/slash/workflow.ts` (`/autonomy ceo-max`)
- `1D-Opta-CLI-TS/src/core/pre-flight.ts`
- `1D-Opta-CLI-TS/src/core/agent.ts` (CEO run report log)

2. Background primitives exist in daemon/runtime:
- `1D-Opta-CLI-TS/src/daemon/background-manager.ts`
- `/v3/background*` routes in `1D-Opta-CLI-TS/src/daemon/http-server.ts`

3. Opta Code exposes generic controls, but not CEO-first workflow:
- `1P-Opta-Code-Universal/src/components/SettingsModal.tsx` has `autonomy.mode = ceo`
- `1P-Opta-Code-Universal/src/pages/BackgroundJobsPage.tsx` is generic shell process control
- No dedicated CEO run/objective queue/start-pause-resume UI

4. Key gap: `runPreFlightOrchestration()` is only used by CLI `opta do` (`1D-Opta-CLI-TS/src/commands/do.ts`), not daemon session submissions used by Opta Code.

5. Key telemetry mismatch:
- Opta Code `TelemetryPanel.tsx` listens for `agent.phase` and `atpo.intervene`, but daemon session stream currently does not emit these event types.

---

### Task 1: Define CEO orchestration contract in `v3` protocol

**Files:**
- Modify: `1D-Opta-CLI-TS/src/protocol/v3/types.ts`
- Modify: `1D-Opta-CLI-TS/src/protocol/v3/http.ts`
- Modify: `1D-Opta-CLI-TS/src/protocol/v3/operations.ts`
- Modify: `1D-Opta-CLI-TS/packages/protocol-shared/src/index.ts`
- Test: `1D-Opta-CLI-TS/tests/protocol/v3/messages.test.ts`
- Test: `1D-Opta-CLI-TS/tests/protocol/operations-contract.test.ts`

**Step 1: Write failing tests for new CEO event + request/response schemas**
Run: `cd 1D-Opta-CLI-TS && npm run test:run -- tests/protocol/v3/messages.test.ts tests/protocol/operations-contract.test.ts`
Expected: FAIL (CEO contracts absent).

**Step 2: Add new CEO protocol primitives**
- CEO run state/event types (`ceo.run.started|checkpoint|paused|resumed|completed|failed`)
- CEO run control API request/response types
- Optional CEO preflight payload structure

**Step 3: Re-run tests and typecheck**
Run: `cd 1D-Opta-CLI-TS && npm run typecheck && npm run test:run -- tests/protocol/v3/messages.test.ts tests/protocol/operations-contract.test.ts`
Expected: PASS.

---

### Task 2: Add daemon CEO run lifecycle operations

**Files:**
- Modify: `1D-Opta-CLI-TS/src/daemon/operations/registry.ts`
- Modify: `1D-Opta-CLI-TS/src/daemon/operations/execute.ts`
- Modify: `1D-Opta-CLI-TS/src/daemon/http-server.ts`
- Create: `1D-Opta-CLI-TS/src/daemon/ceo-run-manager.ts`
- Test: `1D-Opta-CLI-TS/tests/daemon/operations-routes.test.ts`
- Test: `1D-Opta-CLI-TS/tests/daemon/session-manager.test.ts`

**Step 1: Add failing route tests**
- `ceo.run.start`
- `ceo.run.pause`
- `ceo.run.resume`
- `ceo.run.stop`
- `ceo.run.status`
Expected: FAIL.

**Step 2: Implement operation registry bindings**
- Map operation IDs to CEO manager methods.
- Enforce safety class `write`/`dangerous` as appropriate.

**Step 3: Expose route wiring and operation listing**
Ensure CEO operations appear in `/v3/operations` and are callable through existing operation execution path.

**Step 4: Verify**
Run: `cd 1D-Opta-CLI-TS && npm run test:run -- tests/daemon/operations-routes.test.ts tests/daemon/session-manager.test.ts`
Expected: PASS.

---

### Task 3: Unify CEO preflight for CLI and daemon-backed runs

**Files:**
- Modify: `1D-Opta-CLI-TS/src/core/pre-flight.ts`
- Modify: `1D-Opta-CLI-TS/src/commands/do.ts`
- Modify: `1D-Opta-CLI-TS/src/daemon/session-manager.ts`
- Test: `1D-Opta-CLI-TS/tests/commands/do.test.ts` (or nearest do command suite)
- Test: `1D-Opta-CLI-TS/tests/daemon/session-manager-preflight.test.ts`

**Step 1: Extract preflight as reusable service output (non-TTY compatible)**
- Split interactive prompts from analysis payload generation.
- Add daemon-safe path that can consume preflight recommendations without terminal prompts.

**Step 2: Wire daemon turn path for CEO mode**
- If `autonomy.mode=ceo`, run preflight analysis gate and emit preflight events before turn execution.

**Step 3: Verify**
Run targeted tests; ensure CLI behavior is preserved and daemon path now supports CEO preflight.

---

### Task 4: Emit CEO/ATPO/sub-agent telemetry events for Opta Code

**Files:**
- Modify: `1D-Opta-CLI-TS/src/daemon/session-manager.ts`
- Modify: `1D-Opta-CLI-TS/src/core/agent.ts`
- Modify: `1D-Opta-CLI-TS/src/protocol/v3/types.ts`
- Test: `1D-Opta-CLI-TS/tests/daemon/session-manager.test.ts`
- Test: `1D-Opta-CLI-TS/tests/protocol/v3/messages.test.ts`

**Step 1: Add failing tests for event emission**
- `atpo.state`
- `subagent.spawn/progress/done`
- `ceo.run.checkpoint`
Expected: FAIL.

**Step 2: Bridge existing agent callbacks to daemon events**
- Use `onAtpoState`, `onSubAgentSpawn`, `onSubAgentProgress`, `onSubAgentDone` in session manager `agentLoop` invocation.

**Step 3: Verify**
Ensure deterministic event ordering and no event schema regressions.

---

### Task 5: Build Opta Code CEO Control Center page

**Files:**
- Create: `1P-Opta-Code-Universal/src/pages/CeoControlPage.tsx`
- Modify: `1P-Opta-Code-Universal/src/App.tsx`
- Modify: `1P-Opta-Code-Universal/src/lib/daemonClient.ts`
- Modify: `1P-Opta-Code-Universal/src/types.ts`
- Modify: `1P-Opta-Code-Universal/src/opta.css`
- Test: `1P-Opta-Code-Universal/src/pages/CeoControlPage.test.tsx`

**Step 1: Add failing UI tests**
- Start/pause/resume/stop CEO run controls.
- Objective input + queue.
- Live run status panel.
Expected: FAIL.

**Step 2: Implement page with daemon-only integration**
- No local orchestration logic in React.
- Reuse operation runner patterns for safe command execution.

**Step 3: Add navigation + palette command**
- New top-level page (e.g., `CEO`).
- Command palette entries for control actions.

**Step 4: Verify**
Run: `cd 1P-Opta-Code-Universal && npm run test -- src/pages/CeoControlPage.test.tsx && npm run build`
Expected: PASS.

---

### Task 6: Make background CEO runs resilient across reconnects

**Files:**
- Modify: `1D-Opta-CLI-TS/src/daemon/background-manager.ts`
- Modify: `1D-Opta-CLI-TS/src/daemon/lifecycle.ts`
- Modify: `1D-Opta-CLI-TS/src/daemon/session-store.ts`
- Modify: `1P-Opta-Code-Universal/src/hooks/useDaemonSessions.ts`
- Test: `1D-Opta-CLI-TS/tests/daemon/session-manager-cancel.test.ts`
- Test: `1P-Opta-Code-Universal/src/hooks/useDaemonSessions.test.tsx`

**Step 1: Decide persistence policy and implement metadata persistence**
- Persist run metadata/checkpoints even if in-memory process handles cannot survive restart.
- Present accurate “interrupted/recoverable” state on reconnect.

**Step 2: Rehydrate run state in UI after daemon reconnect**
- Restore CEO run cards/status from stored events and status APIs.

**Step 3: Verify reconnection SLO**
- Target p95 reconnect restoration under 2s.

---

### Task 7: Add CEO-specific safety/approval policy gates

**Files:**
- Modify: `1D-Opta-CLI-TS/src/core/autonomy.ts`
- Modify: `1D-Opta-CLI-TS/src/core/config.ts`
- Modify: `1D-Opta-CLI-TS/src/daemon/permission-coordinator.ts`
- Modify: `1P-Opta-Code-Universal/src/components/SettingsModal.tsx`
- Test: `1D-Opta-CLI-TS/tests/core/autonomy.test.ts`
- Test: `1D-Opta-CLI-TS/tests/commands/slash-workflow.test.ts`

**Step 1: Add policy knobs**
- CEO maximum runtime budget
- required-approval steps for destructive actions
- allowlist/denylist for tool categories while unattended

**Step 2: Add UI controls in settings**
- CEO policy section with explicit warnings and defaults.

**Step 3: Verify**
- Tests validate fail-closed behavior for missing approvals.

---

### Task 8: Competitive telemetry + executive reporting surface

**Files:**
- Modify: `1P-Opta-Code-Universal/src/components/TelemetryPanel.tsx`
- Modify: `1P-Opta-Code-Universal/src/hooks/daemonSessions/timeline.ts`
- Modify: `1D-Opta-CLI-TS/src/core/autonomy.ts`
- Test: `1P-Opta-Code-Universal/src/components/TelemetryPanel.test.tsx`

**Step 1: Fix event mismatch**
- Consume only emitted event contracts (or add missing emitted events first).

**Step 2: Add CEO metrics panes**
- Objective progress, cycle/phase, tool budget usage, intervention count, failure-recovery count.

**Step 3: Add executive report export flow**
- Export run summary as markdown/json from CEO page.

---

### Task 9: Release gates and rollout

**Files:**
- Modify: `.github/workflows/opta-code-parity.yml`
- Modify: `.github/workflows/opta-local-web-ci.yml`
- Create: `.github/workflows/opta-ceo-e2e-gate.yml`
- Create: `1P-Opta-Code-Universal/tests/e2e/ceo-background-flow.spec.ts`

**Step 1: Add CEO-specific CI checks**
- Protocol contract checks
- daemon operation route tests
- Opta Code CEO page unit tests
- Playwright CEO background flow smoke

**Step 2: Staged rollout**
- Phase 1: hidden flag (`feature.ceoControlCenter=false` default)
- Phase 2: beta enablement
- Phase 3: default-on after SLO pass

**Step 3: Verify production readiness**
- 24h soak run with reconnect + cancellation + background job churn.

---

## Success Criteria

1. CEO run can be started, paused, resumed, and stopped from Opta Code without CLI fallback.
2. CEO run continues in background while users work in other sessions/pages.
3. CEO telemetry in Opta Code reflects real daemon events (no synthetic mismatch assumptions).
4. Reconnect resumes accurate CEO run state and timeline.
5. Safety gates remain fail-closed for risky actions in unattended mode.
6. CI includes CEO-specific contract + E2E checks.

## Non-Goals (This Plan)

1. Replacing generic background jobs panel entirely (keep as low-level utility).
2. Re-architecting core agent reasoning loop beyond required CEO lifecycle hooks.
3. Full cross-platform packaging changes unrelated to CEO capability.

## Recommended Execution Order

1. Tasks 1-4 (contract + daemon runtime) in parallel where independent.
2. Task 5 (UI CEO Control Center) once contracts are stable.
3. Tasks 6-8 (resilience, safety, telemetry) as hardening pass.
4. Task 9 (CI + rollout gates) before promotion.
