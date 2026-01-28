#!/bin/bash
# Linux build script for Opta
#
# This script installs necessary dependencies and builds Opta for Linux
# with Vulkan backend support for both Wayland and X11.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "=========================================="
echo "Opta Linux Build Script"
echo "=========================================="
echo ""

# Detect package manager and install dependencies
install_dependencies() {
    echo "Installing system dependencies..."
    echo ""

    # Debian/Ubuntu
    if command -v apt-get &> /dev/null; then
        echo "Detected Debian/Ubuntu system"
        sudo apt-get update
        sudo apt-get install -y \
            libvulkan-dev \
            libwayland-dev \
            libxkbcommon-dev \
            libx11-dev \
            libxcursor-dev \
            libxrandr-dev \
            libxi-dev \
            cmake \
            pkg-config
        echo "Dependencies installed via apt"
    fi

    # Fedora/RHEL
    if command -v dnf &> /dev/null; then
        echo "Detected Fedora/RHEL system"
        sudo dnf install -y \
            vulkan-loader-devel \
            wayland-devel \
            libxkbcommon-devel \
            libX11-devel \
            libXcursor-devel \
            libXrandr-devel \
            libXi-devel \
            cmake \
            pkg-config
        echo "Dependencies installed via dnf"
    fi

    # Arch Linux
    if command -v pacman &> /dev/null; then
        echo "Detected Arch Linux system"
        sudo pacman -S --needed --noconfirm \
            vulkan-icd-loader \
            wayland \
            libxkbcommon \
            libx11 \
            libxcursor \
            libxrandr \
            libxi \
            cmake \
            pkgconf
        echo "Dependencies installed via pacman"
    fi

    # openSUSE
    if command -v zypper &> /dev/null; then
        echo "Detected openSUSE system"
        sudo zypper install -y \
            vulkan-loader \
            wayland-devel \
            libxkbcommon-devel \
            libX11-devel \
            libXcursor-devel \
            libXrandr-devel \
            libXi-devel \
            cmake \
            pkg-config
        echo "Dependencies installed via zypper"
    fi
}

# Check Vulkan support
check_vulkan() {
    echo ""
    echo "Checking Vulkan support..."

    if command -v vulkaninfo &> /dev/null; then
        echo "Vulkan tools found"
        if vulkaninfo --summary 2>/dev/null | head -5; then
            echo "Vulkan is working"
        else
            echo "Warning: Vulkan may not be properly configured"
        fi
    else
        echo "Note: vulkaninfo not found. Install vulkan-tools for diagnostics."
    fi
}

# Build Opta
build_opta() {
    local build_type="${1:-release}"
    local features="${2:-linux-full}"

    echo ""
    echo "Building Opta for Linux..."
    echo "Build type: $build_type"
    echo "Features: $features"
    echo ""

    if [ "$build_type" = "debug" ]; then
        cargo build -p opta-render --features "$features"
    else
        cargo build -p opta-render --release --features "$features"
    fi

    echo ""
    echo "Build complete!"
}

# Run tests
run_tests() {
    echo ""
    echo "Running tests..."
    cargo test -p opta-render --features linux-full
}

# Main
main() {
    local skip_deps=false
    local build_type="release"
    local run_tests_flag=false
    local features="linux-full"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-deps)
                skip_deps=true
                shift
                ;;
            --debug)
                build_type="debug"
                shift
                ;;
            --test)
                run_tests_flag=true
                shift
                ;;
            --wayland-only)
                features="wayland"
                shift
                ;;
            --x11-only)
                features="x11-backend"
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-deps      Skip dependency installation"
                echo "  --debug          Build in debug mode"
                echo "  --test           Run tests after build"
                echo "  --wayland-only   Build with Wayland support only"
                echo "  --x11-only       Build with X11 support only"
                echo "  --help           Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    if [ "$skip_deps" = false ]; then
        install_dependencies
    fi

    check_vulkan
    build_opta "$build_type" "$features"

    if [ "$run_tests_flag" = true ]; then
        run_tests
    fi

    echo ""
    echo "=========================================="
    echo "Build Summary"
    echo "=========================================="
    echo "Type: $build_type"
    echo "Features: $features"

    if [ "$build_type" = "release" ]; then
        if [ -f "target/release/libopta_render.a" ]; then
            echo "Output: target/release/libopta_render.a"
            ls -lh target/release/libopta_render.a
        fi
    else
        if [ -f "target/debug/libopta_render.a" ]; then
            echo "Output: target/debug/libopta_render.a"
            ls -lh target/debug/libopta_render.a
        fi
    fi
    echo "=========================================="
}

main "$@"
