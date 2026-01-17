#!/bin/bash
#
# Build script for Opta Menu Bar Swift Plugin
# Plan 20-08: Menu Bar Extra - Swift Plugin
#
# Usage:
#   ./build.sh           - Build debug version
#   ./build.sh release   - Build release version
#   ./build.sh clean     - Clean build artifacts
#

set -e

cd "$(dirname "$0")"

PLUGIN_NAME="OptaMenuBar"
BUILD_MODE="${1:-debug}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    echo_info "Checking prerequisites..."

    if ! command -v swift &> /dev/null; then
        echo_error "Swift not found. Please install Xcode Command Line Tools."
        exit 1
    fi

    echo_info "Swift version: $(swift --version | head -1)"

    # Check macOS version (MenuBarExtra requires macOS 13+)
    MACOS_VERSION=$(sw_vers -productVersion | cut -d. -f1)
    if [ "$MACOS_VERSION" -lt 13 ]; then
        echo_error "macOS 13+ required for MenuBarExtra API (found: $(sw_vers -productVersion))"
        exit 1
    fi

    echo_info "macOS version: $(sw_vers -productVersion)"
}

# Clean build artifacts
clean() {
    echo_info "Cleaning build artifacts..."
    swift package clean
    rm -rf .build
    echo_info "Clean complete"
}

# Build the Swift package
build() {
    local config="$1"
    echo_info "Building $PLUGIN_NAME ($config)..."

    if [ "$config" == "release" ]; then
        swift build -c release
        echo_info "Built release binary at: .build/release/lib${PLUGIN_NAME}.dylib"
    else
        swift build
        echo_info "Built debug binary at: .build/debug/lib${PLUGIN_NAME}.dylib"
    fi
}

# Run tests
test() {
    echo_info "Running tests..."
    swift test
}

# Copy to Tauri target directory
copy_to_tauri() {
    local config="$1"
    local src_dir=".build/${config}"
    local dest_dir="../target/${config}"

    if [ ! -d "$dest_dir" ]; then
        mkdir -p "$dest_dir"
    fi

    if [ -f "${src_dir}/lib${PLUGIN_NAME}.dylib" ]; then
        echo_info "Copying dylib to Tauri target..."
        cp "${src_dir}/lib${PLUGIN_NAME}.dylib" "$dest_dir/"
        echo_info "Copied to: ${dest_dir}/lib${PLUGIN_NAME}.dylib"
    else
        echo_warn "dylib not found, skipping copy"
    fi
}

# Generate FlatBuffers code (if flatc is available)
generate_flatbuffers() {
    if command -v flatc &> /dev/null; then
        echo_info "Generating FlatBuffers code..."
        cd ../..
        flatc --swift -o src-tauri/swift-plugin/Sources/OptaMenuBar/Generated/ schemas/system_metrics.fbs
        flatc --rust -o src-tauri/src/generated/ schemas/system_metrics.fbs
        cd src-tauri/swift-plugin
        echo_info "FlatBuffers code generated"
    else
        echo_warn "flatc not found, skipping FlatBuffers generation"
        echo_warn "Install with: brew install flatbuffers"
    fi
}

# Main entry point
main() {
    check_prerequisites

    case "$BUILD_MODE" in
        clean)
            clean
            ;;
        release)
            build release
            copy_to_tauri release
            ;;
        test)
            build debug
            test
            ;;
        flatbuffers|fb)
            generate_flatbuffers
            ;;
        debug|*)
            build debug
            copy_to_tauri debug
            ;;
    esac

    echo_info "Done!"
}

main
