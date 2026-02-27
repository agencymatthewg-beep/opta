# Accounts + LMX Integration Hardening Plan

**Date:** 2026-02-26
**Scope:** Fix all critical/high gaps from integration assessment
**Strategy:** Two parallel batches — Batch 1 has zero file conflicts, Batch 2 follows

---

## Problem Summary

**Accounts (2/10):** Token written to disk, immediately forgotten. No refresh, no TUI, no slash commands, no feature gating.
**LMX (8/10):** Solid foundation. Gaps are UX: no in-session reconnect, no heartbeat, no /status in REPL, fallback host invisible.

---

## Batch 1 — 4 Parallel Agents (zero file conflicts)

### Agent A1: Token Refresh + Storage Expiry Check
**Files (exclusive):** `src/accounts/supabase.ts`, `src/accounts/storage.ts`

1. Add `refreshSession(config, refreshToken)` to `supabase.ts`:
   - POST `/auth/v1/token?grant_type=refresh_token` with body `{ refresh_token }`
   - Use `requestSupabase()` internal helper, same error handling
   - Return `SupabaseAuthResult`

2. Modify `loadAccountState()` in `storage.ts`:
   - After parsing state, check `state.session?.expires_at`
   - If token expires within 5 minutes (`Date.now() / 1000 + 300 >= expires_at`): call `refreshSession()`
   - On refresh success: call `saveAccountState()` with new session, return refreshed state
   - On refresh failure (network/401): return state with session set to null (token invalid)
   - `resolveSupabaseAuthConfig()` is needed — import it
   - If no Supabase config: skip refresh, return state as-is

3. Export `refreshSession` from `supabase.ts` for use by slash commands

**Verification:** `npm run typecheck` passes, `npm test -- tests/accounts/` passes

---

### Agent A2: SettingsOverlay Account Page
**Files (exclusive):** `src/tui/SettingsOverlay.tsx`

1. Add a new page (insert before last page or as page 6): `'account'`
2. Add to `SETTINGS_PAGES` array: `{ id: 'account', label: 'Account', icon: '◎' }`
3. Implement account page render section:
   - On mount/focus: call `loadAccountState()` from `../../accounts/storage.js`
   - Show: user email/phone, project name, token status (Valid / Expired / Not configured)
   - Show token expiry: "Expires in Xh Ym" or "Expired X ago"
   - Show: "Supabase: configured" or "Supabase: not configured (set OPTA_SUPABASE_URL)"
   - Action hints: "opta account login" to authenticate, "opta account logout" to clear
4. Handle loading state (async) — show "Loading..." until state resolves
5. No interactive actions needed (read-only display is sufficient for now)

**Verification:** `npm run typecheck` passes

---

### Agent A3: Account Slash Commands + Doctor Check
**Files (exclusive):** `src/commands/slash/account.ts` (NEW), `src/commands/slash/index.ts`, `src/commands/doctor.ts`

1. Create `src/commands/slash/account.ts`:
   - `/whoami` — calls `loadAccountState()`, prints user email/phone, token validity, expiry. If not logged in: "Not authenticated — run `opta account login`"
   - `/logout` — calls `loadAccountState()` + `logoutSession()` + `clearAccountState()`. Handles missing Supabase config gracefully (just clears local state with warning).
   - Export `accountCommands: SlashCommandDef[]`

2. Register in `src/commands/slash/index.ts`:
   - Import `{ accountCommands }` from `'./account.js'`
   - Add to `allCommands` array

3. Add account check to `src/commands/doctor.ts`:
   - New check: `'account'`
   - Step 1: Check `resolveSupabaseAuthConfig()` → if null, warn "OPTA_SUPABASE_URL not set"
   - Step 2: Call `loadAccountState()` → if null, info "Not logged in"
   - Step 3: If session exists, check expiry → warn if expired, show "Valid (expires in Xh)" if not
   - Run in parallel with existing checks (it's async/independent)

**Verification:** `npm run typecheck` passes, tests pass

---

### Agent L1: LMX /lmx status + /lmx reconnect Slash Commands
**Files (exclusive):** `src/commands/slash/lmx.ts`

1. Add `/lmx status` handler:
   - Create `LmxClient` from ctx.config (same pattern as existing `/scan`)
   - Call `lmx.health()` then `lmx.status()` (same as `src/commands/status.ts`)
   - Print: server version, uptime, memory used/total, loaded models list with ctx/memory
   - Print which host is active: `lmx.getActiveHost()` — show "(fallback)" if not primary
   - On connection failure: show "LMX unreachable at <host>:<port>"
   - Register as `lmxStatus` command with name `'lmx status'` or alias `'status'` within the lmx group

2. Add `/lmx reconnect` handler:
   - Call `resetClientCache()` from `../../core/agent-setup.js` (already exported)
   - Call `resetProviderCache()` from `../../providers/manager.js` (already exported)
   - Call `probeProvider(ctx.config)` — if succeeds: print "✓ Reconnected to <model>"
   - If fails: print "✗ LMX unreachable — Anthropic fallback active" or error
   - Update `ctx.session.model` if provider changed
   - Return `'model-switched'` to signal the agent loop to pick up new provider

3. Add both to `lmxCommands` export array with category `'lmx'`

**Verification:** `npm run typecheck` passes, existing lmx slash tests still pass

---

## Batch 2 — 2 Parallel Agents (run after Batch 1 commits)

### Agent TUI: App.tsx + StatusBar Full Integration
**Files (exclusive):** `src/tui/App.tsx`, `src/tui/StatusBar.tsx`

**App.tsx additions:**
1. Add `accountState` state: `useState<AccountState | null>(null)`
2. Load on mount: `useEffect(() => { loadAccountState().then(setAccountState); }, [])`
3. Add 30-second LMX heartbeat: `useEffect` with `setInterval(checkConnection, 30_000)` that calls `probeLmxConnection()` and updates `connectionState` — clear interval on unmount
4. Add reconnect trigger: `reconnectLmx()` function that calls `resetProviderCache()` + `probeProvider()` and updates `connectionState`
5. Pass `accountState`, `reconnectLmx` as props where needed

**StatusBar.tsx additions:**
1. Add `accountUser?: SupabaseUser | null` prop
2. Add `activeHost?: string` prop
3. Add `onReconnect?: () => void` prop
4. Render user identity: truncated email (first 20 chars) with `◎` icon — dim if null
5. Render active host: show `(fallback)` badge in amber if `activeHost` differs from primary config host
6. Render reconnect affordance: when `connectionState === 'error'`, show `[r] reconnect` hint

**Verification:** `npm run typecheck`, TUI smoke tests pass, `npm run test:parity:desktop-path`

---

### Agent Tests: Provider Layer Unit Tests
**Files (exclusive):** `tests/providers/manager.test.ts` (extend), `tests/providers/lmx.test.ts` (extend)

1. `tests/providers/manager.test.ts`:
   - Test: `probeProvider()` returns LMX provider when LMX healthy
   - Test: `probeProvider()` returns Anthropic when LMX unreachable + API key present
   - Test: `probeProvider()` throws when both unreachable
   - Test: `resetProviderCache()` forces new provider instance on next `getProvider()`
   - Mock `LmxClient` and `AnthropicProvider`

2. `tests/providers/lmx.test.ts`:
   - Test: `LmxProvider.health()` returns true when client responds
   - Test: `LmxProvider.listModels()` returns empty array on error (no throw)
   - Test: `LmxProvider.getClient()` returns OpenAI-compatible client
   - Mock `LmxClient`

**Verification:** All new tests pass, no regressions

---

## File Conflict Map

```
Batch 1 (simultaneous):
  Agent A1  →  src/accounts/supabase.ts, src/accounts/storage.ts
  Agent A2  →  src/tui/SettingsOverlay.tsx
  Agent A3  →  src/commands/slash/account.ts (NEW), src/commands/slash/index.ts, src/commands/doctor.ts
  Agent L1  →  src/commands/slash/lmx.ts

Batch 2 (simultaneous, after Batch 1):
  Agent TUI   →  src/tui/App.tsx, src/tui/StatusBar.tsx
  Agent Tests →  tests/providers/manager.test.ts, tests/providers/lmx.test.ts
```

No file is touched by more than one agent in any batch.

---

## Commit Plan

After Batch 1:
- `fix(accounts): add token refresh and expiry check in loadAccountState`
- `feat(tui): add Account page to SettingsOverlay`
- `feat(cli): add /whoami /logout slash commands and account doctor check`
- `feat(cli): add /lmx status and /lmx reconnect slash commands`

After Batch 2:
- `feat(tui): integrate account state and LMX heartbeat into App + StatusBar`
- `test(providers): add unit tests for manager and LMX provider`

---

## Definition of Done (verified 2026-02-27 — ALL COMPLETE)

- [x] `npm run typecheck` — zero errors
- [x] `npm test` — all existing tests pass + new tests pass
- [x] `opta account login` → token auto-refreshes on next `loadAccountState()` — _accounts/storage.ts auto-refresh within 5 min_
- [x] `opta doctor` — reports account state alongside existing checks — _checkAccount() 9th check_
- [x] `/whoami` in REPL — shows current user or "not authenticated" — _commands/slash/account.ts_
- [x] `/lmx status` in REPL — shows server health without leaving chat — _commands/slash/lmx.ts_
- [x] `/lmx reconnect` in REPL — re-probes and reconnects without restart — _commands/slash/lmx.ts_
- [x] SettingsOverlay Account page — shows user + token validity — _tui/SettingsOverlay.tsx 6th page 'account'_
- [x] StatusBar — shows user identity + fallback host indicator — _tui/StatusBar.tsx ◎ email + (fallback) badge_
- [x] LMX heartbeat — connection dot updates every 30s without a turn — _tui/App.tsx 30s probeLmxConnection interval_
