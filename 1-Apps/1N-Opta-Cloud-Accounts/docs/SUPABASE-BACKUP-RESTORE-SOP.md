# SUPABASE Backup + Restore SOP (Opta)

This SOP covers logical backups for Opta Cloud Accounts schema and restore rehearsals.

## Scope

- Auth-adjacent shared data in `public` schema (`accounts_*`, `api_keys`, related tables)
- Supports app surfaces: `1P`, `1D`, `1M`, `1F`, `1E`, `1L`

## Ownership + Cadence

- **Owner:** Matthew (Platform)
- **Backup cadence:** daily logical backup
- **Restore test cadence:** monthly minimum
- **Retention baseline:** 35 daily + 12 monthly snapshots

---

## Prerequisites

- `pg_dump`, `pg_restore`, `psql` installed
- Secure access to DB connection string (never commit)
- Environment variables loaded:
  - `OPTA_SUPABASE_DB_URL` (postgres URL)
  - `OPTA_SUPABASE_PROJECT_REF`

## 1) Create Backup

```bash
set -euo pipefail

TS="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$HOME/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts/backups"
mkdir -p "$OUT_DIR"

pg_dump "$OPTA_SUPABASE_DB_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file "$OUT_DIR/opta-supabase-${TS}.dump"

shasum -a 256 "$OUT_DIR/opta-supabase-${TS}.dump" > "$OUT_DIR/opta-supabase-${TS}.sha256"
ls -lh "$OUT_DIR/opta-supabase-${TS}.dump"
```

## 2) Restore Drill (Scratch DB/Project)

> Never restore over production for rehearsal.

```bash
set -euo pipefail

# Example scratch URL exported beforehand
# export OPTA_SUPABASE_SCRATCH_DB_URL="postgres://..."

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "$OPTA_SUPABASE_SCRATCH_DB_URL" \
  "$HOME/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts/backups/<backup-file>.dump"
```

## 3) Post-Restore Validation

Run table sanity checks (row counts + key constraints):

```bash
psql "$OPTA_SUPABASE_SCRATCH_DB_URL" -c "select 'accounts_profiles' as t, count(*) from public.accounts_profiles;"
psql "$OPTA_SUPABASE_SCRATCH_DB_URL" -c "select 'accounts_devices' as t, count(*) from public.accounts_devices;"
psql "$OPTA_SUPABASE_SCRATCH_DB_URL" -c "select 'accounts_sessions' as t, count(*) from public.accounts_sessions;"
psql "$OPTA_SUPABASE_SCRATCH_DB_URL" -c "select 'api_keys' as t, count(*) from public.api_keys;"
```

Then run shared auth smoke against scratch-linked environment where possible:

```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts
./tests/cross-app-auth-smoke.sh
```

---

## 4) Production Restore (Incident Only)

1. Declare Sev-1 incident and freeze writes/deploys.
2. Select restore point (latest known-good).
3. Validate checksum matches artifact.
4. Restore with explicit IC approval.
5. Run smoke tests before reopening traffic.
6. Document exact data-loss window (RPO) and restore duration (RTO).

## Target Objectives

- **RPO:** <= 24h (daily backup)
- **RTO:** <= 60 min for logical restore + smoke validation

## Failure Conditions (Escalate Immediately)

- Backup command exits non-zero
- Checksum mismatch
- Restore fails in scratch env
- Post-restore smoke fails on auth or LMX bearer path

## Retention + Hygiene

- Prune backups older than retention policy.
- Keep checksums and backup files together.
- Store restore drill log with timestamp + success/failure.
