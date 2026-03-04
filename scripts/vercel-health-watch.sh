#!/usr/bin/env bash
set -euo pipefail

WATCH_INTERVAL_SECONDS=${WATCH_INTERVAL_SECONDS:-60}
MAX_CONSECUTIVE_FAILURES=${MAX_CONSECUTIVE_FAILURES:-3}
RUN_FOREVER=${RUN_FOREVER:-1}
SNAPSHOT_CMD_DIR="$(cd "$(dirname "$0")" && pwd)"
SNAPSHOT_CMD="$SNAPSHOT_CMD_DIR/vercel-health-snapshot.sh"
STATE_FILE="$SNAPSHOT_CMD_DIR/../12-Session-Logs/vercel-health/monitor-state.json"
TMP_BASE="/tmp/vercel-health-watch"
mkdir -p "$(dirname "$STATE_FILE")"

if [ "${1:-}" = "--once" ]; then
  RUN_FOREVER=0
fi

if [ ! -x "$SNAPSHOT_CMD" ]; then
  echo "Snapshot script not executable: $SNAPSHOT_CMD" >&2
  exit 1
fi

failure_count=0

log_state() {
  local status="$1"
  local msg="$2"
  printf '{"timestamp":"%s","status":"%s","failure_count":%d,"message":"%s"}\n' "$(date -Iseconds)" "$status" "$failure_count" "$msg" > "$STATE_FILE"
}

run_once() {
  local out="$1"
  set +e
  "$SNAPSHOT_CMD" > "$out" 2>&1
  rc=$?
  set -e

  if [ $rc -eq 0 ]; then
    failure_count=0
    log_state OK "All checks pass"
    return 0
  fi

  failure_count=$((failure_count + 1))
  log_state FAIL "snapshot failed (consecutive=$failure_count)"
  return 2
}

run_forensics() {
  local snapshot_path="$1"
  echo
  echo "--- Vercel health forensics ---"
  jq -r '.checks[] | select(.ok==false) | "\(.url) => expected=\(.expected) actual=\(.code)" + (if .x_vercel_error!="" then " (" + .x_vercel_error + ")" else "" end)' < "$snapshot_path" || true
  echo
  echo "Top production deployment candidates:"
  jq -r '.productionDeployments[] | "\(.uid) \(.url) \(.readyState) \(.readySubstate) \(.meta.githubCommitSha|.[0:8])"' < "$snapshot_path" | head -n 8 || true
}

while :; do
  OUT="${TMP_BASE}.out.${RANDOM}"
  if run_once "$OUT"; then
    :
  else
    if [ "$failure_count" -ge "$MAX_CONSECUTIVE_FAILURES" ]; then
      run_forensics "$OUT" || true
      echo "ALERT: optalocal production may be degraded. Investigate monitor-state.json and latest snapshot under 12-Session-Logs/vercel-health/."
      if [ "$RUN_FOREVER" = "1" ]; then
        :
      else
        exit 2
      fi
    fi
  fi

  if [ "$RUN_FOREVER" != "1" ]; then
    break
  fi

  sleep "$WATCH_INTERVAL_SECONDS"
done
