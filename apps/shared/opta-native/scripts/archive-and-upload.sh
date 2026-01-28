#!/bin/bash
set -e

# Opta Archive and Upload Script
# Usage: ./scripts/archive-and-upload.sh [--archive-only]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
XCODE_PROJECT="$PROJECT_DIR/OptaApp/OptaApp.xcodeproj"
SCHEME="OptaApp"
ARCHIVE_PATH="$PROJECT_DIR/build/Opta.xcarchive"
EXPORT_PATH="$PROJECT_DIR/build/export"

echo "=== Opta Archive & Upload ==="
echo "Project: $XCODE_PROJECT"
echo ""

# Check for Xcode
if ! command -v xcodebuild &> /dev/null; then
    echo "ERROR: xcodebuild not found. Install Xcode Command Line Tools."
    exit 1
fi

# Clean build directory
echo "[1/5] Cleaning build directory..."
rm -rf "$PROJECT_DIR/build"
mkdir -p "$PROJECT_DIR/build"

# Build Rust libraries first (if needed)
if [ -f "$PROJECT_DIR/scripts/build-xcframework.sh" ]; then
    echo "[2/5] Building Rust libraries..."
    "$PROJECT_DIR/scripts/build-xcframework.sh"
else
    echo "[2/5] Skipping Rust build (manual libraries expected)"
fi

# Archive
echo "[3/5] Creating archive..."
xcodebuild archive \
    -project "$XCODE_PROJECT" \
    -scheme "$SCHEME" \
    -configuration Release \
    -archivePath "$ARCHIVE_PATH" \
    CODE_SIGN_STYLE=Automatic \
    -allowProvisioningUpdates

if [ ! -d "$ARCHIVE_PATH" ]; then
    echo "ERROR: Archive failed"
    exit 1
fi

echo "Archive created: $ARCHIVE_PATH"

# Check if archive-only mode
if [ "$1" == "--archive-only" ]; then
    echo ""
    echo "=== Archive Only Mode ==="
    echo "Archive ready at: $ARCHIVE_PATH"
    echo "Open in Xcode: open $ARCHIVE_PATH"
    exit 0
fi

# Export for App Store
echo "[4/5] Exporting for App Store..."

# Create export options plist
cat > "$PROJECT_DIR/build/ExportOptions.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>destination</key>
    <string>upload</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>uploadSymbols</key>
    <true/>
    <key>manageAppVersionAndBuildNumber</key>
    <false/>
</dict>
</plist>
EOF

xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportOptionsPlist "$PROJECT_DIR/build/ExportOptions.plist" \
    -exportPath "$EXPORT_PATH" \
    -allowProvisioningUpdates

echo "[5/5] Upload complete!"
echo ""
echo "=== Next Steps ==="
echo "1. Go to App Store Connect: https://appstoreconnect.apple.com"
echo "2. Select 'Opta' app"
echo "3. Create new version if needed"
echo "4. Select the uploaded build"
echo "5. Fill in What's New text"
echo "6. Submit for review"
echo ""
echo "Archive: $ARCHIVE_PATH"
echo "Exported: $EXPORT_PATH"
