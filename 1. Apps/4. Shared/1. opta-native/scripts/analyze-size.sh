#!/bin/bash
#
# Binary Size Analysis Script for opta-render
#
# This script builds the release binary and reports size metrics
# to help track progress toward the 15MB binary size target.
#
# Usage:
#   ./scripts/analyze-size.sh [--bloat]
#
# Options:
#   --bloat   Run cargo-bloat for detailed crate-level analysis
#             (requires: cargo install cargo-bloat)

set -e

# Configuration
TARGET_SIZE_MB=15
CRATE="opta-render"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Navigate to workspace root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$WORKSPACE_ROOT"

echo -e "${BLUE}=== Opta Binary Size Analysis ===${NC}"
echo ""

# Build release binary
echo -e "${YELLOW}Building release binary...${NC}"
cargo build --release -p "$CRATE" 2>&1 | tail -5

# Find the built library
LIB_PATH=""
if [[ "$OSTYPE" == "darwin"* ]]; then
    LIB_PATH="target/release/libopta_render.a"
elif [[ "$OSTYPE" == "linux"* ]]; then
    LIB_PATH="target/release/libopta_render.a"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    LIB_PATH="target/release/opta_render.lib"
fi

if [[ ! -f "$LIB_PATH" ]]; then
    echo -e "${RED}Error: Could not find built library at $LIB_PATH${NC}"
    exit 1
fi

# Get file size
SIZE_BYTES=$(stat -f%z "$LIB_PATH" 2>/dev/null || stat -c%s "$LIB_PATH" 2>/dev/null)
SIZE_MB=$(echo "scale=2; $SIZE_BYTES / 1048576" | bc)
SIZE_KB=$(echo "scale=0; $SIZE_BYTES / 1024" | bc)

echo ""
echo -e "${BLUE}=== Size Report ===${NC}"
echo ""
echo -e "Library:        ${YELLOW}$LIB_PATH${NC}"
echo -e "Size:           ${GREEN}${SIZE_MB} MB${NC} (${SIZE_KB} KB)"
echo -e "Bytes:          $SIZE_BYTES"
echo ""

# Check against target
TARGET_BYTES=$((TARGET_SIZE_MB * 1048576))
if (( SIZE_BYTES <= TARGET_BYTES )); then
    echo -e "Target (${TARGET_SIZE_MB}MB): ${GREEN}PASS${NC}"
    DIFF_MB=$(echo "scale=2; ($TARGET_BYTES - $SIZE_BYTES) / 1048576" | bc)
    echo -e "Headroom:       ${GREEN}${DIFF_MB} MB under target${NC}"
else
    echo -e "Target (${TARGET_SIZE_MB}MB): ${RED}FAIL${NC}"
    DIFF_MB=$(echo "scale=2; ($SIZE_BYTES - $TARGET_BYTES) / 1048576" | bc)
    echo -e "Over by:        ${RED}${DIFF_MB} MB${NC}"
fi

echo ""

# Show stripped size (if strip is available and this is a debug build for comparison)
if command -v strip &> /dev/null && [[ "$OSTYPE" == "darwin"* ]]; then
    # The release binary should already be stripped per Cargo.toml
    echo -e "${BLUE}Note:${NC} Release binary is already stripped (strip = true in Cargo.toml)"
fi

# Optional: detailed bloat analysis
if [[ "$1" == "--bloat" ]]; then
    echo ""
    echo -e "${BLUE}=== Crate-Level Size Analysis ===${NC}"
    echo ""

    if ! command -v cargo-bloat &> /dev/null; then
        echo -e "${YELLOW}cargo-bloat not installed. Install with:${NC}"
        echo "  cargo install cargo-bloat"
        exit 1
    fi

    echo -e "${YELLOW}Running cargo-bloat (this may take a moment)...${NC}"
    echo ""
    cargo bloat --release -p "$CRATE" --crates -n 15

    echo ""
    echo -e "${BLUE}=== Top Functions by Size ===${NC}"
    echo ""
    cargo bloat --release -p "$CRATE" -n 20
fi

echo ""
echo -e "${BLUE}=== Build Configuration ===${NC}"
echo ""
echo "Profile:        release"
echo "LTO:            fat"
echo "Codegen Units:  1"
echo "Opt Level:      z (size)"
echo "Strip:          true"
echo "Panic:          abort"
echo ""
