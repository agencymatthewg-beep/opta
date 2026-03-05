#!/usr/bin/env bash
set -euo pipefail
HEALTH_ENDPOINT="${OPTA_SUPABASE_HEALTH_ENDPOINT:-https://accounts.optalocal.com/api/health/supabase}"
JSON_ONLY=false
for arg in "$@"; do
  if [[ "$arg" == "--json-only" ]]; then
    JSON_ONLY=true
  fi
done
RESP=$(curl -sSf "${HEALTH_ENDPOINT}")
echo "${RESP}" | jq . >/tmp/supabase-health.json
if [[ "${JSON_ONLY}" != "true" ]]; then
  cat /tmp/supabase-health.json
fi
SCHEMA_READY=$(jq -r '.schemaReady' /tmp/supabase-health.json)
if [[ "${SCHEMA_READY}" != "true" ]]; then
  echo "[health-check] schemaReady=false" >&2
  exit 1
fi
