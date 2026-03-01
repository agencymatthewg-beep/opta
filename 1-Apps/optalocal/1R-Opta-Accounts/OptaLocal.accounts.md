# OptaLocal.accounts.md

Purpose: simple integration source-of-truth for `accounts.optalocal.com`.

## 1) Core Stack We Use (Now)

### Identity + Session
- Supabase Auth (`@supabase/ssr`, `@supabase/supabase-js`)
- Cookie domain strategy: `.optalocal.com` (production)
- Auth methods in use/planned:
  - Email + password
  - Phone + password
  - Google OAuth
  - Apple OAuth
  - CLI browser callback auth

### Accounts Website
- App: `1R-Opta-Accounts` (Next.js 16 + React 19 + TS)
- Primary domain: `accounts.optalocal.com`
- Redirect domains: `auth.optalocal.com`, `login.optalocal.com`
- Security controls:
  - Redirect allowlist (`src/lib/allowed-redirects.ts`)
  - Middleware session refresh (`middleware.ts`)
  - OAuth callback exchange (`/auth/callback`)
  - CLI token relay (`/cli/callback` to `127.0.0.1:<port>`)

### Canonical Auth Spec
- App/spec: `1N-Opta-Cloud-Accounts` (non-buildable, canonical contracts)
- Must remain source-of-truth for all app auth integration rules.

---

## 2) Opta CLI + Opta LMX: What We Use / Can Use

### Opta CLI (1D-Opta-CLI-TS)
Use now:
- LMX provider (local inference)
- Cloud fallback providers (Anthropic/OpenAI/Gemini) when configured
- Autonomy levels + CEO mode
- Browser runtime + MCP tools
- Sub-agent orchestration

Can use more (recommended):
- Full account-aware login via `accounts.optalocal.com` as the only login portal
- Session bootstrap from web login (`/cli/callback`) as default CLI onboarding path
- Per-account profile sync (provider preferences, autonomy defaults, policy presets)

### Opta LMX (1M-Opta-LMX)
Use now:
- OpenAI-compatible endpoints
- API key security + admin controls
- Skills, agents, streaming

Can use more (recommended):
- Account-bound API tokens scoped by user/device
- Device registration tied to accounts portal
- Centralized usage/session ownership by account

---

## 3) Integration Checklist (Every App + Account)

## A. Domain + DNS
- [ ] `accounts.optalocal.com` points to Accounts deployment
- [ ] `auth.optalocal.com` redirects to accounts
- [ ] `login.optalocal.com` redirects to accounts
- [ ] HTTPS valid on all three hostnames

## B. Supabase Project Consistency
- [ ] All apps use same Supabase project URL
- [ ] Same anon key strategy per environment
- [ ] Auth providers enabled (Google/Apple/email/phone as needed)
- [ ] Redirect URLs include all required app callbacks

## C. Cookie + Session SSO
- [ ] Production cookie domain is `.optalocal.com`
- [ ] Middleware session refresh enabled on web apps
- [ ] Logout propagates reliably across subdomains

## D. Redirect Security
- [ ] All `next` / `redirect_to` values pass allowlist validation
- [ ] No open redirects
- [ ] CLI callback accepts only `127.0.0.1` callback target

## E. Opta CLI Integration
- [ ] CLI sign-in flow opens Accounts portal
- [ ] CLI callback state verification active
- [ ] Account session stored securely (keychain/local secure storage)
- [ ] Account -> CLI settings sync (model/fallback/autonomy profile)

## F. Opta LMX Integration
- [ ] LMX API keys are account-scoped where possible
- [ ] Account identity associated with LMX sessions/runs
- [ ] Admin operations require explicit account role checks

## G. App-by-App Wiring
- [ ] 1F Opta Life Web uses Accounts as auth entrypoint
- [ ] 1E Opta Life iOS follows same Supabase user identity
- [ ] 1L Opta Local Web uses same session/account model
- [ ] 1I OptaPlus adopts shared account contracts
- [ ] Any new app must integrate through 1N contracts first

## H. Testing + Verification
- [ ] Typecheck + lint + build pass for 1P
- [ ] Auth callback smoke test (OAuth + password)
- [ ] CLI callback test (valid/invalid state, valid/invalid port)
- [ ] Cross-subdomain SSO smoke test
- [ ] Logout smoke test across apps

---

## 4) Accounts to Track

Primary operational identities to support in flows:
- `matthew@optamize.biz`
- `agencymatthewg@gmail.com`
- `matthew@xpulsenetwork.com`

Bot/testing identities (where needed):
- `maccasscamXX@gmail.com` series (bot throwaways)

Policy:
- Do not hardcode keys/tokens in app code.
- Use env + secure keychain + Supabase-native auth flows only.

---

## 5) Minimal Rollout Plan

1. Stabilize Accounts site deployment on `accounts.optalocal.com`.
2. Enforce redirect hostnames (`auth`, `login`) to primary accounts domain.
3. Complete CLI browser-auth as default sign-in path.
4. Bind LMX usage/session metadata to account identity.
5. Migrate each app to Accounts-first auth entrypoint, one by one.

Owner: Matthew + Opta
Status: In progress

---

## 6) Supabase Health Gate (must pass)

Run and verify:
- `GET /api/health/supabase` returns:
  - `services.auth.ok = true`
  - `services.rest.ok = true`
  - `services.storage.ok = true`
  - `schemaReady = true`

If `schemaReady=false`:
- Apply migration: `1N-Opta-Cloud-Accounts/supabase/migrations/20260228_accounts_capability_device_policy.sql`
- Re-run health endpoint until green.

Current observed state (2026-02-28):
- Auth/REST/Storage reachable
- New capability-device tables not yet present (migration pending)
