# Update 227 — Native Subscription Auth System

**Date:** 2026-03-07
**Scope:** 1R Opta Accounts · 1D Opta CLI · 1M Opta LMX
**Status:** Live (accounts.optalocal.com redeployed, schema migrated)

---

## What Shipped

Full end-to-end OAuth subscription auth pipeline across all three layers.

### 1R Opta Accounts (accounts.optalocal.com)

**New OAuth provider flows:**
- GitHub Copilot — device flow (`/api/oauth/copilot/device/{start,poll}`)
- Gemini CLI — PKCE (`/api/oauth/gemini-cli/{start,callback,refresh}`)
- OpenAI Codex — device flow via GitHub OAuth (`/api/oauth/codex/device/{start,poll}`)
- Hugging Face — PKCE (`/api/oauth/huggingface/{start,callback}`)
- OpenRouter — PKCE, key exchange at `openrouter.ai/api/v1/auth/keys` (`/api/oauth/openrouter/{start,callback}`)

**Connections UI (`/connections`):** 8 providers now shown with correct connect methods.

**New sync endpoint:** `GET /api/sync/connections` — ETag-cached, returns encrypted tokens for CLI vault pull.

**Schema migration applied:**
- `accounts_provider_connections` — 5 new columns: `token_encrypted`, `token_refresh_encrypted`, `token_expires_at`, `token_scope`, `connected_via`
- `UNIQUE(user_id, provider)` constraint (enables upsert ON CONFLICT)
- RLS enabled with self-access policies (select/insert/update/delete)
- Sessions self-write RLS policies

**Encryption:** AES-256-GCM, `OAUTH_TOKEN_ENCRYPTION_KEY` live in Vercel all environments.

### 1D Opta CLI

- `accounts/vault.ts` — `pullVaultConnections()` + `syncVault()` runs keys+rules+connections in parallel
- `keychain/api-keys.ts` — `storeConnectionToken()` decrypts server ciphertext, writes to macOS Keychain as `opta-{provider}/access-token`; `getConnectionTokenMeta()` for expiry checks; `PROVIDER_ACCOUNT_MAP` extended with Copilot, Codex, HuggingFace, OpenRouter
- `commands/vault.ts` — `opta vault status` now shows OAuth connections with expiry status
- `OPTA_TOKEN_ENCRYPTION_KEY` set in `~/.zshrc`

### 1M Opta LMX

- `proxy/subscription_providers.py` — SubscriptionRoute registry; prefix matching (`copilot/*`, `gemini-cli/*`)
- `proxy/keychain_reader.py` — reads from env var → macOS Keychain (`security find-generic-password -s opta-{provider}`); 5-min cache
- `proxy/subscription_proxy.py` — Copilot: OpenAI passthrough with required headers; Gemini: full format translation (OpenAI→Gemini contents→OpenAI)
- `api/inference.py` — subscription intercept at line 152, before local model resolve

---

## Env Vars Remaining

| Var | Where | Status |
|-----|-------|--------|
| `OAUTH_TOKEN_ENCRYPTION_KEY` | Vercel accounts | ✅ Live |
| `OPTA_TOKEN_ENCRYPTION_KEY` | Local `~/.zshrc` | ✅ Live |
| `HUGGINGFACE_OAUTH_CLIENT_ID/SECRET` | Vercel accounts | ⏳ Needs OAuth app |
| `OPENROUTER_OAUTH_CLIENT_ID` | Vercel accounts | ⏳ Needs OAuth app |
| `OPENAI_CODEX_GITHUB_CLIENT_ID/SECRET` | Vercel accounts | ⏳ Needs GitHub app |

---

## Token Flow

```
accounts.optalocal.com/connections
  → OAuth (device flow or PKCE)
  → AES-256-GCM encrypt → accounts_provider_connections.token_encrypted

opta vault pull
  → GET /api/sync/connections (ETag cached)
  → AES-256-GCM decrypt (OPTA_TOKEN_ENCRYPTION_KEY)
  → macOS Keychain: opta-{provider}/access-token

opta chat --model copilot/gpt-4o
  → LMX resolve_subscription_route()
  → security find-generic-password -s opta-github-copilot
  → proxy to api.githubcopilot.com with required Copilot headers
```
