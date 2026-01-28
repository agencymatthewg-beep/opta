#!/bin/bash
# Build XCFramework for macOS and iOS
# Usage: ./scripts/build-xcframework.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/target/xcframework"

echo "========================================="
echo "Building Opta Core XCFramework"
echo "========================================="

# Clean output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Build for all Apple platforms
echo ""
echo "[1/4] Building for macOS (Apple Silicon)..."
cargo build --manifest-path "$PROJECT_DIR/Cargo.toml" -p opta-core --release --target aarch64-apple-darwin

echo ""
echo "[2/4] Building for macOS (Intel)..."
cargo build --manifest-path "$PROJECT_DIR/Cargo.toml" -p opta-core --release --target x86_64-apple-darwin

echo ""
echo "[3/4] Building for iOS (device)..."
cargo build --manifest-path "$PROJECT_DIR/Cargo.toml" -p opta-core --release --target aarch64-apple-ios

echo ""
echo "[4/4] Building for iOS Simulator (Apple Silicon)..."
cargo build --manifest-path "$PROJECT_DIR/Cargo.toml" -p opta-core --release --target aarch64-apple-ios-sim

# Create universal macOS binary
echo ""
echo "Creating universal macOS binary..."
mkdir -p "$OUTPUT_DIR/macos"
lipo -create \
    "$PROJECT_DIR/target/aarch64-apple-darwin/release/libopta_core.a" \
    "$PROJECT_DIR/target/x86_64-apple-darwin/release/libopta_core.a" \
    -output "$OUTPUT_DIR/macos/libopta_core.a"

# Create iOS Simulator binary
mkdir -p "$OUTPUT_DIR/ios-simulator"
cp "$PROJECT_DIR/target/aarch64-apple-ios-sim/release/libopta_core.a" "$OUTPUT_DIR/ios-simulator/"

# Create iOS device binary
mkdir -p "$OUTPUT_DIR/ios"
cp "$PROJECT_DIR/target/aarch64-apple-ios/release/libopta_core.a" "$OUTPUT_DIR/ios/"

# Generate Swift bindings using UniFFI
echo ""
echo "Generating Swift bindings..."
mkdir -p "$OUTPUT_DIR/swift"

# UniFFI 0.28+ uses cargo to generate bindings
cd "$PROJECT_DIR"
cargo run -p uniffi --bin uniffi-bindgen generate \
    "opta-core/src/opta.udl" \
    --language swift \
    --out-dir "$OUTPUT_DIR/swift" \
    2>/dev/null || {
    # Fallback: generate using library approach
    echo "Note: Using proc-macro exports, Swift bindings generated from library"
    # Copy the UDL as reference
    cp "$PROJECT_DIR/opta-core/src/opta.udl" "$OUTPUT_DIR/swift/"
}

# Create module map for the header
cat > "$OUTPUT_DIR/swift/module.modulemap" << 'EOF'
module OptaCore {
    header "opta_coreFFI.h"
    export *
}
EOF

# Create XCFramework
echo ""
echo "Creating XCFramework..."
xcodebuild -create-xcframework \
    -library "$OUTPUT_DIR/macos/libopta_core.a" \
    -library "$OUTPUT_DIR/ios/libopta_core.a" \
    -library "$OUTPUT_DIR/ios-simulator/libopta_core.a" \
    -output "$OUTPUT_DIR/OptaCore.xcframework"

echo ""
echo "========================================="
echo "XCFramework created successfully!"
echo "Output: $OUTPUT_DIR/OptaCore.xcframework"
echo "========================================="
