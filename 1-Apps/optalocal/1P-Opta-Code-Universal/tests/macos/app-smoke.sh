#!/usr/bin/env bash
# tests/macos/app-smoke.sh
#
# macOS DMG smoke test — mount, launch binary, verify liveness, unmount.
#
# Usage:
#   ./tests/macos/app-smoke.sh [--artifacts-path DIR] [--min-alive-seconds N] [--log-file PATH]
#
# Arguments:
#   --artifacts-path   Directory containing the downloaded DMG artifact (default: dist-artifacts)
#   --min-alive-seconds  Minimum seconds the app must stay running (default: 5)
#   --log-file         Optional file path for timestamped log output
#
# Exit codes:
#   0  All checks passed
#   1  A check failed (DMG not found, app didn't stay alive, etc.)

set -euo pipefail

ARTIFACTS_PATH="dist-artifacts"
MIN_ALIVE_SECONDS=5
LOG_FILE=""
APP_PID=""
MOUNT_POINT=""

# ── Argument parsing ──────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --artifacts-path)      ARTIFACTS_PATH="$2"; shift 2 ;;
    --min-alive-seconds)   MIN_ALIVE_SECONDS="$2"; shift 2 ;;
    --log-file)            LOG_FILE="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# ── Logging ───────────────────────────────────────────────────────────────────

log() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  local line="[$ts] $*"
  echo "$line"
  if [[ -n "$LOG_FILE" ]]; then
    echo "$line" >> "$LOG_FILE"
  fi
}

# ── Cleanup trap ─────────────────────────────────────────────────────────────

cleanup() {
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    log "Terminating app process (PID $APP_PID)..."
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  if [[ -n "$MOUNT_POINT" ]] && [[ -d "$MOUNT_POINT" ]]; then
    log "Unmounting DMG at $MOUNT_POINT..."
    hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
  fi
}
trap cleanup EXIT

log "=== Opta Code Desktop — macOS App Smoke Test ==="
log "ArtifactsPath     : $ARTIFACTS_PATH"
log "MinAliveSeconds   : $MIN_ALIVE_SECONDS"

# ── Step 1: Locate DMG ────────────────────────────────────────────────────────

log "Step 1: Searching for DMG in '$ARTIFACTS_PATH'..."

DMG_PATH=""
while IFS= read -r -d '' candidate; do
  DMG_PATH="$candidate"
  break
done < <(find "$ARTIFACTS_PATH" -name "*.dmg" -print0 2>/dev/null)

if [[ -z "$DMG_PATH" ]]; then
  log "ERROR: No .dmg file found in '$ARTIFACTS_PATH'"
  log "Available files:"
  find "$ARTIFACTS_PATH" -type f | while read -r f; do log "  $f"; done
  exit 1
fi

log "Found DMG: $DMG_PATH"

# ── Step 2: Mount DMG ─────────────────────────────────────────────────────────

log "Step 2: Mounting DMG..."

MOUNT_INFO="$(hdiutil attach -nobrowse -quiet -plist "$DMG_PATH")"
MOUNT_POINT="$(echo "$MOUNT_INFO" | plutil -extract "system-entities.0.mount-point" raw - 2>/dev/null || true)"

# Fallback: grep for /Volumes path
if [[ -z "$MOUNT_POINT" ]]; then
  MOUNT_POINT="$(echo "$MOUNT_INFO" | grep -o '/Volumes/[^<"]*' | head -1 | tr -d '\n' || true)"
fi

if [[ -z "$MOUNT_POINT" ]] || [[ ! -d "$MOUNT_POINT" ]]; then
  log "ERROR: Could not determine DMG mount point."
  log "hdiutil output: $MOUNT_INFO"
  exit 1
fi

log "Mounted at: $MOUNT_POINT"

# ── Step 3: Locate .app bundle ────────────────────────────────────────────────

log "Step 3: Locating .app bundle..."

APP_BUNDLE=""
while IFS= read -r -d '' candidate; do
  APP_BUNDLE="$candidate"
  break
done < <(find "$MOUNT_POINT" -maxdepth 2 -name "*.app" -print0 2>/dev/null)

if [[ -z "$APP_BUNDLE" ]]; then
  log "ERROR: No .app bundle found in '$MOUNT_POINT'"
  log "Mount point contents:"
  ls -la "$MOUNT_POINT" | while read -r line; do log "  $line"; done
  exit 1
fi

log "Found app bundle: $APP_BUNDLE"

# Derive binary path from bundle (Contents/MacOS/<binary>)
APP_BINARY=""
while IFS= read -r -d '' candidate; do
  APP_BINARY="$candidate"
  break
done < <(find "$APP_BUNDLE/Contents/MacOS" -maxdepth 1 -type f -perm -u+x -print0 2>/dev/null)

if [[ -z "$APP_BINARY" ]]; then
  # Try without executable bit check (in case permissions are off in DMG)
  while IFS= read -r -d '' candidate; do
    APP_BINARY="$candidate"
    break
  done < <(find "$APP_BUNDLE/Contents/MacOS" -maxdepth 1 -type f -print0 2>/dev/null)
fi

if [[ -z "$APP_BINARY" ]]; then
  log "ERROR: No binary found in '$APP_BUNDLE/Contents/MacOS'"
  exit 1
fi

log "Found binary: $APP_BINARY"

# ── Step 4: Launch and verify liveness ───────────────────────────────────────

log "Step 4: Launching app and checking liveness for ${MIN_ALIVE_SECONDS}s..."

# Launch headlessly; macOS GitHub Actions runners have a window server but
# we avoid relying on it — launch the binary directly rather than via 'open'.
"$APP_BINARY" &
APP_PID=$!

log "Started process (PID $APP_PID). Waiting ${MIN_ALIVE_SECONDS}s..."
sleep "$MIN_ALIVE_SECONDS"

if ! kill -0 "$APP_PID" 2>/dev/null; then
  log "ERROR: App process exited before ${MIN_ALIVE_SECONDS}s elapsed."
  exit 1
fi

log "App is still running after ${MIN_ALIVE_SECONDS}s. Startup liveness: PASS"

log "=== macOS app smoke test PASSED ==="
