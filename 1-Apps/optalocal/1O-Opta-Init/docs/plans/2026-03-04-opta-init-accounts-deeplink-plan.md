# Opta Init Accounts Deep Link Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the Opta Accounts tile start the OAuth flow and automatically refresh local profile state once the deep-link callback fires.

**Architecture:** Split the canvas cluster rendering into a dedicated `AppsGrid` so App.tsx handles orchestration. Use Tauri's deep-link plugin to emit `deep-link::auth-complete` whenever the OS hands us the `opta-init://auth/callback` URL. A React `useEffect` listens for that event, refreshes the account profile via `invoke('get_account_status')`, and surfaces feedback with a lightweight toast banner.

**Tech Stack:** React 18 + Vite, @tauri-apps/api/event, Vitest + React Testing Library, Rust (Tauri), tauri-plugin-deep-link.

---

### Task 1: Extract/extend AppsGrid component

**Files:**
- Create/modify: `desktop-manager/src/components/AppsGrid.tsx`
- Modify: `desktop-manager/src/App.tsx` (import wiring)
- Test: `desktop-manager/src/App.accounts.test.tsx`

**Step 1: Scaffold AppsGrid**
Export `<AppsGrid>` that receives the manifest apps, hover handlers, progress info, `onAppClick`, and new optional `onAccountsClick`. Move the existing `renderAppNode` logic from App.tsx into this component.

**Step 2: Wire Accounts override**
Inside AppsGrid, detect Apps entries (slug === 'accounts' OR id === 'opta-accounts'). When clicked, prefer `onAccountsClick?.()` and skip the generic website launch.

**Step 3: Unit test handler contract**
Add a Vitest test in `src/App.accounts.test.tsx` rendering AppsGrid with fake data to assert the Accounts tile triggers the injected mock.

**Step 4: Re-run focused tests**
`npm run test -- src/App.accounts.test.tsx` (expect failure before implementation, success after wiring).

---

### Task 2: App-level behavior + toast feedback

**Files:**
- Modify: `desktop-manager/src/App.tsx`
- Modify: `desktop-manager/src/App.accounts.test.tsx`

**Step 1: Pass handlers to AppsGrid**
Have App.tsx pass `runAccountAction('login')` as `onAccountsClick` plus the previous run/hover callbacks to AppsGrid. Introduce toast state (simple array or single message) so UI can display when login completes.

**Step 2: Subscribe to deep-link event**
Use `listen('deep-link::auth-complete', handler)` inside a guarded effect. When triggered, call `refreshAccountProfile()`, push a toast, and clear it after a timeout. Ensure the listener unsubscribes on cleanup.

**Step 3: Extend React test**
Add a test verifying that invoking the mocked listener callback results in `invoke('get_account_status')` being called again and the toast UI showing success text.

**Step 4: Run tests**
`npm run test -- src/App.accounts.test.tsx`

---

### Task 3: Tauri deep-link bridge

**Files:**
- Modify: `desktop-manager/src-tauri/src/main.rs`

**Step 1: Register handler**
When initializing `tauri_plugin_deep_link`, provide a closure that inspects the incoming URL. If it matches `opta-init://auth/callback` (or starts with it), emit `deep-link::auth-complete` to the main window with the URL payload.

**Step 2: Ensure fallback logging**
Log other URLs for debugging but ignore them. Return Ok(()) so plugin continues running.

**Step 3: Rust tests**
`cargo test -p desktop-manager`

---

Execution choice pending confirmation; defaulting to subagent-driven in this session once plan approved.
