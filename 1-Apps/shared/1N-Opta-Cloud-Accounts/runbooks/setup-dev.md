# Runbook: Setup Dev

## 1. Confirm canonical source

Use only:
`/Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts`

## 2. Configure Supabase Auth

Enable only:
- Email + password sign-up/sign-in
- Phone + password sign-up/sign-in
- OAuth Google
- OAuth Apple

Register callback URLs for each app in Supabase Auth settings.

## 3. Set workspace env files

Populate env vars per `ENV-MATRIX.md` for:
- `1L-Opta-Local`
- `1D-Opta-CLI-TS`
- `1M-Opta-LMX`
- `1E-Opta-Life-IOS`
- `1F-Opta-Life-Web`
- `3A-Opta-Gateway`

## 4. Link and push migrations

```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push
```

## 5. Smoke test

Run canonical cross-app smoke:

```bash
export OPTA_SUPABASE_URL="https://<project-ref>.supabase.co"
export OPTA_SUPABASE_ANON_KEY="<anon-key>"
export E2E_SUPABASE_TEST_EMAIL="<fixture-email>"
export E2E_SUPABASE_TEST_PASSWORD="<fixture-password>"
# optional but recommended for bootstrap:
export E2E_SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

/Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts/tests/cross-app-auth-smoke.sh
```

What this validates:

- CLI password login (Supabase native)
- CLI access-token persistence
- LMX bearer endpoint call (`/v1/models`)
- Web authenticated `devices` and `pair` success states
