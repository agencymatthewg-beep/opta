---
title: "ARCHITECTURE.md — Opta-LMX Phase 1"
created: 2026-02-15
version: 1.0
status: Design Complete — Ready for Phase 2 Implementation
phase: 1-Design
audience: Architects, coders, reviewers
---

# Opta-LMX Phase 1 Architecture

## 1. Build Strategy Decision

### Evaluated Options

| Option | Approach | Pros | Cons | **Recommendation** |
|--------|----------|------|------|---------|
| **Fork vllm-mlx** | Clone repo, add Admin layer on top | • Fastest to market (2-4 weeks)<br>• Continuous batching (3.4x speedup)<br>• Full multimodal, audio, embeddings<br>• Apache 2.0 license | • Couple with external project's releases<br>• Need to maintain merge compatibility | ✅ **CHOSEN** |
| **Use as dependency** | Import vllm-mlx, wrap externally | • Clean separation<br>• Easy to swap backends | • Slower to optimize<br>• Less control over inference path | Alternative if fork causes friction |
| **Build from scratch** | Write MLX server in 3 months | • Full control<br>• Optimized for our needs | • Reinvent continuous batching (complex)<br>• 3-6 month timeline<br>• Community misses our work | ❌ **REJECTED** — See research findings |

### Decision: Fork vllm-mlx + Add Admin Layer

**Rationale:** vllm-mlx (v0.2.6, 365⭐, actively maintained) already has ~85% of what we need:
- ✅ OpenAI `/v1/chat/completions` + `/v1/completions`
- ✅ Anthropic `/v1/messages` + `/v1/messages/count_tokens`
- ✅ MLX-native inference + streaming
- ✅ Continuous batching (3.4x speedup on concurrent requests)
- ✅ Multimodal (text, image, audio, video)
- ✅ MCP tool calling (12 tool parsers: Mistral, DeepSeek, GLM-4.7, Granite, etc.)
- ✅ Embeddings `/v1/embeddings` (via mlx-embeddings)
- ✅ Reasoning parsers (DeepSeek R1, Harmony, Qwen3, Think)
- ✅ Audio (TTS, STT, voices)
- ✅ Prefix cache for agentic multi-turn
- ❌ **Gap:** Admin API (load/unload/download/delete models at runtime)
- ❌ **Gap:** Multi-model management (single model per process)
- ❌ **Gap:** Memory monitoring + OOM prevention (90% threshold)
- ❌ **Gap:** YAML configuration
- ❌ **Gap:** launchd daemon operation
- ❌ **Gap:** Disk inventory + model lifecycle management

**Our layer adds:** Admin API `/admin/*` + model manager + memory monitor + YAML config + daemon wrapper.

> **Risk:** vllm-metal (official vLLM Apple Silicon plugin) is in development.
> Monitor but don't pivot — vllm-mlx is production-ready now, vllm-metal is not.

---

## 2. Module Map (Full Project Structure)

```
src/opta_lmx/
├── __init__.py                    # Package root, version
├── main.py                        # FastAPI app factory, route registration
├── config.py                      # YAML config loading (dataclass + pydantic)
│
├── inference/                     # MLX inference core (wraps vllm-mlx)
│   ├── __init__.py
│   ├── engine.py                  # InferenceEngine class (load/generate/stream)
│   ├── schema.py                  # Pydantic models: CompletionRequest, StreamResponse
│   ├── streaming.py               # SSE chunk generation, finish_reason logic
│   └── types.py                   # ToolCall, TokenUsage, FinishReason enums
│
├── api/                           # FastAPI route handlers
│   ├── __init__.py
│   ├── inference.py               # Routes: POST /v1/chat/completions, GET /v1/models
│   ├── admin.py                   # Routes: POST /admin/model/load, DELETE /admin/model/unload, etc.
│   ├── health.py                  # Routes: GET /admin/health, GET /admin/status
│   └── errors.py                  # OpenAI-compatible error responses
│
├── manager/                       # Model management layer
│   ├── __init__.py
│   ├── model.py                   # ModelManager: inventory, download, validate (SHA256)
│   ├── memory.py                  # MemoryMonitor: track unified memory, OOM prevention
│   ├── gguf.py                    # GGUFBackend: fallback for non-MLX models
│   └── registry.py                # Model registry: metadata, quantization, paths
│
├── router/                        # Smart routing (Phase 4, stub for Phase 1)
│   ├── __init__.py
│   └── strategy.py                # TaskRouter: select best model for task
│
├── monitoring/                    # Observability
│   ├── __init__.py
│   ├── logging.py                 # Structured logging setup
│   └── metrics.py                 # Speed, memory, request stats (future: Prometheus)
│
└── utils/
    ├── __init__.py
    ├── tokenizer.py               # Token counting utilities
    └── validation.py              # Request validation, model path checks
```

### Key Classes & Responsibilities

#### `InferenceEngine` (inference/engine.py)
```python
class InferenceEngine:
    async def load_model(model_id: str) -> ModelInfo
    async def unload_model(model_id: str) -> None
    async def generate(request: CompletionRequest) -> CompletionResponse
    async def stream_generate(request: CompletionRequest) -> AsyncIterator[StreamChunk]
    def get_loaded_models() -> list[ModelInfo]
```

#### `ModelManager` (manager/model.py)
```python
class ModelManager:
    async def download_model(model_id: str, dest: Path) -> Path  # From HF
    async def validate_model(path: Path) -> bool  # SHA256 verification
    async def list_available() -> list[ModelMetadata]  # From registry
    def estimate_memory(model_id: str) -> int  # Return MB needed
```

#### `MemoryMonitor` (manager/memory.py)
```python
class MemoryMonitor:
    def available_gb() -> float  # Unified memory available
    def used_by_models_gb() -> float  # Currently loaded models
    def can_load(model_id: str) -> bool  # Check 90% threshold
    async def auto_unload_if_needed(required_gb: float) -> bool  # LRU eviction
```

---

## 3. Data Flow Diagrams

### A. Chat Completion Request Flow
```
Client (OpenAI SDK)
    ↓ POST /v1/chat/completions {model, messages, stream}
API Layer (api/inference.py)
    ↓ validate + route
InferenceEngine.generate() OR .stream_generate()
    ↓ check model loaded; if not: ModelManager.auto_load()
    ↓ MLX model.generate() or vllm-mlx request
    ↓ token by token
SSE stream OR JSON response
    ↓ format via schema.py
Client receives tokens in real-time (stream) or full response
```

### B. Model Load/Unload Flow
```
Client (bot or CLI)
    ↓ POST /admin/model/load {model_id, quantization}
Admin API (api/admin.py)
    ↓ MemoryMonitor.can_load(model_id)?
    ├─ Yes: proceed
    └─ No: MemoryMonitor.auto_unload_lru() → retry
ModelManager.download_model(model_id) if not cached
    ↓ HuggingFace API → disk
ModelManager.validate_model() — SHA256 check
    ↓ success? load : error
InferenceEngine.load_model() calls MLX model.load() or GGUF
    ↓ registers in engine's model dict
Response: {model_id, memory_used_gb, status: "loaded"}
```

### C. Download & Auto-Load Flow
```
Admin API
    ↓ POST /admin/model/download {model_id, quantization}
ModelManager.download_model()
    ↓ HF hub.download_file() with progress
    ↓ save to ~/.opta-lmx/models/{quantization}/
    ↓ compute SHA256, compare to registry
    ↓ if auto_load=true: trigger Model Load flow
Response: {model_id, path, size_mb, time_sec, auto_loaded: bool}
```

### D. Health Check Flow
```
Client (monitoring)
    ↓ GET /admin/health
HealthCheck handler
    ├─ Check /admin/status → memory, models, speed
    ├─ Ping inference engine (is it responsive?)
    └─ Check disk space (models dir writable?)
Response: {status: "healthy"|"degraded"|"error", metrics}
```

---

## 4. API Surface (Inference + Admin)

### Inference API (`/v1/*` — OpenAI-compatible)

| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `/v1/chat/completions` | POST | Chat with model | Streaming + non-streaming, tool calling |
| `/v1/models` | GET | List available models | Echo format matches OpenAI |
| `/v1/completions` | POST | Legacy completion | Optional, deprecated |

**Critical Parameters:**
- `model` (required)
- `messages` (required)
- `stream` (default: false)
- `temperature`, `top_p`, `max_tokens`
- `tools` (for function calling)
- `response_format` (JSON mode)

### Admin API (`/admin/*` — Our addition)

| Endpoint | Method | Purpose | Body |
|----------|--------|---------|------|
| `/admin/model/load` | POST | Load model into memory | `{model_id, quantization?}` |
| `/admin/model/unload` | DELETE | Unload model, free memory | `{model_id}` |
| `/admin/model/download` | POST | Download from HuggingFace | `{model_id, quantization?, auto_load?}` |
| `/admin/models/list` | GET | List all available models | — |
| `/admin/models/loaded` | GET | List currently loaded | — |
| `/admin/status` | GET | Memory, models, speed | — |
| `/admin/health` | GET | System health check | — |

---

## 5. Configuration Schema (YAML)

```yaml
# ~/.opta-lmx/config.yaml

server:
  host: "127.0.0.1"          # Localhost only (trust LAN)
  port: 1234                 # Drop-in LM Studio replacement
  workers: 1                 # Uvicorn workers
  timeout_sec: 300           # Request timeout

models:
  default_model: "mlx-community/Mistral-7B-Instruct-4bit"
  models_directory: "/Users/Shared/Opta-LMX/models"
  auto_load:                 # Models to pre-load at startup
    - "mlx-community/Mistral-7B-Instruct-4bit"
    - "mlx-community/Qwen2.5-7B-Instruct-4bit"
  quantization_preference: "4bit"  # Default quant for downloads

memory:
  max_memory_percent: 90     # Never exceed 90% unified memory
  oom_threshold_percent: 95  # Warn at 95%
  auto_evict_lru: true       # Unload LRU model if needed

logging:
  level: "INFO"              # DEBUG, INFO, WARNING, ERROR
  format: "structured"       # JSON or text
  file: "/var/log/opta-lmx/server.log"

security:
  api_key: null              # Optional: require key on /admin/* (Phase 4)
  admin_key: null            # Optional: separate admin key
```

---

## 6. Deployment Model (launchd)

```xml
<!-- /Library/LaunchDaemons/com.opta.lmx.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.opta.lmx</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/python3</string>
        <string>-m</string>
        <string>uvicorn</string>
        <string>opta_lmx.main:app</string>
        <string>--host</string>
        <string>127.0.0.1</string>
        <string>--port</string>
        <string>1234</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/opta-lmx/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/opta-lmx/stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>PYTHONUNBUFFERED</key>
        <string>1</string>
    </dict>
</dict>
</plist>
```

**Log locations:**
- `/var/log/opta-lmx/server.log` — Structured application logs
- `/var/log/opta-lmx/stdout.log` — Uvicorn access logs
- `/var/log/opta-lmx/stderr.log` — Errors

---

## 7. Integration Points

### Opta CLI
- Expects server at `http://127.0.0.1:1234/v1`
- Uses OpenAI Python SDK (no custom code needed)
- **No changes required** to CLI if we're port 1234 + OpenAI-compatible

### OpenClaw Bots (6 instances)
- Each bot sends requests to `/v1/chat/completions`
- Expects same response format (no changes)
- Optional: use `/admin/*` to pre-load preferred models

### OptaPlus (Chat UI)
- Indirectly via bots (no direct connection)
- Bots fetch responses from LMX and relay to OptaPlus

---

## 8. Risk Assessment & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **vllm-mlx upstream changes break us** | High | Fork strategy: cherry-pick merges, maintain compatibility shim |
| **Model download corrupt/malicious** | High | SHA256 verification mandatory (GUARDRAILS G-LMX-02) |
| **OOM crash without notice** | High | Memory monitor at 90% threshold, auto-evict LRU, never crash |
| **Port 1234 already in use** | Medium | Check port in health check, fail early with clear error |
| **GGUF fallback slower than expected** | Medium | Benchmark GGUF vs MLX; migrate models to MLX-community |
| **Tool calling format mismatch with clients** | Medium | Test against Opta CLI tool calls before Phase 2 release |
| **Startup time > 30 seconds** | Low | Pre-load common models in config; lazy-load others |
| **Memory leak in MLX or vllm-mlx** | Medium | Monitor peak memory; add garbage collection hooks |

---

## 9. Success Criteria (Phase 1 Complete)

- [x] Research complete: 5 agents produced docs/research/*.md
- [x] Architecture designed: this document + API-SPEC.md
- [x] Module structure finalized: every .py file planned
- [x] Data flows documented: request → response flows clear
- [x] Configuration schema defined: YAML structure finalized
- [x] Deployment approach validated: launchd plist ready
- [x] Integration points identified: CLI, bots, OptaPlus documented
- [x] Risk assessment completed: mitigation strategies in place

**Next Phase (2): Implement core vllm-mlx fork + admin layer**

---

## References
- **APP.md** — Project charter, 12 non-negotiable capabilities
- **docs/research/existing-mlx-servers.md** — Why fork vllm-mlx
- **docs/research/openai-api-spec.md** — Full API contract
- **docs/DECISIONS.md** — Already-settled architecture choices
- **CLAUDE.md** — Coding standards for Phase 2
- **GUARDRAILS.md** — Safety rules (SHA256, memory limits, etc.)
