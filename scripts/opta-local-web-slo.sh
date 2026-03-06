#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/Synced/Opta}"
LOG_DIR="$ROOT_DIR/12-Session-Logs/opta-local-slo"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$LOG_DIR/opta-local-slo-$TS.log"
NDJSON_FILE="$LOG_DIR/opta-local-slo-$TS.ndjson"
JSON_MODE="${JSON:-0}"

mkdir -p "$LOG_DIR"
: > "$LOG_FILE"
: > "$NDJSON_FILE"

log() {
  printf '[%s] %s\n' "$(date -Iseconds)" "$*" | tee -a "$LOG_FILE"
}

expected_codes() {
  case "$1" in
    optalocal.com|init.optalocal.com|lmx.optalocal.com|help.optalocal.com|learn.optalocal.com|status.optalocal.com)
      echo "200" ;;
    accounts.optalocal.com)
      echo "200,307" ;;
    admin.optalocal.com)
      # Unauthenticated browser access is expected to redirect to /unauthorized.
      echo "200,401,307" ;;
    *)
      echo "200" ;;
  esac
}

check_url() {
  local label="$1"
  local url="$2"
  local expected="$3"

  local headers
  local tmp
  local code
  local location=""
  local security=""

  tmp="$(mktemp)"
  code=$(curl -sS -I --max-redirs 0 -m 12 -o "$tmp" "$url" -w '%{http_code}' || echo ERROR)
  location=$(grep -i '^location:' "$tmp" | tr -d '\r' | sed 's/^[Ll]ocation:[[:space:]]*//' | head -n 1 || true)
  security=$(grep -Ei 'strict-transport-security|content-security-policy|x-frame-options|referrer-policy|permissions-policy' "$tmp" | tr -d '\r' | sed 's/^/  /' || true)

  local match="0"
  IFS=',' read -ra allowed <<< "$expected"
  for e in "${allowed[@]}"; do
    if [[ "$code" == "$e" ]]; then
      match="1"
      break
    fi
  done

  local status="❌"
  if [[ "$match" == "1" ]]; then
    status="✅"
  else
    fail=1
  fi

  local safe_location safe_security
  safe_location=$(printf '%s' "$location" | sed 's/"/\\\"/g')
  safe_security=$(printf '%s' "$security" | tr '\n' '; ' | sed 's/"/\\\"/g')

  printf '{"label":"%s","url":"%s","expected":"%s","status_code":"%s","location":"%s","security_headers":"%s","status":"%s"}\n' \
    "$label" "$url" "$expected" "$code" "$safe_location" "$safe_security" "$status" >> "$NDJSON_FILE"

  log "$status $label => $code (expected [$expected])"
  if [[ -n "$location" ]]; then
    log "  Location: $location"
  fi
  if [[ -n "$security" ]]; then
    echo "$security" | tee -a "$LOG_FILE"
  fi

  rm -f "$tmp"
}

fail=0

for target in \
  "https://optalocal.com" \
  "https://init.optalocal.com" \
  "https://lmx.optalocal.com" \
  "https://accounts.optalocal.com" \
  "https://help.optalocal.com" \
  "https://learn.optalocal.com" \
  "https://admin.optalocal.com" \
  "https://status.optalocal.com"; do

  host="${target#https://}"
  expected="$(expected_codes "$host")"
  check_url "$host" "$target" "$expected"
done

if [[ "$JSON_MODE" == "1" ]]; then
  printf '{"timestamp":"%s","status":"%s","checks":[' "$(date -Iseconds)" "$(if [[ $fail -eq 0 ]]; then echo ok; else echo fail; fi)" >> "$LOG_FILE"
  {
    sed 's/$/,/' "$NDJSON_FILE" | sed '$ s/,$//' | tr -d '\n'
    printf '],"log":"%s"}\n' "$LOG_FILE"
  } | tee -a "$LOG_FILE"
else
  if [[ $fail -eq 0 ]]; then
    log "OPTA_LOCAL_SLO_OK"
  else
    log "OPTA_LOCAL_SLO_FAIL"
  fi
fi

count=$(wc -l < "$NDJSON_FILE" | tr -d ' ')
log "Completed $count checks."

exit "$fail"
