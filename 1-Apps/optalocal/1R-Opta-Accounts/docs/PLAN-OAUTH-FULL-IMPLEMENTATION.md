# OAuth Full Implementation Plan — Opta Accounts

> Status: DRAFT — 2026-03-06
> Scope: Replace all provider connection stubs with real OAuth flows + add Microsoft identity sign-in

---

## Current State Audit

| Component | Status | Notes |
|-----------|--------|-------|
| Google / Apple / GitHub identity sign-in | ✅ Live | Supabase OAuth, `OAuthButtons.tsx` |
| `accounts_provider_connections` table | ✅ Exists | Schema deployed, PGRST205 guard in place |
| `GET /api/providers` | ✅ Live | Lists connections from DB |
| `POST /api/providers/[provider]/connect` | 🟡 Stub | Writes `connectedVia: 'stub'`, no real token |
| `POST /api/providers/[provider]/disconnect` | 🟡 Stub | Sets `status: 'revoked'`, no token revocation |
| Onboarding Wizard Step 3 | 🟡 Informational | Shows providers but links to /keys, no live connect |
| Microsoft identity sign-in | ❌ Missing | Supabase supports it natively |
| GitHub Copilot Device Flow | ❌ Missing | RFC 8628, no browser redirect needed |
| OpenAI Codex OAuth | ❌ Missing | Needs backend callback route |
| Google Gemini CLI OAuth | ❌ Missing | Different from identity Google OAuth, needs @mariozechner/pi-ai |
| Anthropic connection | ❌ Missing | Not standard OAuth; paste-in setup-token UI |
| `/connections` management page | ❌ Missing | Post-setup provider management |

**PROVIDERS policy list** (current): `['google', 'apple', 'openai', 'anthropic', 'gemini']`

---

## Implementation Phases

---

### Phase 1 — Microsoft Identity Sign-In (30 min)

Add Microsoft as a fourth identity sign-in option on the auth form.

**What to build:**

**1a. `src/lib/supabase/auth-actions.ts`** — add:
```typescript
export async function signInWithMicrosoft(redirectAfter?: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Supabase is not configured');
  const callbackUrl = new URL('/auth/callback', process.env.NEXT_PUBLIC_SITE_URL);
  if (redirectAfter) callbackUrl.searchParams.set('next', redirectAfter);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: { redirectTo: callbackUrl.toString(), scopes: 'email profile openid' },
  });
  if (error) throw error;
  if (data.url) redirect(data.url);
}
```

**1b. `src/components/OAuthButtons.tsx`** — add Microsoft button (4th in list, after GitHub).

**1c. Supabase Dashboard** — enable Azure/Microsoft provider, add `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` to Vercel env.

**Prerequisite:** Register an Azure AD app at portal.azure.com with redirect URI:
`https://accounts.optalocal.com/auth/callback`

---

### Phase 2 — Policy Expansion + Token Storage (1 hr)

Extend the provider list and add encrypted token storage before implementing any OAuth flows.

**2a. `src/lib/api/policy.ts`** — expand PROVIDERS:
```typescript
export const PROVIDERS = [
  'google', 'apple', 'openai', 'anthropic', 'gemini',
  'github-copilot', 'openai-codex', 'gemini-cli',
] as const;
```
Note: `openai` = API key, `openai-codex` = OAuth token; `gemini` = API key, `gemini-cli` = OAuth token.

**2b. `accounts_control_plane_hardening_v2.sql` or new migration** — add `token_encrypted` column to `accounts_provider_connections`:
```sql
ALTER TABLE accounts_provider_connections
  ADD COLUMN IF NOT EXISTS token_encrypted TEXT,   -- AES-256-GCM encrypted OAuth token JSON
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_scope TEXT;
```

**2c. `src/lib/oauth/token-crypto.ts`** (new file) — server-side AES-256-GCM encrypt/decrypt:
```typescript
// Uses OAUTH_TOKEN_ENCRYPTION_KEY env var (32-byte hex secret)
// encrypt(plaintext: string): string  — stores as base64url IV + ciphertext
// decrypt(ciphertext: string): string
```
Add `OAUTH_TOKEN_ENCRYPTION_KEY` to Vercel env (generate with `openssl rand -hex 32`).

**2d. `/api/sync/keys/route.ts`** — extend `CATEGORY_MAP['ai-models']` to include:
`'github-copilot', 'openai-codex', 'gemini-cli', 'anthropic'`
so CLI/Desktop can fetch OAuth tokens via the existing sync endpoint.

---

### Phase 3 — GitHub Copilot Device Flow (2–3 hr)

GitHub Device Flow (RFC 8628): user gets a code, enters it at `github.com/login/device`, browser polls until authorized. No redirect disruption — done entirely inline in the wizard.

**Client ID:** `Iv1.b507a08c87ecfe98` (from OpenClaw research; or register own at github.com/settings/developers)

**3a. `src/app/api/oauth/copilot/device/start/route.ts`** (new):
```
POST /api/oauth/copilot/device/start
→ { device_code, user_code, verification_uri, expires_in, interval }
```
Calls `POST https://github.com/login/device/code` with:
- `client_id`: from env `GITHUB_COPILOT_CLIENT_ID`
- `scope`: `copilot`

Returns device_code (server-side only, stored in session), user_code + verification_uri to browser.

**3b. `src/app/api/oauth/copilot/device/poll/route.ts`** (new):
```
POST /api/oauth/copilot/device/poll   { device_code }
→ { status: 'authorized' | 'pending' | 'expired' | 'denied' }
```
Polls `POST https://github.com/login/oauth/access_token`. On `authorized`:
- Encrypt token with token-crypto.ts
- Upsert into `accounts_provider_connections` with `connectedVia: 'device_flow'`
- Return `{ status: 'authorized' }`

**3c. `src/components/providers/DeviceFlowCard.tsx`** (new client component):
- Shows provider icon + name
- "Connect" button → calls `/api/oauth/copilot/device/start`, displays user_code in monospace badge
- "Open GitHub" button → opens `verification_uri` in new tab
- Polls `/api/oauth/copilot/device/poll` every 5s with animated spinner
- On success: animated checkmark, updates parent state
- On expiry: "Code expired — try again" with retry button

**3d. Update `OnboardingWizard.tsx` Step 3** — replace GitHub Copilot informational card with `<DeviceFlowCard provider="github-copilot" />`.

**Env vars needed:**
- `GITHUB_COPILOT_CLIENT_ID`
- `GITHUB_COPILOT_CLIENT_SECRET`

---

### Phase 4 — OpenAI Codex OAuth (2–3 hr)

Standard redirect-based OAuth using the `@mariozechner/pi-ai` library.

**4a. Install dependency:**
```bash
npm install @mariozechner/pi-ai
```

**4b. `src/app/api/oauth/openai-codex/start/route.ts`** (new):
```
GET /api/oauth/openai-codex/start?return_to=/onboarding
```
Uses `pi-ai`'s `getOpenAICodexAuthUrl()` or equivalent.
Stores `return_to` in a signed, HttpOnly, short-lived cookie.
Redirects to OpenAI consent screen.

**4c. `src/app/api/oauth/openai-codex/callback/route.ts`** (new):
```
GET /api/oauth/openai-codex/callback?code=...&state=...
```
Exchanges code for token via pi-ai.
Encrypts and stores in `accounts_provider_connections` with `connectedVia: 'oauth_redirect'`.
Redirects back to `return_to` (validated against `sanitizeRedirect`).

**4d. `src/app/api/oauth/openai-codex/refresh/route.ts`** (new):
```
POST /api/oauth/openai-codex/refresh
```
Called by CLI/Desktop when the synced token is expired.
Auth: Bearer access_token.
Refreshes via pi-ai, re-encrypts and stores updated token.

**4e. Update OnboardingWizard.tsx Step 3** — "Connect OpenAI Codex" button links to `/api/oauth/openai-codex/start?return_to=/onboarding` in a new tab (or same tab with state preservation).

---

### Phase 5 — Google Gemini CLI OAuth (2–3 hr)

Separate from the Google identity OAuth. Uses `@mariozechner/pi-ai`'s Gemini CLI auth.
Token format: JSON `{ "token": "...", "projectId": "..." }` stored encrypted.

**5a. `src/app/api/oauth/gemini-cli/start/route.ts`** (new):
```
GET /api/oauth/gemini-cli/start?return_to=/onboarding
```
Uses `pi-ai`'s `getGeminiCLIAuthUrl()` or equivalent.
Stores state in signed cookie. Redirects to Google consent with Gemini CLI scopes
(`https://www.googleapis.com/auth/generative-language.retriever`).

Note: This is a different OAuth application/scope than the Google identity sign-in used by Supabase.
Requires a separate Google Cloud project client ID.

**5b. `src/app/api/oauth/gemini-cli/callback/route.ts`** (new):
Exchanges code for token. Stores as JSON `{ token, projectId }` encrypted in `accounts_provider_connections`.

**5c. `src/app/api/oauth/gemini-cli/refresh/route.ts`** (new):
Refreshes token using pi-ai's refresh mechanism.

**5d. Update OnboardingWizard.tsx Step 3** — "Connect Gemini CLI" button.

**Env vars needed:**
- `GEMINI_CLI_OAUTH_CLIENT_ID`
- `GEMINI_CLI_OAUTH_CLIENT_SECRET`

---

### Phase 6 — Anthropic Paste-In (1 hr)

Anthropic does not support standard OAuth. `claude setup-token` produces a one-time token
that is then exchanged. The UI provides a paste-in flow with validation.

**6a. `src/app/api/oauth/anthropic/verify/route.ts`** (new):
```
POST /api/oauth/anthropic/verify   { setup_token: string }
```
Calls Anthropic API with the setup-token to validate it. On success:
- Stores the token as `token_encrypted` in `accounts_provider_connections`
- Sets `status: 'connected'`, `connectedVia: 'setup_token'`

**6b. `src/components/providers/AnthropicSetupCard.tsx`** (new client component):
- "How to get your token" expandable guide (instructs: `opta auth token` or `claude setup-token`)
- Paste field (password type) + Verify button
- Calls `/api/oauth/anthropic/verify`
- Shows success/error inline

**6c. Update OnboardingWizard.tsx Step 3** — replace informational Anthropic card with `<AnthropicSetupCard />`.

---

### Phase 7 — Real Connect/Disconnect Routes (1 hr)

Replace stub behavior in existing routes.

**7a. `src/app/api/providers/[provider]/connect/route.ts`** — replace stub with:
- For providers that have OAuth flows (github-copilot, openai-codex, gemini-cli): return `{ redirect: '/api/oauth/[provider]/start' }` — client handles the redirect
- For api-key providers (openai, anthropic, gemini with API key): accept `{ apiKey }` in body, store encrypted in `api_keys` table
- Remove `mode: 'stub'` from response

**7b. `src/app/api/providers/[provider]/disconnect/route.ts`** — on disconnect:
- Zero out `token_encrypted`, set `token_expires_at = null`
- For providers with revocation endpoints (GitHub): call revocation API
- Remove `mode: 'stub'` from response

---

### Phase 8 — /connections Management Page (2–3 hr)

Post-setup provider management. Shows all providers with real status.

**8a. `src/app/connections/page.tsx`** (new server component):
- Auth gate (redirect to /sign-in if unauthenticated)
- Passes user to `ConnectionsContent`

**8b. `src/app/connections/ConnectionsContent.tsx`** (new client component):
- Fetches `GET /api/providers` on mount
- For each known provider: shows `ProviderRow` with connected/disconnected status
- Connected: green indicator, expiry date if applicable, Disconnect button
- Disconnected: Connect button (routes to appropriate flow per provider)
- Token expiry warning: amber indicator when `token_expires_at < now + 7 days`

**8c. Navigation** — add "Connections" link to profile nav.

**8d. Post-onboarding redirect** — OnboardingWizard Step 4 Done button: redirect to `/connections` instead of `/profile` if any provider was connected during onboarding (shows full status).

---

### Phase 9 — Sync Integration (1 hr)

Ensure CLI and Opta Code Desktop can fetch provider tokens via the existing sync pipe.

**9a. `/api/sync/keys/route.ts`** — ensure `CATEGORY_MAP['ai-models']` includes OAuth providers:
```typescript
'ai-models': ['anthropic', 'openai', 'gemini', 'groq', 'lmx', 'opencode', 'codex',
               'github-copilot', 'openai-codex', 'gemini-cli'],
```

**9b. Query path** — `GET /api/sync/keys?category=ai-models` returns all provider tokens including OAuth ones. The existing `key_value` field returns the decrypted token JSON string.

**9c. Response shaping** — for OAuth tokens, `key_value` returns:
```json
{ "access_token": "...", "token_type": "Bearer", "expires_at": "2026-03-07T...", "refresh_token": "..." }
```
CLI daemon already has file-locked refresh logic (from daemon optimization work). The accounts sync endpoint provides the raw token; the CLI is responsible for refresh when `expires_at` approaches.

---

## Implementation Order (by dependency)

```
Phase 1 (Microsoft) → no deps, do first
Phase 2 (Policy + token crypto) → must be done before 3, 4, 5, 6
Phase 3 (Copilot Device Flow) → needs Phase 2
Phase 6 (Anthropic paste-in) → needs Phase 2 (simplest OAuth, do alongside 3)
Phase 4 (OpenAI Codex) → needs Phase 2 + pi-ai install
Phase 5 (Gemini CLI) → needs Phase 4 pattern established
Phase 7 (Real connect/disconnect) → needs 3, 4, 5, 6 complete
Phase 8 (/connections page) → needs Phase 7
Phase 9 (sync integration) → needs Phase 2 token crypto
```

**Parallel tracks:**
- Track A: 1 → 2 → 3 → 6 → 7 → 8
- Track B: 2 → 4 → 5 → 7
- Track C: 2 → 9

---

## New Files Summary

| File | Purpose |
|------|---------|
| `src/lib/oauth/token-crypto.ts` | AES-256-GCM encrypt/decrypt for OAuth tokens |
| `src/app/api/oauth/copilot/device/start/route.ts` | Initiate GitHub Device Flow |
| `src/app/api/oauth/copilot/device/poll/route.ts` | Poll Device Flow status |
| `src/app/api/oauth/openai-codex/start/route.ts` | Initiate OpenAI Codex OAuth |
| `src/app/api/oauth/openai-codex/callback/route.ts` | Handle OpenAI Codex callback |
| `src/app/api/oauth/openai-codex/refresh/route.ts` | Refresh OpenAI Codex token |
| `src/app/api/oauth/gemini-cli/start/route.ts` | Initiate Gemini CLI OAuth |
| `src/app/api/oauth/gemini-cli/callback/route.ts` | Handle Gemini CLI callback |
| `src/app/api/oauth/gemini-cli/refresh/route.ts` | Refresh Gemini CLI token |
| `src/app/api/oauth/anthropic/verify/route.ts` | Validate + store Anthropic setup-token |
| `src/components/providers/DeviceFlowCard.tsx` | GitHub Copilot Device Flow UI |
| `src/components/providers/AnthropicSetupCard.tsx` | Anthropic paste-in UI |
| `src/app/connections/page.tsx` | Connections management page (server gate) |
| `src/app/connections/ConnectionsContent.tsx` | Connections management UI |

## Modified Files Summary

| File | Change |
|------|--------|
| `src/lib/api/policy.ts` | Add `github-copilot`, `openai-codex`, `gemini-cli` to PROVIDERS |
| `src/lib/supabase/auth-actions.ts` | Add `signInWithMicrosoft` |
| `src/components/OAuthButtons.tsx` | Add Microsoft button |
| `src/app/api/providers/[provider]/connect/route.ts` | Replace stub with real logic |
| `src/app/api/providers/[provider]/disconnect/route.ts` | Replace stub, add revocation |
| `src/app/api/sync/keys/route.ts` | Add OAuth providers to CATEGORY_MAP |
| `src/app/onboarding/OnboardingWizard.tsx` | Step 3: live connection cards |

## New Environment Variables

| Variable | Purpose | Where to set |
|----------|---------|-------------|
| `OAUTH_TOKEN_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM | Vercel (never expose) |
| `AZURE_CLIENT_ID` | Microsoft/Azure AD app ID | Vercel + Supabase |
| `AZURE_CLIENT_SECRET` | Microsoft/Azure AD secret | Vercel + Supabase |
| `GITHUB_COPILOT_CLIENT_ID` | GitHub Copilot OAuth app | Vercel |
| `GITHUB_COPILOT_CLIENT_SECRET` | GitHub Copilot secret | Vercel |
| `OPENAI_CODEX_CLIENT_ID` | OpenAI Codex OAuth app | Vercel |
| `OPENAI_CODEX_CLIENT_SECRET` | OpenAI Codex secret | Vercel |
| `GEMINI_CLI_OAUTH_CLIENT_ID` | Google Cloud OAuth client | Vercel |
| `GEMINI_CLI_OAUTH_CLIENT_SECRET` | Google Cloud secret | Vercel |

## New Supabase Migration Required

```sql
-- Add token fields to existing accounts_provider_connections table
ALTER TABLE accounts_provider_connections
  ADD COLUMN IF NOT EXISTS token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_scope TEXT,
  ADD COLUMN IF NOT EXISTS connected_via TEXT;
```

---

## Acceptance Criteria

- [ ] Microsoft sign-in button appears on /sign-in and /sign-up
- [ ] GitHub Copilot Device Flow completes inline in onboarding Step 3 without leaving the page
- [ ] Anthropic setup-token paste-in validates against Anthropic API before storing
- [ ] OpenAI Codex OAuth redirect returns user to onboarding after completion
- [ ] Google Gemini CLI OAuth redirect returns user to onboarding after completion
- [ ] All connected providers visible on /connections with real status
- [ ] Disconnect button revokes token (where API supports it) and clears DB record
- [ ] `GET /api/sync/keys?category=ai-models` returns OAuth tokens decrypted for CLI/Desktop
- [ ] No `mode: 'stub'` in any API response
- [ ] Token encryption key never appears in logs or responses
- [ ] `npm run typecheck` passes clean
- [ ] `npm run test` passes clean
