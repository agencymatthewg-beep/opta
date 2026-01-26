#!/bin/bash

# Opta Mini Quick Launch
# Double-click to launch Opta Mini from an existing build.

APP_NAME="OptaNative"

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 Opta Mini - Quick Launch"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if already running
if pgrep -x "$APP_NAME" > /dev/null; then
    PID=$(pgrep -x "$APP_NAME")
    echo "✅ Opta Mini is ALREADY RUNNING (PID: $PID)"
    echo ""
    echo "   Bringing window to front..."
    open -a "$APP_NAME"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Press any key to close this window..."
    read -n 1 -s
    exit 0
fi

# Search for built app in DerivedData
echo "🔍 Searching for Opta Mini..."
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "$APP_NAME.app" -path "*/Debug/*" -type d 2>/dev/null | head -1)

if [ -z "$APP_PATH" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ❌ ERROR - No built app found"
    echo ""
    echo "  Please run 'Launch Opta Premium.command'"
    echo "  to build and launch Opta Mini."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Press any key to close..."
    read -n 1 -s
    exit 1
fi

echo "📍 Found at: $APP_PATH"
echo ""

# Sign for local execution
echo "🔐 Signing for local execution..."
xattr -cr "$APP_PATH" 2>/dev/null
codesign --force --deep --sign - "$APP_PATH" 2>/dev/null

echo "🚀 Launching Opta Mini..."
open "$APP_PATH"

# Wait and verify
sleep 2

if pgrep -x "$APP_NAME" > /dev/null; then
    PID=$(pgrep -x "$APP_NAME")
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ✅ SUCCESS - Opta Mini is running!"
    echo "     PID: $PID"
    echo "     Look for it in your menu bar ↗️"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ❌ FAILED - App did not start"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo ""
echo "Press any key to close this window..."
read -n 1 -s
