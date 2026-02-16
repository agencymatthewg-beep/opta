# Opta-LMX — APP.md

> Your private AI inference engine, built for Apple Silicon.

---

## 1. Identity

| Field | Value |
|-------|-------|
| **Name** | Opta-LMX |
| **Tagline** | Your private AI inference engine, built for Apple Silicon |
| **Type** | Headless API service (daemon) |
| **Platform** | macOS (Apple Silicon — M3 Ultra primary, M4 Max secondary) |
| **Language** | Python 3.11+ |
| **Frameworks** | MLX, FastAPI, Uvicorn, huggingface_hub |
| **Location** | `~/Synced/Opta/1-Apps/1J-Opta-LMX/` |
| **Status** | Planning — Research Phase |

---

## 2. Purpose

### What It Does
Opta-LMX runs large language models natively on Apple Silicon using MLX, serves them via an OpenAI-compatible API, and provides full programmatic control over model lifecycle — downloading, loading, unloading, routing, and benchmarking — all without a GUI.

### What Problem It Solves
LM Studio requires a human at a screen to manage models. Bots can't click download buttons, drag GPU sliders, or switch models. LM Studio also bundles its own llama.cpp, meaning new model architectures (like GLM-5) are blocked until LM Studio updates. Opta-LMX removes the human bottleneck and the version dependency, giving bots full autonomy over the inference stack.

### What Makes It Different
- **MLX-native** — 15-30% faster than GGUF/llama.cpp on Apple Silicon (zero-copy unified memory)
- **Bot-autonomous** — Full Admin API for programmatic model management (no GUI)
- **Smart routing** — Automatically picks the best model for each task
- **Architecture-agnostic** — Add new model support in Python, not C++ recompilation
- **Purpose-built for our ecosystem** — Designed for OpenClaw bots, Opta CLI, and OptaPlus from day one

### What It Does NOT Do
- ❌ Chat UI (that's OptaPlus / Telegram)
- ❌ Coding tools — read files, edit code, run commands (that's Opta CLI)
- ❌ Conversation management, sessions, or memory (that's Opta CLI / OpenClaw)
- ❌ Bot orchestration or automation (that's OpenClaw)
- ❌ Fine-tuning or training (separate concern, may be added later)

---

## 3. Target Audience

### Primary Users
1. **OpenClaw bots** (Opta512, Mono, Floda, Saturday, Lin) — autonomous consumers of inference API
2. **Opta CLI** — agentic coding assistant that needs fast, reliable local inference
3. **Matthew** — via `opta serve` commands and Opta CLI

### Use Cases
1. **Bot sends a message → LMX serves response** — 6 bots on Mac Studio all hitting `/v1/chat/completions`, LMX handles queuing and routing to the best loaded model
2. **Bot detects new model on HuggingFace → downloads and loads it** — Autonomous model management via Admin API, zero human intervention
3. **Matthew runs `opta do "fix this bug"` from MacBook** — Opta CLI sends request over LAN to LMX on Mac Studio, gets streamed response from the best coding model
4. **Night shift: bots swap to smaller model** — At quiet hours, bots unload the 420GB model and load a faster 24GB model to save memory for other tasks
5. **New model architecture released** — Add Python support in hours, not waiting weeks for LM Studio to update their C++ engine

### User Expectations
- **Always running** — daemon starts on boot, stays up 24/7
- **Fast** — MLX-native performance, no overhead from unnecessary GUI rendering
- **Reliable** — handles concurrent requests, doesn't crash on OOM, graceful degradation
- **Compatible** — any OpenAI SDK client works without modification
- **Observable** — memory usage, model status, throughput stats all queryable via API

---

## 4. Core Capabilities (Non-Negotiable)

| # | Capability | Why Non-Negotiable |
|---|-----------|-------------------|
| 1 | **OpenAI-compatible `/v1/chat/completions`** | Every client (CLI, bots, tools) expects this API |
| 2 | **MLX-native inference** | The entire point — Apple Silicon optimized, 15-30% faster |
| 3 | **SSE streaming** | All modern clients expect token-by-token streaming |
| 4 | **Tool/function calling pass-through** | Opta CLI and OpenClaw bots use tool calling extensively |
| 5 | **Headless daemon operation** | No GUI, no display. Runs as launchd service |
| 6 | **Admin API: load/unload models** | Bots must manage models autonomously |
| 7 | **Admin API: download from HuggingFace** | Bots must acquire new models autonomously |
| 8 | **Admin API: system status** | Memory, loaded models, speed stats — queryable |
| 9 | **Memory monitoring + OOM prevention** | Must refuse to load a model that won't fit, not crash |
| 10 | **Concurrent request handling** | 6+ bots hit it simultaneously — must queue, not drop |
| 11 | **GGUF fallback** | Not all models have MLX weights (e.g., GLM-5 today) |
| 12 | **Drop-in LM Studio replacement** | Serve on port 1234, same API — zero config change for existing clients |

---

## 5. Key Characteristics

### Design Philosophy
- **Headless-first** — No GUI, ever. API-only interaction
- **Bot-autonomous** — Every operation achievable without human intervention
- **Performance-obsessed** — MLX native, zero-copy memory, optimized for Apple Silicon
- **Reliable over clever** — Simple, predictable behavior. Don't crash, don't lose requests
- **Observable** — Every metric, status, and health indicator exposed via API

### Performance Requirements
- Startup: < 5 seconds (without loading a model)
- Model load: < 60 seconds for typical model (24-128GB)
- Inference: Match or exceed LM Studio tok/s on same hardware
- API latency: < 50ms overhead before first token
- Concurrent: Handle 10+ simultaneous requests without dropping

### Quality Bar
- Production-grade reliability (this is infrastructure, not a prototype)
- Clean error handling (never crash, always return meaningful errors)
- Well-documented API (OpenAPI/Swagger for admin endpoints)
- Comprehensive logging (structured, queryable)

---

## 6. Architecture Overview

### Key Components
1. **Inference Engine** — MLX model loading, generation, streaming
2. **API Server** — FastAPI/Uvicorn serving OpenAI-compatible + Admin endpoints
3. **Model Manager** — Download, convert, inventory, disk management
4. **Smart Router** — Task classification, model selection, fallback chains
5. **Memory Monitor** — Track unified memory, prevent OOM, report stats
6. **GGUF Backend** — llama-cpp-python fallback for non-MLX models

### Data Flow
```
Client Request → API Server → Router (picks model) → Inference Engine (MLX/GGUF)
                                                            ↓
Client ← SSE Stream ← API Server ← Token Stream ← Generation Loop
```

### Dependencies
- **MLX** (Apple) — inference runtime
- **mlx-lm** (Apple) — model loading, generation utilities
- **FastAPI** — async API server
- **huggingface_hub** — model downloads
- **llama-cpp-python** — GGUF fallback (optional)
- **psutil** — system monitoring

---

## 7. Ecosystem Context

### Depends On
- Apple Silicon hardware (M3 Ultra on Mono512)
- HuggingFace Hub (model downloads)
- MLX framework (Apple)

### Depended On By
- **Opta CLI** — primary inference backend
- **OpenClaw bots** (6 bots) — inference API
- **Claude Code Router** — inference routing
- **OptaPlus** (indirect, via bots) — chat responses

### Shares With
- Opta CLI: API contract (OpenAI-compatible format)
- OpenClaw: Same API contract

---

## 8. Development Rules

### Coding Conventions
- Python 3.11+ with type hints everywhere
- Async/await for all I/O operations
- Structured logging (not print statements)
- Pydantic models for all API schemas
- Ruff for linting, mypy for type checking

### AI Development Guidelines
- **READ THIS FILE FIRST** before any coding session
- **Research existing solutions** before building anything new
- **Leverage mlx-lm** — don't reimplement what Apple provides
- **Test against real models** — don't just unit test, load a real model
- **Keep the API contract stable** — any change that breaks OpenAI compatibility is a bug

### Testing Requirements
- Unit tests for router, model manager, config
- Integration tests against real MLX models (small test model)
- API contract tests (verify OpenAI SDK compatibility)
- Load tests (concurrent requests)

### Deployment
- launchd plist on Mono512 (`/Library/LaunchDaemons/com.opta.lmx.plist`)
- KeepAlive, RunAtLoad
- Logs to `/var/log/opta-lmx/` or `~/.opta-lmx/logs/`
- Config at `~/.opta-lmx/config.yaml`
- Models at `/Users/Shared/Opta-LMX/models/`

---

## 9. Roadmap Priorities

### Now (Current Phase)
- Phase 0: Research — 5 parallel agents investigating MLX servers, capabilities, API spec, competitors, Apple Silicon optimization
- Phase 1: Architecture design based on research findings

### Next
- Phase 2: Core implementation — MLX inference + OpenAI API
- Phase 3: Admin API + model manager
- Drop-in test: replace LM Studio, verify everything works

### Later
- Smart routing
- Speculative decoding
- Prompt caching
- Prometheus metrics
- Opta CLI migration (Phase 5)

### Never (Anti-Features)
- ❌ GUI / graphical interface
- ❌ Chat UI
- ❌ Built-in coding tools
- ❌ Cloud API proxying (use OpenRouter/LiteLLM for that)
- ❌ Multi-machine distributed inference (single machine only)
- ❌ Training / fine-tuning (separate tool)

---

## 10. Open Questions

1. **Fork or build?** — Research may reveal an existing MLX server we can extend instead of building from scratch
2. **Single port or dual port?** — Should Admin API be on same port (e.g., /admin/*) or separate port?
3. **GGUF priority** — How much effort to invest in GGUF fallback vs focusing purely on MLX?
4. **Model format preferences** — Should we auto-convert GGUF→MLX? Or just support both natively?
5. **Config format** — YAML, TOML, or JSON for server config?
6. **Authentication** — Should Admin API require auth? Token-based? Or trust LAN?

---

*Last updated: 2026-02-15*
*This file is the source of truth for what Opta-LMX is. Update it as the app evolves.*
