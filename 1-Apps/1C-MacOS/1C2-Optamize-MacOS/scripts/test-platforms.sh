#!/bin/bash
# Opta Cross-Platform Testing Script
# Tests all core functionality on macOS and Linux

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Set up Python path for MCP module imports
export PYTHONPATH="$PROJECT_ROOT/mcp-server/src:$PYTHONPATH"

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

# Detect platform
OS=$(uname -s)
echo -e "${BLUE}=== Opta Platform Testing ===${NC}"
echo -e "Platform: ${YELLOW}${OS}${NC}"
echo ""

# Test function
run_test() {
    local test_name="$1"
    local test_cmd="$2"

    echo -n "Testing: $test_name... "

    if eval "$test_cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test function with output
run_test_verbose() {
    local test_name="$1"
    local test_cmd="$2"

    echo -e "${BLUE}Testing: $test_name${NC}"

    if output=$(eval "$test_cmd" 2>&1); then
        echo -e "${GREEN}PASS${NC}"
        echo "$output" | head -5
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        echo "$output"
        ((TESTS_FAILED++))
        return 1
    fi
    echo ""
}

echo -e "${BLUE}=== 1. MCP Server Tests ===${NC}"
cd "$PROJECT_ROOT/mcp-server"

# Test hardware telemetry - CPU
run_test_verbose "CPU telemetry" \
    "uv run python -c 'from opta_mcp.telemetry import get_cpu_info; import json; print(json.dumps(get_cpu_info(), indent=2))'"

# Test hardware telemetry - Memory
run_test_verbose "Memory telemetry" \
    "uv run python -c 'from opta_mcp.telemetry import get_memory_info; import json; print(json.dumps(get_memory_info(), indent=2))'"

# Test hardware telemetry - Disk
run_test_verbose "Disk telemetry" \
    "uv run python -c 'from opta_mcp.telemetry import get_disk_info; import json; print(json.dumps(get_disk_info(), indent=2))'"

# Test hardware telemetry - GPU (may return not available)
run_test_verbose "GPU telemetry (platform-dependent)" \
    "uv run python -c 'from opta_mcp.telemetry import get_gpu_info; import json; print(json.dumps(get_gpu_info(), indent=2))'"

# Test system snapshot
run_test_verbose "System snapshot" \
    "uv run python -c 'from opta_mcp.telemetry import get_system_snapshot; import json; r = get_system_snapshot(); print(f\"CPU: {r[\"cpu\"][\"percent\"]}%, Memory: {r[\"memory\"][\"percent\"]}%\")'"

echo ""
echo -e "${BLUE}=== 2. Process Management Tests ===${NC}"

# Test process listing
run_test_verbose "Process listing" \
    "uv run python -c 'from opta_mcp.processes import get_process_list; procs = get_process_list(); print(f\"Found {len(procs)} processes\")'"

# Test process categorization
run_test_verbose "Process categorization" \
    "uv run python -c '
from opta_mcp.processes import get_process_list
procs = get_process_list()
categories = {}
for p in procs:
    cat = p.get(\"category\", \"unknown\")
    categories[cat] = categories.get(cat, 0) + 1
print(f\"Categories: {categories}\")
'"

echo ""
echo -e "${BLUE}=== 3. Conflict Detection Tests ===${NC}"

# Test conflict detection
run_test_verbose "Conflict detection" \
    "uv run python -c 'from opta_mcp.conflicts import get_conflict_summary; import json; r = get_conflict_summary(); print(f\"Found {r[\"total_count\"]} conflicts\")'"

echo ""
echo -e "${BLUE}=== 4. Game Detection Tests ===${NC}"

# Test game detection
run_test_verbose "Game detection" \
    "uv run python -c '
from opta_mcp.games import detect_all_games
import json
result = detect_all_games()
print(f\"Total games: {result[\"total_games\"]}\")
for launcher in result[\"launchers\"]:
    status = \"installed\" if launcher[\"installed\"] else \"not found\"
    print(f\"  {launcher[\"name\"]}: {launcher[\"game_count\"]} games ({status})\")
'"

echo ""
echo -e "${BLUE}=== 5. LLM Connectivity Tests ===${NC}"

# Test Ollama status (may not be running)
run_test_verbose "Local LLM (Ollama) status" \
    "uv run python -c '
from opta_mcp.llm import check_ollama_status
import json
status = check_ollama_status()
print(f\"Ollama available: {status.get(\"available\", False)}\")
if status.get(\"available\"):
    print(f\"Models: {status.get(\"models\", [])}\")
'"

echo ""
echo -e "${BLUE}=== 6. Frontend Build Test ===${NC}"
cd "$PROJECT_ROOT"

# Test frontend build
run_test "Frontend build (npm run build)" \
    "npm run build"

echo ""
echo -e "${BLUE}=== 7. Platform-Specific Path Tests ===${NC}"
cd "$PROJECT_ROOT/mcp-server"

# Test platform paths are correct
run_test_verbose "Platform detection" \
    "uv run python -c '
from opta_mcp.games import get_platform, LAUNCHERS
import platform

plat = get_platform()
print(f\"Detected platform: {plat}\")
print(f\"Python platform.system(): {platform.system()}\")

# Verify paths are correct for this platform
for launcher_id, launcher in LAUNCHERS.items():
    paths = launcher.get(\"paths\", {}).get(plat, [])
    print(f\"  {launcher[\"name\"]} paths: {len(paths)} configured\")
'"

echo ""
echo -e "${BLUE}=== 8. Scoring System Tests ===${NC}"

# Test scoring module
run_test_verbose "Scoring system" \
    "uv run python -c '
from opta_mcp.scoring import get_hardware_tier
import json
tier = get_hardware_tier()
print(f\"Hardware tier: {tier.get(\"tier\", \"unknown\")}\")
print(f\"Price range: {tier.get(\"price_range\", \"unknown\")}\")
'"

echo ""
echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}=== Test Summary ===${NC}"
echo -e "${BLUE}==================================================${NC}"
echo -e "Platform: ${YELLOW}${OS}${NC}"
echo -e "Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Failed: ${RED}${TESTS_FAILED}${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Review output above.${NC}"
    exit 1
fi
