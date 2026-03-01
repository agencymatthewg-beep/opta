---
status: active
owner: opta-code-parity
created: 2026-02-28
---

# Opta Code Capability + Stability + Windows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring Opta Code to full practical parity with Opta CLI capabilities while achieving Codex macOS-app stability standards and defining a Windows release path.

**Architecture:** Opta Code remains a strict daemon client. Capability expansion flows daemon-first (`/v3/*`, shared protocol/client packages), then desktop UI. For low-frequency CLI families, add typed daemon operation routes instead of shelling out from UI.

**Tech Stack:** TypeScript, React 18, Vite 5, Vitest, Playwright, Fastify daemon v3, `@opta/daemon-client`, `@opta/protocol-shared`, GitHub Actions, Tauri v2 (Windows packaging track).

---

## Investigation Baseline (2026-02-28)

### Evidence used
- `src/index.ts` (CLI command surface)
- `packages/daemon-client/src/http-client.ts` and `types.ts`
- `1P-Opta-Code-Desktop/src/lib/daemonClient.ts`
- `1P-Opta-Code-Desktop/src/hooks/useDaemonSessions.ts`
- `docs/plans/2026-02-23-codex-desktop-parity-spec.md`
- `docs/AUDIT-INTEROP-2026-02-28.md`

### Confirmed gaps
1. Opta Code currently exposes only session orchestration + permission resolution + LMX model controls, not full CLI family coverage.
2. Daemon client already has background process APIs, but Opta Code has no UI for them.
3. Opta Code has no local test harness/CI equivalent to CLI parity gates.
4. Existing codex parity spec still has open P0 items (alternate-buffer assertions and additional visual captures).
5. Current keychain implementation supports macOS/Linux only (`src/keychain/index.ts`), so Windows credential handling is missing.
6. Several CLI operations are platform-specific (`launchctl`, `pbcopy`, macOS defaults) and need abstraction for Windows parity.

---

## Capability Gap Matrix (CLI -> Daemon -> Opta Code)

| CLI family | Daemon/client path today | Opta Code status | Required addition |
|---|---|---|---|
| `chat` / `tui` / `do` | `/v3/sessions/*` + WS events | Partial | Add explicit mode selection (`chat`/`do`/`plan`/`review`/`research`) and session export from UI |
| `sessions` | Session APIs exist | Partial | Add search/filter/export/delete/resume surfaces |
| `models` / `status` | `/v3/lmx/*` + `/v3/metrics` | Partial | Add health drilldowns + failure remediation actions |
| `daemon` | daemon commands exist in CLI; limited HTTP exposure | Missing | Add daemon lifecycle/log actions via typed daemon operation routes |
| `doctor` | CLI-only today | Missing | Add daemon `doctor` operation endpoint + UI report page |
| `embed` / `rerank` / `benchmark` | CLI-only today | Missing | Expose as daemon operations + dedicated UI workflows |
| `env` / `config` | CLI-only today | Missing | Add settings/profile APIs and UI editors |
| `account` / `key` / `keychain` | CLI-only today | Missing | Add auth/key management UI and keychain status |
| `mcp` | CLI-only today | Missing | Add MCP server list/add/remove/test panel |
| `init` / `diff` / `update` / `server` / `completions` | CLI-only today | Missing | Expose as advanced operations console with safeguards |
| Background process tools | `list/start/status/output/kill` in shared client | Missing | Add background jobs page in Opta Code |

---

## Codex-Level Stability Targets (Release Gates)

1. Crash-free daemon+desktop soak run: 24h, zero process crash, zero unrecovered WS disconnect.
2. Session reconnect SLO: p95 reconnect recovery < 2s with cursor replay.
3. Input latency SLO: p95 keypress-to-paint < 50ms under token streaming.
4. Permission safety SLO: race-conflict safe, fail-closed on timeout, 100% deterministic tests.
5. Visual parity gate: deterministic snapshots for session shell, overlays, permission prompts, and deep-scroll states.
6. CI gate parity: build/type/lint + core smoke + reconnect + permission + visual + strict aggregate gate must pass.

---

## Execution Plan

### Task 1: Create canonical capability contract and operation taxonomy

**Files:**
- Modify: `docs/DAEMON-INTEROP-CONTRACT.md`
- Create: `src/protocol/v3/operations.ts`
- Modify: `packages/protocol-shared/src/index.ts`
- Test: `tests/protocol/operations-contract.test.ts`

**Step 1: Write failing contract test**

Create `tests/protocol/operations-contract.test.ts` to assert canonical operation IDs exist (for `doctor`, `env.*`, `mcp.*`, `embed`, `rerank`, `benchmark`, `keychain.*`).

**Step 2: Run contract test**

Run: `npm run test:run -- tests/protocol/operations-contract.test.ts`  
Expected: FAIL (operations contract missing).

**Step 3: Add `v3` operations contract types**

Create `src/protocol/v3/operations.ts` with typed operation IDs, request/response envelopes, and explicit safety class (`read`, `write`, `dangerous`).

**Step 4: Export shared types**

Update shared protocol exports so Opta Code and daemon client consume one operation type source.

**Step 5: Re-run test + typecheck**

Run: `npm run typecheck && npm run test:run -- tests/protocol/operations-contract.test.ts`  
Expected: PASS.

---

### Task 2: Add daemon operation routes for non-session CLI capability families

**Files:**
- Modify: `src/daemon/http-server.ts`
- Create: `src/daemon/operations/registry.ts`
- Create: `src/daemon/operations/execute.ts`
- Test: `tests/daemon/operations-routes.test.ts`

**Step 1: Write failing route tests**

Add route tests for `GET /v3/operations` and `POST /v3/operations/:id`.

**Step 2: Run failing tests**

Run: `npm run test:run -- tests/daemon/operations-routes.test.ts`  
Expected: FAIL (routes not registered).

**Step 3: Implement operation registry**

Create a registry mapping operation IDs to existing command-module adapters with strict input schemas.

**Step 4: Implement operation execute route**

Add authenticated route handlers in daemon HTTP server; enforce safety policy for `dangerous` operations.

**Step 5: Verify**

Run: `npm run test:run -- tests/daemon/operations-routes.test.ts tests/daemon/http-server.test.ts`  
Expected: PASS.

---

### Task 3: Extend shared daemon client with operations APIs

**Files:**
- Modify: `packages/daemon-client/src/types.ts`
- Modify: `packages/daemon-client/src/http-client.ts`
- Test: `packages/daemon-client/src/http-client.test.ts`
- Modify: `1P-Opta-Code-Desktop/src/lib/daemonClient.ts`

**Step 1: Write failing daemon-client tests**

Add tests for `listOperations()` and `runOperation(id, payload)`.

**Step 2: Run failing tests**

Run: `npm run test:run -- packages/daemon-client/src/http-client.test.ts`  
Expected: FAIL.

**Step 3: Implement methods**

Add typed methods to daemon client and wire through Opta Code `daemonClient` wrapper.

**Step 4: Add backwards compatibility checks**

Ensure existing session and LMX methods remain untouched.

**Step 5: Verify**

Run: `npm run typecheck && npm run test:run -- packages/daemon-client/src/http-client.test.ts`  
Expected: PASS.

---

### Task 4: Add Opta Code operations console (100% command-family access)

**Files:**
- Create: `1P-Opta-Code-Desktop/src/pages/OperationsPage.tsx`
- Create: `1P-Opta-Code-Desktop/src/hooks/useOperations.ts`
- Create: `1P-Opta-Code-Desktop/src/components/OperationRunner.tsx`
- Modify: `1P-Opta-Code-Desktop/src/App.tsx`
- Modify: `1P-Opta-Code-Desktop/src/types.ts`

**Step 1: Add failing UI tests**

Create component tests asserting operation catalog loads and operation execute responses render.

**Step 2: Run failing tests**

Run: `cd 1P-Opta-Code-Desktop && npm run test -- src/pages/OperationsPage.test.tsx`  
Expected: FAIL (test setup/page absent).

**Step 3: Implement operations page + runner**

Add operation picker grouped by family with payload form + JSON output panel.

**Step 4: Integrate into app navigation**

Add top-level `Operations` page route and palette command.

**Step 5: Verify**

Run: `cd 1P-Opta-Code-Desktop && npm run build`  
Expected: PASS.

---

### Task 5: Add background process control UI in Opta Code

**Files:**
- Create: `1P-Opta-Code-Desktop/src/pages/BackgroundJobsPage.tsx`
- Modify: `1P-Opta-Code-Desktop/src/lib/daemonClient.ts`
- Modify: `1P-Opta-Code-Desktop/src/App.tsx`
- Test: `1P-Opta-Code-Desktop/src/pages/BackgroundJobsPage.test.tsx`

**Step 1: Write failing tests for jobs panel**

Test list/start/kill/output-follow flows.

**Step 2: Run failing tests**

Run: `cd 1P-Opta-Code-Desktop && npm run test -- src/pages/BackgroundJobsPage.test.tsx`  
Expected: FAIL.

**Step 3: Implement page**

Use existing shared client methods (`listBackground`, `startBackground`, `backgroundOutput`, `killBackground`).

**Step 4: Add page to main nav and palette**

Expose `Background Jobs` under runtime controls.

**Step 5: Verify**

Run: `cd 1P-Opta-Code-Desktop && npm run build`  
Expected: PASS.

---

### Task 6: Add Opta Code quality harness (unit + E2E + CI)

**Files:**
- Create: `1P-Opta-Code-Desktop/vitest.config.ts`
- Create: `1P-Opta-Code-Desktop/src/test/setup.ts`
- Create: `1P-Opta-Code-Desktop/playwright.config.ts`
- Create: `1P-Opta-Code-Desktop/tests/e2e/smoke.spec.ts`
- Modify: `1P-Opta-Code-Desktop/package.json`
- Create: `1P-Opta-Code-Desktop/.github/workflows/opta-code-parity.yml`

**Step 1: Add failing CI-local command set**

Define scripts: `test`, `test:run`, `test:e2e`, `lint`, `typecheck`.

**Step 2: Add baseline tests**

Hook tests for session streaming, permission resolution cards, and operation runner.

**Step 3: Add Playwright smoke**

Cover connect -> create session -> send prompt -> resolve permission -> open operations.

**Step 4: Add GitHub parity workflow**

Include build/type/lint/unit/e2e + strict aggregate gate.

**Step 5: Verify**

Run: `cd 1P-Opta-Code-Desktop && npm run typecheck && npm run build`  
Expected: PASS.

---

### Task 7: Close remaining codex parity P0 gaps in CLI plan

**Files:**
- Modify: `tests/tui/App.test.tsx`
- Modify: `tests/tui/visual-snapshots.test.tsx`
- Modify: `tests/tui/__snapshots__/visual-snapshots.test.tsx.snap`
- Modify: `.github/workflows/parity-macos-codex.yml`
- Modify: `docs/plans/2026-02-23-codex-desktop-parity-spec.md`

**Step 1: Add alternate buffer assertions (`P0-03`)**

Extend TUI app test coverage for enter/exit buffer behavior.

**Step 2: Add missing visual captures (`P0-09`)**

Add `VG-APP-IDLE`, `VG-APP-SAFE`, `VG-OVERLAY-MENU`, `VG-PERMISSION`, `VG-SCROLL-DEEP`.

**Step 3: Replace manual TODO stubs with executable suites**

Promote reconnect replay and permission stress checks to automated CI jobs.

**Step 4: Update parity spec checklist**

Move open P0 items to closed with evidence links.

**Step 5: Verify**

Run: `npm run test:parity:visual && npm run test:parity:ws9`  
Expected: PASS.

---

### Task 8: Windows readiness in CLI core (platform abstraction)

**Files:**
- Modify: `src/keychain/index.ts`
- Modify: `src/commands/key.ts`
- Modify: `src/commands/serve.ts`
- Modify: `src/core/config.ts`
- Create: `tests/keychain/windows-keychain.test.ts`
- Create: `tests/commands/key.windows-clipboard.test.ts`

**Step 1: Add failing Windows-targeted tests**

Mock `process.platform === "win32"` and assert keychain + clipboard behavior.

**Step 2: Implement Windows keychain backend**

Add Credential Manager adapter path (or explicit secure fallback with warning if unavailable).

**Step 3: Implement Windows clipboard adapter**

Support `powershell Set-Clipboard` fallback in key commands.

**Step 4: Guard macOS-specific service operations**

Ensure `launchctl`/mac-only logic is isolated behind platform checks.

**Step 5: Verify**

Run: `npm run test:run -- tests/keychain/windows-keychain.test.ts tests/commands/key.windows-clipboard.test.ts`  
Expected: PASS.

---

### Task 9: Windows Opta Code desktop packaging track

**Files:**
- Create: `1P-Opta-Code-Desktop/src-tauri/Cargo.toml`
- Create: `1P-Opta-Code-Desktop/src-tauri/src/main.rs`
- Create: `1P-Opta-Code-Desktop/src-tauri/tauri.conf.json`
- Create: `1P-Opta-Code-Desktop/.github/workflows/opta-code-windows-build.yml`
- Modify: `1P-Opta-Code-Desktop/README.md`

**Step 1: Add shell wrapper**

Create Tauri wrapper around existing Vite app.

**Step 2: Add secure settings bridge**

Persist daemon connection/token through OS-appropriate secure storage APIs.

**Step 3: Add Windows build workflow**

Build/sign artifact on `windows-latest` and publish ZIP/MSI output.

**Step 4: Add smoke automation**

Run packaged app startup test and basic daemon connect probe in CI.

**Step 5: Verify**

Run: `cd 1P-Opta-Code-Desktop && npm run build` plus Tauri build in CI  
Expected: artifact generated.

---

## Parallel Agent Workstreams (for other agents)

### Lane A: Protocol + Daemon Operations
- Owns Task 1 and Task 2.
- Files are mostly under `1D-Opta-CLI-TS/src/protocol` and `src/daemon/operations`.
- Must not edit `1P` UI files.

### Lane B: Shared Client + Opta Code Operations UX
- Owns Task 3, Task 4, Task 5.
- Files are `packages/daemon-client/*` and `1P-Opta-Code-Desktop/src/*`.
- Coordinate with Lane A on operation IDs only.

### Lane C: Quality + Parity Gates
- Owns Task 6 and Task 7.
- Files are tests/workflows/docs parity specs.
- Cannot change runtime semantics without Lane A sign-off.

### Lane D: Windows Compatibility
- Owns Task 8 and Task 9.
- Files are platform abstractions + packaging.
- Must keep macOS behavior unchanged.

---

## Acceptance Criteria

- [ ] Every CLI family is reachable in Opta Code through first-class UI or typed operations console.
- [ ] Opta Code has repeatable unit and E2E test gates in CI.
- [ ] Codex parity P0 checklist has no open items.
- [ ] 24h soak reliability evidence captured and archived.
- [x] Windows build artifact produced and smoke-tested (Tauri v2 CI workflow: unit-tests → windows-build → smoke).
- [ ] Daemon/client protocol remains canonicalized (`@opta/*` shared packages only).

---

## Verification Command Set

```bash
# CLI runtime/parity
cd 1-Apps/optalocal/1D-Opta-CLI-TS
npm run typecheck
npm run test:parity:core-smoke
npm run test:parity:ws9
npm run test:parity:visual

# Opta Code desktop
cd 1-Apps/optalocal/1P-Opta-Code-Desktop
npm run typecheck
npm run build
npm run test:run
npm run test:e2e
```

---

## Notes

- This plan intentionally avoids duplicating CLI runtime logic inside Opta Code.
- Long-tail CLI capability parity is provided by typed daemon operations, not shell command execution from UI.
- Windows scope is viable, but gated on platform abstraction completion in CLI core and secure credential strategy.
