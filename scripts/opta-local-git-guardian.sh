#!/usr/bin/env bash
set -euo pipefail

REPO="${OPTA_REPO:-$HOME/Synced/Opta}"
SCOPE="${OPTA_SCOPE:-1-Apps/optalocal}"
BRANCH="${OPTA_BRANCH:-main}"
LOG_DIR="$REPO/12-Session-Logs/git-guardian"
LOCK_DIR="$LOG_DIR/.guardian.lockdir"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$LOG_DIR/run-$TS.log"
mkdir -p "$LOG_DIR"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$(date -Iseconds)] lock held; exiting" | tee -a "$LOG_FILE"
  exit 0
fi
trap "rmdir \"$LOCK_DIR\" >/dev/null 2>&1 || true" EXIT

log(){ echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"; }
run(){ log "+ $*"; "$@" >>"$LOG_FILE" 2>&1; }

cd "$REPO"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { log "not a git repo"; exit 2; }

run git fetch origin
run git checkout "$BRANCH"

# Stage only scoped files + guardian metadata
run git add -A "$SCOPE" .gitignore scripts/opta-local-git-guardian.sh

# Strip volatile artifacts
git reset HEAD -- ':(glob)'"$SCOPE"'/**/.opta/**' 2>/dev/null || true
git reset HEAD -- ':(glob)'"$SCOPE"'/**/.githooks/**' 2>/dev/null || true
git reset HEAD -- ':(glob)'"$SCOPE"'/**/*.tgz' ':(glob)'"$SCOPE"'/**/keychain-store.json' 2>/dev/null || true

# Abort if any secrets detected
if git diff --cached -p | grep -qE 'vcp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|sbp_[A-Za-z0-9]{20,}'; then
  log "SECRET DETECTED in staged diff — aborting commit"
  run git reset HEAD
  exit 3
fi

if git diff --cached --quiet; then
  log "no staged changes for scope=$SCOPE"
  exit 0
fi

# Safety patch backup
PATCH="$LOG_DIR/staged-$TS.patch"
git diff --cached > "$PATCH"
log "staged patch saved: $PATCH"

changed_count=$(git diff --cached --name-only | wc -l | tr -d ' ')
msg="chore(optalocal): autonomous sync (${changed_count} files) [$TS]"
run git commit -m "$msg"

run git fetch origin
if run git push origin "$BRANCH"; then
  log "push success"
else
  log "push failed — leaving commit local for manual reconcile"
  exit 1
fi
log "completed"
