#!/usr/bin/env bash
# Populate the Opta-LMX compatibility registry by probing model backends.
#
# Usage:
#   ./scripts/populate-compatibility-registry.sh <model_id> [model_id ...]
#   ./scripts/populate-compatibility-registry.sh --all
#   ./scripts/populate-compatibility-registry.sh --file models.txt
#
# This script probes each model against all available backends (MLX-LM, llama.cpp,
# etc.) to determine compatibility. Results are stored in the LMX compatibility
# registry and exported to benchmarks/compatibility-registry.json.
#
# Prerequisites:
#   - Opta LMX running on the target host (default: 192.168.188.11:1234)
#   - LMX_ADMIN_KEY set in environment or ~/.opta-lmx/admin.key
#
# Examples:
#   # Probe specific models
#   ./scripts/populate-compatibility-registry.sh \
#       mlx-community/Qwen2.5-72B-4bit \
#       inferencerlabs/MiniMax-M2.5-MLX-6.5bit
#
#   # Probe all models known to the manager
#   ./scripts/populate-compatibility-registry.sh --all
#
#   # Probe models from a file (one model_id per line)
#   echo "mlx-community/Kimi-K2.5-3bit" > models.txt
#   ./scripts/populate-compatibility-registry.sh --file models.txt

set -euo pipefail

# ---- Configuration ----
LMX_HOST="${LMX_HOST:-192.168.188.11}"
LMX_PORT="${LMX_PORT:-1234}"
BASE_URL="http://${LMX_HOST}:${LMX_PORT}"
PROBE_TIMEOUT="${PROBE_TIMEOUT:-90}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BENCHMARKS_DIR="${PROJECT_DIR}/benchmarks"
OUTPUT_FILE="${BENCHMARKS_DIR}/compatibility-registry.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# ---- Usage / help ----
usage() {
    echo "Usage: $0 [OPTIONS] <model_id> [model_id ...]"
    echo ""
    echo "Probe models against LMX backends and populate the compatibility registry."
    echo ""
    echo "Options:"
    echo "  --all             Probe all models available in the model manager"
    echo "  --file FILE       Read model IDs from a file (one per line)"
    echo "  --timeout SECS    Probe timeout per model (default: ${PROBE_TIMEOUT}s)"
    echo "  --allow-unsupported  Include otherwise-blocked backends in probing"
    echo "  --summary         Include per-model summary in output"
    echo "  -h, --help        Show this help"
    echo ""
    echo "Environment:"
    echo "  LMX_HOST          LMX server hostname (default: 192.168.188.11)"
    echo "  LMX_PORT          LMX server port (default: 1234)"
    echo "  LMX_ADMIN_KEY     Admin authentication key"
    echo "  PROBE_TIMEOUT     Per-model probe timeout in seconds (default: 90)"
}

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
        --max-time "$((PROBE_TIMEOUT + 10))" \
        -d "$body" \
        "${BASE_URL}${path}"
}

# ---- Parse arguments ----
MODEL_IDS=()
PROBE_ALL=false
MODEL_FILE=""
ALLOW_UNSUPPORTED=false
INCLUDE_SUMMARY=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --all)
            PROBE_ALL=true; shift ;;
        --file)
            MODEL_FILE="$2"; shift 2 ;;
        --timeout)
            PROBE_TIMEOUT="$2"; shift 2 ;;
        --allow-unsupported)
            ALLOW_UNSUPPORTED=true; shift ;;
        --summary)
            INCLUDE_SUMMARY=true; shift ;;
        -h|--help)
            usage; exit 0 ;;
        -*)
            echo -e "${RED}Unknown option: $1${NC}"; usage; exit 1 ;;
        *)
            MODEL_IDS+=("$1"); shift ;;
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

# Validate we have some models to probe
if [[ "$PROBE_ALL" == "false" && ${#MODEL_IDS[@]} -eq 0 && -z "$MODEL_FILE" ]]; then
    echo -e "${RED}Error: Specify model IDs, --all, or --file.${NC}"
    usage
    exit 1
fi

# ---- Step 1: Check LMX is reachable ----
echo -e "${PURPLE}=== Opta-LMX Compatibility Registry Population ===${NC}"
echo -e "Target: ${BLUE}${BASE_URL}${NC}"
echo ""

echo -n "Checking LMX health... "
if ! curl -sf --connect-timeout 5 "${BASE_URL}/healthz" >/dev/null 2>&1; then
    echo -e "${RED}FAILED${NC}"
    echo -e "${RED}Error: LMX server not reachable at ${BASE_URL}${NC}"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# ---- Step 2: Build model list ----
if [[ "$PROBE_ALL" == "true" ]]; then
    echo -n "Fetching all available models... "
    AVAILABLE=$(api_get "/admin/models/available" 2>/dev/null || echo '{"models":[]}')
    ALL_MODEL_IDS=$(echo "$AVAILABLE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
models = data if isinstance(data, list) else data.get('models', data.get('data', []))
for m in models:
    mid = m.get('id', m.get('model_id', ''))
    if mid:
        print(mid)
" 2>/dev/null || true)

    if [[ -z "$ALL_MODEL_IDS" ]]; then
        # Fallback: try /v1/models (loaded models only)
        MODELS_JSON=$(api_get "/v1/models" 2>/dev/null || echo '{"data":[]}')
        ALL_MODEL_IDS=$(echo "$MODELS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for m in data.get('data', []):
    print(m['id'])
" 2>/dev/null || true)
    fi

    while IFS= read -r line; do
        [[ -n "$line" ]] && MODEL_IDS+=("$line")
    done <<< "$ALL_MODEL_IDS"
    echo -e "${GREEN}${#MODEL_IDS[@]} model(s)${NC}"
fi

if [[ -n "$MODEL_FILE" ]]; then
    if [[ ! -f "$MODEL_FILE" ]]; then
        echo -e "${RED}Error: Model file not found: ${MODEL_FILE}${NC}"
        exit 1
    fi
    while IFS= read -r line; do
        # Skip comments and blank lines
        line=$(echo "$line" | sed 's/#.*//' | xargs)
        [[ -n "$line" ]] && MODEL_IDS+=("$line")
    done < "$MODEL_FILE"
    echo "Loaded ${#MODEL_IDS[@]} model(s) from ${MODEL_FILE}"
fi

if [[ ${#MODEL_IDS[@]} -eq 0 ]]; then
    echo -e "${YELLOW}No models to probe.${NC}"
    exit 0
fi

echo ""
echo "Models to probe (${#MODEL_IDS[@]}):"
for mid in "${MODEL_IDS[@]}"; do
    echo "  - $mid"
done
echo ""

# ---- Step 3: Probe each model ----
PROBE_OK=0
PROBE_FAIL=0
PROBE_RESULTS=()

for mid in "${MODEL_IDS[@]}"; do
    echo -e "${BLUE}Probing: ${mid}${NC}"
    echo -n "  "

    BODY=$(cat <<ENDJSON
{
    "model_id": "${mid}",
    "timeout_sec": ${PROBE_TIMEOUT},
    "allow_unsupported_runtime": ${ALLOW_UNSUPPORTED}
}
ENDJSON
)

    RESULT=$(api_post "/admin/models/probe" "$BODY" 2>&1)
    EXIT_CODE=$?

    if [[ $EXIT_CODE -ne 0 ]]; then
        echo -e "${RED}FAILED${NC} (connection error)"
        PROBE_FAIL=$((PROBE_FAIL + 1))
        continue
    fi

    # Parse probe result
    RECOMMENDED=$(echo "$RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
rec = data.get('recommended_backend', 'none')
candidates = data.get('candidates', [])
parts = []
for c in candidates:
    status = 'OK' if c.get('compatible') else 'FAIL'
    parts.append(f\"{c.get('backend','?')}: {status}\")
print(f\"recommended={rec} | {', '.join(parts) if parts else 'no candidates'}\")
" 2>/dev/null || echo "parse error")

    # Check if any candidate is compatible
    HAS_COMPATIBLE=$(echo "$RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
has = any(c.get('compatible') for c in data.get('candidates', []))
print('yes' if has else 'no')
" 2>/dev/null || echo "no")

    if [[ "$HAS_COMPATIBLE" == "yes" ]]; then
        echo -e "${GREEN}${RECOMMENDED}${NC}"
        PROBE_OK=$((PROBE_OK + 1))
    else
        echo -e "${YELLOW}${RECOMMENDED}${NC}"
        PROBE_FAIL=$((PROBE_FAIL + 1))
    fi
done

echo ""
echo -e "Probing complete: ${GREEN}${PROBE_OK} compatible${NC}, ${YELLOW}${PROBE_FAIL} failed/incompatible${NC}"
echo ""

# ---- Step 4: Dump the full compatibility registry ----
echo -n "Fetching compatibility registry... "
mkdir -p "$BENCHMARKS_DIR"

COMPAT_URL="/admin/models/compatibility?limit=2000"
if [[ "$INCLUDE_SUMMARY" == "true" ]]; then
    COMPAT_URL="${COMPAT_URL}&include_summary=true"
fi

REGISTRY=$(api_get "$COMPAT_URL" 2>/dev/null || echo '{"total": 0, "rows": []}')
TOTAL=$(echo "$REGISTRY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total', 0))" 2>/dev/null || echo "0")
echo -e "${GREEN}${TOTAL} record(s)${NC}"

# Save registry with pretty-print
echo "$REGISTRY" | python3 -m json.tool > "$OUTPUT_FILE" 2>/dev/null || echo "$REGISTRY" > "$OUTPUT_FILE"
echo "Registry saved to: ${OUTPUT_FILE}"

echo ""
echo -e "${GREEN}=== Compatibility Registry Population Complete ===${NC}"
echo "  Records: ${TOTAL}"
echo "  Output:  ${OUTPUT_FILE}"
echo ""

# Print summary table if available
if [[ "$INCLUDE_SUMMARY" == "true" ]]; then
    echo "Summary by model:"
    echo "$REGISTRY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
summary = data.get('summary', {})
if not summary:
    print('  (no summary available)')
    sys.exit(0)
for model_id, info in sorted(summary.items()):
    backends = info if isinstance(info, dict) else {}
    parts = []
    for backend, status in sorted(backends.items()):
        parts.append(f'{backend}={status}')
    print(f'  {model_id}: {\" | \".join(parts)}')
" 2>/dev/null || echo "  (summary parse failed)"
fi
