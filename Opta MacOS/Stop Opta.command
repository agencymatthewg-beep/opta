#!/bin/bash

# Stop Opta Mini
# Gracefully terminates the running app.

APP_NAME="OptaNative"

echo "🛑 Stopping Opta Mini..."
echo ""

if pgrep -x "$APP_NAME" > /dev/null; then
    # Try graceful quit first
    osascript -e "tell application \"$APP_NAME\" to quit" 2>/dev/null
    sleep 1

    # Force kill if still running
    if pgrep -x "$APP_NAME" > /dev/null; then
        pkill -x "$APP_NAME"
        echo "✓ Force stopped $APP_NAME"
    else
        echo "✓ $APP_NAME quit gracefully"
    fi
else
    echo "ℹ️  Opta Mini is not running"
fi

echo ""
echo "Press any key to close..."
read -n 1
