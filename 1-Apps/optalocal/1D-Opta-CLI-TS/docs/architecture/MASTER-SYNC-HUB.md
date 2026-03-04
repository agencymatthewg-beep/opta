# Opta Daemon Master Sync Architecture

## Overview
The Opta Daemon (`1D-Opta-CLI-TS/src/daemon`) acts as the Master Sync Hub for the entire Opta Local ecosystem. It is the central authority for authentication, cloud capability syncing, and API key propagation. Instead of fragmented frontend authentication, all desktop apps (like Opta Code) rely on the Daemon's unified OAuth relay and local secure keychain.

## Core Objectives
1. **Centralized Auth:** Remove Supabase SDK fragmentation from client apps. Provide a unified local OAuth relay via the Daemon.
2. **Cloud Sync:** Securely pull and sync `public.api_keys` and `public.accounts_capability_grants` from `accounts.optalocal.com`.
3. **Local Propagation:** Broadcast updated cloud state to all connected desktop clients via the Daemon's `SessionManager` and `ws-server`.
4. **Offline Resilience:** Maintain a highly secured local cache (`account.json` / keychain) to ensure local inference models (like LMX) and cached keys function completely offline.

## Architecture

### 1. The OAuth Relay (HTTP Server)
The Daemon's Fastify server (`src/daemon/http-server.ts`) will expose a local callback endpoint.
- **Route:** `GET /auth/callback`
- **Flow:** 
  - User triggers "Log In" from the CLI or Opta Code.
  - They are directed to `https://accounts.optalocal.com/login?redirect=http://127.0.0.1:{DAEMON_PORT}/auth/callback`.
  - The browser redirects back with an authorization `code`.
  - The Daemon exchanges this code for a persistent Supabase session via `src/accounts/supabase.ts`.

### 2. Secure Persistence (Storage)
The retrieved tokens and synced API keys are handled by `src/accounts/storage.ts`.
- **Location:** `~/.opta/account.json` (or encrypted OS keychain depending on OS capabilities).
- **Format:** The `AccountState` schema will be extended to include `api_keys` (encrypted/obfuscated locally if possible) and `capabilities`.
- **Permissions:** Strictly enforced `0o600` file modes.

### 3. The Sync Loop
The Daemon implements a background sync task to pull the latest state from the cloud database.
- Uses the stored Supabase `access_token`.
- Queries the `api_keys` and `accounts_capability_grants` tables.
- Updates the local in-memory config overrides.

### 4. Client Broadcasting (WebSocket)
When the Daemon successfully completes a sync or a new login, it must notify the connected Opta Code client.
- **Manager:** `src/daemon/session-manager.ts`
- **Event:** A system-level broadcast event `opta:account_synced`.
- **Payload:** The sanitized capability list and the presence of API keys (but never the raw secret keys).
- **Effect:** Opta Code's frontend automatically updates to show the "Logged In" state and unlocks premium features (like cloud routing).

## Implementation Steps
1. [ ] Extend `AccountState` in `src/accounts/types.ts` to support capabilities and key metadata.
2. [ ] Add `GET /auth/callback` to `src/daemon/http-server.ts`.
3. [ ] Implement the `exchangeAuthCodeForSession` logic using the `code` parameter.
4. [ ] Build the background `syncCloudState` polling mechanism.
5. [ ] Wire `sessionManager.broadcast('opta:account_synced', payload)` when sync succeeds.
