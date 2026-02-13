#!/bin/bash
# OptaPlus macOS — Build & Run
# Usage: ./scripts/build-run.sh [--clean]

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MACOS_DIR="$PROJECT_DIR/macOS"
SCHEME="OptaPlusMacOS"
CONFIG="Debug"

# Find the DerivedData folder
DD_BASE="$HOME/Library/Developer/Xcode/DerivedData"
DD_DIR=$(ls -dt "$DD_BASE"/OptaPlusMacOS-* 2>/dev/null | head -1)

if [ "$1" = "--clean" ]; then
    echo "🧹 Cleaning DerivedData..."
    rm -rf "$DD_BASE"/OptaPlusMacOS-*
    DD_DIR=""
fi

echo "🔨 Building $SCHEME ($CONFIG)..."
cd "$MACOS_DIR"
xcodebuild -project OptaPlusMacOS.xcodeproj \
    -scheme "$SCHEME" \
    -configuration "$CONFIG" \
    build 2>&1 | tail -5

# Re-find DerivedData after build
DD_DIR=$(ls -dt "$DD_BASE"/OptaPlusMacOS-* 2>/dev/null | head -1)
APP="$DD_DIR/Build/Products/$CONFIG/OptaPlusMacOS.app"

if [ ! -d "$APP" ]; then
    echo "❌ Build product not found"
    exit 1
fi

echo "🔪 Killing old instances..."
killall -9 OptaPlusMacOS 2>/dev/null || true
sleep 1

echo "🚀 Launching $(basename "$APP")..."
open "$APP"

# Wait and verify
sleep 2
if pgrep -q OptaPlusMacOS; then
    PID=$(pgrep OptaPlusMacOS)
    echo "✅ Running (PID: $PID)"
    echo "📍 Binary: $APP/Contents/MacOS/OptaPlusMacOS"
    echo "📅 Built: $(stat -f '%Sm' "$APP/Contents/MacOS/OptaPlusMacOS")"
else
    echo "❌ Failed to launch"
    exit 1
fi
