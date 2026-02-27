# CLI Auth Contract (`1D-Opta-CLI-TS`)

## Supported Login Modes

- Email/password via `signInWithPassword({ email, password })`
- Phone/password via `signInWithPassword({ phone, password })`
- OAuth Google via `signInWithOAuth({ provider: 'google' })`
- OAuth Apple via `signInWithOAuth({ provider: 'apple' })`

## Session Persistence

- Session is stored in `SUPABASE_SESSION_FILE` as JSON.
- Required fields: `access_token`, `refresh_token`, `expires_at`, `user.id`.
- File permissions should be user-only (`0600` where possible).

## CLI Command Expectations

- `auth login` obtains and stores session
- `auth whoami` resolves current `user.id` from active session
- `auth logout` clears local session file
- Protected commands fail fast with a clear unauthenticated error when session is absent/expired

## Restrictions

- No custom auth endpoints.
- No auth method beyond Supabase-native set in this repository.
