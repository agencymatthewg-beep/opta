#!/usr/bin/env bash
set -euo pipefail

: "${VERCEL_SCOPE:=matthews-projects-5b1a3ee3}"
: "${VERCEL_TEAM_ID:=team_gU9yOVESJwOUWdYC0SLGGoGv}"
: "${VERCEL_PROJECT_ID:=prj_LUQzl1HQxbRGKaAYYdELDOp0kqjc}"
: "${VERCEL_DEPLOY_LIMIT:=40}"
: "${VERCEL_WEB_TARGETS:=https://optalocal.com https://www.optalocal.com https://init.optalocal.com https://lmx.optalocal.com https://accounts.optalocal.com https://help.optalocal.com https://learn.optalocal.com https://admin.optalocal.com https://status.optalocal.com}"

ROOT_DIR="$(cd "$(dirname "$0")/../" && pwd)"
OUT_DIR="$ROOT_DIR/12-Session-Logs/vercel-health"
mkdir -p "$OUT_DIR"
RUN_ID="$(date +%s)"
SNAPSHOT="$OUT_DIR/snapshot-${RUN_ID}.json"
STATE_JSON="$OUT_DIR/state.json"
LEDGER="$OUT_DIR/ledger.ndjson"

log() { printf '%s %s\n' "[$(date -Iseconds)]" "$*"; }

json_escape() {
  local raw="$1"
  printf "%s" "$raw" | python3 - <<'PY2'
import json,sys
print(json.dumps(sys.stdin.read()))
PY2
}

fetch_aliases() {
  local next=""
  local prev=""
  local page=1
  local out
  while :; do
    local cmd=(vercel alias list --scope "$VERCEL_SCOPE")
    if [ -n "$next" ]; then
      cmd+=(--next "$next")
    fi

    out=$( { ${cmd[@]} 2>&1; } || true )
    [ -z "$out" ] && break

    echo "$out"       | awk 'BEGIN { } /^Fetching aliases/{next} /^To display the next page run/{next} NR>2 { if (NF>=2 && $1 ~ /^(.*\.vercel\.app|.*\.optalocal\.com)$/) print $1 "\t" $2 }'

    next=$(echo "$out" | sed -n 's/.*`next \([0-9]\+\)`.*/\1/p' | head -n 1)
    if [ -z "$next" ] || [ "$next" = "$prev" ]; then
      break
    fi
    prev="$next"
    page=$((page + 1))
    if [ "$page" -gt 30 ]; then
      break
    fi
  done
}

check_endpoints() {
  local target code verror location expected ok checks failed=0
  checks=''
  for target in $VERCEL_WEB_TARGETS; do
    local hdr
    local url=${target%/}

    if hdr=$(curl -sI -L -m 20 "$url" 2>/dev/null); then
      :
    else
      hdr=""
    fi

    code=$(printf '%s' "$hdr" | awk 'BEGIN{c="000"} /^HTTP\//{split($2,a," "); if(a[1] ~ /^[0-9]{3}$/) c=a[1]} END{print c}')
    if [ -z "$code" ] || [ "$code" = "000" ]; then
      code=$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$url" || true)
    fi

    verror=$(printf '%s' "$hdr" | awk -F": " 'tolower($1)=="x-vercel-error"{print $2; exit}')
    location=$(printf '%s' "$hdr" | awk -F": " 'tolower($1)=="location"{print $2; exit}')

    if [ "$url" = "https://accounts.optalocal.com" ]; then
      expected="200,307"
    elif [ "$url" = "https://admin.optalocal.com" ]; then
      expected="200,401"
    else
      expected="200"
    fi

    ok="false"
    if [ "$expected" = "200,307" ]; then
      if [ "$code" = "200" ] || [ "$code" = "307" ]; then ok="true"; fi
    elif [ "$expected" = "200,401" ]; then
      if [ "$code" = "200" ] || [ "$code" = "401" ]; then ok="true"; fi
    elif [ "$code" = "$expected" ]; then
      ok="true"
    fi

    if [ "$ok" != "true" ]; then
      failed=$((failed + 1))
    fi

    safe_error=$(json_escape "${verror:-}")
    safe_location=$(json_escape "${location:-}")
    checks+="{\"url\":\"$url\",\"expected\":\"$expected\",\"code\":\"$code\",\"ok\":$ok,\"x_vercel_error\":$safe_error,\"location\":$safe_location},"
  done
  checks="[${checks%,}]"
  echo "$failed:$checks"
}

main() {
  local checks_result failed checks_json alias_lines dep_json production_deployments recent_deployments alias_health='[]'

  dep_json=$(vercel api "/v6/deployments?teamId=$VERCEL_TEAM_ID&projectId=$VERCEL_PROJECT_ID&limit=$VERCEL_DEPLOY_LIMIT" --scope "$VERCEL_SCOPE" 2>/dev/null || true)
  if [ -z "$dep_json" ]; then
    dep_json='{}'
  fi

  alias_lines="$(fetch_aliases)"

  while IFS=$'\t' read -r source domain; do
    [ -z "$source" ] && continue
    [ -z "$domain" ] && continue
    local match
    match="$(printf '%s' "$dep_json" | jq -r --arg s "$source" '.deployments[] | select(.url==$s) | "\(.uid)|\(.readyState)|\(.state)|\(.target)|\(.readySubstate)|\(.createdAt)|\(.meta.githubCommitSha)"' 2>/dev/null | head -n 1 || true)"
    alias_health=$(printf '%s' "$alias_health" | jq --arg d "$domain" --arg s "$source" --arg m "$match" '. + [{domain:$d,source:$s,deployment:$m}]')
  done <<< "$alias_lines"

  checks_result="$(check_endpoints)"
  failed=${checks_result%%:*}
  checks_json=${checks_result#*:}

  production_deployments=$(printf '%s' "$dep_json" | jq '[.deployments[] | select(.target=="production") | {uid,url,state:.state,readyState:.readyState,readySubstate:.readySubstate,target:.target,createdAt:.createdAt,meta:.meta,aliasError:.aliasError}]' 2>/dev/null || echo '[]')
  recent_deployments=$(printf '%s' "$dep_json" | jq '[.deployments[:20][]? | {uid,url,state:.state,readyState:.readyState,readySubstate:.readySubstate,target:.target,createdAt:.createdAt,meta:.meta}]' 2>/dev/null || echo '[]')

  local status="OK"
  if [ "$failed" -gt 0 ]; then
    status="FAIL"
  fi

  local snapshot_json
  snapshot_json=$(cat <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "projectId": "$VERCEL_PROJECT_ID",
  "scope": "$VERCEL_SCOPE",
  "status": "$status",
  "failedDomains": $failed,
  "checks": $checks_json,
  "aliasHealth": $alias_health,
  "productionDeployments": $production_deployments,
  "recentDeployments": $recent_deployments
}
EOF
  )

  printf '%s
' "$snapshot_json" > "$SNAPSHOT"
  printf '%s
' "$snapshot_json" > "$STATE_JSON"
  printf '%s	%s
' "$(date -Iseconds)" "$(printf '%s' "$snapshot_json" | tr '
' ' ')" >> "$LEDGER"

  if [ "$status" = "FAIL" ]; then
    log "Vercel health snapshot failed"
    echo "$snapshot_json" | jq '.checks, .productionDeployments'
    exit 2
  fi

  log "Vercel health snapshot OK"
  echo "$snapshot_json" | jq '.checks'
}

main "$@"
