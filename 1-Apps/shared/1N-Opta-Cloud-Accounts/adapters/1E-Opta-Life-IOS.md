# Adapter: 1E-Opta-Life-IOS

## Required Env / Config

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_AUTH_REDIRECT_URL` (`opta-life://auth/callback`)

## Allowed Auth

- `signUp(email/password)` or `signUp(phone/password)`
- `signInWithPassword(email/password)` or `signInWithPassword(phone/password)`
- `signInWithOAuth(google)`
- `signInWithOAuth(apple)`

## Notes

- Keep session tokens in Keychain.
- Register URL scheme for OAuth callback.
