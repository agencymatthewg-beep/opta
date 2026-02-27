# Supabase Health Automation (Opta)

Canonical automation scripts live in:
- `/Users/matthewbyrden/.openclaw/workspace/scripts/supabase-health-check.sh`
- `/Users/matthewbyrden/.openclaw/workspace/scripts/supabase-health-cron.sh`

This health suite validates:
1. **Auth health** (password sign-in + token validation)
2. **REST health** (anon and service-role paths)
3. **Storage health** (bucket listing via Storage API)
4. **Representative RLS query** (`profiles` self-row read via auth token)

It outputs:
- **Machine-readable JSON**
- **Human-readable summary**

---

## Required Environment Variables

```bash
export OPTA_SUPABASE_URL="https://<project-ref>.supabase.co"
export OPTA_SUPABASE_ANON_KEY="<anon-key>"
export OPTA_SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
export E2E_SUPABASE_TEST_EMAIL="<fixture-email>"
export E2E_SUPABASE_TEST_PASSWORD="<fixture-password>"
```

Optional:

```bash
# Request timeout per check (seconds)
export OPTA_SUPABASE_HEALTH_TIMEOUT_SEC="15"

# Optional bucket existence assertion
export OPTA_SUPABASE_HEALTH_BUCKET="opta-assets"

# Cron artifact output directory
export OPTA_SUPABASE_HEALTH_OUT_DIR="$HOME/.openclaw/health/supabase"
```

---

## Manual Usage

### JSON + Summary

```bash
/Users/matthewbyrden/.openclaw/workspace/scripts/supabase-health-check.sh
```

### JSON only (for automation/parsing)

```bash
/Users/matthewbyrden/.openclaw/workspace/scripts/supabase-health-check.sh --json-only
```

### Summary only

```bash
/Users/matthewbyrden/.openclaw/workspace/scripts/supabase-health-check.sh --summary-only
```

Exit codes:
- `0` = pass/warn (no hard failures)
- `1` = one or more failed checks
- `2` = invalid usage / missing prerequisites

---

## Cron-Ready Wrapper

Use the wrapper for scheduled execution. It:
- writes timestamped JSON + summary files,
- updates `latest.json` and `latest.txt` symlinks,
- keeps only the latest 50 runs.

Run once:

```bash
/Users/matthewbyrden/.openclaw/workspace/scripts/supabase-health-cron.sh
```

Example cron (every 15 minutes):

```cron
*/15 * * * * source "$HOME/.zshrc" >/dev/null 2>&1; /Users/matthewbyrden/.openclaw/workspace/scripts/supabase-health-cron.sh >> "$HOME/.openclaw/health/supabase/cron.log" 2>&1
```

> If your env vars are not in `.zshrc`, source a dedicated env file instead.

---

## Output Schema (JSON)

Top-level fields:
- `started_at`, `ended_at`
- `project_url`
- `overall_status`: `pass|warn|fail`
- `fixture_user_id` (if auth succeeded)
- `summary`: counts for total/pass/warn/fail
- `checks[]`: per-check details

Each check has:
- `name`
- `status` (`pass|warn|fail`)
- `http_status`
- `duration_ms`
- `message`
- `details` (context payload)

---

## Current Check Set

- `rest.anon`
- `auth.password_signin`
- `auth.token_user`
- `rls.profiles_self_select`
- `rest.service_role`
- `storage.list_buckets`
- `storage.bucket_exists` (only when `OPTA_SUPABASE_HEALTH_BUCKET` is set)

---

## Notes

- RLS check uses the fixture user token and reads its own row from `public.profiles`.
- If sign-in succeeds but profile row is missing, RLS check returns `warn` (not hard fail).
- Storage check is non-destructive (lists buckets only).
