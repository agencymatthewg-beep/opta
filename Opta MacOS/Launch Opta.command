#!/bin/bash

# Opta Mini Quick Launch
# Launches the existing built app without rebuilding.
# Use "Launch Opta Premium.command" to rebuild first.

cd "$(dirname "$0")"

APP_NAME="OptaNative"
BUILD_DIR="./build"
DEBUG_PATH="$BUILD_DIR/Build/Products/Debug/$APP_NAME.app"
RELEASE_PATH="$BUILD_DIR/Build/Products/Release/$APP_NAME.app"

echo "🚀 Quick Launch: Opta Mini"
echo ""

# Check if already running
if pgrep -x "$APP_NAME" > /dev/null; then
    echo "⚡ Already running. Bringing to front..."
    open -a "$APP_NAME"
    exit 0
fi

# Function to sign and launch
sign_and_launch() {
    local app_path="$1"
    echo "🔐 Ensuring app is signed..."
    xattr -cr "$app_path" 2>/dev/null
    codesign --force --deep --sign - "$app_path" 2>/dev/null

    echo "🚀 Launching..."
    open "$app_path"
    sleep 1

    if pgrep -x "$APP_NAME" > /dev/null; then
        echo "✨ Opta Mini is now running"
        exit 0
    else
        echo "⚠️  Launch may have failed"
        return 1
    fi
}

# Try Debug build first (more likely to exist)
if [ -d "$DEBUG_PATH" ]; then
    echo "📍 Found Debug build"
    sign_and_launch "$DEBUG_PATH"
fi

# Try Release build
if [ -d "$RELEASE_PATH" ]; then
    echo "📍 Found Release build"
    sign_and_launch "$RELEASE_PATH"
fi

# Search DerivedData as fallback
echo "🔍 Searching for built app..."
FOUND_APP=$(find ~/Library/Developer/Xcode/DerivedData -name "$APP_NAME.app" -type d 2>/dev/null | head -1)

if [ -n "$FOUND_APP" ]; then
    echo "📍 Found at: $FOUND_APP"
    sign_and_launch "$FOUND_APP"
fi

# No app found
echo "❌ No built app found."
echo ""
echo "Run 'Launch Opta Premium.command' to build and launch."
echo ""
read -p "Press ENTER to close..."
exit 1
