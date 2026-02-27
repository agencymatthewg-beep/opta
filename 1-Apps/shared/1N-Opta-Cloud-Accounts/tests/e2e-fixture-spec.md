# E2E Fixture Spec

Canonical fixture spec for cross-app auth smoke in:

- `1L-Opta-Local` (Web)
- `1D-Opta-CLI-TS` (CLI)
- `1M-Opta-LMX` (inference API bearer check)

## Fixture Identity

- Primary user: `E2E_SUPABASE_TEST_EMAIL`
- Secret: `E2E_SUPABASE_TEST_PASSWORD`
- Optional bootstrap key: `E2E_SUPABASE_SERVICE_ROLE_KEY` (or `OPTA_SUPABASE_SERVICE_ROLE_KEY`)

If service role is provided, the fixture user is created/updated with `email_confirm=true` before each smoke run.

## Required Environment

- `OPTA_SUPABASE_URL`
- `OPTA_SUPABASE_ANON_KEY`
- `E2E_SUPABASE_TEST_EMAIL` (or `OPTA_E2E_TEST_EMAIL`)
- `E2E_SUPABASE_TEST_PASSWORD` (or `OPTA_E2E_TEST_PASSWORD`)

Optional:

- `E2E_SUPABASE_SERVICE_ROLE_KEY` (or `OPTA_SUPABASE_SERVICE_ROLE_KEY`)
- `OPTA_LMX_URL` (default: `http://127.0.0.1:1234`)

## Canonical Smoke Command

```bash
/Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts/tests/cross-app-auth-smoke.sh
```

This command verifies:

1. CLI password login with Supabase (`opta account login` path)
2. CLI session persistence (`~/.config/opta/account.json` has `access_token`)
3. Bearer request to LMX (`GET /v1/models`)
4. Authenticated Web E2E in `1L`:
   - `devices` signed-in state
   - `pair` signed-in success state

## Web Pairing Test Stabilization

Current shared Supabase project does not expose `public.devices` in schema cache, so the authenticated pair test in `1L` keeps real Supabase auth but mocks `**/rest/v1/devices*` responses to validate UI success-state behavior deterministically.

File:

- `/Users/matthewbyrden/Synced/Opta/1-Apps/1L-Opta-Local/web/tests/e2e/authenticated-devices-pair.spec.ts`

## Non-goals

- No non-Supabase auth methods
- No magic-link/OTP-only fixtures
- No custom auth bypass endpoints
