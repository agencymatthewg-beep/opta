---
status: archived
created: 2026-03-04
---

# CLI + Desktop Accounts Resilience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure Opta CLI boots gracefully when LMX/admin keys are misconfigured, wire desktop “Accounts” entry points to the real OAuth flow, and document the troubleshooting path.

**Architecture:** CLI will eagerly probe providers but convert failures into a structured `startupConnectionNotice` so the Ink app renders with a disabled input + CTA banner; admin keys auto-populate from local YAML/key files. Desktop apps reuse the daemon login commands and subscribe to deep-link callbacks to refresh account state. Docs capture the workflow and recovery commands.

**Tech Stack:** TypeScript (Node/Ink CLI), React/Tauri (1P Opta Code, 1O Opta Init), Supabase daemon bridge, Jest/Vitest + Playwright-based integration tests, Markdown docs.

---

### Task 1: CLI Admin Key Detection Helper

**Files:**
- Create: `src/lmx/local-config.ts`
- Modify: `src/core/config.ts`, `src/lmx/client.ts`, `tests/lmx/admin-keys.test.ts`
- Test: `npm run test -- tests/lmx/admin-keys.test.ts`

**Step 1: Write failing unit tests**
Add cases covering YAML parsing + lookup precedence in `tests/lmx/admin-keys.test.ts` (e.g., loopback host auto-detects key from `~/.opta-lmx/config.yaml`).

**Step 2: Run tests to confirm failure**
`npm run test -- tests/lmx/admin-keys.test.ts`
Expect new cases to fail due to missing helper.

**Step 3: Implement `detectLocalAdminKey`**
Add `src/lmx/local-config.ts` with file search + YAML parsing (strip whitespace, allow override env). Export helper returning `{ key, source }`.

**Step 4: Integrate helper**
In `loadConfig`, when host is loopback and `connection.adminKey` falsy, call helper and patch `raw.connection.adminKey`. In `createLmxClient`, use helper as fallback so ad-hoc scripts inherit it. Ensure `resolveAdminKeyForHost` can consume host-specific map.

**Step 5: Re-run tests**
`npm run test -- tests/lmx/admin-keys.test.ts`
All cases should pass.

**Step 6: Commit**
`git add src/lmx/local-config.ts src/core/config.ts src/lmx/client.ts tests/lmx/admin-keys.test.ts`
`git commit -m "feat(cli): auto-detect LMX admin key"`

---

### Task 2: CLI Offline Startup Notice & Input Guard

**Files:**
- Modify: `src/commands/chat.ts`, `src/tui/App.tsx`, `src/tui/hooks/useAppConfig.ts`, `src/tui/types.ts`, `tests/commands/chat-startup.test.ts`, `tests/tui/App.offline.test.tsx`
- Test: `npm run test -- tests/commands/chat-startup.test.ts tests/tui/App.offline.test.tsx`

**Step 1: Add failing test for `startChat`**
Extend `tests/commands/chat-startup.test.ts` to simulate `probeProvider` throwing `OptaError` and assert `renderTUI` invoked with `startupConnectionNotice` and placeholder model.

**Step 2: Add Ink-level test**
Create `tests/tui/App.offline.test.tsx` verifying the new banner renders, input disabled, and callouts visible.

**Step 3: Run tests (expect fail)**
`npm run test -- tests/commands/chat-startup.test.ts tests/tui/App.offline.test.tsx`

**Step 4: Implement notice plumbing**
In `startChat`, catch `OptaError` with `code === 'lmx_unreachable'` (or admin key rejection), build `startupConnectionNotice` {severity, bullets, attemptedEndpoints}, set `startupModelLoaded=false`, and pass it to `renderTUI`. Persist same notice when `ensureModelLoadedOnLmxStartup` fails due to 401.

**Step 5: Update Ink components**
Extend `App` props + context: show banner (emoji + instructions), disable composer + push `Offline` pill; store notice in `useAppConfig` and re-enable once `runConnectionDiagnostics` or manual `/lmx` command succeeds. Provide CTA shortcuts (e.g., highlight `/server status`).

**Step 6: Re-run tests**
`npm run test -- tests/commands/chat-startup.test.ts tests/tui/App.offline.test.tsx`

**Step 7: Commit**
`git add src/commands/chat.ts src/tui/App.tsx src/tui/hooks/useAppConfig.ts src/tui/types.ts tests/commands/chat-startup.test.ts tests/tui/App.offline.test.tsx`
`git commit -m "feat(cli): render offline notice when LMX unavailable"`

---

### Task 3: Opta Code Desktop “Accounts” Button + Deep-Link Listener

**Files:**
- Modify: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1P-Opta-Code-Universal/src/App.tsx`
- Create: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1P-Opta-Code-Universal/src/lib/runtime/deepLinks.ts`
- Modify: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1P-Opta-Code-Universal/src/pages/AccountControlPage.tsx`, `/src/lib/runtime/index.ts`, tests under `src/__tests__/App.topbar.account.test.tsx`
- Test: `npm run test -- App.topbar.account.test.tsx`

**Step 1: Update tests**
Add a React Testing Library test ensuring the top-right Accounts button triggers `handleBrowserLogin` and that the new deep-link hook dispatches `fetchAccountStatus` when receiving `opta-code://auth/callback`.

**Step 2: Run tests (fail)**
`npm run test -- App.topbar.account.test.tsx`

**Step 3: Wire button to login helper**
Replace `openSettings('connection')` callback with a palette command invoking `handleBrowserLogin`. Inject handler via context or prop drill so top bar can call it even when `AccountControlPage` unmounted.

**Step 4: Implement deep-link hook**
Create `deepLinks.ts` that calls `listen('deep-link://', handler)` on mount; when payload matches `opta-code://auth/callback`, dispatch `fetchAccountStatus` and trigger a toast (reuse existing notification system).

**Step 5: Export hook**
Use the hook within `App.tsx` so it registers once. Ensure cleanup unsubscribes.

**Step 6: Re-run tests**
`npm run test -- App.topbar.account.test.tsx`

**Step 7: Commit**
`git -C /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1P-Opta-Code-Universal add src/App.tsx src/lib/runtime/deepLinks.ts src/pages/AccountControlPage.tsx src/lib/runtime/index.ts src/__tests__/App.topbar.account.test.tsx`
`git -C ... commit -m "feat(opta-code): wire Accounts button to OAuth flow"`

---

### Task 4: Opta Init Desktop Tile + Deep-Link Event

**Files:**
- Modify: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1O-Opta-Init/desktop-manager/src/App.tsx`
- Modify: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1O-Opta-Init/desktop-manager/src/components/AppsGrid.tsx`
- Modify: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1O-Opta-Init/desktop-manager/src-tauri/src/main.rs`
- Test: `npm run test -- src/App.accounts.test.tsx` (add new test), and `cargo test --package desktop-manager --lib tauri_plugin_deep_link`

**Step 1: Write React test**
Ensure clicking the Opta Accounts tile triggers `runAccountAction('login')` and that receiving a `deep-link::auth-complete` event reloads account status + shows alert.

**Step 2: Run tests (fail)**
`npm run test -- src/App.accounts.test.tsx`

**Step 3: Update tile handler**
In `AppsGrid`, detect `app.slug === 'accounts'` and call a passed-in `onAccountsClick`. In `App.tsx`, pass `runAccountAction('login')` so the tile triggers the OAuth flow.

**Step 4: Implement deep-link bridge**
In `src-tauri/src/main.rs`, register a deep-link callback that emits `deep-link::auth-complete` with URL payload to the webview (`window.emit`).

**Step 5: React listener**
Extend the existing `useEffect` that watches `cmd-progress` to also subscribe to the new event via `listen('deep-link::auth-complete', ...)`, then call `refreshAccountProfile()` and show a toast.

**Step 6: Run React + Rust tests**
`npm run test -- src/App.accounts.test.tsx`
`cargo test -p desktop-manager`

**Step 7: Commit**
`git -C /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1O-Opta-Init add desktop-manager/src/App.tsx desktop-manager/src/components/AppsGrid.tsx desktop-manager/src-tauri/src/main.rs src/App.accounts.test.tsx`
`git -C ... commit -m "feat(init): deep-link aware accounts tile"`

---

### Task 5: Update Troubleshooting Docs

**Files:**
- Modify: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1U-Opta-Help/app/docs/accounts/auth/page.tsx`
- Modify: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1D-Opta-CLI-TS/docs/OPERATOR-RUNBOOK.md`
- Test: `npm run lint` (docs build) + `npm run test -- docs` if applicable

**Step 1: Add CLI resilience section**
Document new offline banner meaning, steps to run `opta status`, location of auto-detected admin key, and how to use the Accounts buttons on desktop.

**Step 2: Update runbook**
Add a troubleshooting snippet referencing `detectLocalAdminKey`, command to clear/set `connection.adminKey`, and explanation of offline notice.

**Step 3: Build docs**
`npm run lint` (1U project) or `npm run build` if required to ensure MDX compiles.

**Step 4: Commit**
`git add app/docs/accounts/auth/page.tsx docs/OPERATOR-RUNBOOK.md`
`git commit -m "docs: explain accounts flow + offline banner"`
