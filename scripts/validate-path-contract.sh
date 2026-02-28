#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$HOME/Synced/Opta}"
APPS="$ROOT/1-Apps"
fail=0

# duplicate ID report (warning-only while migration in progress)
id_list=$(mktemp)
while IFS= read -r d; do
  b=$(basename "$d")
  if [[ "$b" =~ ^([0-9][A-Z]) ]]; then
    echo "${BASH_REMATCH[1]}" >> "$id_list"
  fi
done < <(find "$APPS" \( -path "$APPS/optalocal/*" -o -path "$APPS/optamize/*" -o -path "$APPS/shared/*" -o -path "$APPS/1*" \) -type d -maxdepth 2 2>/dev/null)
if [[ -s "$id_list" ]]; then
  while IFS= read -r id; do
    [[ -n "$id" ]] && echo "WARN duplicate ID present during migration: $id"
  done < <(sort "$id_list" | uniq -d)
fi
rm -f "$id_list"

# sync-conflict files outside allowed archives
conf=$(find "$ROOT" -name '*.sync-conflict-*' -type f \
  ! -path '*/.git/*' \
  ! -path '*/node_modules/*' \
  ! -path '*/_archived/*' \
  ! -path '*/8-Project/8A-Reorganization-Docs/sync-conflict-quarantine/*' | head -n 1 || true)
if [[ -n "$conf" ]]; then
  echo "FAIL sync-conflict file outside quarantine: $conf"
  fail=1
fi

# broken symlink check under 1-Apps
broken=$(find "$APPS" -type l ! -path '*/node_modules/*' ! -path '*/_archived/*' ! -path '*/_migration-archive/*' ! -path '*/.vercel/*' ! -path '*/dist/*' ! -path '*/out/*' ! -exec test -e {} \; -print | head -n 1 || true)
if [[ -n "$broken" ]]; then
  echo "FAIL broken symlink: $broken"
  fail=1
fi

if [[ $fail -eq 0 ]]; then
  echo "PATH_CONTRACT_OK"
else
  exit 1
fi
