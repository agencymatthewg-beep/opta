#!/bin/bash
# Opta-LMX Production Setup — Mono512 (Mac Studio M3 Ultra)
# Run this ON the Mac Studio to install the daemon.
#
# Usage:
#   cd /Users/Shared/312/Opta/1-Apps/1J-Opta-LMX
#   bash scripts/setup-production.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="/Users/Shared/Opta-LMX/venv"
LOG_DIR="/var/log/opta-lmx"
CONFIG_DIR="/Users/Shared/.opta-lmx"
PLIST_SRC="$PROJECT_DIR/docs/launchd/com.opta.lmx.plist"
PLIST_DST="/Library/LaunchDaemons/com.opta.lmx.plist"

echo "=== Opta-LMX Production Setup ==="
echo "Project: $PROJECT_DIR"

# 1. Create log directory
echo "[1/5] Creating log directory..."
sudo mkdir -p "$LOG_DIR"
sudo chmod 755 "$LOG_DIR"

# 2. Create venv if missing
if [ ! -d "$VENV_DIR" ]; then
    echo "[2/5] Creating Python venv..."
    mkdir -p "$(dirname "$VENV_DIR")"
    python3 -m venv "$VENV_DIR"
else
    echo "[2/5] Venv exists at $VENV_DIR"
fi

# 3. Install opta-lmx in editable mode
echo "[3/5] Installing opta-lmx..."
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install -e "$PROJECT_DIR"

# 4. Copy production config if not already customized
if [ ! -f "$CONFIG_DIR/config.yaml" ]; then
    echo "[4/5] Installing production config..."
    mkdir -p "$CONFIG_DIR"
    cp "$PROJECT_DIR/config/production-config.yaml" "$CONFIG_DIR/config.yaml"
    echo "  -> Edit $CONFIG_DIR/config.yaml to set admin_key and auto_load models"
else
    echo "[4/5] Config exists at $CONFIG_DIR/config.yaml (not overwriting)"
fi

# 5. Install launchd plist
echo "[5/5] Installing launchd plist..."
sudo cp "$PLIST_SRC" "$PLIST_DST"
sudo chown root:wheel "$PLIST_DST"
sudo chmod 644 "$PLIST_DST"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit $CONFIG_DIR/config.yaml"
echo "     - Set admin_key for security"
echo "     - Add models to auto_load list"
echo "     - Configure routing aliases"
echo ""
echo "  2. Start the daemon:"
echo "     sudo launchctl load $PLIST_DST"
echo ""
echo "  3. Check it's running:"
echo "     curl http://localhost:1234/admin/health"
echo ""
echo "  4. View logs:"
echo "     tail -f $LOG_DIR/opta-lmx.stdout.log"
echo ""
echo "  To stop:  sudo launchctl unload $PLIST_DST"
echo "  To restart: sudo launchctl unload $PLIST_DST && sudo launchctl load $PLIST_DST"
