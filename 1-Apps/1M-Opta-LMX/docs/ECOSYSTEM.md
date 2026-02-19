---
title: ECOSYSTEM.md — How LMX Fits
created: 2026-02-15
updated: 2026-02-15
type: context
audience: Architects, integrators, Matthew
status: Active
---

# ECOSYSTEM.md — Opta-LMX Ecosystem & Integration

This document explains where LMX sits in the larger Opta ecosystem, what it depends on, and what depends on it.

---

## System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Opta Ecosystem                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Mac Studio (M3 Ultra, 512GB) — Primary Inference Server          │  │
│  │                                                                  │  │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │
│  │  │  Opta-LMX (This Project)                                │   │  │
│  │  │  Port 1234 (http://localhost:1234)                      │   │  │
│  │  │                                                         │   │  │
│  │  │  /v1/chat/completions  ← OpenAI-compatible API         │   │  │
│  │  │  /v1/models             ← Model listing                 │   │  │
│  │  │  /admin/model/load      ← Admin endpoints               │   │  │
│  │  │  /admin/model/download  ← Model management              │   │  │
│  │  │  /admin/status          ← Health & memory               │   │  │
│  │  │                                                         │   │  │
│  │  │  Backend: MLX (primary) + llama-cpp-python (fallback)  │   │  │
│  │  │  Storage: /Users/Shared/Opta-LMX/models/              │   │  │
│  │  └─────────────────────────────────────────────────────────┘   │  │
│  │                          ↑                                       │  │
│  └──────────────────────────┼───────────────────────────────────────┘  │
│                             │                                          │
│  ┌──────────────────────────┼───────────────────────────────────────┐  │
│  │ MacBook (M4 Max) — Client Devices                               │  │
│  │                                                                  │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ Opta CLI (TypeScript)                                    │  │  │
│  │  │  - `opta connect` → checks http://mac-studio:1234/v1/   │  │  │
│  │  │  - `opta models` → lists from LMX                        │  │  │
│  │  │  - `opta do "fix bug"` → sends inference request to LMX  │  │  │
│  │  │  - Uses openai.ts provider (refactored for LMX)          │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                                                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ OpenClaw Bots (6 instances)                                      │  │
│  │                                                                  │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │ Opta512, Opta Max, Mono, Saturday, Floda, Lin             │ │  │
│  │  │  - Each connects to http://mac-studio:1234/v1/chat/...   │ │  │
│  │  │  - Uses standardized openai SDK (python-openai)          │ │  │
│  │  │  - Sends chat requests, gets streamed responses          │ │  │
│  │  │  - Admin API: autonomous model management (bots load/    │ │  │
│  │  │    unload models via /admin/model/* endpoints            │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │                                                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ HuggingFace Hub (External — Model Source)                        │  │
│  │                                                                  │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │ MLX-community models, GGUF models, metadata               │ │  │
│  │  │  ← Downloaded by LMX admin API when requested             │ │  │
│  │  │  ← SHA256 verified before loading                         │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │                                                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Optional Future: OptaPlus (Chat UI)                             │  │
│  │  - Uses Opta CLI for inference (which uses LMX)                 │  │
│  │  - Or could connect directly to LMX API                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### Opta-LMX (This Project)
**What it is:** Headless inference server on Mac Studio (port 1234)

**What it does:**
- Loads and runs MLX models (or GGUF as fallback)
- Serves `/v1/chat/completions` (OpenAI-compatible)
- Provides admin API for model management
- Monitors memory, reports system status
- Handles concurrent inference requests from all clients

**What it does NOT do:**
- ❌ Manage CLI configuration (that's Opta CLI)
- ❌ Orchestrate bots or tasks (that's OpenClaw)
- ❌ Store conversation history (that's optional in CLI)
- ❌ Provide a chat UI (that's OptaPlus)
- ❌ Manage code in the repo (that's Opta CLI)

---

### Opta CLI (TypeScript) — Integration Point
**What it is:** Agentic coding assistant that communicates with LMX

**Current State:** Uses LM Studio on port 1234  
**After Migration:** Uses Opta-LMX on port 1234 (zero config change!)

**Key Changes:**
- `src/providers/lmx.ts` — replaces `src/providers/lmstudio.ts`
- `src/commands/connect.ts` — calls `GET http://mac-studio:1234/v1/models` instead
- `src/commands/models.ts` — same (parse LMX models list)
- `src/commands/serve.ts` — NEW: start/stop/status of LMX daemon via ssh to Mac Studio

**Uses LMX for:**
- All inference requests (via `/v1/chat/completions`)
- Model enumeration (via `/v1/models`)
- Optional: model management (load/unload via `/admin/*`)

---

### OpenClaw Bots (6 instances) — Inference Consumers
**What they are:** Autonomous agent instances running in OpenClaw

**Current State:** Likely using LM Studio (need to verify)  
**After Migration:** Use LMX via openai SDK (same as now)

**Key Changes:**
- Config points to `http://mac-studio:1234` (same as LM Studio, so no change!)
- Use standard `openai` Python library (already do)
- Optional: use Admin API to manage models autonomously (new feature)

**Uses LMX for:**
- Inference requests (all `/v1/chat/completions` calls)
- Concurrent requests (LMX queues + routes)
- Optional: autonomous model loading/unloading via `/admin/*`

---

### HuggingFace Hub (External) — Model Source
**What it is:** Public repository of model weights

**How LMX uses it:**
- `huggingface_hub` library downloads models
- Admin API endpoint `/admin/model/download?model_id=...` fetches from HF
- SHA256 verification against known hashes (GUARDRAILS.md G-LMX-02)
- Models cached at `/Users/Shared/Opta-LMX/models/`

**No special API key needed** (public models). Private models require HF token in config.

---

## Data Flow Diagrams

### Inference Request Flow (Normal Path)

```
Client Request
  ↓
Opta CLI / Bot sends to http://mac-studio:1234/v1/chat/completions
  ↓
FastAPI routes request to inference.py handler
  ↓
Handler validates request (Pydantic)
  ↓
Router selects best loaded model (or falls back to default)
  ↓
MLX inference engine generates response
  ↓
Tokens streamed back as SSE (Server-Sent Events)
  ↓
Client receives streamed response (compatible with openai SDK)
```

### Model Download Flow (Admin Path)

```
Bot calls POST /admin/model/download
  ↓
Admin API validates request
  ↓
Model manager downloads from HuggingFace (huggingface_hub)
  ↓
SHA256 hash computed and verified (GUARDRAILS.md)
  ↓
Model stored at /Users/Shared/Opta-LMX/models/<model_id>/
  ↓
Return: "Model ready to load" or "Verification failed"
  ↓
Bot can now call /admin/model/load to use it
```

### Memory Monitoring Flow (Health Check)

```
Client calls GET /admin/status
  ↓
Memory monitor checks psutil.virtual_memory()
  ↓
Return JSON:
{
  "memory": {
    "available_gb": 400,
    "used_percent": 15,
    "loaded_models": ["mistral-7b", "llama2-70b"]
  },
  "performance": {
    "avg_tokens_per_sec": 45.2,
    "concurrent_requests": 3
  }
}
```

---

## Integration Checklist (Phase 5)

### Opta CLI Integration
- [ ] Create `src/providers/lmx.ts` provider
- [ ] Update `connect.ts` to call LMX `/v1/models` endpoint
- [ ] Update `models.ts` to parse LMX response
- [ ] Create `serve.ts` command to manage LMX daemon
- [ ] Test: `opta connect` successfully discovers LMX
- [ ] Test: `opta models` lists MLX models
- [ ] Test: `opta do "fix this bug"` gets response from LMX

### OpenClaw Bot Integration
- [ ] Verify 6 bots point to port 1234 (LM Studio → LMX, same port)
- [ ] Update configs (if needed) to LMX-specific model IDs
- [ ] Test: each bot can send/receive from LMX
- [ ] Load test: all 6 bots simultaneously (verify queuing)
- [ ] Test: autonomous model management (load/unload via Admin API)

### Mac Studio Deployment
- [ ] Install plist at `/Library/LaunchDaemons/com.opta.lmx.plist`
- [ ] Create log directory: `/var/log/opta-lmx/`
- [ ] Create model directory: `/Users/Shared/Opta-LMX/models/`
- [ ] Create config: `~/.opta-lmx/config.yaml`
- [ ] Start daemon: `launchctl load ...`
- [ ] Verify: `launchctl list com.opta.lmx` shows running
- [ ] Verify: `curl http://localhost:1234/v1/models` works
- [ ] Verify: logs appear in `/var/log/opta-lmx/`

---

## Dependency Graph

```
Opta-LMX (this project)
├── Depends On:
│   ├── MLX (inference runtime)
│   ├── mlx-lm (model loading utilities)
│   ├── FastAPI (HTTP server)
│   ├── huggingface_hub (model downloads)
│   ├── llama-cpp-python (GGUF fallback)
│   ├── psutil (memory monitoring)
│   └── Apple Silicon hardware (M3 Ultra / M4 Max)
│
└── Depended On By:
    ├── Opta CLI (TypeScript)
    ├── OpenClaw Bots (6 instances)
    ├── OptaPlus (future, via CLI)
    └── Direct HTTP clients (via /v1/* API)
```

---

## Network Architecture

### Mac Studio (Primary Inference Host)
```
Internal Network: 192.168.1.X/24

LMX listens on: 127.0.0.1:1234
  ↑
Can be accessed from:
  - Local (same machine): http://localhost:1234
  - LAN (MacBook): http://mac-studio.local:1234 (via mDNS)
  - Or direct IP: http://192.168.1.X:1234
```

### MacBook / Clients
```
Opta CLI:
  - Configured with: "inference_host": "mac-studio.local"
  - Connects to: http://mac-studio.local:1234/v1/...

Bots (via OpenClaw):
  - Configured with: "lm_studio_url": "http://mac-studio.local:1234"
  - Uses openai SDK with: openai.api_base = "http://mac-studio.local:1234/v1"
```

---

## Authorization & Security

### Current Model (Phase 2-3)
- LMX listens on localhost:1234 (LAN-only, not exposed to internet)
- Admin API has NO authentication (trust LAN)
- Inference API has NO authentication (stateless)
- No API keys needed (local-only)

### Future Consideration (Phase 4+)
- Admin API could require token-based auth (optional)
- Inference API stays open (clients are trusted)
- TLS encryption (if exposed beyond LAN)

---

## Performance Expectations

### Single Request Latency
- First token: ~500ms (model already loaded)
- Subsequent tokens: ~100-150ms per token (depends on model size)
- Streaming: SSE delivers tokens as fast as they're generated

### Throughput
- Single request: 20-50 tokens/sec (depending on model)
- Concurrent requests: Handled by async queuing
- All 6 bots simultaneously: LMX queues, doesn't drop

### Memory Usage
- Mistral 7B (MLX): ~14GB
- Llama2 70B (MLX): ~140GB
- GGUF fallback: Similar, depends on quantization

---

## Monitoring & Observability

### Built-in Endpoints
- `GET /admin/status` — Memory, models, performance
- `GET /admin/health` — Liveness check
- Logs → `/var/log/opta-lmx/` (structured JSON, if configured)

### Future (Phase 4+)
- Prometheus metrics export (`GET /metrics`)
- Per-model benchmark tracking
- Request history / audit log

---

## Related Documents
- Project identity: `APP.md`
- Development phases: `docs/ROADMAP.md` (§5 Integration phase)
- Architectural decisions: `docs/DECISIONS.md`
- CLI migration: `docs/OPTA-CLI-MIGRATION.md`

---

*This diagram is the source of truth for how LMX integrates. Update it as the ecosystem evolves.*
