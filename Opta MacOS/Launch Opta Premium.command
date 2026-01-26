#!/bin/bash

# Opta Mini Premium Launch
# Double-click to build and launch Opta Mini.

# Navigate to script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="OptaNative"

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔮 Opta Mini - Premium Launch"
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

# Check for Xcode
if ! command -v xcodebuild &> /dev/null; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ❌ ERROR - Xcode not found"
    echo ""
    echo "  Please install Xcode from the App Store."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Press any key to close..."
    read -n 1 -s
    exit 1
fi

# Check for project file
if [ ! -f "$SCRIPT_DIR/OptaNative.xcodeproj/project.pbxproj" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ❌ ERROR - Project not found"
    echo ""
    echo "  OptaNative.xcodeproj not found in:"
    echo "  $SCRIPT_DIR"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Press any key to close..."
    read -n 1 -s
    exit 1
fi

# Build
echo "🛠️  Building Opta Mini..."
echo "   This may take a moment..."
echo ""

xcodebuild -project "$SCRIPT_DIR/OptaNative.xcodeproj" \
           -scheme "OptaNative" \
           -configuration Debug \
           build 2>&1 | tee /tmp/opta_build.log

BUILD_RESULT=${PIPESTATUS[0]}

echo ""

if [ $BUILD_RESULT -ne 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ❌ BUILD FAILED"
    echo ""
    echo "  Check the output above for errors."
    echo "  Common fixes:"
    echo "  • Open in Xcode and check for issues"
    echo "  • Run: xcode-select --install"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Press any key to close..."
    read -n 1 -s
    exit 1
fi

echo "✅ Build successful"
echo ""

# Find the built app
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "$APP_NAME.app" -path "*/Debug/*" -type d 2>/dev/null | head -1)

if [ -z "$APP_PATH" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ❌ ERROR - Built app not found"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Press any key to close..."
    read -n 1 -s
    exit 1
fi

# Sign for local execution
echo "🔐 Signing for local execution..."
xattr -cr "$APP_PATH" 2>/dev/null
codesign --force --deep --sign - "$APP_PATH" 2>/dev/null

# Launch
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
    echo "  ❌ LAUNCH FAILED"
    echo ""
    echo "  The app built but failed to start."
    echo "  Try opening OptaNative.xcodeproj in"
    echo "  Xcode and running from there."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo ""
echo "Press any key to close this window..."
read -n 1 -s
