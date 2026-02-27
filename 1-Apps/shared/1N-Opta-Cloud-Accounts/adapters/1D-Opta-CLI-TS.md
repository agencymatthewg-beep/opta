# Adapter: 1D-Opta-CLI-TS

## Required Env

- `OPTA_SUPABASE_URL`
- `OPTA_SUPABASE_ANON_KEY`

Fallbacks currently supported:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Allowed Auth

- `signUp({ email, password })` or `signUp({ phone, password })`
  - exposed as: `opta account signup --identifier --password`
- `signInWithPassword({ email, password })` or `signInWithPassword({ phone, password })`
  - exposed as: `opta account login --identifier --password`

## Notes

- CLI account state is stored in:
  - `~/.config/opta/account.json` (mode `600` on unix-like systems)
- CLI does not require service-role credentials for runtime login.
