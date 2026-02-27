# Adapter: 1L-Opta-Local

## Required Env

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional:

- `NEXT_PUBLIC_SITE_URL` (used for callback URL construction)
- `E2E_SUPABASE_TEST_EMAIL`
- `E2E_SUPABASE_TEST_PASSWORD`
- `E2E_SUPABASE_SERVICE_ROLE_KEY` (test bootstrap only)

## Allowed Auth

- Password:
  - `signUp({ email, password })` or `signUp({ phone, password })`
  - `signInWithPassword({ email, password })` or `signInWithPassword({ phone, password })`
- OAuth:
  - `signInWithOAuth({ provider: 'google' })`
  - `signInWithOAuth({ provider: 'apple' })`

## Notes

- Runtime uses anon key and browser cookies/session via Supabase client.
- Authenticated E2E fixture lives in:
  - `/Users/matthewbyrden/Synced/Opta/1-Apps/1L-Opta-Local/web/tests/e2e/fixtures/supabase-auth.ts`
