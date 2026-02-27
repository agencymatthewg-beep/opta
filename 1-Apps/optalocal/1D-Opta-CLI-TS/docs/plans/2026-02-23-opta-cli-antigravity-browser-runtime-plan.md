# Opta CLI — Antigravity Browser Runtime 110% Parity Plan
Date: 2026-02-23
Last Updated: 2026-02-24
Owner: Opta Max
Status: Execution Complete (M1-M4 complete + adaptation and safety hardening complete)
Program Goal: Reach full Antigravity browser-runtime parity and exceed it with deterministic safety, stronger replay guarantees, and operator-first ergonomics.

## 1) Mission and "110%" Definition
This plan defines how Opta CLI reaches:
1. 100% parity with the browser-runtime feature areas currently documented for Antigravity.
2. An additional 10% advantage focused on production safety, deterministic behavior, and operational debuggability.

"110%" in this plan means parity plus measurable overperformance in:
- Safety determinism (no high-risk action bypass).
- Replay/forensics completeness (artifact and timeline guarantees).
- Operator control latency and rollback ergonomics.
- Validation gates in CI before rollout.

## 2) External Antigravity Feature Model (What We Are Matching)
Public references used for feature modeling:
- Google Developers Blog (Antigravity announcement): editor/browser split, manager supervision model, artifacting, and iterative-learning positioning.
- Antigravity docs (`/docs/ai-agents`, `/docs/browser-extension`, `/docs/complete-feature-list`): autonomous agents, browser assistant UX, and operational controls.

Important note:
- Some mechanics are inferred from public behavior descriptions. Inferred claims are marked as such in the parity matrix.

## 3) How Antigravity Browser Runtime Works (Target Behavior)
### 3.1 Execution Loop
1. Operator gives high-level objective.
2. Agent decomposes into browser actions (navigate/read/click/type/submit).
3. Runtime executes actions in a browser context while emitting step artifacts.
4. Manager/supervisor path can intervene (pause/approve/stop).
5. Artifacts support replay, debug, and quality control.

### 3.2 Safety Loop
1. Action is classified by risk and destination.
2. Host and origin policy is evaluated.
3. High-risk actions require explicit operator approval.
4. Decision and action outcome are logged for audit.

### 3.3 Operator UX
1. Live state visibility (active runs, approval queue, action stream).
2. Immediate controls (pause/resume/stop/kill).
3. Replay and evidence view for post-run forensics.

### 3.4 Learning Loop (Inferred)
1. Historical run artifacts and outcomes are used to improve future decision quality.
2. Failure modes are used to adapt strategy or routing.
3. Operationally, this requires persistent run grouping and deterministic replay indexes.

## 4) Verified Opta Baseline (As of 2026-02-24)
Validation commands run:
- `npm run typecheck` -> PASS
- `CI=1 npm test -- tests/browser/runtime-daemon.test.ts tests/browser/intent-router.test.ts` -> PASS (21/21)
- `CI=1 npm test -- tests/integration/browser-autonomous-flow.test.ts` -> PASS (6/6)
- `CI=1 npm test -- tests/browser/policy-engine.test.ts tests/browser/replay.test.ts tests/browser/quality-gates.test.ts tests/browser/canary-evidence.test.ts tests/browser/run-corpus.test.ts tests/commands/slash-browser.test.ts tests/tui/App.test.tsx tests/tui/StatusBar.test.tsx` -> PASS (99/99)
- `CI=1 npm run test:browser:runtime-regression` -> PASS (139/139)
- `CI=1 npm run test:browser:canary-proof` -> PASS (16/16)
- `CI=1 npm test -- tests/core/tool-compatibility.test.ts tests/core/agent-protocol-retry.test.ts tests/core/agent-permissions.browser-session.test.ts tests/browser/runtime-daemon.concurrency.test.ts tests/integration/browser-autonomous-flow.test.ts` -> PASS (18/18)

Core implemented baseline:
- Runtime daemon lifecycle and persistence:
  - `src/browser/runtime-daemon.ts`
  - `src/browser/session-store.ts`
- Intent auto-routing hook:
  - `src/browser/intent-router.ts`
  - `src/core/agent.ts`
- Policy engine (risk + host rules + approval):
  - `src/browser/policy-engine.ts`
  - `src/core/agent-permissions.ts`
- Slash control surface and approval log:
  - `src/browser/control-surface.ts`
  - `src/commands/slash/browser.ts`
  - `src/browser/approval-log.ts`
- Artifacts and replay summaries:
  - `src/browser/artifacts.ts`
  - `src/browser/replay.ts`
  - `src/browser/native-session-manager.ts`

## 5) Opta vs Antigravity Parity Matrix (Feature-by-Feature)
Status key:
- `Implemented`: feature is present and validated.
- `Partial`: core exists, but capability depth is below target.
- `Missing`: not present yet.

| Capability Area | Antigravity Model | Opta Current | Status | Gap to Close | 110% Target |
| --- | --- | --- | --- | --- | --- |
| Autonomous browser action execution | Agent performs browser steps from high-level intent | Runtime daemon + tool executors route browser actions | Implemented | None for baseline | Add deterministic action retry taxonomy with classified failure reasons |
| Session persistence across turns | Stateful continuity across runs | Persistent runtime sessions with recovery + optional isolated profile continuity + daemon auto-prune scheduler + surfaced prune telemetry in status/TUI | Implemented | Telemetry history is last-run only | Add prune-history rollups and trend alerts |
| Intent auto-routing | Web-intent tasks routed without manual command | Heuristic intent injection into agent prompt | Partial | Confidence calibration is heuristic only | Add model-assisted intent confidence with deterministic fallback |
| Host allow/block enforcement | Destination constraints are policy-gated | Allow/block evaluated by policy engine with deterministic normalization tests (scheme/case/port patterns) + deterministic property-based host/origin tests | Implemented | None in current scope | Expand fuzz corpus size in nightly jobs |
| High-risk approval gate | Sensitive actions require operator approval | High-risk class forces approval, logs decision, and persists structured risk evidence signals | Implemented | None in current scope | Add optional DOM-context signals when runtime exports richer metadata |
| Kill/pause control path | Supervisor can interrupt immediately | `/browser pause|resume|stop|kill` + always-on Browser Manager rail shortcuts (`Ctrl+P`, `Ctrl+X`, `Ctrl+R`) | Implemented | None in current scope | Add per-session kill/pause granularity |
| Approval observability | Live decision visibility | Approval history via JSONL + `/browser approvals` + Browser Control pending queue + always-on rail risk telemetry | Implemented | None in current scope | Add long-horizon approval trend rollups |
| Artifact capture | Step-level artifacts for all actions | `metadata.json` + `steps.jsonl` + `recordings.json` + persisted `visual-diff-results.jsonl` with `runId` grouping | Implemented | None for milestone scope | Add adaptive retry taxonomy from corpus trends |
| Replay UX | Rich run replay for operator debugging | Slash replay + interactive step scrub + artifact preview (HTML text snippet + inline byte preview + dimensions) + visual diff summary + persisted diff ingestion + deterministic perceptual/regression scoring | Implemented | Inline previews are terminal-native and non-raster | Add optional external thumbnail renderer |
| Learning substrate (inferred) | Repeated runs improve execution quality | Run-corpus summaries persist regression signals + deterministic adaptation hints feed intent/policy (feature-flagged off by default) | Implemented | None in current scope | Add staged rollout thresholds per environment |
| CI quality gates | Reliability validated pre-release | Unit/integration tests + `test:browser:gates` quality-gate suite + required CI gate job | Implemented | Branch protection wiring still required at repository policy level | Enforce required check policy in repo settings |
| Operator ergonomics | Manager-like continuous oversight | Dedicated Browser Control workspace + command controls + pending-approval queue badges + always-on manager rail | Implemented | None in current scope | Add richer split-pane timeline for dense sessions |

## 6) Execution Streams (Parallel, Owned, and Non-Overlapping)
The work is split into independent streams to maximize safe concurrency.

### Stream A: Runtime and Persistence Hardening
Owner: Runtime
Primary files:
- `src/browser/runtime-daemon.ts`
- `src/browser/session-store.ts`
- `tests/browser/runtime-daemon.test.ts`
- `tests/browser/runtime-daemon.concurrency.test.ts`

Tasks:
1. Add optional persisted profile continuity mode with explicit security warning and default-off behavior.
2. Add restart invariants to prevent stale session resurrection.
3. Add lock/lease guard around recovery to avoid duplicate restore races.

Acceptance:
- Recovery deterministic under concurrent restart tests.
- No orphan sessions after daemon reconfiguration.

### Stream B: Intent and Policy Fidelity
Owner: Autonomy/Safety
Primary files:
- `src/browser/intent-router.ts`
- `src/browser/policy-engine.ts`
- `src/core/agent.ts`
- `tests/browser/intent-router.test.ts`
- `tests/browser/policy-engine.test.ts`

Tasks:
1. Introduce scored intent decision (`route | do-not-route`) with rationale payload.
2. Extend risk classification signals beyond keyword patterns.
3. Add host normalization/property tests for wildcard and subdomain edge cases.

Acceptance:
- 0 known high-risk bypasses in policy tests.
- Deterministic intent decision path for ambiguous prompts.

### Stream C: Control Surface, Artifacts, and Replay
Owner: Operator Experience
Primary files:
- `src/tui/App.tsx`
- `src/browser/control-surface.ts`
- `src/browser/artifacts.ts`
- `src/browser/replay.ts`
- `src/browser/types.ts`
- `tests/browser/control-surface.test.ts`
- `tests/browser/replay.test.ts`

Tasks:
1. Add a dedicated Browser Control Pane (not slash-only).
2. Add `runId` to session metadata and artifact grouping.
3. Add recording index and replay manifest for deterministic run diffs.
4. Add replay step scrub + artifact preview support in TUI.

Acceptance:
- Operator can pause/kill from pane in <=2 interactions.
- Replay supports deterministic step navigation.

### Stream D: Validation, Gates, and Rollout Safety
Owner: Reliability
Primary files:
- `tests/integration/browser-autonomous-flow.test.ts`
- CI workflow and test scripts
- release/runbook docs

Tasks:
1. Add benchmark gate (latency/success thresholds).
2. Add artifact completeness gate (metadata/timeline/screenshot policy compliance).
3. Add canary rollout checklist and rollback drill verification.

Acceptance:
- Build fails when benchmark or artifact gates regress.
- Rollback can be executed in <=5 minutes.

## 7) Milestone Plan (Current Reality + Remaining Work)
### M1 Runtime Daemon + Persistence
State: Complete and validated.
Evidence:
- Runtime and session-store implementation present.
- Required runtime tests passing.

### M2 Intent Auto-Routing + Policy Engine
State: Complete and validated (including deterministic adaptation hook).
Evidence:
- Intent routing supports deterministic adaptation penalty via run-corpus hint inputs.
- Policy engine emits structured risk evidence and deterministic adaptive escalation.
- Host/origin behavior hardened with deterministic property-based tests.

### M3 Control Surface + Artifacts + Replay
State: Complete and validated for this plan scope.
Evidence:
- Browser Control pane + slash controls + pending approval observability are live.
- Replay includes step scrub, inline artifact preview, persisted visual-diff ingestion, severity, and regression signal derivation.
- `runId`/recording index continuity is persisted and replay-compatible.

### M4 Validation + Hardening + Release Gate
State: Complete and validated for this plan scope.
Evidence:
- Benchmark telemetry ingestion now feeds deterministic threshold checks.
- Canary evidence and rollback drill capture are implemented via `/browser canary` and `/browser canary rollback`.
- Runbook added: `docs/runbooks/browser-runtime-canary-24h.md`.
- CI includes required browser runtime regression and canary-proof jobs.
- Deterministic retry taxonomy metadata is emitted from runtime/tool error surfaces.

## 8) Safety Contract (Non-Negotiable)
1. High-risk browser actions always require approval before execution.
2. Host allow/block policy is enforced for all navigations and high-impact actions.
3. Explicit kill and pause path must remain available regardless of routing mode.
4. Any policy decision must be audit-logged with timestamp, action, and outcome.

## 9) Opta CLI vs Antigravity Browser Usage Model
This section defines how operators use each system for equivalent workflows.

| Workflow | Antigravity Pattern | Opta CLI Pattern (Now) | Opta CLI Pattern (Target) |
| --- | --- | --- | --- |
| Start autonomous web task | Prompt in editor with browser context | Prompt in chat with `browser.autoInvoke=true` | Same, plus confidence/rationale display |
| Interrupt/stop run | Manager controls | `/browser pause`, `/browser stop`, `/browser kill` | Dedicated Browser Control Pane hotkeys |
| Approve high-risk action | Manager approval prompt | Inline permission prompt + approval log + pending queue (age/risk badges) | Always-on queue + inline rationale |
| Inspect run evidence | Artifact/replay views | `/browser replay <sessionId>` + session artifacts | Interactive replay scrub + visual diff index |
| Review safety decisions | Manager logs | `/browser approvals [limit]` | Pane-integrated approval timeline |

## 10) Required Validation Commands
```bash
cd ~/Synced/Opta/1-Apps/1D-Opta-CLI-TS
npm run typecheck
CI=1 npm test -- tests/browser/runtime-daemon.test.ts tests/browser/intent-router.test.ts
CI=1 npm test -- tests/integration/browser-autonomous-flow.test.ts
CI=1 npm test -- tests/browser/policy-engine.test.ts tests/browser/replay.test.ts tests/browser/quality-gates.test.ts tests/browser/canary-evidence.test.ts tests/browser/run-corpus.test.ts tests/commands/slash-browser.test.ts tests/tui/App.test.tsx tests/tui/StatusBar.test.tsx
```

Recommended full browser suite:
```bash
CI=1 npm test -- tests/browser/runtime-daemon.test.ts tests/browser/runtime-daemon.concurrency.test.ts tests/browser/intent-router.test.ts tests/browser/policy-engine.test.ts tests/browser/control-surface.test.ts tests/browser/replay.test.ts tests/integration/browser-autonomous-flow.test.ts
```

## 11) Rollout and Rollback
Rollout:
1. Shadow mode (`autoInvoke=false`) with policy/audit verification.
2. Low-risk auto-routing only.
3. Full policy-gated autonomous mode.
4. 24h canary with benchmark and artifact gate monitoring.

Rollback:
1. Set `browser.autoInvoke=false`.
2. Restart CLI daemon/session.
3. Preserve artifacts and approval logs for incident review.

## 12) Open Decisions (Needed for Full 110% Completion)
1. Persisted profile mode default remains `off` unless explicitly enabled by operator.
2. Branch protection enforcement for new CI jobs remains an external repository setting step.
3. Production 24h canary execution evidence still needs to be captured from a live staging environment.

## 13) 2026-02-24 Completion Evidence
Implemented in code:
1. Always-on Browser Manager rail with non-modal controls and pending-risk telemetry.
2. Deterministic run-corpus adaptation into intent/policy (`browser.adaptation.enabled=false` default).
3. Safety hardening:
   - property-style host/origin tests,
   - daemon-started session scan in permission preflight to recover/reuse persisted sessions deterministically,
   - host/origin URL re-check on sensitive `browser_click`/`browser_type` session actions,
   - structured risk evidence,
   - deterministic retry taxonomy,
   - kill-triggered cancellation of in-flight browser actions.
4. Runtime data lifecycle hardening:
   - automatic run-corpus summary refresh on runtime lifecycle events (`startup`, session close, stop/kill),
   - deterministic run-corpus refresh de-duplication for concurrent lifecycle events,
   - configurable artifact retention policy with safe session-dir pruning (feature-flagged off by default).
5. Release hardening: CI runtime-regression + canary-proof jobs and scripts.
6. Any-model robustness hardening:
   - per-model/provider tool compatibility telemetry cache,
   - deterministic pseudo-protocol retry path coverage.

Execution evidence (latest run):
- `npm run typecheck` -> PASS
- `CI=1 npm test -- tests/browser/runtime-daemon.test.ts tests/browser/intent-router.test.ts` -> PASS (2 files, 21 tests)
- `CI=1 npm test -- tests/integration/browser-autonomous-flow.test.ts` -> PASS (1 file, 6 tests)
- `CI=1 npm test -- tests/browser/policy-engine.test.ts tests/browser/replay.test.ts tests/browser/quality-gates.test.ts tests/browser/canary-evidence.test.ts tests/browser/run-corpus.test.ts tests/commands/slash-browser.test.ts tests/tui/App.test.tsx tests/tui/StatusBar.test.tsx` -> PASS (8 files, 99 tests)
- `CI=1 npm run test:browser:runtime-regression` -> PASS (15 files, 139 tests)
- `CI=1 npm run test:browser:canary-proof` -> PASS (2 files, 16 tests)
- `CI=1 npm test -- tests/core/tool-compatibility.test.ts tests/core/agent-protocol-retry.test.ts tests/core/agent-permissions.browser-session.test.ts tests/browser/runtime-daemon.concurrency.test.ts tests/integration/browser-autonomous-flow.test.ts` -> PASS (5 files, 18 tests)

## 14) Source References
- Google Developers Blog: https://developers.googleblog.com/en/introducing-google-ai-agents-and-assistant/
- Antigravity docs overview pages:
  - https://www.antigravity.im/docs/ai-agents
  - https://www.antigravity.im/docs/browser-extension
  - https://www.antigravity.im/docs/complete-feature-list
