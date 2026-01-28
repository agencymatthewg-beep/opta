#!/bin/bash
# Generate Swift bindings from opta-core via UniFFI
# Usage: ./scripts/generate-swift-bindings.sh
#
# This script builds opta-core for macOS and generates Swift bindings
# using UniFFI 0.28+ library-mode binding generation.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/target/swift-bindings"
GENERATED_DIR="$PROJECT_DIR/OptaApp/OptaApp/Generated"

echo "========================================="
echo "Generating Swift Bindings for opta-core"
echo "========================================="

# Clean and create output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Step 1: Build opta-core for macOS (Apple Silicon)
echo ""
echo "[1/4] Building opta-core for macOS (aarch64-apple-darwin)..."
cargo build --manifest-path "$PROJECT_DIR/Cargo.toml" \
    -p opta-core \
    --release \
    --target aarch64-apple-darwin

# Verify the library was built
DYLIB_PATH="$PROJECT_DIR/target/aarch64-apple-darwin/release/libopta_core.dylib"
STATICLIB_PATH="$PROJECT_DIR/target/aarch64-apple-darwin/release/libopta_core.a"

if [ ! -f "$DYLIB_PATH" ] && [ ! -f "$STATICLIB_PATH" ]; then
    echo "Error: Could not find built library"
    echo "Expected at: $DYLIB_PATH or $STATICLIB_PATH"
    exit 1
fi

# Use dylib for binding generation, fall back to static lib
if [ -f "$DYLIB_PATH" ]; then
    LIBRARY_PATH="$DYLIB_PATH"
else
    LIBRARY_PATH="$STATICLIB_PATH"
fi

echo "Library built at: $LIBRARY_PATH"

# Step 2: Generate Swift bindings using library-mode
echo ""
echo "[2/4] Generating Swift bindings via UniFFI..."

# UniFFI 0.28+ uses library-mode: generate bindings from the compiled library
# The library contains the metadata from proc-macros
# We use the uniffi-bindgen binary defined in opta-core/src/bin/uniffi-bindgen.rs
cd "$PROJECT_DIR"
cargo run -p opta-core --bin uniffi-bindgen -- \
    generate \
    --library "$LIBRARY_PATH" \
    --language swift \
    --out-dir "$OUTPUT_DIR"

# Step 3: Verify generated files
echo ""
echo "[3/4] Verifying generated files..."

# UniFFI generates files named after the namespace in UDL (opta)
if [ -f "$OUTPUT_DIR/opta.swift" ]; then
    SWIFT_FILE="$OUTPUT_DIR/opta.swift"
elif [ -f "$OUTPUT_DIR/optaFFI.swift" ]; then
    SWIFT_FILE="$OUTPUT_DIR/optaFFI.swift"
elif [ -f "$OUTPUT_DIR/opta_core.swift" ]; then
    SWIFT_FILE="$OUTPUT_DIR/opta_core.swift"
else
    echo "Error: No Swift bindings file found in $OUTPUT_DIR"
    ls -la "$OUTPUT_DIR"
    exit 1
fi

echo "Swift bindings: $SWIFT_FILE"

# Find the header file
if [ -f "$OUTPUT_DIR/optaFFI.h" ]; then
    HEADER_FILE="$OUTPUT_DIR/optaFFI.h"
elif [ -f "$OUTPUT_DIR/opta_coreFFI.h" ]; then
    HEADER_FILE="$OUTPUT_DIR/opta_coreFFI.h"
else
    echo "Warning: No FFI header file found"
    HEADER_FILE=""
fi

if [ -n "$HEADER_FILE" ]; then
    echo "FFI header: $HEADER_FILE"
fi

# Step 4: Copy to OptaApp/Generated/
echo ""
echo "[4/4] Copying bindings to OptaApp project..."

mkdir -p "$GENERATED_DIR"

# Copy Swift bindings (rename to OptaCore.swift for clarity)
cp "$SWIFT_FILE" "$GENERATED_DIR/OptaCore.swift"
echo "Copied: $GENERATED_DIR/OptaCore.swift"

# Copy header if it exists
if [ -n "$HEADER_FILE" ] && [ -f "$HEADER_FILE" ]; then
    cp "$HEADER_FILE" "$GENERATED_DIR/opta_coreFFI.h"
    echo "Copied: $GENERATED_DIR/opta_coreFFI.h"
fi

# Copy and fix modulemap if it exists
if [ -f "$OUTPUT_DIR/optaFFI.modulemap" ]; then
    # Fix header reference to match our renamed file
    sed 's/header "optaFFI.h"/header "opta_coreFFI.h"/' "$OUTPUT_DIR/optaFFI.modulemap" > "$GENERATED_DIR/opta_coreFFI.modulemap"
    echo "Copied: $GENERATED_DIR/opta_coreFFI.modulemap (with header path fixed)"
elif [ -f "$OUTPUT_DIR/opta_coreFFI.modulemap" ]; then
    cp "$OUTPUT_DIR/opta_coreFFI.modulemap" "$GENERATED_DIR/opta_coreFFI.modulemap"
    echo "Copied: $GENERATED_DIR/opta_coreFFI.modulemap"
fi

echo ""
echo "========================================="
echo "Swift Bindings Generated Successfully!"
echo "========================================="
echo ""
echo "Output directory: $OUTPUT_DIR"
echo "OptaApp Generated: $GENERATED_DIR"
echo ""
echo "Generated types:"
echo "  - OptaCore (main FFI object)"
echo "  - FfiHapticPattern enum"
echo "  - FfiSoundEffect enum"
echo "  - optaInit() function"
echo "  - optaVersion() function"
echo ""
echo "Next steps:"
echo "  1. Open OptaApp.xcodeproj in Xcode"
echo "  2. Add Generated/ folder to the project if not already present"
echo "  3. Build and verify compilation"
echo ""
