#!/bin/bash

# Stop Opta Mini
# Double-click to gracefully quit Opta Mini.

APP_NAME="OptaNative"

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🛑 Opta Mini - Stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if pgrep -x "$APP_NAME" > /dev/null; then
    PID=$(pgrep -x "$APP_NAME")
    echo "📍 Found Opta Mini running (PID: $PID)"
    echo ""

    # Try graceful quit first
    echo "   Attempting graceful quit..."
    osascript -e "tell application \"$APP_NAME\" to quit" 2>/dev/null
    sleep 2

    # Check if still running
    if pgrep -x "$APP_NAME" > /dev/null; then
        echo "   Graceful quit failed, force stopping..."
        pkill -x "$APP_NAME"
        sleep 1

        if pgrep -x "$APP_NAME" > /dev/null; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "  ❌ FAILED - Could not stop Opta Mini"
            echo ""
            echo "  Try: kill -9 $PID"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        else
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "  ✅ Opta Mini stopped (force)"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        fi
    else
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  ✅ Opta Mini stopped gracefully"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    fi
else
    echo "ℹ️  Opta Mini is not running"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Nothing to stop."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo ""
echo "Press any key to close this window..."
read -n 1 -s
