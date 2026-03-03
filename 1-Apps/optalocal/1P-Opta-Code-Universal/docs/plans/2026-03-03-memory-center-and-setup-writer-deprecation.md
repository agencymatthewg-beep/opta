# Memory Center + Setup Writer Deprecation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated Memory Center UX (pin/recall/retention) backed by daemon/CLI operations, and deprecate `save_setup_config` now with scheduled removal in the next release.

**Architecture:** Memory capabilities should be first-class daemon operations (not ad-hoc local UI state), then surfaced in Opta Code via a dedicated page and quick actions. Pin/recall should build on session store tags/search; retention should be explicit policy + prune operations to avoid destructive implicit cleanup. `save_setup_config` remains temporarily for compatibility but is marked deprecated and instrumented; wizard continues to use `onboard.apply` as the single canonical onboarding path.

**Tech Stack:** TypeScript (Vitest, React), Node CLI daemon operation registry, Rust Tauri commands, existing session store (`src/memory/store.ts`).

---

## Scope and Release Split

### Release N (now)
- Deliver Memory Center page and daemon-backed memory operations.
- Mark `save_setup_config` deprecated and instrument usage.
- Keep compatibility behavior intact for any legacy caller.

### Release N+1 (next release)
- Remove `save_setup_config` command registration and implementation.
- Remove compatibility tests and docs references.

---

### Task 1: Baseline Contract Tests for New Memory Operations

**Files:**
- Modify: `1D-Opta-CLI-TS/tests/protocol/operations-contract.test.ts`
- Modify: `1D-Opta-CLI-TS/tests/protocol/v3/messages.test.ts`

**Step 1: Write failing contract assertions for new operation IDs**

```ts
expect(OPERATION_IDS).toContain("sessions.pin");
expect(OPERATION_IDS).toContain("sessions.retention.prune");
```

**Step 2: Run tests to confirm failure**

Run: `npm run -s test:run -- tests/protocol/operations-contract.test.ts tests/protocol/v3/messages.test.ts`
Expected: FAIL due to missing operations.

**Step 3: Add minimal schema placeholders for these IDs**
- Use empty-object input/output placeholders first.

**Step 4: Re-run tests**
Expected: PASS for schema presence, still pending behavior tests.

**Step 5: Commit**

```bash
git add 1D-Opta-CLI-TS/tests/protocol/operations-contract.test.ts 1D-Opta-CLI-TS/tests/protocol/v3/messages.test.ts
git commit -m "test(protocol): add memory operation contract expectations"
```

---

### Task 2: Add CLI Session-Memory Actions (Pin/Unpin/List Pins)

**Files:**
- Modify: `1D-Opta-CLI-TS/src/commands/sessions.ts`
- Test: `1D-Opta-CLI-TS/tests/commands/sessions.test.ts` (create if missing)

**Step 1: Write failing command tests**

```ts
it("pins a session by id", async () => {
  await sessions("pin", "sess-id", { json: true });
  // assert pinned tag was added
});
```

**Step 2: Run test to verify failure**

Run: `npm run -s test:run -- tests/commands/sessions.test.ts`
Expected: FAIL (`Unknown action: pin`).

**Step 3: Implement minimal action handlers**
- Add `pin`, `unpin`, `pins` actions in `sessions()`.
- Reuse `tagSession` / `untagSession` / `listSessions` from `src/memory/store.ts`.
- Use canonical tag name: `pinned`.

**Step 4: Re-run test and verify JSON/non-JSON output**
Expected: PASS.

**Step 5: Commit**

```bash
git add 1D-Opta-CLI-TS/src/commands/sessions.ts 1D-Opta-CLI-TS/tests/commands/sessions.test.ts
git commit -m "feat(sessions): add pin/unpin/pins actions"
```

---

### Task 3: Add Retention Policy + Prune Engine in CLI Memory Layer

**Files:**
- Create: `1D-Opta-CLI-TS/src/memory/retention.ts`
- Modify: `1D-Opta-CLI-TS/src/commands/sessions.ts`
- Test: `1D-Opta-CLI-TS/tests/memory/retention.test.ts`

**Step 1: Write failing retention unit tests**

```ts
it("keeps pinned sessions during prune", async () => {
  const plan = await planRetentionPrune({ days: 30, preservePinned: true });
  expect(plan.deleteIds).not.toContain("pinned-session");
});
```

**Step 2: Run to verify failure**

Run: `npm run -s test:run -- tests/memory/retention.test.ts`
Expected: FAIL (module/functions missing).

**Step 3: Implement minimal retention module**
- `getRetentionPolicy()` / `setRetentionPolicy()` stored in `~/.config/opta/sessions/retention-policy.json`.
- `planRetentionPrune(policy)` returns candidates only.
- `applyRetentionPrune(policy)` deletes sessions via existing `deleteSession`.

**Step 4: Add CLI actions**
- `sessions retention-get`
- `sessions retention-set <days> [--preserve-pinned=true|false]`
- `sessions prune [--dry-run]`

**Step 5: Re-run tests + commit**

```bash
git add 1D-Opta-CLI-TS/src/memory/retention.ts 1D-Opta-CLI-TS/src/commands/sessions.ts 1D-Opta-CLI-TS/tests/memory/retention.test.ts
git commit -m "feat(memory): add retention policy and prune engine"
```

---

### Task 4: Extend Daemon Protocol for Memory Operations

**Files:**
- Modify: `1D-Opta-CLI-TS/src/protocol/v3/operations.ts`
- Modify: `1D-Opta-CLI-TS/src/daemon/operations/registry.ts`
- Modify: `1D-Opta-CLI-TS/src/daemon/operations/capability-evaluator.ts`

**Step 1: Write failing protocol typing checks**
- Add tests validating new input/output schemas and execute variants.

**Step 2: Add operation IDs + schemas**
- `sessions.pin`, `sessions.unpin`, `sessions.pins`
- `sessions.retention.get`, `sessions.retention.set`, `sessions.retention.prune`

**Step 3: Wire registry handlers**
- Route to CLI command functions or direct retention helpers.

**Step 4: Mark safety classes**
- `pin/unpin/retention.set/prune` = `write`.
- Add prune to high-risk write checks in capability evaluator.

**Step 5: Verify and commit**

Run: `npm run -s test:run -- tests/protocol/operations-contract.test.ts tests/protocol/v3/messages.test.ts`

```bash
git add 1D-Opta-CLI-TS/src/protocol/v3/operations.ts 1D-Opta-CLI-TS/src/daemon/operations/registry.ts 1D-Opta-CLI-TS/src/daemon/operations/capability-evaluator.ts
git commit -m "feat(protocol): add session memory operations"
```

---

### Task 5: Add Daemon Client Helpers for Memory Center

**Files:**
- Modify: `1P-Opta-Code-Universal/src/lib/daemonClient.ts`
- Test: `1P-Opta-Code-Universal/src/lib/daemonClient.test.ts` (create if missing)

**Step 1: Write failing helper tests**
- `sessionsPin`, `sessionsUnpin`, `sessionsPins`, `sessionsRetentionGet`, `sessionsRetentionSet`, `sessionsRetentionPrune`.

**Step 2: Run tests and confirm failure**

Run: `npm run -s test:run -- src/lib/daemonClient.test.ts`

**Step 3: Implement helper wrappers around `runOperation`**
- Use strict response parsing and `operationError()` for failures.

**Step 4: Re-run tests**
Expected: PASS.

**Step 5: Commit**

```bash
git add 1P-Opta-Code-Universal/src/lib/daemonClient.ts 1P-Opta-Code-Universal/src/lib/daemonClient.test.ts
git commit -m "feat(daemon-client): add memory center operation wrappers"
```

---

### Task 6: Build Memory Center Page UI

**Files:**
- Create: `1P-Opta-Code-Universal/src/pages/MemoryCenterPage.tsx`
- Create: `1P-Opta-Code-Universal/src/pages/MemoryCenterPage.test.tsx`
- Modify: `1P-Opta-Code-Universal/src/opta.css`

**Step 1: Write failing page tests**
- Loads pinned sessions.
- Runs recall search.
- Updates retention policy.
- Dry-run prune preview and apply prune.

**Step 2: Run tests and confirm failure**

Run: `npm run -s test:run -- src/pages/MemoryCenterPage.test.tsx`

**Step 3: Implement page**
- Section A: `Pinned Sessions` (unpin action).
- Section B: `Recall Search` (query -> ranked sessions).
- Section C: `Retention` (days, preserve pinned toggle).
- Section D: `Prune Preview` (dry-run list + apply button).

**Step 4: Add CSS tokens/classes only needed for this page**
- Keep style aligned with existing glass panels.

**Step 5: Re-run tests + commit**

```bash
git add 1P-Opta-Code-Universal/src/pages/MemoryCenterPage.tsx 1P-Opta-Code-Universal/src/pages/MemoryCenterPage.test.tsx 1P-Opta-Code-Universal/src/opta.css
git commit -m "feat(ui): add Memory Center page with pin/recall/retention"
```

---

### Task 7: Wire Memory Center into App Navigation and Palette

**Files:**
- Modify: `1P-Opta-Code-Universal/src/App.tsx`
- Modify: `1P-Opta-Code-Universal/src/types.ts` (if page enum/types extracted)
- Test: `1P-Opta-Code-Universal/src/App.test.tsx`

**Step 1: Add failing nav tests**
- Memory tab renders page.
- Command palette action routes to Memory Center.

**Step 2: Implement app wiring**
- Add `"memory"` to `AppPage` union.
- Import and render `MemoryCenterPage`.
- Add left-nav item and palette command (`open-memory-center`).

**Step 3: Re-run tests**
Expected: PASS.

**Step 4: Verify no regressions in existing page routing.**

**Step 5: Commit**

```bash
git add 1P-Opta-Code-Universal/src/App.tsx 1P-Opta-Code-Universal/src/App.test.tsx
 git commit -m "feat(app): integrate Memory Center navigation and palette action"
```

---

### Task 8: Expose Memory Actions in CLI Operations Scope and Docs

**Files:**
- Modify: `1P-Opta-Code-Universal/src/pages/CliOperationsPage.tsx`
- Modify: `1P-Opta-Code-Universal/docs/OPTACLI-PARITY-MATRIX.md`
- Modify: `1P-Opta-Code-Universal/docs/OPTA-CODE-CLI-PARITY-PLAN.md`

**Step 1: Confirm operations scope already includes `sessions.*`**
- If no change needed, add explicit note in docs only.

**Step 2: Update parity docs**
- Mark memory UX gap as closed once page ships.

**Step 3: Run parity check**

Run: `npm run -s parity:check`
Expected: PASS (`missingRequiredScopes=0`).

**Step 4: Commit docs/scope updates**

```bash
git add 1P-Opta-Code-Universal/src/pages/CliOperationsPage.tsx 1P-Opta-Code-Universal/docs/OPTACLI-PARITY-MATRIX.md 1P-Opta-Code-Universal/docs/OPTA-CODE-CLI-PARITY-PLAN.md
git commit -m "docs(parity): record Memory Center and operation parity status"
```

**Step 5: Tag release note item**
- Add “Memory Center” entry to release notes/changelog.

---

### Task 9: Deprecate `save_setup_config` Now (Release N)

**Files:**
- Modify: `1P-Opta-Code-Universal/src-tauri/src/setup_wizard.rs`
- Modify: `1P-Opta-Code-Universal/src-tauri/src/lib.rs`
- Modify: `1P-Opta-Code-Universal/src/components/SetupWizard.test.tsx`
- Modify: `1P-Opta-Code-Universal/docs/plans/2026-03-03-memory-center-and-setup-writer-deprecation.md` (status notes)

**Step 1: Add failing test proving wizard does not invoke deprecated command**
- Assert no `save_setup_config` invocation during setup success/failure flows.

**Step 2: Mark deprecation in Rust**
- Add doc comment: “DEPRECATED: use `onboard.apply` via daemon”.
- Add runtime warning (`eprintln!`) on invocation.
- Append deprecation hit to `~/.config/opta/daemon/deprecations.log` for local observability.

**Step 3: Keep command callable for compatibility**
- Do not remove from invoke handler yet.
- Maintain behavior so old builds/scripts do not hard-break.

**Step 4: Re-run wizard tests**
Expected: PASS and zero calls from current UI.

**Step 5: Commit**

```bash
git add 1P-Opta-Code-Universal/src-tauri/src/setup_wizard.rs 1P-Opta-Code-Universal/src/components/SetupWizard.test.tsx
 git commit -m "chore(tauri): deprecate save_setup_config with compatibility shim"
```

---

### Task 10: Remove `save_setup_config` Next Release (Release N+1)

**Files:**
- Modify: `1P-Opta-Code-Universal/src-tauri/src/lib.rs`
- Modify: `1P-Opta-Code-Universal/src-tauri/src/setup_wizard.rs`
- Modify: `1P-Opta-Code-Universal/src/components/SetupWizard.test.tsx`
- Modify: `1P-Opta-Code-Universal/docs/OPTACLI-PARITY-MATRIX.md`
- Modify: `1P-Opta-Code-Universal/docs/CHANGELOG.md` (or equivalent)

**Step 1: Add failing test for command absence**
- Ensure no runtime paths reference `save_setup_config`.

**Step 2: Remove invoke registration and function**
- Delete `setup_wizard::save_setup_config` from `generate_handler!`.
- Delete obsolete `SetupConfig` struct + function.

**Step 3: Clean docs and migration note**
- State removal version and replacement (`onboard.apply`).

**Step 4: Run full desktop tests + typecheck**

Run:
- `npm run -s typecheck`
- `npm run -s test:run -- src/components/SetupWizard.test.tsx src/hooks/useDaemonSessions.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add 1P-Opta-Code-Universal/src-tauri/src/lib.rs 1P-Opta-Code-Universal/src-tauri/src/setup_wizard.rs 1P-Opta-Code-Universal/src/components/SetupWizard.test.tsx 1P-Opta-Code-Universal/docs/OPTACLI-PARITY-MATRIX.md
git commit -m "refactor(tauri): remove deprecated save_setup_config command"
```

---

## Verification Matrix (Done Before Merge)

- `1D-Opta-CLI-TS`
  - `npm run -s typecheck`
  - `npm run -s test:run -- tests/protocol/operations-contract.test.ts tests/protocol/v3/messages.test.ts tests/commands/sessions.test.ts tests/memory/retention.test.ts`

- `1P-Opta-Code-Universal`
  - `npm run -s typecheck`
  - `npm run -s test:run -- src/pages/MemoryCenterPage.test.tsx src/components/SetupWizard.test.tsx src/hooks/useDaemonSessions.test.tsx`
  - `npm run -s parity:check`

- Manual UX smoke
  - Open Memory Center -> pin/unpin session -> verify persistence after restart.
  - Recall search returns expected sessions.
  - Retention dry-run preview before apply.
  - Setup wizard completes without any `save_setup_config` path.

---

## Tradeoffs and Decision Record

- **Pin state as session tags (daemon/CLI shared)**
  - Pros: cross-surface parity, no duplicate state model.
  - Cons: needs protocol/command extensions.

- **Retention policy in config-dir JSON (not localStorage)**
  - Pros: deterministic across CLI/Desktop.
  - Cons: one more on-disk schema to maintain.

- **Deprecate before remove**
  - Pros: avoids breaking hidden legacy integrations.
  - Cons: temporary duplicate path remains for one release.

