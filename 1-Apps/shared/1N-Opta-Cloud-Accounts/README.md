# Opta Cloud Accounts Canonical

Canonical source for shared cloud account setup across Opta apps.

- Canonical path: `/Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts`
- This canonical source is in `1-Apps`, not `Documents`.
- Scope: Supabase-native auth methods, session/data contracts, adapter expectations, runbooks, and test specs.

## Allowed Auth Methods (Supabase-native only)

1. `signUp(email/password)` or `signUp(phone/password)`
2. `signInWithPassword(email/password)` or `signInWithPassword(phone/password)`
3. `signInWithOAuth(google)`
4. `signInWithOAuth(apple)`

See:
- `AUTH-METHODS.md`
- `ENV-MATRIX.md`
- `contracts/`
- `adapters/`
- `runbooks/`
- `tests/`
