# Adapter: 1F-Opta-Life-Web

## Required Env

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_AUTH_REDIRECT_URL`
  - Dev: `http://localhost:3000/auth/callback`
  - Prod: `https://life.opta.app/auth/callback`

## Allowed Auth

- `signUp(email/password)` or `signUp(phone/password)`
- `signInWithPassword(email/password)` or `signInWithPassword(phone/password)`
- `signInWithOAuth(google)`
- `signInWithOAuth(apple)`

## Notes

- Browser runtime uses anon key only.
- Server routes must not leak service role credentials to client bundles.
