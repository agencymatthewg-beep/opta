# Opta Init — Account Sync Implementation Plan

**Goal:** Bridge the Opta Init Desktop Manager (`1O-Opta-Init/desktop-manager`) with the broader Opta Accounts ecosystem by leveraging the CLI as the identity broker.

## Context
Currently, Opta Init acts as a blind local supervisor. It can talk to the `opta daemon` using a local loopback token, but it has no awareness of the user's cloud identity (`accounts.optalocal.com`). We need to implement a "CLI Auth Bridge" so Opta Init can read the user's profile and trigger logins/logouts.

## Implementation Steps

### Phase 1: Rust Backend Bindings (CLI Auth Bridge)
We will add three new Tauri commands in `1O-Opta-Init/desktop-manager/src-tauri/src/main.rs`:
1.  `get_account_status()`: Executes `opta account status --json`. Parses the output to return the user's email, name, avatar, and active role. Returns `null` if not logged in.
2.  `trigger_login()`: Executes `opta account login --oauth --timeout <seconds> --return-to opta-init://auth/callback --json`. This opens the user's default browser to `accounts.optalocal.com/sign-in?mode=cli`, then returns focus to Init via deep link after callback completion before persisting the local account state.
3.  `trigger_logout()`: Executes `opta account logout --json` to clear local account state and revoke the remote session when possible.

### Phase 2: React UI Integration (`App.tsx`)
1.  **State Management:** Add a `userProfile` state object to `App.tsx`. Poll `invoke('get_account_status')` periodically (or on window focus) to ensure the Init app stays synced if the user logs out via the terminal.
2.  **Settings Modal Update:**
    *   Replace the placeholder "Link Account" button with a dynamic Identity section.
    *   **Logged Out State:** Show a prominent "Sign In to Opta Accounts" button that fires `trigger_login()`.
    *   **Logged In State:** Display the user's avatar, email, and a "Sign Out" button that fires `trigger_logout()`.

### Phase 3: CLI Contract Verification
Ensure the `1D-Opta-CLI-TS` repository actually supports the required `--json` outputs for `opta account status`. If it doesn't, we will patch the CLI first to ensure the contract is stable before writing the Rust parser.

---
**Status:** Ready for parallel execution.
