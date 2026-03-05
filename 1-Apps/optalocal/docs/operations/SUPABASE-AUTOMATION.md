# Supabase Automation Pipeline

Status: draft → implement now
Owner: Platform (Accounts + Ops)

## Goals

1. **Schema source of truth** — all changes land through tracked SQL in `shared/1N-Opta-Cloud-Accounts/supabase/migrations`.
2. **Zero-drift detection** — `/api/health/supabase` and the `.openclaw` health script fail the build if required tables or services disappear.
3. **Repeatable releases** — every backend deploy runs `apply-and-health.sh` before shipping any app relying on Supabase.

## Required environment

```bash
export OPTA_SUPABASE_DATABASE_URL="postgresql://<user>:<pass>@<host>:6543/postgres"
export OPTA_SUPABASE_DB_PASSWORD="<pass>"            # only if URL omits password
export OPTA_SUPABASE_URL="https://<ref>.supabase.co"
export OPTA_SUPABASE_ANON_KEY="..."
export OPTA_SUPABASE_SERVICE_ROLE_KEY="..."
```

Optional for health script parity:
```bash
export E2E_SUPABASE_TEST_EMAIL="fixtures@optalocal.com"
export E2E_SUPABASE_TEST_PASSWORD="changeme"
```

## Release checklist

1. `cd shared/1N-Opta-Cloud-Accounts && ./scripts/apply-and-health.sh`
2. Capture the JSON produced by the health script (`--json-only`) and attach it to the release ticket.
3. `curl https://accounts.optalocal.com/api/health/supabase | jq .schemaReady` must return `true`.
4. Update `optalocal/docs/reports/OPTALOCAL-DOCS-STATUS.md` with the date/time of the last green health run.
5. Tag release / continue with per-app deploys.

## CI guardrail

- GitHub workflow: `.github/workflows/supabase-health.yml`
- Cadence: nightly (`03:00 UTC`) + manual dispatch
- Required repository/environment secrets:
  - `OPTA_SUPABASE_DATABASE_URL`
  - `OPTA_SUPABASE_DB_PASSWORD` (optional when password already in URL)
  - `OPTA_SUPABASE_URL`
  - `OPTA_SUPABASE_ANON_KEY`
  - `OPTA_SUPABASE_SERVICE_ROLE_KEY`
  - `E2E_SUPABASE_TEST_EMAIL`
  - `E2E_SUPABASE_TEST_PASSWORD`

## Failure actions

- Schema failure: stop deploy, inspect migrations, rerun script once fixed.
- Health script failure: read the emitted JSON for which check failed (auth/rest/storage/rls).
- `/api/health/supabase` failure: investigate Supabase availability, revert if outage persists.

## Automation backlog

- [x] Wire GitHub Action to run `1-Apps/shared/1N-Opta-Cloud-Accounts/scripts/apply-and-health.sh` nightly with secrets (`.github/workflows/supabase-health.yml`).
- [ ] Mirror `.openclaw` cron output to `optalocal/logs/supabase-health/` for retention.
- [ ] Create Ops dashboard widget referencing `/api/health/supabase` state.

## Dependencies

- GNU `psql` client (for migrations)
- `curl` and `jq` (for `scripts/supabase/health-check.sh`)
