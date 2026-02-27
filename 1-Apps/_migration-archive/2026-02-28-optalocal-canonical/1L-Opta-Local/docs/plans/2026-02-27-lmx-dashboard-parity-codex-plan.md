# LMX Dashboard Parity + Codex Simplicity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fully cover all capabilities that are currently "in LMX but not in Dashboard", while redesigning the app toward minimal, precise, Codex-style information density and adding durable AI capability orchestration aligned with the 8 non-negotiables.

**Architecture:** Introduce a single source of truth capability registry generated from LMX/OpenAPI + typed Dashboard client coverage, then build a minimal Operations surface that guarantees endpoint parity. Layer in deterministic context management, safe mutation guardrails, orchestration state machines, and lessons/decision logging so behavior improves over time instead of drifting.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Vitest, Playwright, FastAPI OpenAPI ingestion, SWR, existing `LMXClient` patterns.

---

## Scope Definition (Critical)

Because the literal label `In LMX But Not In Dashboard` is not present verbatim in this repo, define it as:

1. **All LMX server endpoints** discovered from:
   - `1M-Opta-LMX/src/opta_lmx/api/*`
2. **Minus Dashboard-supported capabilities** represented by:
   - `web/src/lib/lmx-client.ts`
   - existing route surfaces under `web/src/app/**`

This definition becomes codified in a machine-checked parity artifact so coverage is objective, not manual.

---

### Task 1: Build Capability Inventory + Parity Artifact

**Files:**
- Create: `web/scripts/generate-lmx-capability-parity.ts`
- Create: `web/src/lib/capabilities/parity.generated.json`
- Create: `web/src/lib/capabilities/types.ts`
- Modify: `web/package.json`
- Test: `web/tests/unit/capability-parity.test.ts`

**Step 1: Write the failing test**

Create test asserting generated artifact exists and every endpoint is categorized as one of:
- `in_dashboard`
- `in_lmx_not_dashboard`
- `dashboard_only`

**Step 2: Run test to verify it fails**

Run: `pnpm -s vitest web/tests/unit/capability-parity.test.ts`
Expected: FAIL (missing generator/artifact).

**Step 3: Implement generator + schema**

- Parse local LMX API files (and/or OpenAPI JSON fallback).
- Parse Dashboard client capability map.
- Emit deterministic JSON with sorted endpoints and categories.

**Step 4: Run test to verify it passes**

Run: `pnpm -s vitest web/tests/unit/capability-parity.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add web/scripts/generate-lmx-capability-parity.ts web/src/lib/capabilities/types.ts web/src/lib/capabilities/parity.generated.json web/tests/unit/capability-parity.test.ts web/package.json
git commit -m "feat(web): add generated lmx-dashboard capability parity inventory"
```

---

### Task 2: Extend Typed LMX Client to Cover Missing Endpoint Groups

**Files:**
- Modify: `web/src/lib/lmx-client.ts`
- Modify: `web/src/types/lmx.ts`
- Create: `web/src/types/skills.ts`
- Create: `web/src/types/agents.ts`
- Test: `web/tests/integration/lmx-client.integration.test.ts`

**Step 1: Write failing tests for missing operations**

Add integration cases for at least one endpoint per missing cluster:
- `/v1/responses`
- `/v1/messages`
- `/v1/embeddings`
- `/v1/rerank`
- `/v1/agents/runs`
- `/v1/skills`
- `/admin/memory`
- `/admin/diagnostics`

**Step 2: Run test to verify it fails**

Run: `pnpm -s vitest web/tests/integration/lmx-client.integration.test.ts`
Expected: FAIL (methods absent / typing gaps).

**Step 3: Add typed methods + request/response contracts**

Implement explicit methods; avoid generic `any` dispatch.

**Step 4: Run test to verify it passes**

Run: `pnpm -s vitest web/tests/integration/lmx-client.integration.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add web/src/lib/lmx-client.ts web/src/types/lmx.ts web/src/types/skills.ts web/src/types/agents.ts web/tests/integration/lmx-client.integration.test.ts
git commit -m "feat(web): add typed lmx client coverage for missing endpoint groups"
```

---

### Task 3: Add Minimal Operations Console to Guarantee Full Parity

**Files:**
- Create: `web/src/app/operations/page.tsx`
- Create: `web/src/components/operations/CapabilityList.tsx`
- Create: `web/src/components/operations/CapabilityPanel.tsx`
- Create: `web/src/components/operations/CapabilityRunCard.tsx`
- Modify: `web/src/components/shared/AppShell.tsx`
- Test: `web/tests/unit/operations-page.test.tsx`

**Step 1: Write failing UI tests**

Test should assert:
- operations page lists all `in_lmx_not_dashboard` capabilities
- each item has copyable request payload + endpoint string
- each item has run action + structured response panel

**Step 2: Run test to verify it fails**

Run: `pnpm -s vitest web/tests/unit/operations-page.test.tsx`
Expected: FAIL.

**Step 3: Implement page using generated parity artifact**

Use generated data as rendering source so coverage remains total as LMX evolves.

**Step 4: Run test to verify it passes**

Run: `pnpm -s vitest web/tests/unit/operations-page.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add web/src/app/operations/page.tsx web/src/components/operations web/src/components/shared/AppShell.tsx web/tests/unit/operations-page.test.tsx
git commit -m "feat(web): add operations console for full lmx capability parity"
```

---

### Task 4: Promote High-Value Missing Capabilities to First-Class Minimal Views

**Files:**
- Create: `web/src/app/agents/runs/page.tsx`
- Create: `web/src/app/skills/page.tsx`
- Create: `web/src/app/models/advanced/page.tsx`
- Create: `web/src/app/diagnostics/page.tsx`
- Test: `web/tests/unit/agents-runs-page.test.tsx`
- Test: `web/tests/unit/skills-page.test.tsx`

**Step 1: Write failing tests for route-level behavior**

Verify list/detail/cancel for agent runs, skills list/execute, advanced model ops, diagnostics fetch.

**Step 2: Run tests to verify fail**

Run: `pnpm -s vitest web/tests/unit/agents-runs-page.test.tsx web/tests/unit/skills-page.test.tsx`
Expected: FAIL.

**Step 3: Implement focused pages**

Keep them thin wrappers over shared operations primitives and typed client methods.

**Step 4: Run tests to verify pass**

Run: `pnpm -s vitest web/tests/unit/agents-runs-page.test.tsx web/tests/unit/skills-page.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add web/src/app/agents/runs/page.tsx web/src/app/skills/page.tsx web/src/app/models/advanced/page.tsx web/src/app/diagnostics/page.tsx web/tests/unit/agents-runs-page.test.tsx web/tests/unit/skills-page.test.tsx
git commit -m "feat(web): add minimal first-class pages for high-value lmx capabilities"
```

---

### Task 5: Codex Simplicity UI System (Minimal, Smart, Precise)

**Files:**
- Modify: `web/src/app/globals.css`
- Create: `web/src/components/shared/CodexDenseSurface.tsx`
- Create: `web/src/components/shared/CodexKeyValue.tsx`
- Create: `web/src/components/shared/CodexActionLine.tsx`
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/app/chat/page.tsx`
- Modify: `web/src/app/sessions/page.tsx`
- Test: `web/tests/e2e/smoke.spec.ts`

**Step 1: Add failing visual/layout assertions**

Playwright checks for:
- no overflow at mobile widths
- consistent density rhythm
- primary actions always visible without excessive scroll

**Step 2: Run test to verify fail**

Run: `pnpm test:e2e:smoke`
Expected: FAIL on current layout assertions.

**Step 3: Implement codex-style primitives and refactor major pages**

Rules:
- one clear primary action per panel
- compact key-value rows
- no decorative-only cards
- copy buttons on all key values (URL, model IDs, run IDs, endpoint paths)

**Step 4: Run tests to verify pass**

Run: `pnpm test:e2e:smoke`
Expected: PASS.

**Step 5: Commit**

```bash
git add web/src/app/globals.css web/src/components/shared/CodexDenseSurface.tsx web/src/components/shared/CodexKeyValue.tsx web/src/components/shared/CodexActionLine.tsx web/src/app/page.tsx web/src/app/chat/page.tsx web/src/app/sessions/page.tsx web/tests/e2e/smoke.spec.ts
git commit -m "refactor(web): apply codex simplicity design system for dense precise layouts"
```

---

### Task 6: Non-Negotiable #1 — Consistent Context + Autonomous Context Management

**Files:**
- Create: `web/src/lib/context/context-ledger.ts`
- Create: `web/src/lib/context/context-snapshot.ts`
- Create: `web/src/hooks/useContextLedger.ts`
- Test: `web/tests/unit/context-ledger.test.ts`

**Step 1: Write failing tests**

Require deterministic append-only timeline, snapshot retrieval, and pruning with audit trail.

**Step 2: Run failing tests**

Run: `pnpm -s vitest web/tests/unit/context-ledger.test.ts`
Expected: FAIL.

**Step 3: Implement**

Store:
- `goal`
- `constraints`
- `active assumptions`
- `last verified facts`
- `open risks`

**Step 4: Run passing tests**

Run: `pnpm -s vitest web/tests/unit/context-ledger.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add web/src/lib/context web/src/hooks/useContextLedger.ts web/tests/unit/context-ledger.test.ts
git commit -m "feat(web): add autonomous context ledger and snapshots"
```

---

### Task 7: Non-Negotiable #2 + #6 — Capability-Aware Tooling + Multi-Status Orchestration

**Files:**
- Create: `web/src/lib/orchestrator/run-orchestrator.ts`
- Create: `web/src/lib/orchestrator/run-state-machine.ts`
- Create: `web/src/components/operations/RunTimeline.tsx`
- Test: `web/tests/unit/run-orchestrator.test.ts`

**Step 1: Write failing tests**

Validate lifecycle states:
- `queued`
- `running`
- `waiting_input`
- `blocked`
- `retrying`
- `completed`
- `failed`
- `cancelled`

**Step 2: Run failing tests**

Run: `pnpm -s vitest web/tests/unit/run-orchestrator.test.ts`
Expected: FAIL.

**Step 3: Implement deterministic orchestrator**

Tie available actions to capability registry so tool calls are contextually valid.

**Step 4: Run passing tests**

Run: `pnpm -s vitest web/tests/unit/run-orchestrator.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add web/src/lib/orchestrator web/src/components/operations/RunTimeline.tsx web/tests/unit/run-orchestrator.test.ts
git commit -m "feat(web): add deterministic orchestrator with capability-aware run states"
```

---

### Task 8: Non-Negotiable #3 + #4 — Long-Term Safe Changes + Precision Mutation Guard

**Files:**
- Create: `web/src/lib/safety/change-scope-guard.ts`
- Create: `web/src/lib/safety/settings-diff.ts`
- Modify: `web/src/app/settings/page.tsx`
- Test: `web/tests/unit/settings-precision.test.tsx`

**Step 1: Write failing tests**

Ensure changing one setting cannot mutate unrelated keys.

**Step 2: Run failing tests**

Run: `pnpm -s vitest web/tests/unit/settings-precision.test.tsx`
Expected: FAIL.

**Step 3: Implement scoped mutation guard**

- explicit allowlist of mutable fields per action
- diff preview before apply
- reject unknown key writes

**Step 4: Run passing tests**

Run: `pnpm -s vitest web/tests/unit/settings-precision.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add web/src/lib/safety web/src/app/settings/page.tsx web/tests/unit/settings-precision.test.tsx
git commit -m "feat(web): add scoped settings mutation guard for precision updates"
```

---

### Task 9: Non-Negotiable #5 — Research-Backed Structured Problem-Solving Logs

**Files:**
- Create: `docs/runbooks/problem-solving-playbook.md`
- Create: `web/src/lib/learning/decision-log.ts`
- Create: `web/src/lib/learning/lessons-log.ts`
- Test: `web/tests/unit/decision-log.test.ts`

**Step 1: Write failing tests**

Require required fields:
- hypothesis
- evidence
- decision
- outcome
- follow-up check date

**Step 2: Run failing tests**

Run: `pnpm -s vitest web/tests/unit/decision-log.test.ts`
Expected: FAIL.

**Step 3: Implement logs + schema enforcement**

**Step 4: Run passing tests**

Run: `pnpm -s vitest web/tests/unit/decision-log.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add docs/runbooks/problem-solving-playbook.md web/src/lib/learning web/tests/unit/decision-log.test.ts
git commit -m "feat(web): add structured decision and lessons logs with enforced schema"
```

---

### Task 10: Non-Negotiable #7 — Easy Copy/Paste + Autonomous Action Affordances

**Files:**
- Modify: `web/src/components/operations/CapabilityPanel.tsx`
- Modify: `web/src/components/shared/CommandPalette.tsx`
- Create: `web/src/components/shared/CopyableValue.tsx`
- Test: `web/tests/unit/copyable-actions.test.tsx`

**Step 1: Write failing tests**

Ensure each operation/result has copy controls and explicit "Run now" action.

**Step 2: Run failing tests**

Run: `pnpm -s vitest web/tests/unit/copyable-actions.test.tsx`
Expected: FAIL.

**Step 3: Implement copy-first action design**

Include:
- endpoint
- payload
- response IDs
- retry command templates

**Step 4: Run passing tests**

Run: `pnpm -s vitest web/tests/unit/copyable-actions.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add web/src/components/operations/CapabilityPanel.tsx web/src/components/shared/CommandPalette.tsx web/src/components/shared/CopyableValue.tsx web/tests/unit/copyable-actions.test.tsx
git commit -m "feat(web): add copy-first action patterns and autonomous run affordances"
```

---

### Task 11: Non-Negotiable #8 — Self-Awareness Loop (What Worked / Didn’t)

**Files:**
- Create: `web/src/lib/learning/effectiveness-metrics.ts`
- Create: `web/src/app/operations/insights/page.tsx`
- Test: `web/tests/unit/effectiveness-metrics.test.ts`

**Step 1: Write failing tests**

Track:
- success rate by capability
- retry count
- mean time to resolution
- recurring failure signatures

**Step 2: Run failing tests**

Run: `pnpm -s vitest web/tests/unit/effectiveness-metrics.test.ts`
Expected: FAIL.

**Step 3: Implement metrics + insights view**

**Step 4: Run passing tests**

Run: `pnpm -s vitest web/tests/unit/effectiveness-metrics.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add web/src/lib/learning/effectiveness-metrics.ts web/src/app/operations/insights/page.tsx web/tests/unit/effectiveness-metrics.test.ts
git commit -m "feat(web): add self-awareness metrics and insights dashboard"
```

---

### Task 12: Hard Verification Gate (No Regressions, No Missing Coverage)

**Files:**
- Modify: `web/package.json`
- Create: `web/tests/e2e/operations-parity.spec.ts`
- Modify: `web/tests/e2e/smoke.spec.ts`

**Step 1: Add failing end-to-end parity assertions**

Checks:
- every `in_lmx_not_dashboard` capability is visible in Operations
- at least one happy-path call per capability cluster succeeds

**Step 2: Run failing tests**

Run: `pnpm -s playwright test web/tests/e2e/operations-parity.spec.ts`
Expected: FAIL.

**Step 3: Add CI gate script**

Create `pnpm check:parity` that runs:
- generator freshness
- parity unit tests
- operations e2e parity smoke

**Step 4: Run passing checks**

Run:
- `pnpm -s vitest`
- `pnpm -s playwright test web/tests/e2e/operations-parity.spec.ts`
- `pnpm check`
- `pnpm check:parity`

Expected: all PASS.

**Step 5: Commit**

```bash
git add web/package.json web/tests/e2e/operations-parity.spec.ts web/tests/e2e/smoke.spec.ts
git commit -m "chore(web): add parity verification gates for complete lmx coverage"
```

---

## Canonical "In LMX But Not In Dashboard" Coverage Targets

The parity generator must include (at minimum) these currently missing groups:

1. **Inference Extended APIs:** `/v1/responses`, `/v1/completions`, `/v1/messages`, `/v1/embeddings`, `/v1/rerank`, `/v1/models/{id}`, `/v1/chat/stream`
2. **Agent Runtime APIs:** `/v1/agents/runs`, `/v1/agents/runs/{id}`, `/cancel`, `/events`
3. **Skills + MCP APIs:** `/v1/skills*`, `/v1/skills/mcp/*`, `/mcp/*`
4. **Admin Deep Ops APIs:** `/admin/memory`, `/admin/diagnostics`, `/admin/config/reload`, `/admin/presets*`, `/admin/stack`, `/admin/quantize*`, `/admin/predictor`, `/admin/helpers`
5. **Model Lifecycle APIs:** `/admin/models/probe`, `/compatibility`, `/autotune*`, `/load/confirm`, `/available`, `/download*`, `/performance`, model delete endpoint
6. **Diagnostics/Observability APIs:** `/admin/metrics*`, `/admin/logs/*`, `/healthz`, `/readyz`, `/admin/health`
7. **Session Extras:** `/admin/sessions/search`
8. **Benchmark Variants:** `/admin/benchmark`, `/admin/benchmark/run`, `/admin/benchmark/results`

No capability in this list can remain uncategorized or inaccessible.

---

## Acceptance Criteria

1. A machine-generated parity artifact exists and is checked in CI.
2. Every `in_lmx_not_dashboard` capability is accessible either through:
   - dedicated minimal page, or
   - Operations console endpoint runner.
3. Dashboard UI follows codex simplicity constraints:
   - dense layout, zero decorative clutter, copy-first actions.
4. All 8 non-negotiables are represented as tested modules and visible UI behaviors.
5. `pnpm check` and parity-specific gates pass.

---

## Risks and Mitigations

1. **Risk:** Endpoint churn in LMX breaks parity.
   - **Mitigation:** Regenerate parity artifact in CI and fail on drift.
2. **Risk:** UI bloat from full capability exposure.
   - **Mitigation:** Keep advanced capabilities in Operations console + promote only high-frequency flows.
3. **Risk:** Hidden side effects from settings/actions.
   - **Mitigation:** strict change-scope guard + diff preview + test coverage.

---

## Execution Order

1. Task 1-3 first (inventory + typed client + operations parity surface)
2. Task 4-5 next (high-value routes + codex simplification)
3. Task 6-11 after (non-negotiable intelligence behaviors)
4. Task 12 final (parity gates)

---

Plan complete and saved to `docs/plans/2026-02-27-lmx-dashboard-parity-codex-plan.md`.

Two execution options:

1. Subagent-Driven (this session) - dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - open new session with executing-plans, batch execution with checkpoints
