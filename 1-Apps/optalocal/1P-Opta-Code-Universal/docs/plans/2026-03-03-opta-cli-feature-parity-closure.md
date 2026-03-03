# Opta CLI Feature Parity Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the verified feature gaps between `1D-Opta-CLI-TS` and `1P-Opta-Code-Universal`, with explicit coverage for advanced `opta models`, chat mode parity, and CLI parity CI gating.

**Architecture:** Keep `1D` as runtime source of truth. Add missing feature families to daemon operation contracts first, then surface them in `1P` via operations and dedicated UI where appropriate. Enforce drift prevention with a generated parity manifest and CI check.

**Tech Stack:** TypeScript, Commander, Fastify daemon operations (`1D`), React/Vite/Tauri (`1P`), Vitest, Playwright, GitHub Actions.

---

### Task 1: Add a machine-readable parity inventory

**Files:**
- Create: `1D-Opta-CLI-TS/scripts/parity/export-cli-surface.mjs`
- Create: `1D-Opta-CLI-TS/docs/parity/cli-surface.json`
- Create: `1P-Opta-Code-Universal/scripts/parity/check-cli-parity.mjs`
- Create: `1P-Opta-Code-Universal/docs/parity/desktop-surface.json`
- Modify: `1P-Opta-Code-Universal/package.json`

**Steps:**
1. Export CLI command and operation families from `1D/src/index.ts` and `1D/src/protocol/v3/operations.ts` to `cli-surface.json`.
2. Export desktop feature families from `1P/src` (pages + operation scopes + modes) to `desktop-surface.json`.
3. Implement a parity checker that reports `covered`, `partial`, and `missing` families.
4. Add script aliases:
   - `parity:export`
   - `parity:check`
5. Run:
   - `node scripts/parity/export-cli-surface.mjs`
   - `node scripts/parity/check-cli-parity.mjs`

**Expected result:** deterministic JSON reports and non-zero exit when required parity contracts are unmet.

---

### Task 2: Add daemon operation contract for advanced models suite

**Files:**
- Modify: `1D-Opta-CLI-TS/src/protocol/v3/operations.ts`
- Modify: `1D-Opta-CLI-TS/src/daemon/operations/registry.ts`
- Modify: `1D-Opta-CLI-TS/tests/protocol/operations-contract.test.ts`
- Modify: `1D-Opta-CLI-TS/tests/daemon/http-server.test.ts`

**Steps:**
1. Add new operation IDs for model-advanced capabilities (history/aliases/predictor/helpers/quantize/agents/skills/rag/health/scan/browse metadata).
2. Define input and output schemas in `OperationInputSchemaById` / `OperationOutputSchemaById`.
3. Register handlers in daemon operation registry by reusing existing model command internals.
4. Add/adjust contract tests for new IDs and schema validation.
5. Run:
   - `npm run test:contract`
   - `npm run typecheck`

**Expected result:** advanced model features are daemon-addressable and schema-validated.

---

### Task 3: Extend Opta Code operations scopes and dedicated model controls

**Files:**
- Modify: `1P-Opta-Code-Universal/src/pages/CliOperationsPage.tsx`
- Modify: `1P-Opta-Code-Universal/src/pages/ModelsPage.tsx`
- Modify: `1P-Opta-Code-Universal/src/hooks/useModels.ts`
- Modify: `1P-Opta-Code-Universal/src/pages/ModelsPage.test.tsx`
- Modify: `1P-Opta-Code-Universal/src/pages/OperationsPage.test.tsx`

**Steps:**
1. Include newly added model operation families in CLI operations scope.
2. Add dedicated controls for highest-frequency advanced model flows (history/health/scan first).
3. Keep lower-frequency flows runnable via OperationRunner until dedicated UX is added.
4. Expand unit tests to assert visibility and execution wiring.
5. Run:
   - `npm run test:run`
   - `npm run build`

**Expected result:** advanced model capability is available in Opta Code without forcing terminal usage.

---

### Task 4: Add session mode parity (`plan`, `review`, `research`)

**Files:**
- Modify: `1D-Opta-CLI-TS/src/daemon/turn-queue.ts`
- Modify: `1D-Opta-CLI-TS/src/protocol/v3/sessions.ts` (or session request schema owner)
- Modify: `1P-Opta-Code-Universal/src/components/Composer.tsx`
- Modify: `1P-Opta-Code-Universal/src/hooks/useDaemonSessions.ts`
- Modify: `1P-Opta-Code-Universal/src/App.tsx`
- Modify: `1P-Opta-Code-Universal/src/hooks/useDaemonSessions.test.tsx`

**Steps:**
1. Expand daemon session submit schema to support `chat|do|plan|review|research`.
2. Ensure mode-specific runtime behavior maps to existing CLI semantics.
3. Add composer mode selector entries and status pill rendering for all modes.
4. Add tests for submit payload mode and UI toggle behavior.
5. Run:
   - `npm run test:run` in `1P`
   - `npm run test:contract` in `1D`

**Expected result:** desktop session execution modes match CLI intent modes.

---

### Task 5: Resolve `server` command parity stance

**Files:**
- Modify: `1P-Opta-Code-Universal/docs/OPTACLI-PARITY-MATRIX.md`
- Modify: `1P-Opta-Code-Universal/docs/OPTA-CODE-RELATIONSHIP.md`
- Optional modify: `1D-Opta-CLI-TS/src/protocol/v3/operations.ts`
- Optional modify: `1D-Opta-CLI-TS/src/daemon/operations/registry.ts`

**Steps:**
1. Decide one of two supported outcomes:
   - `A`: Intentional CLI-only (documented, accepted gap), or
   - `B`: add `server.*` operations and desktop controls.
2. If `B`, add operation IDs + handlers and wire into CLI Operations page.
3. Update docs to mark final status.
4. Run:
   - `npm run test:contract` (`1D`, if operation added)
   - `npm run test:run` (`1P`)

**Expected result:** no ambiguous parity status for `server`.

---

### Task 6: Enforce parity in CI and release gates

**Files:**
- Modify: `1P-Opta-Code-Universal/.github/workflows/opta-code-parity.yml` (or canonical parity workflow)
- Modify: `1P-Opta-Code-Universal/package.json`
- Modify: `1P-Opta-Code-Universal/docs/OPTACLI-PARITY-MATRIX.md`

**Steps:**
1. Add CI job that runs parity export/check scripts and fails on required-gap regressions.
2. Add parity check to `check:desktop` gate or pre-release workflow stage.
3. Publish parity report artifact in CI for audit.
4. Run locally:
   - `npm run parity:check`
   - `npm run check:desktop`

**Expected result:** future CLI growth cannot silently outpace Opta Code coverage.

---

### Verification Checklist (After Implementation)

Run in `1D-Opta-CLI-TS`:
- `npm run typecheck`
- `npm run test:contract`
- `npm run test:run`

Run in `1P-Opta-Code-Universal`:
- `npm run test:run`
- `npm run test:e2e`
- `npm run build`
- `npm run parity:check`

Acceptance criteria:
- No required parity gaps in checker output.
- Updated matrix shows explicit `Covered/Partial/Gap` with rationale.
- CI gate blocks regressions automatically.
