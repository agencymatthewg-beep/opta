# API Keys Contract

> Cloud-managed API key storage for the Opta ecosystem.

## Purpose

Provides centralized API key management so users configure keys once and all Opta apps resolve them from the cloud. Keys are stored in Supabase with Row-Level Security, scoped to the authenticated user.

## Table: `public.api_keys`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, auto-generated |
| `user_id` | uuid | FK → auth.users, NOT NULL |
| `provider` | text | NOT NULL |
| `label` | text | nullable (allows multiple keys per provider) |
| `key_value` | text | NOT NULL |
| `is_active` | boolean | DEFAULT true, NOT NULL |
| `created_at` | timestamptz | DEFAULT now() |
| `updated_at` | timestamptz | DEFAULT now(), auto-trigger |
| `last_verified_at` | timestamptz | nullable |

**Unique constraint:** `(user_id, provider, label)` — prevents duplicate keys for the same provider+label combination.

## Supported Providers

| Provider ID | Display Name | Has Prefix Heuristic |
|-------------|-------------|---------------------|
| `anthropic` | Anthropic | `sk-ant-*` |
| `openai` | OpenAI | `sk-*` / `sk-proj-*` |
| `gemini` | Gemini | `AIza*` |
| `groq` | Groq | `gsk_*` |
| `tavily` | Tavily | `tvly-*` |
| `lmx` | LMX | `opta_sk_*` |
| `brave` | Brave Search | No distinct prefix |
| `exa` | Exa | No distinct prefix |

New providers can be added without migration (provider is `text`, not enum).

## Key Resolution Chain

Clients resolve API keys in this priority order:

1. **Environment variables** — `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.
2. **OS Keychain** — macOS `security(1)`, Linux `secret-tool`
3. **Cloud (Supabase)** — this contract; requires authenticated session
4. **Config file** — `~/.config/opta/config.json`
5. **Default cloud key** — `config.provider.cloud.apiKey`

Cloud keys never override local keys. They serve as a shared fallback across devices.

## RLS Policies

Standard four-policy pattern (matches `profiles` and `devices`):
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id` (both USING and WITH CHECK)
- DELETE: `auth.uid() = user_id`

## Client Responsibilities

### Portal (1P-Opta-Accounts)

- **Page:** `/keys` — full CRUD UI with smart paste detection
- **Server Actions:** `getApiKeys`, `upsertApiKey`, `deleteApiKey`, `verifyApiKey`
- **Masking:** Never sends full key values to browser except on explicit reveal (auto-hides after 5s)
- **Verification:** Server-side API endpoint probing (no CORS issues)

### CLI (1D-Opta-CLI-TS)

- **`accounts/cloud-keys.ts`** — fetches keys via Supabase REST API using stored session token
- **`core/cloud-keys.ts`** — resolution chain with cloud step between keychain and config
- **`opta keychain sync`** — downloads all cloud keys to local OS keychain
- **`opta keychain set auto <key> --cloud`** — stores locally + uploads to cloud
- **Caching:** Cloud keys cached in memory for the session duration
- **Graceful degradation:** Cloud fetch failures never block the resolution chain

## Security Notes

- TLS encrypts all Supabase connections in transit
- RLS prevents cross-user key access
- No service role key used on client side
- Future: `pgp_sym_encrypt` for at-rest encryption (separate migration)
