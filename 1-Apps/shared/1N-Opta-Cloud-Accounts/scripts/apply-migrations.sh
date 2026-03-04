#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
MIGRATIONS_DIR="${ROOT_DIR}/supabase/migrations"
DB_URL="${OPTA_SUPABASE_DATABASE_URL:-}" # expects full postgres connection string
if [[ -z "${DB_URL}" ]]; then
  echo "[apply-migrations] Set OPTA_SUPABASE_DATABASE_URL to your Supabase postgres connection string." >&2
  exit 1
fi
psql_available=$(command -v psql || true)
if [[ -z "${psql_available}" ]]; then
  echo "[apply-migrations] psql not found. Install PostgreSQL client tools or ensure they are on PATH." >&2
  exit 1
fi
shopt -s nullglob
MIGRATION_FILES=($(ls -1 "${MIGRATIONS_DIR}"/*.sql | sort))
if [[ ${#MIGRATION_FILES[@]} -eq 0 ]]; then
  echo "[apply-migrations] No migration files found in ${MIGRATIONS_DIR}" >&2
  exit 1
fi
for file in "${MIGRATION_FILES[@]}"; do
  echo "[apply-migrations] Applying $(basename "${file}")"
  PGPASSWORD="${OPTA_SUPABASE_DB_PASSWORD:-}" psql "${DB_URL}" --single-transaction --file "${file}" --set ON_ERROR_STOP=1 >/dev/null
  echo "[apply-migrations] Done $(basename "${file}")"
  sleep 1
done
shopt -u nullglob
echo "[apply-migrations] All migrations applied."
