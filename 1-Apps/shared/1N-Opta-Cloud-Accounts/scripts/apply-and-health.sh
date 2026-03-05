#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
MIGRATIONS_SCRIPT="${SCRIPT_DIR}/apply-migrations.sh"
DEFAULT_HEALTH_SCRIPT="$(cd -- "${ROOT_DIR}/../../scripts" && pwd)/supabase/health-check.sh"
HEALTH_SCRIPT="${OPTA_SUPABASE_HEALTH_SCRIPT:-$DEFAULT_HEALTH_SCRIPT}"
if [[ ! -x "${MIGRATIONS_SCRIPT}" ]]; then
  echo "[apply-and-health] missing migrations script at ${MIGRATIONS_SCRIPT}" >&2
  exit 1
fi
"${MIGRATIONS_SCRIPT}"
if [[ ! -x "${HEALTH_SCRIPT}" ]]; then
  echo "[apply-and-health] warning: health script not found (${HEALTH_SCRIPT}), skipping health check" >&2
  exit 0
fi
"${HEALTH_SCRIPT}" --json-only
