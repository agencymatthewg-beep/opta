# Auth Session Contract

## Identity Source

- Canonical user id: `auth.users.id` (UUID)
- Canonical auth authority: Supabase Auth

## Accepted Entry Methods

- `signUp({ email, password })` or `signUp({ phone, password })`
- `signInWithPassword({ email, password })` or `signInWithPassword({ phone, password })`
- `signInWithOAuth({ provider: 'google' })`
- `signInWithOAuth({ provider: 'apple' })`

## Session Shape

```json
{
  "access_token": "string",
  "refresh_token": "string",
  "expires_at": 1700000000,
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "string|null",
    "phone": "string|null"
  }
}
```

## Client Responsibilities

- Persist session in platform-secure storage.
- Attach `Authorization: Bearer <access_token>` when calling protected APIs.
- Refresh/rotate session via Supabase SDK.
- Treat missing/expired session as unauthenticated and require re-login.

## Server Responsibilities (`3A`)

- Verify bearer tokens against Supabase JWT settings.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to clients.
- Enforce user scoping by `user.id` on all protected resources.
