#!/usr/bin/env bash
# Run full benchmark suite on Mono512 Mac Studio.
#
# Usage:
#   ./scripts/run-benchmarks-mono512.sh                     # Benchmark all loaded models
#   ./scripts/run-benchmarks-mono512.sh <model_id>          # Benchmark a specific model
#   ./scripts/run-benchmarks-mono512.sh --runs 10           # Override run count
#   LMX_HOST=127.0.0.1 ./scripts/run-benchmarks-mono512.sh # Local testing
#
# Prerequisites:
#   - Opta LMX running on the target host (default: 192.168.188.11:1234)
#   - LMX_ADMIN_KEY set in environment or ~/.opta-lmx/admin.key
#   - Python 3 with pyyaml (for report generation)
#
# Output:
#   - JSON results saved to benchmarks/ directory with timestamp
#   - HTML report generated and auto-opened

set -euo pipefail

# ---- Configuration ----
LMX_HOST="${LMX_HOST:-192.168.188.11}"
LMX_PORT="${LMX_PORT:-1234}"
BASE_URL="http://${LMX_HOST}:${LMX_PORT}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BENCHMARKS_DIR="${PROJECT_DIR}/benchmarks"
VENV_PYTHON="${PROJECT_DIR}/.venv/bin/python"
REPORT_SCRIPT="${SCRIPT_DIR}/benchmark-report.py"

# Default benchmark parameters
RUNS="${BENCHMARK_RUNS:-5}"
WARMUP="${BENCHMARK_WARMUP:-1}"
MAX_TOKENS="${BENCHMARK_MAX_TOKENS:-200}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No color

# ---- Usage / help ----
usage() {
    echo "Usage: $0 [OPTIONS] [model_id]"
    echo ""
    echo "Run the Opta-LMX benchmark suite on Mono512 Mac Studio."
    echo ""
    echo "Options:"
    echo "  --runs N        Number of benchmark runs per model (default: $RUNS)"
    echo "  --warmup N      Number of warmup runs to discard (default: $WARMUP)"
    echo "  --max-tokens N  Maximum output tokens per run (default: $MAX_TOKENS)"
    echo "  --no-report     Skip HTML report generation"
    echo "  --no-open       Generate report but don't open in browser"
    echo "  -h, --help      Show this help"
    echo ""
    echo "Environment:"
    echo "  LMX_HOST        LMX server hostname (default: 192.168.188.11)"
    echo "  LMX_PORT        LMX server port (default: 1234)"
    echo "  LMX_ADMIN_KEY   Admin authentication key"
    echo ""
    echo "Examples:"
    echo "  $0                                         # All loaded models"
    echo "  $0 mlx-community/Qwen2.5-72B-4bit         # Specific model"
    echo "  $0 --runs 10 --warmup 2                    # Custom parameters"
}

# ---- Parse arguments ----
MODEL_ID=""
NO_REPORT=false
NO_OPEN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --runs)
            RUNS="$2"; shift 2 ;;
        --warmup)
            WARMUP="$2"; shift 2 ;;
        --max-tokens)
            MAX_TOKENS="$2"; shift 2 ;;
        --no-report)
            NO_REPORT=true; shift ;;
        --no-open)
            NO_OPEN=true; shift ;;
        -h|--help)
            usage; exit 0 ;;
        -*)
            echo -e "${RED}Unknown option: $1${NC}"; usage; exit 1 ;;
        *)
            MODEL_ID="$1"; shift ;;
    esac
done

# ---- Resolve admin key (after arg parsing so --help works) ----
if [[ -z "${LMX_ADMIN_KEY:-}" ]]; then
    KEY_FILE="${HOME}/.opta-lmx/admin.key"
    if [[ -f "$KEY_FILE" ]]; then
        LMX_ADMIN_KEY="$(cat "$KEY_FILE" | tr -d '[:space:]')"
    else
        echo -e "${RED}Error: LMX_ADMIN_KEY not set and ${KEY_FILE} not found.${NC}"
        echo "Set the admin key via: export LMX_ADMIN_KEY=<key>"
        exit 1
    fi
fi

# ---- Helper functions ----
api_get() {
    local path="$1"
    curl -sf -H "X-Admin-Key: ${LMX_ADMIN_KEY}" "${BASE_URL}${path}"
}

api_post() {
    local path="$1"
    local body="$2"
    curl -sf -X POST \
        -H "Content-Type: application/json" \
        -H "X-Admin-Key: ${LMX_ADMIN_KEY}" \
        -d "$body" \
        "${BASE_URL}${path}"
}

timestamp() {
    date -u +"%Y-%m-%dT%H%M%SZ"
}

slugify() {
    echo "$1" | sed 's/[^a-zA-Z0-9_-]/_/g' | cut -c1-60
}

# ---- Step 1: Check LMX is reachable ----
echo -e "${PURPLE}=== Opta-LMX Benchmark Runner ===${NC}"
echo -e "Target: ${BLUE}${BASE_URL}${NC}"
echo ""

echo -n "Checking LMX health... "
if ! HEALTH=$(curl -sf --connect-timeout 5 "${BASE_URL}/healthz" 2>/dev/null); then
    echo -e "${RED}FAILED${NC}"
    echo -e "${RED}Error: LMX server not reachable at ${BASE_URL}${NC}"
    echo "Is Opta-LMX running? Check: ssh mono512 'curl localhost:1234/healthz'"
    exit 1
fi

VERSION=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('version','unknown'))" 2>/dev/null || echo "unknown")
echo -e "${GREEN}OK${NC} (v${VERSION})"

# ---- Step 2: List available models ----
echo -n "Fetching loaded models... "
MODELS_JSON=$(api_get "/v1/models")
MODEL_IDS=$(echo "$MODELS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
models = data.get('data', [])
for m in models:
    print(m['id'])
" 2>/dev/null)

MODEL_COUNT=$(echo "$MODEL_IDS" | grep -c . || true)
echo -e "${GREEN}${MODEL_COUNT} model(s) loaded${NC}"

if [[ "$MODEL_COUNT" -eq 0 ]]; then
    echo -e "${YELLOW}Warning: No models loaded. Load a model first:${NC}"
    echo "  curl -X POST ${BASE_URL}/admin/models/load -H 'X-Admin-Key: ...' -d '{\"model_id\": \"...\"}'"
    exit 1
fi

echo "$MODEL_IDS" | while read -r mid; do
    echo "  - $mid"
done
echo ""

# ---- Step 3: Determine which models to benchmark ----
if [[ -n "$MODEL_ID" ]]; then
    # Validate specified model is loaded
    if ! echo "$MODEL_IDS" | grep -qF "$MODEL_ID"; then
        echo -e "${RED}Error: Model '${MODEL_ID}' is not loaded.${NC}"
        echo "Loaded models:"
        echo "$MODEL_IDS" | while read -r mid; do echo "  - $mid"; done
        exit 1
    fi
    TARGET_MODELS="$MODEL_ID"
else
    TARGET_MODELS="$MODEL_IDS"
fi

# ---- Step 4: Run benchmarks ----
mkdir -p "$BENCHMARKS_DIR"
TS=$(timestamp)
RESULTS_FILES=()

echo "$TARGET_MODELS" | while read -r mid; do
    [[ -z "$mid" ]] && continue
    SLUG=$(slugify "$mid")
    OUTFILE="${BENCHMARKS_DIR}/${SLUG}_${TS}.json"

    echo -e "${BLUE}Benchmarking: ${mid}${NC}"
    echo "  Runs: ${RUNS} (+ ${WARMUP} warmup), Max tokens: ${MAX_TOKENS}"
    echo -n "  Running... "

    BODY=$(cat <<ENDJSON
{
    "model_id": "${mid}",
    "runs": ${RUNS},
    "warmup_runs": ${WARMUP},
    "num_output_tokens": ${MAX_TOKENS},
    "temperature": 0.0
}
ENDJSON
)

    RESULT=$(api_post "/admin/benchmark/run" "$BODY" 2>&1) || {
        echo -e "${RED}FAILED${NC}"
        echo "  Error: $RESULT"
        continue
    }

    # Save result
    echo "$RESULT" | python3 -m json.tool > "$OUTFILE" 2>/dev/null || echo "$RESULT" > "$OUTFILE"

    # Extract summary metrics
    TPS=$(echo "$RESULT" | python3 -c "import sys,json; s=json.load(sys.stdin)['stats']; print(f\"{s['toks_per_sec_mean']:.1f}\")" 2>/dev/null || echo "?")
    TTFT=$(echo "$RESULT" | python3 -c "import sys,json; s=json.load(sys.stdin)['stats']; print(f\"{s['ttft_mean_sec']*1000:.0f}\")" 2>/dev/null || echo "?")
    STATUS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null || echo "?")

    echo -e "${GREEN}DONE${NC}"
    echo "  tok/s: ${TPS} | TTFT: ${TTFT}ms | Status: ${STATUS}"
    echo "  Saved: ${OUTFILE}"
    echo ""
done

# ---- Step 5: Collect results from API ----
echo -n "Collecting all stored results from LMX... "
ALL_RESULTS=$(api_get "/admin/benchmark/results" 2>/dev/null || echo "[]")
RESULT_COUNT=$(echo "$ALL_RESULTS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
echo -e "${GREEN}${RESULT_COUNT} result(s)${NC}"

# Save combined results
COMBINED_FILE="${BENCHMARKS_DIR}/combined_${TS}.json"
echo "$ALL_RESULTS" | python3 -m json.tool > "$COMBINED_FILE" 2>/dev/null || echo "$ALL_RESULTS" > "$COMBINED_FILE"
echo "Combined results saved to: ${COMBINED_FILE}"
echo ""

# ---- Step 6: Generate HTML report ----
if [[ "$NO_REPORT" == "true" ]]; then
    echo "Skipping report generation (--no-report)."
    exit 0
fi

echo -e "${BLUE}Generating benchmark report...${NC}"
REPORT_FILE="/tmp/opta-lmx-benchmark-${TS}.html"

REPORT_ARGS=(
    "--results-dir" "$BENCHMARKS_DIR"
    "--output" "$REPORT_FILE"
)

if [[ "$NO_OPEN" == "true" ]]; then
    REPORT_ARGS+=("--no-open")
fi

if [[ -x "$VENV_PYTHON" ]]; then
    "$VENV_PYTHON" "$REPORT_SCRIPT" "${REPORT_ARGS[@]}"
elif command -v python3 &>/dev/null; then
    python3 "$REPORT_SCRIPT" "${REPORT_ARGS[@]}"
else
    echo -e "${RED}Error: No Python available for report generation.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Benchmark Complete ===${NC}"
echo "Results: ${BENCHMARKS_DIR}/"
echo "Report:  ${REPORT_FILE}"
