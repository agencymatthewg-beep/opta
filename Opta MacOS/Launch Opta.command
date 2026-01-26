#!/bin/bash

# Opta Mini Quick Launch
# Double-click to launch Opta Mini from an existing build.

# Navigate to script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="OptaNative"
BUILD_DIR="$SCRIPT_DIR/build"
DEBUG_PATH="$BUILD_DIR/Build/Products/Debug/$APP_NAME.app"
RELEASE_PATH="$BUILD_DIR/Build/Products/Release/$APP_NAME.app"

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 Opta Mini - Quick Launch"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📂 Directory: $SCRIPT_DIR"
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

# Function to sign and launch
launch_app() {
    local app_path="$1"
    local build_type="$2"

    echo "📍 Found $build_type build"
    echo "   Path: $app_path"
    echo ""

    # Sign for local execution
    echo "🔐 Signing for local execution..."
    xattr -cr "$app_path" 2>/dev/null
    codesign --force --deep --sign - "$app_path" 2>/dev/null

    if [ $? -ne 0 ]; then
        echo "⚠️  Signing warning (may still work)"
    fi

    echo "🚀 Launching Opta Mini..."
    open "$app_path"

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
        echo ""
        echo "Press any key to close this window..."
        read -n 1 -s
        exit 0
    else
        echo ""
        echo "❌ FAILED - App did not start"
        return 1
    fi
}

# Try Debug build first
if [ -d "$DEBUG_PATH" ]; then
    launch_app "$DEBUG_PATH" "Debug"
fi

# Try Release build
if [ -d "$RELEASE_PATH" ]; then
    launch_app "$RELEASE_PATH" "Release"
fi

# Search DerivedData as fallback
echo "🔍 Searching Xcode DerivedData..."
FOUND_APP=$(find ~/Library/Developer/Xcode/DerivedData -name "$APP_NAME.app" -type d 2>/dev/null | head -1)

if [ -n "$FOUND_APP" ]; then
    launch_app "$FOUND_APP" "Cached"
fi

# No app found
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
