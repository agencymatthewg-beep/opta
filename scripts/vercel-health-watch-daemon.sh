#!/usr/bin/env bash
set -euo pipefail

PLIST="$HOME/Library/LaunchAgents/com.opta.vercel-health-watch.plist"
REPO="$(cd "$(dirname "$0")/../" && pwd)"
RUN_SCRIPT="$REPO/scripts/vercel-health-watch.sh"
LOG_DIR="$REPO/12-Session-Logs/vercel-health"
mkdir -p "$LOG_DIR"

cat > "$PLIST" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.opta.vercel-health-watch</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>%%RUN_SCRIPT%%</string>
      <string>--once</string>
    </array>
    <key>WorkingDirectory</key>
    <string>%%REPO%%</string>
    <key>StartInterval</key>
    <integer>120</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>%%LOG%%/vercel-health-watch.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>%%LOG%%/vercel-health-watch.stderr.log</string>
    <key>KeepAlive</key>
    <dict>
      <key>Crashed</key>
      <true/>
    </dict>
  </dict>
</plist>
PLIST

sed -i '' "s#%%RUN_SCRIPT%%#$RUN_SCRIPT#g" "$PLIST"
sed -i '' "s#%%REPO%%#$REPO#g" "$PLIST"
sed -i '' "s#%%LOG%%#$LOG_DIR#g" "$PLIST"

launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load "$PLIST"

echo "Installed and started: $PLIST"
echo "To stop: launchctl unload $PLIST"
