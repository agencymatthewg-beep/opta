# Runbook: Setup Prod

## 1. Secrets

Load production values in secret manager:
- `OPTA_SUPABASE_URL`
- `OPTA_SUPABASE_ANON_KEY`
- `OPTA_SUPABASE_SERVICE_ROLE_KEY`
- `OPTA_SUPABASE_PROJECT_REF`
- `OPTA_SUPABASE_JWT_SECRET`

## 2. Provider configuration

In Supabase Auth, enable only canonical methods:
- `signUp(email/password)` or `signUp(phone/password)`
- `signInWithPassword(email/password)` or `signInWithPassword(phone/password)`
- `signInWithOAuth(google)`
- `signInWithOAuth(apple)`

Add production redirect URLs for web, iOS, and desktop callbacks.

## 3. Deploy order

1. `3A-Opta-Gateway`
2. `1F-Opta-Life-Web`
3. `1E-Opta-Life-IOS`, `1L-Opta-Local`, `1M-Opta-LMX`, `1D-Opta-CLI-TS`

## 4. Validation

- Verify all login methods in prod.
- Verify token verification and RLS behavior.
- Verify no client bundle contains service role key.
