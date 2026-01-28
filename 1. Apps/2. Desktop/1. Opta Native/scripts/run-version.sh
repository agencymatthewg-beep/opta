#!/bin/bash
#
# run-version.sh - Run any tagged version of Opta
#
# Usage:
#   ./scripts/run-version.sh list          - List all available versions
#   ./scripts/run-version.sh v5.0.0        - Run version 5.0.0
#   ./scripts/run-version.sh v2.0.0 --dev  - Run v2.0.0 in dev mode (no build)
#   ./scripts/run-version.sh compare v2.0.0 v7.0.0 - Open two versions side by side
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VERSIONS_DIR="$PROJECT_ROOT/.versions"

print_header() {
    echo -e "${PURPLE}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                    OPTA VERSION RUNNER                        ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

list_versions() {
    print_header
    echo -e "${CYAN}Available versions:${NC}"
    echo ""

    git tag -l -n1 | while read tag message; do
        # Extract version number and description
        version="${tag}"
        desc="${message#*- }"

        # Color code by major version
        case "$tag" in
            v1.*) color="$GREEN" ;;
            v2.*) color="$YELLOW" ;;
            v3.*) color="$BLUE" ;;
            v4.*) color="$PURPLE" ;;
            v5.*) color="$CYAN" ;;
            v6.*) color="$RED" ;;
            v7.*) color="$GREEN" ;;
            *) color="$NC" ;;
        esac

        printf "  ${color}%-10s${NC} %s\n" "$version" "$desc"
    done

    echo ""
    echo -e "${YELLOW}Usage:${NC}"
    echo "  $0 <version>           Run a specific version"
    echo "  $0 <version> --dev     Run in dev mode (faster, no build)"
    echo "  $0 compare <v1> <v2>   Compare two versions side by side"
    echo ""
}

check_version_exists() {
    local version="$1"
    if ! git tag -l | grep -q "^${version}$"; then
        echo -e "${RED}Error: Version '$version' not found${NC}"
        echo ""
        echo "Available versions:"
        git tag -l
        exit 1
    fi
}

setup_version() {
    local version="$1"
    local version_dir="$VERSIONS_DIR/$version"

    echo -e "${CYAN}Setting up $version...${NC}"

    # Create versions directory if needed
    mkdir -p "$VERSIONS_DIR"

    # Check if already set up
    if [ -d "$version_dir" ] && [ -f "$version_dir/.setup_complete" ]; then
        echo -e "${GREEN}Version $version already set up${NC}"
        return 0
    fi

    # Clean and create directory
    rm -rf "$version_dir"
    mkdir -p "$version_dir"

    # Clone the specific version using worktree
    echo -e "${YELLOW}Creating worktree for $version...${NC}"

    # Remove any existing worktree
    git worktree remove "$version_dir" 2>/dev/null || true

    # Add worktree at the tag
    git worktree add "$version_dir" "$version"

    # Install dependencies
    echo -e "${YELLOW}Installing dependencies...${NC}"
    cd "$version_dir"
    npm install --legacy-peer-deps 2>/dev/null || npm install

    # Mark setup complete
    touch "$version_dir/.setup_complete"

    echo -e "${GREEN}Setup complete for $version${NC}"
    cd "$PROJECT_ROOT"
}

run_version() {
    local version="$1"
    local dev_mode="$2"
    local version_dir="$VERSIONS_DIR/$version"

    print_header
    check_version_exists "$version"
    setup_version "$version"

    cd "$version_dir"

    echo -e "${GREEN}Starting Opta $version...${NC}"
    echo ""

    if [ "$dev_mode" = "--dev" ]; then
        echo -e "${YELLOW}Running in dev mode (Vite only, no Tauri)${NC}"
        npm run dev
    else
        echo -e "${YELLOW}Building and running with Tauri...${NC}"
        npm run tauri dev
    fi
}

compare_versions() {
    local v1="$1"
    local v2="$2"

    print_header
    echo -e "${CYAN}Comparing $v1 and $v2 side by side${NC}"
    echo ""

    check_version_exists "$v1"
    check_version_exists "$v2"

    setup_version "$v1"
    setup_version "$v2"

    # Run both in dev mode (web only) on different ports
    local v1_dir="$VERSIONS_DIR/$v1"
    local v2_dir="$VERSIONS_DIR/$v2"

    # Kill any existing vite processes on these ports
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    lsof -ti:5174 | xargs kill -9 2>/dev/null || true
    sleep 1

    echo -e "${YELLOW}Starting $v1 on port 5173...${NC}"
    cd "$v1_dir"
    npx vite --port 5173 > /tmp/opta-v1.log 2>&1 &
    local pid1=$!

    sleep 2

    echo -e "${YELLOW}Starting $v2 on port 5174...${NC}"
    cd "$v2_dir"
    npx vite --port 5174 > /tmp/opta-v2.log 2>&1 &
    local pid2=$!

    sleep 3

    # Check if servers started
    if ! kill -0 $pid1 2>/dev/null; then
        echo -e "${RED}Failed to start $v1. Check /tmp/opta-v1.log${NC}"
        cat /tmp/opta-v1.log
        return 1
    fi

    if ! kill -0 $pid2 2>/dev/null; then
        echo -e "${RED}Failed to start $v2. Check /tmp/opta-v2.log${NC}"
        cat /tmp/opta-v2.log
        return 1
    fi

    echo ""
    echo -e "${GREEN}Both versions running:${NC}"
    echo -e "  $v1: ${CYAN}http://localhost:5173${NC}  (PID: $pid1)"
    echo -e "  $v2: ${CYAN}http://localhost:5174${NC}  (PID: $pid2)"
    echo ""

    # Open in browser
    if command -v open &> /dev/null; then
        open "http://localhost:5173"
        open "http://localhost:5174"
    fi

    echo -e "${YELLOW}Servers running in background. To stop:${NC}"
    echo -e "  kill $pid1 $pid2"
    echo -e "  # or: npm run version:cleanup"
    echo ""

    # Save PIDs for cleanup
    echo "$pid1" > /tmp/opta-compare-pids
    echo "$pid2" >> /tmp/opta-compare-pids
}

cleanup_versions() {
    print_header
    echo -e "${YELLOW}Cleaning up...${NC}"

    # Stop any running comparison servers
    if [ -f /tmp/opta-compare-pids ]; then
        echo -e "  Stopping comparison servers..."
        while read pid; do
            kill $pid 2>/dev/null && echo -e "    Stopped PID $pid"
        done < /tmp/opta-compare-pids
        rm /tmp/opta-compare-pids
    fi

    # Kill any vite processes on comparison ports
    lsof -ti:5173 | xargs kill -9 2>/dev/null && echo -e "  Stopped server on port 5173" || true
    lsof -ti:5174 | xargs kill -9 2>/dev/null && echo -e "  Stopped server on port 5174" || true

    echo -e "${YELLOW}Cleaning up version worktrees...${NC}"

    if [ -d "$VERSIONS_DIR" ]; then
        for dir in "$VERSIONS_DIR"/v*; do
            if [ -d "$dir" ]; then
                version=$(basename "$dir")
                echo -e "  Removing $version..."
                git worktree remove "$dir" 2>/dev/null || rm -rf "$dir"
            fi
        done
        rmdir "$VERSIONS_DIR" 2>/dev/null || true
    fi

    echo -e "${GREEN}Cleanup complete${NC}"
}

# Main
case "$1" in
    "list"|"")
        list_versions
        ;;
    "compare")
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo -e "${RED}Usage: $0 compare <version1> <version2>${NC}"
            exit 1
        fi
        compare_versions "$2" "$3"
        ;;
    "cleanup")
        cleanup_versions
        ;;
    v*)
        run_version "$1" "$2"
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        list_versions
        exit 1
        ;;
esac
