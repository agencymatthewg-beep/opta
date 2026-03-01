# Opta LMX Day-2 Operations Runbook

Updated: 2026-02-27

**Target host:** Mono512 Mac Studio M3 Ultra (192.168.188.11, 512GB unified memory)
**Service port:** 1234
**Base URL:** `http://192.168.188.11:1234`

### Opta48 policy (critical)
- Do not run `python -m opta_lmx` on Opta48 (MacBook).
- Do not store models on Opta48.
- Opta48 is client/orchestrator only; Mono512 is the inference host.

---

## Table of Contents

1. [Service Management](#1-service-management)
2. [Common Operations](#2-common-operations)
3. [Troubleshooting Playbook](#3-troubleshooting-playbook)
4. [Monitoring and Alerting](#4-monitoring-and-alerting)
5. [Emergency Procedures](#5-emergency-procedures)

---

## 1. Service Management

### 1.1 Configuration Files

| File | Purpose |
|------|---------|
| `~/.opta-lmx/config.yaml` | Primary config (searched first) |
| `<repo>/config/default-config.yaml` | Fallback defaults (searched second) |
| `~/.opta-lmx/runtime-state.json` | Persisted loaded-models state, crash loop detection |
| `~/.opta-lmx/compatibility-registry.json` | Model/backend pass/fail ledger (max 2000 rows) |
| `~/.opta-lmx/presets/*.yaml` | Model preset files (performance, aliases, system prompts) |
| `~/.opta-lmx/rag-store.json` | RAG vector store persistence |
| `~/.opta-lmx/session-logs/` | Runtime journal session logs (when journaling is enabled) |
| `~/.opta-lmx/update-logs/` | Numbered update logs (when journaling is enabled) |

### 1.2 Environment Variable Overrides

All config values can be overridden with `LMX_` prefixed environment variables. Use `__` as a nested delimiter.

```bash
# Examples
LMX_SERVER__PORT=8080                    # server.port = 8080
LMX_SERVER__HOST=0.0.0.0                 # server.host = 0.0.0.0
LMX_MEMORY__MAX_MEMORY_PERCENT=85        # memory.max_memory_percent = 85
LMX_MEMORY__LOAD_SHEDDING_PERCENT=92     # memory.load_shedding_percent = 92
LMX_MODELS__MAX_CONCURRENT_REQUESTS=8    # models.max_concurrent_requests = 8
LMX_LOGGING__LEVEL=DEBUG                 # logging.level = DEBUG
LMX_SECURITY__ADMIN_KEY=my-secret-key    # security.admin_key = my-secret-key
LMX_SECURITY__PROFILE=cloud              # security.profile = cloud (requires auth)
```

### 1.3 Starting the Service

#### Via launchd (production daemon)

```bash
# Install plist
sudo cp docs/launchd/com.opta.lmx.plist /Library/LaunchDaemons/

# Start
launchctl load /Library/LaunchDaemons/com.opta.lmx.plist

# Stop
launchctl unload /Library/LaunchDaemons/com.opta.lmx.plist

# Check if running
launchctl list | grep opta.lmx
```

#### Via CLI entry point (development/debugging on Mono512 host)

```bash
cd ~/Synced/Opta/1-Apps/optalocal/1M-Opta-LMX

# Default: binds to 127.0.0.1:1234
python -m opta_lmx

# With overrides
python -m opta_lmx --host 0.0.0.0 --port 1234 --log-level DEBUG

# Custom config file
python -m opta_lmx --config /path/to/custom-config.yaml
```

#### Via uvicorn directly (maximum control on Mono512 host)

```bash
cd ~/Synced/Opta/1-Apps/optalocal/1M-Opta-LMX

# Standard
uvicorn src.opta_lmx.main:app --host 0.0.0.0 --port 1234

# Debug with verbose logging
LOGLEVEL=DEBUG uvicorn src.opta_lmx.main:app \
  --host 0.0.0.0 --port 1234 --log-level debug

# Safe mode (skip auto-load by setting empty auto_load)
LMX_MODELS__AUTO_LOAD='[]' python -m opta_lmx
```

### 1.4 Stopping the Service

A clean shutdown does the following in order:
1. Cancels all background tasks (Metal cache maintenance, TTL eviction, prefetch, etc.)
2. Stops the agents runtime and skill dispatchers
3. Closes helper node clients
4. Persists the RAG store
5. Drains in-flight requests (30 second timeout)
6. Cancels active downloads
7. Unloads all models
8. Writes `last_clean_shutdown: true` to `runtime-state.json` (resets crash loop counter)

```bash
# Graceful: send SIGTERM
kill -TERM $(pgrep -f "opta_lmx")

# Verify clean shutdown marker
cat ~/.opta-lmx/runtime-state.json | python3 -m json.tool
# Expect: "last_clean_shutdown": true, "startup_count": 0
```

### 1.5 Log Locations

| Source | Location |
|--------|----------|
| Structured logs (stdout) | Console or launchd journal |
| Log file (when configured) | Value of `logging.file` in config |
| Session logs (journaling) | `~/.opta-lmx/session-logs/*.md` |
| Update logs (journaling) | `~/.opta-lmx/update-logs/*.md` |
| Runtime state | `~/.opta-lmx/runtime-state.json` |

```bash
# Tail launchd logs on macOS
log stream --level debug --predicate 'process == "opta-lmx"'

# If running in foreground, logs go to stderr (structured JSON or text based on config)
```

### 1.6 Health Check URLs

```bash
# Liveness probe (unauthenticated, always 200 if process is alive)
curl http://192.168.188.11:1234/healthz
# {"status": "ok", "version": "..."}

# Readiness probe (unauthenticated, 200 when models loaded, 503 during startup)
curl http://192.168.188.11:1234/readyz
# {"status": "ready", "version": "...", "models_loaded": 2}

# Detailed health (admin auth required if admin_key is set)
curl http://192.168.188.11:1234/admin/health \
  -H "X-Admin-Key: $ADMIN_KEY"
# Returns: status (ok/degraded), memory_usage_percent, metal info, helper node health

# Discovery contract (unauthenticated): preferred base URL + auth requirements
curl http://192.168.188.11:1234/v1/discovery

# Well-known discovery alias for auto-pairing clients
curl http://192.168.188.11:1234/.well-known/opta-lmx
```

---

## 2. Common Operations

**Note on authentication:** All `/admin/*` endpoints require the `X-Admin-Key` header if `security.admin_key` is set in config. In LAN mode with no admin_key configured, the header is not required. All `/v1/*` inference endpoints require `Authorization: Bearer <key>` or `X-Api-Key` if `security.inference_api_key` is set.

The examples below include `$ADMIN_KEY` -- omit the `-H "X-Admin-Key: ..."` header if running in unauthenticated LAN mode.

### 2.1 List Loaded Models

```bash
# OpenAI-compatible (inference auth)
curl http://192.168.188.11:1234/v1/models
# {"object": "list", "data": [{"id": "mlx-community/...", "object": "model", ...}]}

# Admin detailed view (with memory, readiness, request counts)
curl http://192.168.188.11:1234/admin/models \
  -H "X-Admin-Key: $ADMIN_KEY"
# {"loaded": [...], "count": 2}
```

### 2.2 Load a Model

```bash
# Load a model already on disk
curl -X POST http://192.168.188.11:1234/admin/models/load \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{
    "model_id": "mlx-community/Qwen2.5-Coder-32B-Instruct-8bit"
  }'

# Load with auto-download if not on disk
curl -X POST http://192.168.188.11:1234/admin/models/load \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{
    "model_id": "mlx-community/Qwen2.5-Coder-32B-Instruct-8bit",
    "auto_download": true
  }'

# Load with performance overrides
curl -X POST http://192.168.188.11:1234/admin/models/load \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{
    "model_id": "mlx-community/Qwen2.5-Coder-32B-Instruct-8bit",
    "performance_overrides": {
      "max_tokens": 4096,
      "temperature": 0.7
    }
  }'

# Force load a quarantined model (use with caution)
curl -X POST http://192.168.188.11:1234/admin/models/load \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{
    "model_id": "some-quarantined-model",
    "allow_unsupported_runtime": true
  }'

# Load with specific backend preference
curl -X POST http://192.168.188.11:1234/admin/models/load \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{
    "model_id": "some-model.gguf",
    "backend": "gguf"
  }'
```

**Response codes:**
- `200` -- Model loaded successfully
- `202` -- Download required (returns confirmation token or download ID if `auto_download: true`)
- `409` -- Model quarantined, canary failed, load timeout, or loader crashed
- `422` -- Unsupported architecture or backend
- `507` -- Insufficient memory or disk

### 2.3 Unload a Model

```bash
curl -X POST http://192.168.188.11:1234/admin/models/unload \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "mlx-community/Qwen2.5-Coder-32B-Instruct-8bit"}'
# {"success": true, "model_id": "...", "memory_freed_gb": 17.5}
```

### 2.4 Download a New Model

```bash
# Start download (returns download_id for progress tracking)
curl -X POST http://192.168.188.11:1234/admin/models/download \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{
    "repo_id": "mlx-community/DeepSeek-V3-0324-4bit"
  }'
# {"download_id": "dl-xxx", "repo_id": "...", "status": "downloading"}

# Check download progress
curl http://192.168.188.11:1234/admin/models/download/dl-xxx/progress \
  -H "X-Admin-Key: $ADMIN_KEY"
# {"status": "downloading", "progress_percent": 45.2, ...}
```

### 2.5 List Available Models on Disk

```bash
curl http://192.168.188.11:1234/admin/models/available \
  -H "X-Admin-Key: $ADMIN_KEY"
# [{"repo_id": "...", "local_path": "...", "size_bytes": ...}, ...]
```

### 2.6 Delete a Model from Disk

```bash
# Must unload first if loaded (returns 409 if still loaded)
curl -X DELETE "http://192.168.188.11:1234/admin/models/mlx-community/some-model" \
  -H "X-Admin-Key: $ADMIN_KEY"
# {"success": true, "model_id": "...", "freed_bytes": ...}
```

### 2.7 Check Memory

```bash
curl http://192.168.188.11:1234/admin/memory \
  -H "X-Admin-Key: $ADMIN_KEY"
# {
#   "total_unified_memory_gb": 512.0,
#   "used_gb": 128.5,
#   "available_gb": 383.5,
#   "threshold_percent": 90,
#   "models": {
#     "mlx-community/Qwen2.5-72B-Instruct-4bit": {"memory_gb": 42.3, "loaded": true},
#     ...
#   }
# }
```

### 2.8 Full System Status

```bash
curl http://192.168.188.11:1234/admin/status \
  -H "X-Admin-Key: $ADMIN_KEY"
# {
#   "version": "...",
#   "uptime_seconds": 86400.5,
#   "loaded_models": 2,
#   "models": ["model-a", "model-b"],
#   "memory": {...},
#   "in_flight_requests": 1,
#   "max_concurrent_requests": 4
# }
```

### 2.9 Hot-Reload Configuration

Re-reads `~/.opta-lmx/config.yaml` and updates routing, memory thresholds, logging level, auth settings, and presets without restarting. Does NOT unload/reload models or change server bind address.

```bash
curl -X POST http://192.168.188.11:1234/admin/config/reload \
  -H "X-Admin-Key: $ADMIN_KEY"
# {"success": true, "updated": ["routing", "memory", "security", "logging", "presets"]}
```

### 2.10 Run a Benchmark

```bash
curl -X POST http://192.168.188.11:1234/admin/benchmark \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{
    "model_id": "mlx-community/Qwen2.5-Coder-32B-Instruct-8bit",
    "prompt": "Explain the concept of recursion in Python with examples.",
    "max_tokens": 256,
    "runs": 3,
    "temperature": 0.7
  }'
# Returns: avg_tokens_per_second, avg_time_to_first_token_ms, avg_total_time_ms, per-run results
```

### 2.11 Autotune a Model

Benchmarks multiple load profiles and persists the best-performing one.

```bash
curl -X POST http://192.168.188.11:1234/admin/models/autotune \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{
    "model_id": "mlx-community/Qwen2.5-Coder-32B-Instruct-8bit",
    "prompt": "Write a Python function to sort a list.",
    "max_tokens": 128,
    "runs": 3
  }'
```

### 2.12 Probe a Model (without loading)

Tests candidate backends without fully loading the model into memory.

```bash
curl -X POST http://192.168.188.11:1234/admin/models/probe \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{
    "model_id": "mlx-community/some-new-model",
    "timeout_sec": 60
  }'
```

### 2.13 Reload Presets

```bash
curl -X POST http://192.168.188.11:1234/admin/presets/reload \
  -H "X-Admin-Key: $ADMIN_KEY"
# {"success": true, "presets_loaded": 5}
```

### 2.14 View Model Stack Status

```bash
curl http://192.168.188.11:1234/admin/stack \
  -H "X-Admin-Key: $ADMIN_KEY"
# Returns: roles (routing aliases and resolved models), helper nodes, loaded models, backends
```

### 2.15 Start a Quantization Job

```bash
curl -X POST http://192.168.188.11:1234/admin/quantize \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{
    "source_model": "meta-llama/Llama-3-8B",
    "bits": 4,
    "group_size": 64
  }'
# {"job_id": "...", "status": "running", ...}

# Check progress
curl http://192.168.188.11:1234/admin/quantize/JOB_ID \
  -H "X-Admin-Key: $ADMIN_KEY"
```

### 2.16 Send an Inference Request

```bash
# Standard OpenAI-compatible chat completion
curl -X POST http://192.168.188.11:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mlx-community/Qwen2.5-Coder-32B-Instruct-8bit",
    "messages": [{"role": "user", "content": "Hello, how are you?"}],
    "temperature": 0.7,
    "max_tokens": 256
  }'

# Streaming
curl -X POST http://192.168.188.11:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mlx-community/Qwen2.5-Coder-32B-Instruct-8bit",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'

# Using a routing alias (resolves to first loaded model matching the alias)
curl -X POST http://192.168.188.11:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "code",
    "messages": [{"role": "user", "content": "Write a Python function"}]
  }'

# Using a preset
curl -X POST http://192.168.188.11:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "preset:code-assistant",
    "messages": [{"role": "user", "content": "Explain async/await"}]
  }'
```

---

## 3. Troubleshooting Playbook

### 3.1 Model Fails to Load

**Symptoms:**
- `POST /admin/models/load` returns 409, 422, or 500
- Error codes: `model_unsupported_arch`, `model_unsupported_backend`, `model_load_timeout`, `model_loader_crashed`, `model_probe_failed`, `model_canary_failed`

**Diagnosis:**

```bash
# Step 1: Check the exact error code in the response
curl -X POST http://192.168.188.11:1234/admin/models/load \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "problematic-model"}' | python3 -m json.tool

# Step 2: Check compatibility registry for this model
curl "http://192.168.188.11:1234/admin/models/compatibility?model_id=problematic-model&include_summary=true" \
  -H "X-Admin-Key: $ADMIN_KEY" | python3 -m json.tool

# Step 3: Check readiness state (if model was previously loaded)
curl http://192.168.188.11:1234/admin/models \
  -H "X-Admin-Key: $ADMIN_KEY" | python3 -m json.tool
# Look for readiness.state and readiness.reason in each model entry

# Step 4: Check memory (may be insufficient)
curl http://192.168.188.11:1234/admin/memory \
  -H "X-Admin-Key: $ADMIN_KEY"

# Step 5: Check local snapshot completeness (incomplete downloads)
curl http://192.168.188.11:1234/admin/models/available \
  -H "X-Admin-Key: $ADMIN_KEY"

# Step 6: Probe the model without loading
curl -X POST http://192.168.188.11:1234/admin/models/probe \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "problematic-model", "timeout_sec": 120}'
```

**Resolution by error code:**

| Error Code | Cause | Fix |
|-----------|-------|-----|
| `model_unsupported_arch` | MLX requires Apple Silicon (arm64) | Cannot fix -- MLX is Apple Silicon only |
| `model_unsupported_backend` | Backend cannot handle this model format | Try `"backend": "gguf"` or `"backend": "mlx"` explicitly |
| `model_load_timeout` | Child loader timed out (default 120s) | Increase `models.loader_timeout_sec` in config, check disk speed |
| `model_loader_crashed` | Child loader process died (signal/segfault) | Check for OOM, re-download model, try different quant |
| `model_probe_failed` | Probe returned invalid output | Check model file integrity, re-download |
| `model_canary_failed` | Model loaded but warmup inference failed | Model may be corrupt; re-download or try different quant level |
| `model_incomplete` | Missing required files on disk | Re-download: `POST /admin/models/load` with `auto_download: true` |

### 3.2 High Memory / Load Shedding

**Symptoms:**
- Requests return `503 Server under memory pressure` with `Retry-After: 30` header
- `/admin/health` returns `"status": "degraded"`
- Prometheus alert `OptaLMXMemoryPressure` fires

**Diagnosis:**

```bash
# Step 1: Check current memory state
curl http://192.168.188.11:1234/admin/memory \
  -H "X-Admin-Key: $ADMIN_KEY"

# Step 2: Check which models are using the most memory
curl http://192.168.188.11:1234/admin/models \
  -H "X-Admin-Key: $ADMIN_KEY" | python3 -m json.tool
# Sort by memory_gb to find largest residents

# Step 3: Check Metal GPU memory
curl http://192.168.188.11:1234/admin/health \
  -H "X-Admin-Key: $ADMIN_KEY"
# Look at "metal" section: active_memory_gb, peak_memory_gb, cache_memory_gb
```

**Resolution:**

```bash
# Option A: Unload least-used model to free memory
curl -X POST http://192.168.188.11:1234/admin/models/unload \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "least-used-model-id"}'

# Option B: Reduce load shedding threshold (temporary)
# Edit ~/.opta-lmx/config.yaml -> memory.load_shedding_percent: 97
curl -X POST http://192.168.188.11:1234/admin/config/reload \
  -H "X-Admin-Key: $ADMIN_KEY"

# Option C: Enable TTL eviction for idle models
# Edit config: memory.ttl_enabled: true, memory.ttl_seconds: 1800
curl -X POST http://192.168.188.11:1234/admin/config/reload \
  -H "X-Admin-Key: $ADMIN_KEY"
```

**Key thresholds (from config defaults):**
- `memory.max_memory_percent`: 90 (engine refuses new model loads above this)
- `memory.load_shedding_percent`: 95 (all non-health requests return 503 above this)
- Load shedding exempts: `/healthz`, `/readyz`, `/admin/health`

### 3.3 Crash Loop Detected

**Symptoms:**
- LMX starts but logs `crash_loop_detected` and skips auto-load
- Models that were previously loaded are not restored
- Service is running but in "safe mode" (no models loaded)

**Diagnosis:**

```bash
# Step 1: Inspect runtime state file
cat ~/.opta-lmx/runtime-state.json | python3 -m json.tool
# Look for:
#   "last_clean_shutdown": false
#   "startup_count": >= 3
#   "last_startup_at": <recent timestamp>

# Step 2: Check if service is running but in safe mode
curl http://192.168.188.11:1234/readyz
# Will return 503 (no models loaded) if in safe mode

curl http://192.168.188.11:1234/admin/status \
  -H "X-Admin-Key: $ADMIN_KEY"
# loaded_models: 0
```

**Resolution:**

Crash loop detection triggers when 3+ startups happen within 60 seconds. The service runs but skips `auto_load` to prevent repeated OOM/crash cycles.

```bash
# Step 1: Fix the root cause (likely OOM from auto-loaded models)
# Check which models were loaded before crash
cat ~/.opta-lmx/runtime-state.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
print('Previously loaded:', data.get('loaded_models', []))
print('Clean shutdown:', data.get('last_clean_shutdown'))
print('Startup count:', data.get('startup_count'))
"

# Step 2: Clear crash loop state by performing a clean shutdown
kill -TERM $(pgrep -f "opta_lmx")
# Wait for shutdown to complete

# Step 3: Verify clean shutdown cleared the counter
cat ~/.opta-lmx/runtime-state.json | python3 -m json.tool
# Should show: "last_clean_shutdown": true, "startup_count": 0

# Step 4: (Optional) Remove problematic models from auto_load list
# Edit ~/.opta-lmx/config.yaml and remove the OOM-causing model from models.auto_load

# Step 5: Restart
python -m opta_lmx

# Step 6: Manually load models one at a time, checking memory between loads
curl http://192.168.188.11:1234/admin/memory -H "X-Admin-Key: $ADMIN_KEY"
curl -X POST http://192.168.188.11:1234/admin/models/load \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "smaller-model-first"}'
```

**Nuclear option (force-clear state):**

```bash
# Delete runtime state entirely (will lose loaded-model tracking)
rm ~/.opta-lmx/runtime-state.json
# Restart service
python -m opta_lmx
```

### 3.4 Model Quarantined

**Symptoms:**
- `POST /admin/models/load` returns 409 with code `model_unstable`
- Message: "Model 'X' is quarantined after instability"
- Prometheus alert `OptaLMXQuarantinedModelPresent` fires

**Diagnosis:**

```bash
# Step 1: Check readiness state
curl http://192.168.188.11:1234/admin/models \
  -H "X-Admin-Key: $ADMIN_KEY" | python3 -m json.tool
# Look for models with readiness.state: "quarantined"
# The readiness.reason will say "crash_loop:N" indicating N failures

# Step 2: Check compatibility registry for failure history
curl "http://192.168.188.11:1234/admin/models/compatibility?model_id=quarantined-model&outcome=fail" \
  -H "X-Admin-Key: $ADMIN_KEY" | python3 -m json.tool

# Step 3: Check which backend and version failed
# Look at "backend", "backend_version", and "reason" fields in the rows
```

**Resolution:**

A model is quarantined after 3 consecutive inference failures (configurable via `quarantine_threshold` in ReadinessTracker). It will not be routed to for inference.

```bash
# Option A: Unload and try a different backend
curl -X POST http://192.168.188.11:1234/admin/models/unload \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "quarantined-model"}'

# Reload with different backend
curl -X POST http://192.168.188.11:1234/admin/models/load \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "quarantined-model", "backend": "gguf"}'

# Option B: Force-override quarantine (diagnostics only)
curl -X POST http://192.168.188.11:1234/admin/models/load \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{
    "model_id": "quarantined-model",
    "allow_unsupported_runtime": true
  }'

# Option C: Re-download model (may be corrupt)
curl -X POST http://192.168.188.11:1234/admin/models/unload \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "quarantined-model"}'

curl -X DELETE "http://192.168.188.11:1234/admin/models/quarantined-model" \
  -H "X-Admin-Key: $ADMIN_KEY"

curl -X POST http://192.168.188.11:1234/admin/models/load \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "quarantined-model", "auto_download": true}'
```

### 3.5 Slow Inference

**Symptoms:**
- High latency on `/v1/chat/completions`
- Prometheus alert `OptaLMXHighP95Latency` fires (p95 > 3s)
- Prometheus alert `OptaLMXPerModelThroughputDrop` fires (< 5 tok/s)

**Diagnosis:**

```bash
# Step 1: Check current concurrency and queue status
curl http://192.168.188.11:1234/admin/status \
  -H "X-Admin-Key: $ADMIN_KEY"
# Look at: in_flight_requests vs max_concurrent_requests

# Step 2: Check metrics for latency breakdown
curl http://192.168.188.11:1234/admin/metrics/json \
  -H "X-Admin-Key: $ADMIN_KEY" | python3 -m json.tool
# Check per_model errors, completion_tokens, request counts

# Step 3: Check per-model performance
curl "http://192.168.188.11:1234/admin/models/MODEL_ID/performance" \
  -H "X-Admin-Key: $ADMIN_KEY" | python3 -m json.tool

# Step 4: Check memory pressure (causes throttling)
curl http://192.168.188.11:1234/admin/memory \
  -H "X-Admin-Key: $ADMIN_KEY"

# Step 5: Check if adaptive concurrency has throttled down
# Look at in_flight_requests -- if near max_concurrent_requests, the system is saturated
```

**Resolution:**

```bash
# Option A: Increase max concurrent requests
# Edit config: models.max_concurrent_requests: 8
curl -X POST http://192.168.188.11:1234/admin/config/reload \
  -H "X-Admin-Key: $ADMIN_KEY"

# Option B: Adjust adaptive concurrency target latency
# Edit config: models.adaptive_latency_target_ms: 5000
curl -X POST http://192.168.188.11:1234/admin/config/reload \
  -H "X-Admin-Key: $ADMIN_KEY"

# Option C: Set per-model concurrency limits (isolate slow models)
# Edit config: models.per_model_concurrency_limits: {"slow-model": 1}
curl -X POST http://192.168.188.11:1234/admin/config/reload \
  -H "X-Admin-Key: $ADMIN_KEY"

# Option D: Unload unused models to free memory/Metal capacity
curl -X POST http://192.168.188.11:1234/admin/models/unload \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "idle-model"}'

# Option E: Run autotune to optimize model load profile
curl -X POST http://192.168.188.11:1234/admin/models/autotune \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "slow-model", "runs": 5}'
```

### 3.6 503 Overloaded (Load Shedding)

**Symptoms:**
- All non-health requests return `503` with body:
  ```json
  {"error": {"message": "Server under memory pressure", "type": "server_error", "code": "overloaded"}}
  ```
- Response includes `Retry-After: 30` header

**Diagnosis:**

The load shedding middleware checks system memory before every non-exempt request. When memory exceeds `memory.load_shedding_percent` (default 95%), requests are rejected.

```bash
# Health endpoints still work during load shedding
curl http://192.168.188.11:1234/healthz
curl http://192.168.188.11:1234/readyz
curl http://192.168.188.11:1234/admin/health \
  -H "X-Admin-Key: $ADMIN_KEY"

# Check memory state -- admin/memory may also be blocked during load shedding
# Use the health endpoint which is exempt
```

**Resolution:**

```bash
# Step 1: Unload models to free memory (admin endpoints may also be blocked!)
# If /admin/models/unload is also returning 503, you must restart the service
# with reduced auto_load

# Step 2: If admin endpoints work, unload the largest model
curl -X POST http://192.168.188.11:1234/admin/models/unload \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "largest-model"}'

# Step 3: If admin endpoints are also blocked, restart in safe mode
kill -TERM $(pgrep -f "opta_lmx")
LMX_MODELS__AUTO_LOAD='[]' python -m opta_lmx
# Then manually load only the models you need
```

### 3.7 429 Rate Limited / Server Busy

**Symptoms:**
- Requests return `429` with `"code": "rate_limit_exceeded"` and `Retry-After: 5` header
- Happens when the inference semaphore is full (all slots busy)

**Diagnosis:**

```bash
# Check current in-flight vs limit
curl http://192.168.188.11:1234/admin/status \
  -H "X-Admin-Key: $ADMIN_KEY"
# If in_flight_requests == max_concurrent_requests, the semaphore is full

# Check semaphore timeout setting
# Default: models.semaphore_timeout_sec = 30 (waits 30s for a slot before returning 429)
```

**Resolution:**

```bash
# Option A: Increase max concurrent requests (if hardware can handle it)
# Edit config: models.max_concurrent_requests: 8

# Option B: Increase semaphore timeout (clients wait longer for a slot)
# Edit config: models.semaphore_timeout_sec: 60

# Option C: Enable adaptive concurrency (auto-scales based on latency)
# Edit config: models.adaptive_concurrency_enabled: true

curl -X POST http://192.168.188.11:1234/admin/config/reload \
  -H "X-Admin-Key: $ADMIN_KEY"
```

### 3.8 Authentication Failures

**Symptoms:**
- Inference requests return `401 Invalid or missing API key`
- Admin requests return `403 Invalid or missing admin key`

**Diagnosis:**

```bash
# Step 1: Check which security profile is active
curl http://192.168.188.11:1234/healthz
# This always works (no auth). If it returns OK, the server is running.

# Step 2: Check the config security section
# Review ~/.opta-lmx/config.yaml:
# security:
#   profile: "lan"     # or "cloud"
#   admin_key: null     # null = no auth required for admin
#   inference_api_key: null  # null = no auth required for inference
```

**Resolution:**

| Profile | Admin Auth | Inference Auth | Behavior |
|---------|-----------|----------------|----------|
| `lan` (default) | Optional (if `admin_key` is set) | Optional (if `inference_api_key` is set) | Trust LAN |
| `cloud` | **Required** (must set `admin_key`) | **Required** (must set `inference_api_key` or enable Supabase JWT) | Fail-closed |

```bash
# For LAN mode with no auth:
# security:
#   profile: lan
#   admin_key: null
#   inference_api_key: null

# For LAN mode with admin auth only:
# security:
#   profile: lan
#   admin_key: "my-admin-secret"

# For cloud mode (all auth required):
# security:
#   profile: cloud
#   admin_key: "my-admin-secret"
#   inference_api_key: "my-inference-secret"

# After editing config:
curl -X POST http://192.168.188.11:1234/admin/config/reload \
  -H "X-Admin-Key: $ADMIN_KEY"

# Note: if you change admin_key via config reload, subsequent requests must use the NEW key
```

---

## 4. Monitoring and Alerting

### 4.1 Prometheus Metrics

```bash
# Scrape endpoint (Prometheus text format)
curl http://192.168.188.11:1234/admin/metrics \
  -H "X-Admin-Key: $ADMIN_KEY"
```

**Key metrics to watch:**

| Metric | Type | What It Tells You |
|--------|------|-------------------|
| `lmx_requests_total` | counter | Total inference requests |
| `lmx_errors_total` | counter | Total failed requests |
| `lmx_stream_requests_total` | counter | Total streaming requests |
| `lmx_prompt_tokens_total` | counter | Total prompt tokens processed |
| `lmx_completion_tokens_total` | counter | Total tokens generated |
| `lmx_model_requests_total{model="..."}` | counter | Per-model request counts |
| `lmx_model_errors_total{model="..."}` | counter | Per-model error counts |
| `lmx_request_duration_seconds_bucket{model="...",le="..."}` | histogram | Request latency distribution |
| `lmx_loaded_models` | gauge | Number of currently loaded models |
| `lmx_memory_used_gb` | gauge | Current unified memory usage |
| `lmx_memory_total_gb` | gauge | Total unified memory |
| `lmx_in_flight_requests` | gauge | Currently active inference requests |
| `lmx_concurrent_limit` | gauge | Max allowed concurrent requests |
| `lmx_queued_requests` | gauge | Requests waiting for semaphore |
| `lmx_uptime_seconds` | gauge | Server uptime |

**Per-client metrics** (when `X-Client-ID` header is sent):
- `lmx_client_requests_total{client="..."}`
- `lmx_client_tokens_total{client="..."}`
- `lmx_client_errors_total{client="..."}`

### 4.2 JSON Metrics Summary

```bash
curl http://192.168.188.11:1234/admin/metrics/json \
  -H "X-Admin-Key: $ADMIN_KEY" | python3 -m json.tool
# Returns: total_requests, total_errors, per_model breakdown, per_client breakdown, uptime
```

### 4.3 SSE Event Stream

Real-time event feed for admin dashboards and automation.

```bash
# Connect to SSE stream (keep-alive connection)
curl -N http://192.168.188.11:1234/admin/events \
  -H "X-Admin-Key: $ADMIN_KEY"
# Events: model_loaded, model_unloaded, download_progress, download_completed,
#          download_failed, request_completed, memory_warning, config_reloaded
# Heartbeat every 30 seconds (configurable: server.sse_heartbeat_interval_sec)
```

### 4.4 Compatibility Registry

Track model/backend compatibility over time.

```bash
# All records
curl http://192.168.188.11:1234/admin/models/compatibility \
  -H "X-Admin-Key: $ADMIN_KEY"

# Filter by model and outcome
curl "http://192.168.188.11:1234/admin/models/compatibility?model_id=some-model&outcome=fail&include_summary=true" \
  -H "X-Admin-Key: $ADMIN_KEY"
```

### 4.5 Journal Logs (when journaling enabled)

```bash
# List session logs
curl http://192.168.188.11:1234/admin/logs/sessions \
  -H "X-Admin-Key: $ADMIN_KEY"

# Read a specific session log
curl http://192.168.188.11:1234/admin/logs/sessions/FILENAME \
  -H "X-Admin-Key: $ADMIN_KEY"

# List update logs
curl http://192.168.188.11:1234/admin/logs/updates \
  -H "X-Admin-Key: $ADMIN_KEY"
```

### 4.6 Predictor Stats

View model usage prediction data (used by warm pool prefetch).

```bash
curl http://192.168.188.11:1234/admin/predictor \
  -H "X-Admin-Key: $ADMIN_KEY"
# Returns usage history and predicted next model
```

### 4.7 Helper Node Health

```bash
curl http://192.168.188.11:1234/admin/helpers \
  -H "X-Admin-Key: $ADMIN_KEY"
# Returns health status, circuit breaker state for embedding/reranking helper nodes
```

### 4.8 Prometheus Alert Rules

Pre-built alert rules are available at `docs/ops/monitoring/prometheus-alerts.yaml`. Key alerts:

| Alert | Severity | Condition |
|-------|----------|-----------|
| `OptaLMXHighErrorRate` | warning | Error ratio > 5% for 10m |
| `OptaLMXHighP95Latency` | warning | p95 latency > 3s for 10m |
| `OptaLMXQueueSaturation` | critical | Requests queuing at max concurrency for 5m |
| `OptaLMXMemoryPressure` | warning | Memory > 90% for 10m |
| `OptaLMXQuarantinedModelPresent` | critical | Any model quarantined for 2m |
| `OptaLMXCanaryPendingStuck` | warning | Model stuck in canary_pending for 20m |
| `OptaLMXPerModelHighErrorRate` | warning | Per-model error rate > 10% for 10m |
| `OptaLMXPerModelThroughputDrop` | warning | Per-model throughput < 5 tok/s for 15m |
| `OptaLMXPerModelEvictionThrash` | warning | 3+ evictions in 30m |
| `OptaLMXAgentFailureRatioHigh` | warning | Agent failure/cancel ratio > 20% for 15m |

### 4.9 SLO Targets

From `docs/ops/monitoring/SLO-REGRESSION-BUDGETS.md`:

| SLO | Target |
|-----|--------|
| Request latency p95 | <= 0.60s |
| Queue wait p95 | <= 1.50s |
| Request error rate | < 1% |
| Throughput floor | >= 20 rps |
| Tuned profile regression budget | <= 15% drop vs baseline |

---

## 5. Emergency Procedures

### 5.1 Emergency Model Unload (Free Memory Fast)

When the server is under severe memory pressure and load shedding is active:

```bash
# Step 1: Try admin unload (may fail if load shedding blocks admin routes)
curl -X POST http://192.168.188.11:1234/admin/models/unload \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "largest-model-id"}'

# Step 2: If admin routes are blocked, kill and restart in safe mode
kill -TERM $(pgrep -f "opta_lmx")
sleep 5  # Wait for graceful shutdown

# Step 3: Restart with no auto-load
LMX_MODELS__AUTO_LOAD='[]' python -m opta_lmx --host 0.0.0.0 --port 1234

# Step 4: Verify service is up and empty
curl http://192.168.188.11:1234/healthz
curl http://192.168.188.11:1234/admin/memory -H "X-Admin-Key: $ADMIN_KEY"

# Step 5: Manually load only what is needed
curl -X POST http://192.168.188.11:1234/admin/models/load \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "essential-model-only"}'
```

### 5.2 Force Restart Without Auto-Load (Safe Mode)

When auto-loaded models are causing crashes or OOM on startup:

```bash
# Option A: Use environment variable override
kill -TERM $(pgrep -f "opta_lmx")
LMX_MODELS__AUTO_LOAD='[]' python -m opta_lmx

# Option B: Temporarily edit config
# Set models.auto_load: [] in ~/.opta-lmx/config.yaml
kill -TERM $(pgrep -f "opta_lmx")
python -m opta_lmx

# Option C: Let crash loop detection handle it
# If the service has crashed 3+ times in 60 seconds, it will automatically
# enter safe mode and skip auto_load. Just restart normally.
python -m opta_lmx
# Watch logs for: "crash_loop_detected" + "auto_load_skipped_safe_mode"
```

### 5.3 Recovering from Data Corruption

#### Corrupted runtime state

```bash
# Symptoms: service fails to start, or runtime-state.json is malformed
cat ~/.opta-lmx/runtime-state.json
# If this is corrupted JSON:

rm ~/.opta-lmx/runtime-state.json
python -m opta_lmx
# Service will start fresh with no model restoration
```

#### Corrupted compatibility registry

```bash
# Symptoms: compatibility queries fail, models cannot be loaded
cat ~/.opta-lmx/compatibility-registry.json | python3 -m json.tool
# If corrupted:

rm ~/.opta-lmx/compatibility-registry.json
# Registry will be recreated as new model load events occur
```

#### Corrupted RAG store

```bash
# Symptoms: RAG queries fail, /v1/rag/* endpoints return errors
rm ~/.opta-lmx/rag-store.json
# Store will be recreated empty; re-ingest documents
```

#### Corrupted model files

```bash
# Symptoms: model loads but canary fails, or produces garbage output

# Step 1: Unload the model
curl -X POST http://192.168.188.11:1234/admin/models/unload \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "corrupted-model"}'

# Step 2: Delete from disk
curl -X DELETE "http://192.168.188.11:1234/admin/models/corrupted-model" \
  -H "X-Admin-Key: $ADMIN_KEY"

# Step 3: Re-download and load
curl -X POST http://192.168.188.11:1234/admin/models/load \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"model_id": "corrupted-model", "auto_download": true}'
```

### 5.4 Full Factory Reset

When all else fails and you need a clean slate:

```bash
# Step 1: Stop the service
kill -TERM $(pgrep -f "opta_lmx")

# Step 2: Back up config (if you want to preserve settings)
cp ~/.opta-lmx/config.yaml ~/.opta-lmx/config.yaml.backup

# Step 3: Remove all state files (preserves config and models on disk)
rm -f ~/.opta-lmx/runtime-state.json
rm -f ~/.opta-lmx/compatibility-registry.json
rm -f ~/.opta-lmx/rag-store.json
rm -rf ~/.opta-lmx/session-logs/
rm -rf ~/.opta-lmx/update-logs/

# Step 4: Restart
python -m opta_lmx
```

**Note:** This does NOT delete downloaded models from `/Users/Shared/Opta-LMX/models/`. To also purge models, delete that directory, but be aware this may require re-downloading tens or hundreds of GB.

---

## Appendix A: Quick Reference Card

```
Health Checks:
  GET  /healthz                          Liveness (no auth)
  GET  /readyz                           Readiness (no auth)
  GET  /admin/health                     Detailed health (admin auth)

Models:
  GET  /v1/models                        List loaded (OpenAI format)
  GET  /admin/models                     List loaded (detailed)
  GET  /admin/models/available           List on disk
  POST /admin/models/load                Load model
  POST /admin/models/unload              Unload model
  POST /admin/models/download            Start download
  GET  /admin/models/download/{id}/progress  Download progress
  DEL  /admin/models/{id}                Delete from disk
  POST /admin/models/probe               Probe backends
  POST /admin/models/autotune            Benchmark + tune
  GET  /admin/models/compatibility       Compatibility registry

Inference:
  POST /v1/chat/completions              Chat completion (OpenAI)
  POST /v1/responses                     Responses API (OpenAI)
  POST /v1/embeddings                    Embeddings
  POST /v1/rerank                        Reranking
  POST /v1/messages                      Anthropic Messages API

Admin:
  GET  /admin/status                     System status
  GET  /admin/memory                     Memory breakdown
  GET  /admin/metrics                    Prometheus metrics
  GET  /admin/metrics/json               JSON metrics summary
  GET  /admin/events                     SSE event stream
  GET  /admin/stack                      Model stack overview
  POST /admin/config/reload              Hot-reload config
  POST /admin/benchmark                  Run benchmark
  GET  /admin/presets                    List presets
  POST /admin/presets/reload             Reload presets
  POST /admin/quantize                   Start quantization
  GET  /admin/predictor                  Usage predictions
  GET  /admin/helpers                    Helper node health
```

## Appendix B: Key Config Sections

```yaml
server:
  host: "0.0.0.0"
  port: 1234
  timeout_sec: 300
  websocket_enabled: true
  sse_events_enabled: true

models:
  default_model: null
  models_directory: /Users/Shared/Opta-LMX/models
  auto_load:
    - "mlx-community/Qwen2.5-Coder-32B-Instruct-8bit"
  max_concurrent_requests: 4
  inference_timeout_sec: 300
  loader_isolation_enabled: true
  loader_timeout_sec: 120
  warmup_on_load: true
  semaphore_timeout_sec: 30
  adaptive_concurrency_enabled: true
  adaptive_latency_target_ms: 2500

memory:
  max_memory_percent: 90
  auto_evict_lru: true
  load_shedding_percent: 95
  ttl_enabled: false
  ttl_seconds: 3600

security:
  profile: "lan"           # "lan" or "cloud"
  admin_key: null           # null = no admin auth
  inference_api_key: null   # null = no inference auth

logging:
  level: "INFO"
  format: "structured"

routing:
  aliases:
    code: ["model-a", "model-b"]
    reasoning: ["model-c"]
    chat: ["model-d"]
  default_model: null
```
