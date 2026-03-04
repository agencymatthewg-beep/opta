#!/usr/bin/env bash
set -euo pipefail

STATE_FILE="$(cd "$(dirname "$0")/../" && pwd)/12-Session-Logs/vercel-health/state.json"
SNAP_DIR="$(cd "$(dirname "$0")/../" && pwd)/12-Session-Logs/vercel-health"

if [ ! -f "$STATE_FILE" ]; then
  echo "No current state file found. Run scripts/vercel-health-snapshot.sh first."
  exit 1
fi

jq -r '
  "Timestamp: \(.timestamp)",
  "Status: \(.status)\n",
  "Failed domains: \(.failedDomains)\n",
  "Checks:",
  ( .checks[] | select(.ok==false) | "- \(.url) expected=\(.expected) actual=\(.code)" + (if .x_vercel_error != "" then " [" + .x_vercel_error + "]" else "" end) )
' "$STATE_FILE"

echo
 echo "Top root-causing production deployments:" 
jq -r '
  "Production deployments: ",
  (.productionDeployments[]? | "- \(.uid) ready=\(.readyState)/\(.state) url=\(.url) commit=\(.meta.githubCommitSha|.[0:8]) target=\(.target)")
' "$STATE_FILE"

echo
 echo "Alias mapping for expected domains:" 
jq -r '.aliasHealth[]? | "- \(.domain) -> \(.source) deployment=\(.deployment)"' "$STATE_FILE"

ls -1t "$SNAP_DIR"/snapshot-*.json 2>/dev/null | head -n 5 | while read -r s; do
  echo "Recent snapshot: $s"
done
