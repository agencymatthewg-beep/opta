# Auth Methods (Canonical)

Only the following Supabase-native auth entry points are allowed.

## Allowed

```ts
await supabase.auth.signUp({ email, password })
await supabase.auth.signUp({ phone, password })

await supabase.auth.signInWithPassword({ email, password })
await supabase.auth.signInWithPassword({ phone, password })

await supabase.auth.signInWithOAuth({ provider: 'google' })
await supabase.auth.signInWithOAuth({ provider: 'apple' })
```

## Not Allowed

- Magic link auth
- OTP-only login flows
- Anonymous auth
- Custom token minting as primary login
- Any non-Supabase auth provider flow outside `signInWithOAuth(google|apple)`

## Session Baseline

- Successful auth returns a Supabase session with `access_token`, `refresh_token`, and `user.id`.
- `user.id` (UUID from `auth.users`) is the canonical identity across all apps.
- Client apps must persist session securely per platform and refresh using Supabase SDK behavior.
