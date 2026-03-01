# Opta Accounts Full Optimization Plan

Status: **Ready for execution**
Owner: Matthew + Opta
Scope: All apps synced with `cytjsmezydytbmjrolyz.supabase.co`
Created: 2026-02-28

---

## Current Reality (What Exists Today)

### Supabase Database — Actual Table State

| Table                                  | Status                             | Who Uses It               |
| -------------------------------------- | ---------------------------------- | ------------------------- |
| `auth.users`                           | Applied, working                   | All authed apps           |
| `public.profiles`                      | Applied (core_schema)              | Nobody reads it           |
| `public.devices` (1N generic)          | Applied (core_schema)              | Nobody uses it            |
| `public.devices` (1L rich)             | Applied (1L migration)             | 1L only                   |
| `public.cloud_sessions`                | Applied (1L migration)             | 1L only                   |
| `public.cloud_messages`                | Applied (1L migration)             | 1L only                   |
| `public.credentials`                   | Unknown (no migration file exists) | 1F + 1E (Google tokens)   |
| `public.api_keys`                      | **NOT APPLIED** (archived)         | 1R code queries it, fails |
| `public.accounts_profiles`             | **NOT APPLIED** (archived)         | 1R code queries it, fails |
| `public.accounts_devices`              | **NOT APPLIED** (archived)         | 1R code queries it, fails |
| `public.accounts_sessions`             | **NOT APPLIED** (archived)         | 1R code queries it, fails |
| `public.accounts_capability_grants`    | **NOT APPLIED** (archived)         | 1R code queries it, fails |
| `public.accounts_provider_connections` | **NOT APPLIED** (archived)         | 1R code queries it, fails |
| `public.accounts_audit_events`         | **NOT APPLIED** (archived)         | 1R code queries it, fails |

### App Auth Integration — Actual State

| App             | Has Auth              | Uses Accounts Portal | Cookie Domain              | Cloud Data Sync          |
| --------------- | --------------------- | -------------------- | -------------------------- | ------------------------ |
| 1R Accounts     | Yes (portal)          | IS the portal        | `.optalocal.com`           | Manages all account data |
| 1L Local Web    | Yes (cloud mode)      | No (own auth forms)  | **Not set** (breaks SSO)   | Sessions + devices       |
| 1F Life Web     | Yes                   | No (own auth forms)  | Not set (different domain) | Google OAuth tokens      |
| 1E Life iOS     | Yes                   | No (own auth forms)  | N/A (native)               | Credentials (encrypted)  |
| 1D CLI          | Yes (email/pass only) | No (raw REST)        | N/A                        | Nothing                  |
| 1M LMX          | JWT verify only       | No                   | N/A                        | Nothing                  |
| 1J Optamize Mac | No                    | No                   | N/A                        | Nothing                  |
| 1P Code Desktop | No (daemon token)     | No                   | N/A                        | Nothing                  |
| 1G Mini Mac     | No                    | No                   | N/A                        | Nothing                  |
| 1H Scan iOS     | No                    | No                   | N/A                        | Nothing                  |
| 1O Init         | No                    | No                   | N/A                        | Nothing                  |
| 1I OptaPlus     | No (bot tokens)       | No                   | N/A                        | Nothing                  |

### Critical Blockers (Day Zero)

1. **7 tables not applied** — Every 1R API route errors against non-existent tables
2. **`api_keys` table not applied** — Keys page completely broken
3. **`credentials` table has no migration** — May have been created manually; fragile
4. **1L cookie domain not set** — SSO from accounts portal doesn't propagate session refresh
5. **1F crashes without env vars** — Non-null `!` assertions on Supabase client creation
6. **CLI has no OAuth flow** — `/cli/callback` relay built in 1R but CLI never uses it
7. **Zero apps call capability evaluator** — Policy engine is dead code

---

## Phase 0: Foundation (Database)

**Goal:** Get the Supabase schema to match what 1R's code expects.

### 0.1 Apply accounts capability + device policy migration

- Source: `_archived/.../20260228_accounts_capability_device_policy.sql`
- Move to: `shared/1N-Opta-Cloud-Accounts/supabase/migrations/20260228_accounts_capability_device_policy.sql`
- Apply via: Supabase Dashboard SQL Editor (or `supabase db push` if CLI configured)
- Creates: `accounts_profiles`, `accounts_devices`, `accounts_sessions`, `accounts_capability_grants`, `accounts_provider_connections`, `accounts_audit_events`
- All with RLS + indexes

### 0.2 Apply api_keys migration

- Source: `_archived/.../20260229_api_keys.sql`
- Move to: `shared/1N-Opta-Cloud-Accounts/supabase/migrations/20260229_api_keys.sql`
- Apply via: Same as above
- Creates: `public.api_keys` with `(user_id, provider, label)` unique constraint

### 0.3 Codify credentials table migration

- Write migration: `20260230_credentials.sql`
- Schema to match 1F's `tokens.ts` and 1E's `OptaCredentialService.swift`:
  ```sql
  create table if not exists public.credentials (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    service_name text not null,
    credential_type text not null,
    encrypted_value text not null,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(user_id, service_name, credential_type)
  );
  ```
- Apply to production if table doesn't already exist
- If table exists (manual creation), validate schema matches

### 0.4 Seed owner account profile

- After `accounts_profiles` is created, insert Matthew's profile:
  ```sql
  insert into public.accounts_profiles (id, email, display_name, role)
  select id, email, 'Matthew', 'owner'
  from auth.users
  where email = 'matthew@optamize.biz'
  on conflict (id) do update set role = 'owner';
  ```

### 0.5 Retire generic `public.profiles` table

- The 1N core_schema `profiles` table (just `id`, `user_id`, `created_at`, `updated_at`) is unused by every app
- It conflicts conceptually with `accounts_profiles` (which has `display_name`, `role`, etc.)
- Action: Keep table but stop the auto-create trigger from firing (or redirect it to `accounts_profiles`)
- Better: Update `handle_new_user()` trigger to insert into `accounts_profiles` instead:
  ```sql
  create or replace function public.handle_new_user()
  returns trigger as $$
  begin
    insert into public.accounts_profiles (id, email, role)
    values (new.id, new.email, 'member')
    on conflict (id) do nothing;
    return new;
  end;
  $$ language plpgsql security definer;
  ```

### 0.6 Resolve `public.devices` conflict

- 1N's generic `devices` table (`id, user_id, app_id, device_info`) conflicts with 1L's rich table
- 1L's table is the one actually used in production
- Action: Rename 1N's table to `accounts_device_registry` or simply drop it in favor of `accounts_devices` (which is the capability model version with trust states)
- 1L keeps its own `devices` table for LMX infrastructure tracking
- These are different concerns: `accounts_devices` = security/trust, `devices` (1L) = LMX infrastructure

### 0.7 Verify health endpoint passes

- After all migrations: `GET /api/health/supabase` must return `{ ok: true, schemaReady: true }`
- All 6 `accounts_*` tables present
- All 3 services (auth, rest, storage) healthy

**Verification gate:** `curl http://localhost:3002/api/health/supabase | jq .ok` returns `true`

---

## Phase 1: Fix Critical Bugs in Existing Apps

**Goal:** Every app that has Supabase auth should work correctly and safely.

### 1.1 Fix 1F Supabase client null-safety

- File: `1F-Opta-Life-Web/lib/supabase/client.ts`
- Change: Replace `!` non-null assertions with null guards (match 1L/1R pattern)
- If env vars missing, return `null` instead of crashing
- Same for `server.ts` and `middleware.ts`

### 1.2 Fix 1L cookie domain for SSO

- Files: `1L-Opta-Local/web/src/lib/supabase/server.ts`, `middleware.ts`
- Add cookie domain logic matching 1R:
  ```typescript
  const isProduction = process.env.NODE_ENV === 'production';
  // In cookie set/remove options:
  ...(isProduction ? { domain: '.optalocal.com' } : {})
  ```
- This enables session tokens set by 1R (accounts portal) to be refreshed by 1L without losing the domain scope

### 1.3 Fix 1E competing auth managers

- `AuthManager.swift` and `OptaAccountService.swift` are parallel singletons
- Choose one as canonical (recommend `OptaAccountService` — it uses auth state listener)
- Deprecate the other; forward calls to the canonical one
- Ensure only one writes to Keychain

### 1.4 Write `credentials` table migration if missing

- Check if `public.credentials` exists in Supabase dashboard
- If not, apply the migration from Phase 0.3
- If yes, verify schema matches (columns, constraints, RLS)

### 1.5 Add service role key to 1R env

- The health endpoint needs `SUPABASE_SERVICE_ROLE_KEY` to probe table existence
- Without it, table probes go through RLS and may return false positives
- Add to `.env.local` (already gitignored) and Vercel env vars
- **Never expose to client**

---

## Phase 2: Centralize Auth Through Accounts Portal

**Goal:** All apps that need user auth should funnel through `accounts.optalocal.com`.

### 2.1 1L: Redirect to Accounts portal for sign-in (cloud mode)

- Current: 1L has its own sign-in/sign-up forms with Google/Apple OAuth
- Target: In cloud mode, redirect to `https://accounts.optalocal.com/sign-in?next=https://local.optalocal.com`
- After sign-in at accounts portal, user is redirected back with session cookie already set on `.optalocal.com`
- 1L's middleware picks up the session from the shared cookie
- Remove 1L's duplicate OAuth buttons and sign-in forms
- Keep LAN mode as-is (no auth)

### 2.2 1D CLI: Implement browser OAuth flow

- The contract (`cli-auth-contract.md`) specifies OAuth support
- 1R's `/cli/callback` relay route is already built and working
- CLI implementation needed:
  1. `opta account login --oauth` (or make it default)
  2. Start local HTTP server on random port (1024-65535)
  3. Open browser to `https://accounts.optalocal.com/sign-in?cli_port=<port>&state=<nonce>`
  4. User signs in at portal (Google/Apple/email)
  5. Portal hits `/cli/callback?port=<port>&state=<nonce>` which relays tokens to `http://127.0.0.1:<port>`
  6. CLI receives tokens, saves to `~/.config/opta/account.json`
  7. Shut down local server
- State nonce must be single-use with short TTL

### 2.3 1E iOS: Use accounts portal via in-app browser

- Currently: 1E has full native sign-in forms
- Target: Open `ASWebAuthenticationSession` to `accounts.optalocal.com/sign-in?redirect=opta-life://auth/callback`
- This is already in the 1R redirect allowlist (`opta-life://auth/callback`)
- After portal sign-in, deep link back to app with session tokens
- Simplifies 1E — remove duplicate Google/Apple sign-in code
- Keep native Supabase SDK for ongoing session management (refresh, queries)

### 2.4 1F: Evaluate SSO feasibility

- 1F is on `life.opta.app` — different root domain from `optalocal.com`
- Cookie-based SSO is impossible across different root domains
- Options:
  - **A) Move 1F to `life.optalocal.com`** — enables cookie SSO (recommended if DNS allows)
  - **B) Token relay** — redirect to accounts portal, portal redirects back with one-time code, 1F exchanges code for session
  - **C) Keep independent** — 1F already works with its own auth; just share same Supabase project
- Recommendation: **Option C for now**, promote to A later if/when 1F is active

---

## Phase 3: Sync API Keys Across All Apps

**Goal:** API keys stored in Opta Accounts should be available to every app that needs them.

### 3.1 Verify `api_keys` table is live

- Prerequisite: Phase 0.2 complete
- Test: Sign in at 1R, navigate to `/keys`, add an Anthropic key
- Verify: Key appears in Supabase dashboard under `public.api_keys`

### 3.2 1D CLI: Add cloud key resolution

- The key resolution chain in `lmx/api-key.ts` currently:
  1. `OPTA_API_KEY` env var
  2. `connection.apiKey` from config
  3. OS keychain
  4. Default sentinel
- Add step between keychain and default:
  ```
  3. OS keychain
  4. Cloud key from Supabase api_keys table (if logged in)
  5. Default sentinel
  ```
- New file: `src/accounts/cloud-keys.ts`
- Uses account session from `~/.config/opta/account.json` to query:
  ```
  GET /rest/v1/api_keys?is_active=eq.true&select=provider,key_value
  Authorization: Bearer <access_token>
  ```
- Cache locally with TTL (e.g. 5 min) to avoid network calls on every inference

### 3.3 1L: Pull API keys from cloud

- When signed in (cloud mode), query `api_keys` table for the user
- Display in a "Cloud Keys" section of settings
- Allow overriding with local keys (local takes precedence)
- Use cloud keys as fallback for LMX, Anthropic, etc.

### 3.4 1E iOS: Sync API keys via credentials table

- 1E already syncs credentials (Google token, Todoist key) with AES-256-GCM encryption
- Extend `OptaCredentialService` to also sync API provider keys from `api_keys`
- Or: Read directly from `api_keys` table (simpler, since keys aren't encrypted there)

### 3.5 1M LMX: Account-scoped API tokens

- When `supabase_jwt_enabled=true`, LMX verifies JWT and extracts `sub` (user_id)
- Add: After JWT verification, look up user's `api_keys` for per-request provider routing
- This enables multi-user LMX: each user's inference goes through their own API keys
- Lower priority — only matters for cloud/multi-tenant LMX deployments

---

## Phase 4: Device Registration & Trust

**Goal:** Every app that authenticates should register its device in `accounts_devices`.

### 4.1 Define device fingerprint strategy

- **Web (1R, 1L, 1F):** User-agent hash + screen resolution + timezone
- **CLI (1D):** hostname + platform + arch + username hash
- **iOS (1E):** `identifierForVendor` + model + OS version
- **LMX (1M):** hostname + MAC address hash (for LAN identification)
- Fingerprint is hashed (SHA-256) and stored as `fingerprint_hash`

### 4.2 1R: Auto-register device on sign-in

- After successful auth callback, upsert into `accounts_devices`:
  ```
  { user_id, device_label: browser+OS, platform: 'web',
    fingerprint_hash, trust_state: 'trusted', last_seen_at: now() }
  ```
- Show device list on profile page (already coded, needs working table)

### 4.3 1L: Register device in cloud mode

- On successful auth (cloud mode), register device:
  ```
  { device_label: deviceName, platform: 'web',
    fingerprint_hash, trust_state: 'trusted' }
  ```
- Update `last_seen_at` on every cloud sync heartbeat (piggyback on existing settings-sync upsert)

### 4.4 1D CLI: Register on login

- After `opta account login`, register device:
  ```
  { device_label: hostname, platform: os.platform(),
    fingerprint_hash, trust_state: 'trusted' }
  ```
- Store `device_id` in `~/.config/opta/account.json` for future capability checks

### 4.5 Device management UI in 1R

- Already coded in `/api/devices` and `/api/devices/[id]/trust-state`
- Once table exists, the profile page can list/manage devices
- Allow changing trust state: trusted, restricted, quarantined, revoked

---

## Phase 5: Capability Gating

**Goal:** Sensitive actions across all apps are guarded by the capability evaluator.

### 5.1 Seed default capability grants

- On new user registration (trigger), insert baseline grants:
  ```sql
  insert into accounts_capability_grants (user_id, scope, granted, reason)
  values
    (NEW.id, 'account.read', true, 'default'),
    (NEW.id, 'account.write', true, 'default'),
    (NEW.id, 'cli.login', true, 'default'),
    (NEW.id, 'cli.run', true, 'default'),
    (NEW.id, 'lmx.inference', true, 'default'),
    (NEW.id, 'provider.key.read_metadata', true, 'default');
  ```
- Owner/admin roles bypass scope checks (already implemented in 1R's `authz.ts`)

### 5.2 1D CLI: Call evaluator before high-risk actions

- Before `opta do` (autonomous mode), call:
  ```
  POST /api/capabilities/evaluate
  { scope: "cli.run", deviceId: "<stored_device_id>" }
  ```
- If denied, show reason and exit
- For `automation.high_risk` actions (browser automation, desktop control), require explicit scope

### 5.3 1M LMX: Gate admin endpoints

- Admin routes (`/admin/*`) should require `lmx.admin` scope
- After JWT verification, call accounts evaluator:
  ```
  POST https://accounts.optalocal.com/api/capabilities/evaluate
  { scope: "lmx.admin", deviceId: null }
  ```
- If denied, return 403

### 5.4 1R: Show capability grants on profile

- Add a "Permissions" section to profile page
- List active grants, their scopes, expiry
- Allow owner to modify grants for other users

---

## Phase 6: Audit Trail

**Goal:** All security-relevant actions produce immutable audit events.

### 6.1 Write audit events server-side

- Every 1R API route that modifies data should write to `accounts_audit_events`:
  - Device trust change: `{ event_type: 'device.trust_change', risk_level: 'medium', decision: 'allow' }`
  - Session revocation: `{ event_type: 'session.revoke', risk_level: 'low', decision: 'allow' }`
  - API key CRUD: `{ event_type: 'api_key.upsert', risk_level: 'medium', decision: 'allow' }`
  - Capability evaluation: `{ event_type: 'capability.evaluate', ... }`
  - Failed auth attempts: `{ event_type: 'auth.failed', risk_level: 'high', decision: 'deny' }`
- Use service role for writes (audit table should be append-only via RLS — users can read their own but never insert/update/delete)

### 6.2 Add append-only RLS for audit events

```sql
-- Users can read their own audit events
create policy accounts_audit_self_select on public.accounts_audit_events
  for select using (auth.uid() = user_id);

-- Only service role can insert (no user inserts)
-- Default deny on insert/update/delete for anon/authenticated roles
```

### 6.3 Audit viewer in 1R profile

- Show recent audit events on profile page
- Filter by event type, risk level
- Highlight high/critical events

---

## Phase 7: Session Management

**Goal:** Centralized session tracking with cross-app revocation.

### 7.1 Track sessions in `accounts_sessions`

- On every sign-in (any app), create session record:
  ```
  { user_id, device_id, session_type: 'web'|'cli'|'api',
    expires_at: token.exp }
  ```
- On sign-out, set `revoked_at`

### 7.2 Session revocation propagation

- When user revokes a session in 1R:
  1. Mark `revoked_at` in `accounts_sessions`
  2. Call `supabase.auth.admin.signOut(userId, scope)` to invalidate tokens
  3. Revocation propagates via token expiry (access tokens are short-lived)
- For immediate revocation: apps should check session status on critical actions

### 7.3 "Revoke all" implementation

- Already coded in `POST /api/sessions/revoke-all`
- Needs working `accounts_sessions` table (Phase 0.1)
- After marking all sessions revoked, calls `supabase.auth.signOut({ scope: 'global' })`

---

## Phase 8: Provider Connections

**Goal:** Track which OAuth providers are linked to each account.

### 8.1 Real provider detection

- Current: Stub mode (marks status but no real exchange)
- Target: Read `auth.users.identities` to detect which providers are actually linked
- Supabase stores linked identities automatically after OAuth sign-in
- `accounts_provider_connections` should mirror this for UI display

### 8.2 API key provider connections

- Distinguish between:
  - **OAuth providers** (Google, Apple) — identity/login
  - **API providers** (Anthropic, OpenAI, Gemini, Groq, etc.) — API keys
- OAuth status comes from `auth.identities`
- API status comes from `api_keys` table (is_active, last_verified_at)
- Show both on a unified "Connections" page in 1R

### 8.3 1E credential sync alignment

- 1E uses `OptaCredentialService` with AES-256-GCM client-side encryption to sync to `credentials`
- This is more secure than `api_keys` (which stores plaintext)
- Decision: Keep both:
  - `credentials`: Client-encrypted secrets (Google OAuth tokens, per-device secrets)
  - `api_keys`: User-managed API keys (viewable in portal, verifiable)

---

## Phase 9: Shared Supabase Package

**Goal:** Eliminate duplicated Supabase auth code across web apps.

### 9.1 Create `@opta/supabase` package

- Location: `6-Packages/6F-Supabase/`
- Exports:
  - `createBrowserSupabase()` — null-safe browser client
  - `createServerSupabase()` — null-safe server client with cookie domain logic
  - `updateSupabaseMiddleware()` — session refresh middleware with `.optalocal.com` domain
  - `isCloudMode()` — environment detection
  - TypeScript types for all custom tables
- All three web apps (1R, 1L, 1F) import from this shared package

### 9.2 Generate TypeScript types from schema

- Run `supabase gen types typescript --project-id cytjsmezydytbmjrolyz > types.ts`
- Include types for all tables: `accounts_*`, `api_keys`, `credentials`, `devices`, `cloud_sessions`, `cloud_messages`
- Export from `@opta/supabase/types`

### 9.3 Migrate apps to shared package

- 1R: Replace `src/lib/supabase/*` with imports from `@opta/supabase`
- 1L: Replace `web/src/lib/supabase/*` with imports from `@opta/supabase`
- 1F: Replace `lib/supabase/*` with imports from `@opta/supabase`
- Each app still has its own `.env.local` for config

---

## Phase 10: Data Completeness Audit

**Goal:** Ensure every piece of user data that should sync, does sync.

### 10.1 Data that SHOULD sync via Opta Accounts

| Data                               | Source App        | Target Table                    | Status    |
| ---------------------------------- | ----------------- | ------------------------------- | --------- |
| User identity (email, name)        | All               | `accounts_profiles`             | Phase 0   |
| Device registry                    | All authed apps   | `accounts_devices`              | Phase 4   |
| Active sessions                    | All authed apps   | `accounts_sessions`             | Phase 7   |
| API keys (Anthropic, OpenAI, etc.) | 1R portal, 1D CLI | `api_keys`                      | Phase 3   |
| Google OAuth tokens                | 1F, 1E            | `credentials`                   | Phase 0.3 |
| Capability grants                  | 1R admin          | `accounts_capability_grants`    | Phase 5   |
| Audit trail                        | 1R (all actions)  | `accounts_audit_events`         | Phase 6   |
| Provider connections               | 1R                | `accounts_provider_connections` | Phase 8   |

### 10.2 Data that should NOT sync (stays local)

| Data                    | App | Storage      | Reason                    |
| ----------------------- | --- | ------------ | ------------------------- |
| LMX admin key           | 1M  | YAML config  | Machine-specific          |
| Daemon connection token | 1P  | In-memory    | Per-session               |
| Bot pairing tokens      | 1I  | Keychain     | Device-specific           |
| Chess usernames         | 1J  | localStorage | Toy feature               |
| Arena sessions          | 1L  | IndexedDB    | Experimental, high-volume |
| Camera permissions      | 1H  | System       | OS-level                  |

### 10.3 Data that COULD sync (future consideration)

| Data                                     | App    | Current Storage                               | Benefit                 |
| ---------------------------------------- | ------ | --------------------------------------------- | ----------------------- |
| Chat sessions + messages                 | 1L     | IndexedDB + `cloud_sessions`/`cloud_messages` | Already syncing         |
| Device connection settings               | 1L     | `devices` (1L)                                | Already syncing         |
| CLI session history                      | 1D     | `~/.config/opta/sessions/`                    | Cross-device continuity |
| User preferences (theme, autonomy level) | 1D, 1L | Local config                                  | Profile sync            |
| Agent run history                        | 1L     | IndexedDB                                     | Analytics, replay       |

---

## Execution Priority

| Phase                      | Effort    | Impact                         | Dependencies              |
| -------------------------- | --------- | ------------------------------ | ------------------------- |
| **0 Foundation**           | 1-2 hours | Critical — unblocks everything | Supabase dashboard access |
| **1 Fix bugs**             | 2-3 hours | Critical — apps crash/break    | None                      |
| **2 Centralize auth**      | 1-2 days  | High — single sign-on          | Phase 0                   |
| **3 API key sync**         | 1 day     | High — key management          | Phase 0.2                 |
| **4 Device registration**  | 1 day     | Medium — security visibility   | Phase 0.1                 |
| **5 Capability gating**    | 2 days    | Medium — security enforcement  | Phase 4                   |
| **6 Audit trail**          | 1 day     | Medium — compliance/debugging  | Phase 0.1                 |
| **7 Session management**   | 1 day     | Medium — security              | Phase 0.1, 4              |
| **8 Provider connections** | 0.5 days  | Low — UI polish                | Phase 0.1                 |
| **9 Shared package**       | 1 day     | Medium — maintenance           | Phase 1                   |
| **10 Data audit**          | 0.5 days  | Low — completeness check       | All above                 |

---

## Success Criteria (100% Optimization)

- [ ] `GET /api/health/supabase` returns `{ ok: true, schemaReady: true }`
- [ ] All 8 tables exist with correct RLS policies
- [ ] `api_keys` CRUD works end-to-end in portal
- [ ] 1L SSO works: sign in at accounts.optalocal.com, session available at local.optalocal.com
- [ ] 1D CLI can `opta account login --oauth` via browser
- [ ] 1D CLI resolves API keys from cloud when logged in
- [ ] Every authed app registers its device in `accounts_devices`
- [ ] High-risk actions in CLI/LMX call capability evaluator
- [ ] All auth/security actions produce audit events
- [ ] Session revocation at portal propagates to all clients < 30s
- [ ] No duplicate Supabase auth code across web apps
- [ ] Zero `!` non-null assertions on Supabase client creation
- [ ] `credentials` table has a proper migration file in 1N
