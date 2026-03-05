#!/usr/bin/env bash
set -euo pipefail

# Deterministic validation for OptaLocal live web apps on Vercel.
# - No deploy side-effects
# - Verifies project config invariants + live endpoint health/SLO

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if ! command -v vercel >/dev/null 2>&1; then
  echo "ERROR: vercel CLI not found" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq not found" >&2
  exit 1
fi

TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
REPORT_DIR="$ROOT_DIR/docs/ops/evidence"
mkdir -p "$REPORT_DIR"
REPORT_JSON="$REPORT_DIR/deploy-validation-$TIMESTAMP.json"

# project|expectedDomain|pathForHTTPCheck
TARGETS=(
  "web|optalocal.com|/"
  "opta-init|init.optalocal.com|/"
  "opta-lmx-dashboard|lmx.optalocal.com|/"
  "accounts|accounts.optalocal.com|/api/health/supabase"
  "status-fix|status.optalocal.com|/"
  "opta-help|help.optalocal.com|/"
  "opta-learn|learn.optalocal.com|/"
  "opta-admin|admin.optalocal.com|/api/health"
)

TMP_JSON="$(mktemp)"
printf '[]' > "$TMP_JSON"

echo "[info] Validation timestamp: $TIMESTAMP"

FAIL=0
for target in "${TARGETS[@]}"; do
  IFS='|' read -r project domain path <<<"$target"
  echo "[check] $project -> $domain$path"

  PROJECT_JSON="$(vercel api "/v9/projects/$project" --raw)"
  ROOT_DIR_VAL="$(echo "$PROJECT_JSON" | jq -r '.rootDirectory')"
  FRAMEWORK="$(echo "$PROJECT_JSON" | jq -r '.framework')"
  NODE_VERSION="$(echo "$PROJECT_JSON" | jq -r '.nodeVersion')"

  ROOT_OK=false
  [[ "$ROOT_DIR_VAL" == "null" ]] && ROOT_OK=true

  MODEL_OK=false
  if [[ "$FRAMEWORK" == "nextjs" && "$NODE_VERSION" == "24.x" ]]; then
    MODEL_OK=true
  fi

  HTTP_CODE="$(curl -sS -o /dev/null -L --connect-timeout 10 --max-time 30 -w '%{http_code}' "https://$domain$path" || echo 000)"
  HTTP_OK=false
  [[ "$HTTP_CODE" =~ ^2|3 ]] && HTTP_OK=true

  if [[ "$ROOT_OK" != true || "$MODEL_OK" != true || "$HTTP_OK" != true ]]; then
    FAIL=1
  fi

  jq --arg project "$project" \
     --arg domain "$domain" \
     --arg path "$path" \
     --arg rootDirectory "$ROOT_DIR_VAL" \
     --arg framework "$FRAMEWORK" \
     --arg nodeVersion "$NODE_VERSION" \
     --arg httpCode "$HTTP_CODE" \
     --argjson rootDirectoryNull "$ROOT_OK" \
     --argjson deploymentModelOk "$MODEL_OK" \
     --argjson liveHttpOk "$HTTP_OK" \
     '. += [{project:$project,domain:$domain,path:$path,rootDirectory:$rootDirectory,framework:$framework,nodeVersion:$nodeVersion,httpCode:$httpCode,rootDirectoryNull:$rootDirectoryNull,deploymentModelOk:$deploymentModelOk,liveHttpOk:$liveHttpOk}]' \
     "$TMP_JSON" > "$TMP_JSON.next"
  mv "$TMP_JSON.next" "$TMP_JSON"
done

jq --arg timestamp "$TIMESTAMP" --arg root "$ROOT_DIR" '{timestamp:$timestamp,root:$root,results:.,summary:{total:(.|length),rootDirectoryNullCount:([.[]|select(.rootDirectoryNull==true)]|length),deploymentModelOkCount:([.[]|select(.deploymentModelOk==true)]|length),liveHttpOkCount:([.[]|select(.liveHttpOk==true)]|length),allPassed:([.[].rootDirectoryNull,.[].deploymentModelOk,.[].liveHttpOk]|all)}}' "$TMP_JSON" > "$REPORT_JSON"
rm -f "$TMP_JSON"

echo "[done] Wrote report: $REPORT_JSON"
cat "$REPORT_JSON" | jq '.summary'

if [[ "$FAIL" -ne 0 ]]; then
  echo "[fail] One or more checks failed" >&2
  exit 2
fi

echo "[pass] All checks passed"
