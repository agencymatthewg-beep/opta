#!/bin/bash
#
# build-macos.sh
# Build script for Opta macOS native app
#
# This script builds the Rust render library and copies it to the Xcode project
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
XCODE_PROJECT="$PROJECT_ROOT/OptaApp"
LIBRARIES_DIR="$XCODE_PROJECT/OptaApp/Libraries"

# Rust configuration
RUST_TARGET_AARCH64="aarch64-apple-darwin"
RUST_TARGET_X86_64="x86_64-apple-darwin"
RUST_RELEASE_DIR="$PROJECT_ROOT/target"

# Library name
LIB_NAME="libopta_render"
LIB_EXTENSION="a"

# Build configuration (default: release)
BUILD_TYPE="${1:-release}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Opta macOS Build Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check for required tools
check_requirements() {
    print_status "Checking requirements..."

    # Check for Rust
    if ! command -v cargo &> /dev/null; then
        print_error "Cargo not found. Please install Rust: https://rustup.rs"
        exit 1
    fi

    # Check for rustup targets
    if ! rustup target list --installed | grep -q "$RUST_TARGET_AARCH64"; then
        print_warning "Adding target: $RUST_TARGET_AARCH64"
        rustup target add "$RUST_TARGET_AARCH64"
    fi

    if ! rustup target list --installed | grep -q "$RUST_TARGET_X86_64"; then
        print_warning "Adding target: $RUST_TARGET_X86_64"
        rustup target add "$RUST_TARGET_X86_64"
    fi

    # Check for lipo (should be available on macOS)
    if ! command -v lipo &> /dev/null; then
        print_error "lipo not found. Are you on macOS?"
        exit 1
    fi

    print_status "Requirements satisfied"
}

# Build Rust library
build_rust() {
    print_status "Building Rust library..."

    cd "$PROJECT_ROOT"

    local cargo_flags=""
    local build_dir=""

    if [ "$BUILD_TYPE" = "release" ]; then
        cargo_flags="--release"
        build_dir="release"
    else
        build_dir="debug"
    fi

    # Check if opta-render crate exists
    if [ ! -d "$PROJECT_ROOT/opta-render" ]; then
        print_warning "opta-render crate not found at $PROJECT_ROOT/opta-render"
        print_warning "Creating placeholder library structure..."
        create_placeholder_lib
        return
    fi

    # Build for Apple Silicon (aarch64)
    print_status "Building for Apple Silicon (aarch64)..."
    cargo build -p opta-render --target "$RUST_TARGET_AARCH64" $cargo_flags

    # Build for Intel (x86_64)
    print_status "Building for Intel (x86_64)..."
    cargo build -p opta-render --target "$RUST_TARGET_X86_64" $cargo_flags

    # Create universal binary
    print_status "Creating universal binary..."

    local aarch64_lib="$RUST_RELEASE_DIR/$RUST_TARGET_AARCH64/$build_dir/$LIB_NAME.$LIB_EXTENSION"
    local x86_64_lib="$RUST_RELEASE_DIR/$RUST_TARGET_X86_64/$build_dir/$LIB_NAME.$LIB_EXTENSION"
    local universal_lib="$RUST_RELEASE_DIR/$build_dir/$LIB_NAME.$LIB_EXTENSION"

    mkdir -p "$RUST_RELEASE_DIR/$build_dir"

    if [ -f "$aarch64_lib" ] && [ -f "$x86_64_lib" ]; then
        lipo -create "$aarch64_lib" "$x86_64_lib" -output "$universal_lib"
        print_status "Universal binary created: $universal_lib"
    elif [ -f "$aarch64_lib" ]; then
        cp "$aarch64_lib" "$universal_lib"
        print_warning "Only aarch64 build available"
    elif [ -f "$x86_64_lib" ]; then
        cp "$x86_64_lib" "$universal_lib"
        print_warning "Only x86_64 build available"
    else
        print_error "No library files found!"
        create_placeholder_lib
        return
    fi
}

# Create placeholder library for development
create_placeholder_lib() {
    print_status "Creating placeholder library for development..."

    local build_dir
    if [ "$BUILD_TYPE" = "release" ]; then
        build_dir="release"
    else
        build_dir="debug"
    fi

    mkdir -p "$RUST_RELEASE_DIR/$build_dir"

    # Create a minimal static library placeholder
    # This allows the Xcode project to link while Rust code is being developed
    local placeholder_c="$RUST_RELEASE_DIR/$build_dir/placeholder.c"
    local placeholder_o="$RUST_RELEASE_DIR/$build_dir/placeholder.o"
    local placeholder_lib="$RUST_RELEASE_DIR/$build_dir/$LIB_NAME.$LIB_EXTENSION"

    cat > "$placeholder_c" << 'EOF'
// Placeholder for opta_render library
// This file provides stub implementations for development

#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

typedef struct OptaRenderContext OptaRenderContext;

typedef struct {
    uint32_t max_texture_dimension;
    uint64_t max_buffer_size;
    bool supports_compute;
    bool supports_raytracing;
    char vendor[64];
    char device_name[128];
    uint32_t preferred_frame_rate;
} OptaGpuCapabilities;

typedef enum {
    OPTA_RENDER_OK = 0,
    OPTA_RENDER_ERROR_NULL_CONTEXT = 1,
    OPTA_RENDER_ERROR_SURFACE_CONFIG = 2,
    OPTA_RENDER_ERROR_FRAME_ACQUIRE = 3,
    OPTA_RENDER_ERROR_RENDER_PASS = 4,
    OPTA_RENDER_ERROR_QUEUE_SUBMIT = 5,
    OPTA_RENDER_ERROR_PRESENT = 6,
    OPTA_RENDER_ERROR_INVALID_PARAMS = 7,
    OPTA_RENDER_ERROR_DEVICE_LOST = 8,
    OPTA_RENDER_ERROR_OUT_OF_MEMORY = 9,
    OPTA_RENDER_ERROR_UNKNOWN = 255,
} OptaRenderResult;

typedef struct {
    bool is_active;
    bool is_paused;
    float current_fps;
    float target_fps;
    float frame_time_ms;
    uint64_t total_frames;
    uint64_t dropped_frames;
    float quality_level;
    uint64_t gpu_memory_usage;
} OptaRenderStatus;

typedef enum {
    OPTA_QUALITY_LOW = 0,
    OPTA_QUALITY_MEDIUM = 1,
    OPTA_QUALITY_HIGH = 2,
    OPTA_QUALITY_ULTRA = 3,
    OPTA_QUALITY_ADAPTIVE = 4,
} OptaQualityLevel;

// Placeholder context
struct OptaRenderContext {
    bool initialized;
    bool paused;
    float quality;
    uint32_t target_fps;
    uint64_t frame_count;
};

OptaRenderContext* opta_render_create(void) {
    OptaRenderContext* ctx = (OptaRenderContext*)malloc(sizeof(OptaRenderContext));
    if (ctx) {
        memset(ctx, 0, sizeof(OptaRenderContext));
        ctx->quality = 1.0f;
        ctx->target_fps = 60;
    }
    return ctx;
}

OptaRenderResult opta_render_init(OptaRenderContext* ctx, void* metal_layer) {
    if (!ctx) return OPTA_RENDER_ERROR_NULL_CONTEXT;
    ctx->initialized = true;
    return OPTA_RENDER_OK;
}

void opta_render_destroy(OptaRenderContext* ctx) {
    if (ctx) {
        free(ctx);
    }
}

OptaRenderResult opta_render_configure_surface(OptaRenderContext* ctx, uint32_t width, uint32_t height, float scale) {
    if (!ctx) return OPTA_RENDER_ERROR_NULL_CONTEXT;
    return OPTA_RENDER_OK;
}

OptaRenderResult opta_render_resize(OptaRenderContext* ctx, uint32_t width, uint32_t height, float scale) {
    if (!ctx) return OPTA_RENDER_ERROR_NULL_CONTEXT;
    return OPTA_RENDER_OK;
}

OptaRenderResult opta_render_frame_begin(OptaRenderContext* ctx, double timestamp) {
    if (!ctx) return OPTA_RENDER_ERROR_NULL_CONTEXT;
    if (ctx->paused) return OPTA_RENDER_ERROR_FRAME_ACQUIRE;
    return OPTA_RENDER_OK;
}

OptaRenderResult opta_render_frame_end(OptaRenderContext* ctx) {
    if (!ctx) return OPTA_RENDER_ERROR_NULL_CONTEXT;
    ctx->frame_count++;
    return OPTA_RENDER_OK;
}

OptaRenderResult opta_render_set_quality(OptaRenderContext* ctx, OptaQualityLevel quality) {
    if (!ctx) return OPTA_RENDER_ERROR_NULL_CONTEXT;
    ctx->quality = (float)quality / 4.0f;
    return OPTA_RENDER_OK;
}

OptaRenderResult opta_render_set_quality_value(OptaRenderContext* ctx, float quality_value) {
    if (!ctx) return OPTA_RENDER_ERROR_NULL_CONTEXT;
    ctx->quality = quality_value;
    return OPTA_RENDER_OK;
}

OptaRenderResult opta_render_set_target_fps(OptaRenderContext* ctx, uint32_t fps) {
    if (!ctx) return OPTA_RENDER_ERROR_NULL_CONTEXT;
    ctx->target_fps = fps;
    return OPTA_RENDER_OK;
}

OptaRenderResult opta_render_pause(OptaRenderContext* ctx) {
    if (!ctx) return OPTA_RENDER_ERROR_NULL_CONTEXT;
    ctx->paused = true;
    return OPTA_RENDER_OK;
}

OptaRenderResult opta_render_resume(OptaRenderContext* ctx) {
    if (!ctx) return OPTA_RENDER_ERROR_NULL_CONTEXT;
    ctx->paused = false;
    return OPTA_RENDER_OK;
}

OptaRenderResult opta_render_set_paused(OptaRenderContext* ctx, bool paused) {
    if (!ctx) return OPTA_RENDER_ERROR_NULL_CONTEXT;
    ctx->paused = paused;
    return OPTA_RENDER_OK;
}

OptaRenderResult opta_render_get_status(OptaRenderContext* ctx, OptaRenderStatus* status) {
    if (!ctx || !status) return OPTA_RENDER_ERROR_NULL_CONTEXT;
    status->is_active = ctx->initialized;
    status->is_paused = ctx->paused;
    status->current_fps = 60.0f;
    status->target_fps = (float)ctx->target_fps;
    status->frame_time_ms = 16.67f;
    status->total_frames = ctx->frame_count;
    status->dropped_frames = 0;
    status->quality_level = ctx->quality;
    status->gpu_memory_usage = 0;
    return OPTA_RENDER_OK;
}

OptaRenderResult opta_render_get_capabilities(OptaRenderContext* ctx, OptaGpuCapabilities* caps) {
    if (!ctx || !caps) return OPTA_RENDER_ERROR_NULL_CONTEXT;
    caps->max_texture_dimension = 16384;
    caps->max_buffer_size = 1024 * 1024 * 1024;
    caps->supports_compute = true;
    caps->supports_raytracing = false;
    strncpy(caps->vendor, "Apple", 64);
    strncpy(caps->device_name, "Placeholder GPU", 128);
    caps->preferred_frame_rate = 120;
    return OPTA_RENDER_OK;
}

const char* opta_render_get_last_error(OptaRenderContext* ctx) {
    return NULL;
}
EOF

    # Compile for both architectures
    print_status "Compiling placeholder for aarch64..."
    clang -c -target arm64-apple-macos13 -o "${placeholder_o}.arm64" "$placeholder_c"

    print_status "Compiling placeholder for x86_64..."
    clang -c -target x86_64-apple-macos13 -o "${placeholder_o}.x86_64" "$placeholder_c"

    # Create universal library
    print_status "Creating universal placeholder library..."
    lipo -create "${placeholder_o}.arm64" "${placeholder_o}.x86_64" -output "$placeholder_o"
    ar rcs "$placeholder_lib" "$placeholder_o"

    # Cleanup
    rm -f "$placeholder_c" "$placeholder_o" "${placeholder_o}.arm64" "${placeholder_o}.x86_64"

    print_status "Placeholder library created: $placeholder_lib"
}

# Copy library to Xcode project
copy_to_xcode() {
    print_status "Copying library to Xcode project..."

    local build_dir
    if [ "$BUILD_TYPE" = "release" ]; then
        build_dir="release"
    else
        build_dir="debug"
    fi

    local source_lib="$RUST_RELEASE_DIR/$build_dir/$LIB_NAME.$LIB_EXTENSION"
    local dest_lib="$LIBRARIES_DIR/$LIB_NAME.$LIB_EXTENSION"

    # Create Libraries directory if it doesn't exist
    mkdir -p "$LIBRARIES_DIR"

    if [ -f "$source_lib" ]; then
        cp "$source_lib" "$dest_lib"
        print_status "Library copied: $dest_lib"

        # Verify the library
        print_status "Verifying library..."
        lipo -info "$dest_lib"
    else
        print_error "Source library not found: $source_lib"
        exit 1
    fi
}

# Main build process
main() {
    echo ""
    print_status "Build type: $BUILD_TYPE"
    print_status "Project root: $PROJECT_ROOT"
    echo ""

    check_requirements
    build_rust
    copy_to_xcode

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Build completed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Library location: $LIBRARIES_DIR/$LIB_NAME.$LIB_EXTENSION"
    echo ""
    echo "Next steps:"
    echo "  1. Open OptaApp.xcodeproj in Xcode"
    echo "  2. Build and run the project"
    echo ""
}

# Run main
main
