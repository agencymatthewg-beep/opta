# Opta Cloud Accounts Canonical

Canonical source for shared cloud account setup across Opta apps.

- Canonical path: `/Users/matthewbyrden/Synced/Opta/1-Apps/shared/1N-Opta-Cloud-Accounts`
- This canonical source is in `1-Apps`, not `Documents`.
- Scope: Supabase-native auth methods, session/data contracts, adapter expectations, runbooks, and test specs.

## Applying Migrations

All Supabase migrations live in `supabase/migrations`. Apply them in order so `/api/health/supabase` stays green:

```bash
cd 1-Apps/shared/1N-Opta-Cloud-Accounts
export OPTA_SUPABASE_DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/postgres"
./scripts/apply-migrations.sh
```

If your DB URL omits credentials, set `OPTA_SUPABASE_DB_PASSWORD` so the script can export `PGPASSWORD`. The script uses `psql --single-transaction` and aborts on the first error.

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
