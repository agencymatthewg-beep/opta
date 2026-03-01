# Opta Code Desktop Windows Compatibility Continuation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the remaining Windows compatibility scope for Opta Code Desktop by securing daemon token persistence, improving packaged-app smoke validation, and closing CI/runtime gaps for Windows release readiness.

**Architecture:** Keep the desktop app as a thin daemon client. Persist non-secret connection metadata in browser storage, but move daemon auth token storage behind a Tauri native bridge backed by OS credential storage (`keyring` crate). Keep browser/dev-mode fallback behavior intact. Extend Windows CI to validate packaged app startup behavior, not just artifact presence.

**Tech Stack:** React 18, TypeScript, Vite 5, Vitest, Playwright, Tauri v2, Rust (`tauri`, `keyring`), GitHub Actions (Windows runners).

---

## Investigation Baseline (2026-02-28)

### Confirmed already done
- Tauri shell exists (`src-tauri/*`) and Windows packaging workflow exists (`.github/workflows/opta-code-windows-build.yml`).
- Unit tests/build pass locally: `npm run typecheck`, `npm run test:run`, `npm run build`.
- Windows path handling improved in config resolution (`vite.config.ts`, `vitest.config.ts`) by avoiding raw URL pathname drive-prefix bugs.

### Confirmed remaining gaps
- Daemon token is still persisted in `localStorage` (`src/hooks/useDaemonSessions.ts`), not OS-secure storage.
- Windows CI “smoke” currently validates artifact existence only, not app startup/connect behavior.
- No explicit desktop docs/checklist defining Windows-ready vs unsupported capabilities.
- Legacy parity workflow path filters (`.github/workflows/opta-code-parity.yml`) appear to target pre-domain-reorg paths and should be reconciled during release gating.

---

### Task 1: Add Native Secure Token Storage Bridge (Tauri + keyring)

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/connection_secrets.rs`
- Test: `src-tauri/src/connection_secrets.rs` (unit tests in-module)

**Step 1: Write the failing Rust tests**

Add tests in `connection_secrets.rs` for:
- serialize/deserialize of persisted connection secret payload
- key naming strategy stability (`opta-code:<host>:<port>`)
- missing secret path returns `Ok(None)`

**Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test connection_secrets -- --nocapture`
Expected: FAIL because module/commands do not exist.

**Step 3: Implement minimal secure storage module**

Create `connection_secrets.rs` with:
- `set_connection_secret(host, port, token)`
- `get_connection_secret(host, port)`
- `delete_connection_secret(host, port)`

Use `keyring::Entry` with service `com.opta.code.desktop` and account key `daemon:<host>:<port>`.

**Step 4: Register Tauri commands**

Expose command handlers in `src-tauri/src/lib.rs` via `invoke_handler`.

**Step 5: Run Rust tests**

Run: `cd src-tauri && cargo test connection_secrets -- --nocapture`
Expected: PASS.

**Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/src/connection_secrets.rs
git commit -m "feat(windows): add native secure daemon token storage bridge"
```

---

### Task 2: Move Token Persistence Out of localStorage in Desktop Hook

**Files:**
- Create: `src/lib/secureConnectionStore.ts`
- Modify: `src/hooks/useDaemonSessions.ts`
- Modify: `src/types.ts`
- Test: `src/hooks/useDaemonSessions.test.tsx` (new)

**Step 1: Write failing tests**

Add tests asserting:
- host/port still load from local storage defaults
- token is loaded from secure store when Tauri bridge is available
- browser fallback keeps current behavior when bridge unavailable

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/hooks/useDaemonSessions.test.tsx`
Expected: FAIL because secure store abstraction not implemented.

**Step 3: Implement secure store abstraction**

Create `secureConnectionStore.ts` with:
- `loadToken(host, port): Promise<string>`
- `saveToken(host, port, token): Promise<void>`
- `clearToken(host, port): Promise<void>`

Behavior:
- Tauri runtime: call `window.__TAURI__.core.invoke(...)`
- Browser/dev fallback: use existing localStorage token path

**Step 4: Integrate hook with async token load/save**

In `useDaemonSessions.ts`:
- keep host/port local storage sync
- remove direct token persistence from localStorage writes in Tauri runtime
- lazy-load token on connection change with cancellation safety

**Step 5: Re-run tests + existing suite**

Run:
- `npm run test:run -- src/hooks/useDaemonSessions.test.tsx`
- `npm run test:run`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/lib/secureConnectionStore.ts src/hooks/useDaemonSessions.ts src/hooks/useDaemonSessions.test.tsx src/types.ts
git commit -m "feat(security): move daemon token persistence to native secure store"
```

---

### Task 3: Extend Windows CI Smoke from Artifact Check to Startup Check

**Files:**
- Modify: `.github/workflows/opta-code-windows-build.yml`
- Create: `tests/windows/packaged-smoke.ps1`

**Step 1: Write failing smoke script first**

Create PowerShell script to:
- locate built `.exe` in artifact tree
- start process with timeout
- verify process stays alive for at least 5 seconds
- terminate cleanly and report pass/fail

**Step 2: Run workflow script locally on Windows runner (CI)**

Run in workflow step before implementation is wired:
`pwsh -File tests/windows/packaged-smoke.ps1`
Expected: FAIL or inconclusive due missing script/exe wiring.

**Step 3: Wire script into windows-smoke job**

Update workflow:
- keep artifact existence check
- add startup smoke step using the script
- upload smoke logs as artifact on failure

**Step 4: Verify via workflow dispatch**

Run: GitHub Actions `Opta Code — Windows Build` via `workflow_dispatch`
Expected: PASS with startup smoke evidence logged.

**Step 5: Commit**

```bash
git add .github/workflows/opta-code-windows-build.yml tests/windows/packaged-smoke.ps1
git commit -m "ci(windows): add packaged app startup smoke validation"
```

---

### Task 4: Define Windows Capability Contract + Operator Checklist

**Files:**
- Modify: `README.md`
- Create: `docs/WINDOWS-COMPATIBILITY.md`
- Create: `docs/plans/2026-02-28-windows-compatibility-checklist.md`

**Step 1: Write failing doc assertions (manual review checklist)**

Create checklist items requiring explicit statements for:
- supported runtime features on Windows
- unsupported/mac-only features and graceful behavior
- required CI evidence links

**Step 2: Run manual verification pass**

Verify each checklist item can be answered from docs; expected initial gaps.

**Step 3: Implement docs updates**

Add clear matrix:
- Supported: desktop UI, daemon session control, operations page, jobs page
- Conditional: secure token storage (requires Tauri build)
- Out of scope: local macOS-only LMX features

**Step 4: Verify docs consistency**

Run: `rg -n "Windows|win32|unsupported|LMX|Tauri" README.md docs/WINDOWS-COMPATIBILITY.md`
Expected: consistent terminology and no conflicting claims.

**Step 5: Commit**

```bash
git add README.md docs/WINDOWS-COMPATIBILITY.md docs/plans/2026-02-28-windows-compatibility-checklist.md
git commit -m "docs(windows): publish compatibility contract and release checklist"
```

---

### Task 5: Final Windows Release Readiness Gate

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/opta-code-windows-build.yml`
- Create: `docs/plans/2026-02-28-windows-release-readiness-report.md`

**Step 1: Add a strict verification command set**

Add script entries:
- `check:desktop` => `npm run typecheck && npm run test:run && npm run build`

**Step 2: Run failing/green gate sequence in CI**

Add aggregate summary step in Windows workflow with explicit pass/fail outputs for:
- unit/type/build
- packaging
- startup smoke

**Step 3: Generate readiness report template**

Include date, workflow run IDs, artifact hashes, open risks, and go/no-go decision.

**Step 4: Verify full gate**

Run locally:
`npm run check:desktop`
Run in CI:
Windows workflow dispatch
Expected: full green gate + readiness report completed.

**Step 5: Commit**

```bash
git add package.json .github/workflows/opta-code-windows-build.yml docs/plans/2026-02-28-windows-release-readiness-report.md
git commit -m "chore(windows): add release readiness gate and reporting"
```

---

## Execution Order

1. Task 1 (native secure bridge)
2. Task 2 (frontend token persistence migration)
3. Task 3 (packaged startup smoke)
4. Task 4 (capability contract docs)
5. Task 5 (final release gate/report)

## Acceptance Criteria

- [ ] No daemon auth token persisted in plain localStorage for Tauri desktop runtime.
- [ ] Windows CI validates packaged executable startup, not just artifact existence.
- [ ] Windows capability/support matrix is published and consistent.
- [ ] `npm run check:desktop` passes locally and in CI.
- [ ] Readiness report documents latest successful Windows pipeline evidence.
