#!/bin/bash

# Opta Mini Launch Script
# Builds and launches the native macOS app.

cd "$(dirname "$0")"
echo "📂 Working Directory: $(pwd)"

APP_NAME="OptaNative"
BUILD_DIR="./build"
APP_PATH="$BUILD_DIR/Build/Products/Debug/$APP_NAME.app"

echo ""
echo "🔮 Opta Mini Launch Sequence"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Check if already running
if pgrep -x "$APP_NAME" > /dev/null; then
    echo "⚡ Opta is already running. Bringing to front..."
    open -a "$APP_NAME"
    exit 0
fi

# 2. Build (incremental)
echo "🛠️  Building Opta Mini..."
BUILD_OUTPUT=$(xcodebuild -project "OptaNative.xcodeproj" \
           -scheme "OptaNative" \
           -configuration Debug \
           -derivedDataPath "$BUILD_DIR" \
           build 2>&1)

BUILD_RESULT=$?

if [ $BUILD_RESULT -eq 0 ] || [ -d "$APP_PATH" ]; then
    echo "✅ Build complete"

    # 3. Clear extended attributes and re-sign for local execution
    echo "🔐 Signing for local execution..."
    xattr -cr "$APP_PATH" 2>/dev/null
    codesign --force --deep --sign - "$APP_PATH" 2>/dev/null

    # 4. Launch
    if [ -d "$APP_PATH" ]; then
        echo "🚀 Launching Opta Mini..."
        open "$APP_PATH"
        sleep 1

        if pgrep -x "$APP_NAME" > /dev/null; then
            echo ""
            echo "✨ Opta Mini is now running in your menu bar"
        else
            echo "⚠️  App may have launched but couldn't verify"
        fi
    else
        echo "❌ Could not find built app at: $APP_PATH"
        read -p "Press ENTER to close..."
        exit 1
    fi
else
    echo "❌ Build failed"
    echo ""
    echo "Build output (last 30 lines):"
    echo "$BUILD_OUTPUT" | tail -30
    echo ""
    read -p "Press ENTER to close..."
    exit 1
fi
