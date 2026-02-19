# Opta-LMX — Project Definition

**Created:** 2026-02-15
**Author:** Matthew Byrden + Opta Max (Claude Opus 4.6)
**Status:** Pre-Development — Research & Planning Phase
**Location:** `~/Synced/Opta/1-Apps/1J-Opta-LMX/`

---

## 1. Name & Identity

**Name:** Opta-LMX
**Meaning:** Combines **LM** (Language Model) + **MLX** (Apple's ML framework) + **Opta** (the brand)
**Tagline:** "Your private AI inference engine, built for Apple Silicon."

---

## 2. AIM

Replace LM Studio with a purpose-built, headless, Python-based inference server optimized for Apple Silicon via MLX. Designed for autonomous bot operation — no GUI dependency, full programmatic control over model lifecycle, intelligent routing, and native MLX performance.

---

## 3. Purpose

Opta-LMX is the **inference layer** of the Opta ecosystem. It answers one question: **"How do we run LLMs on our hardware as fast, smart, and autonomously as possible?"**

It does NOT:
- Provide coding tools (that's Opta CLI)
- Manage conversations or sessions (that's Opta CLI / OpenClaw)
- Have a chat UI (that's OptaPlus / Telegram)

It DOES:
- Load and run MLX models natively on Apple Silicon
- Serve an OpenAI-compatible API (drop-in replacement for LM Studio)
- Provide an Admin API for programmatic model management
- Route requests to the optimal model based on task type
- Allow bots to autonomously download, load, unload, and benchmark models
- Monitor memory, performance, and health
- Support GGUF as fallback via llama.cpp integration

---

## 4. Key Functions

### 4A. Inference API (OpenAI-Compatible)
- `POST /v1/chat/completions` — Chat completions (streaming + non-streaming)
- `POST /v1/completions` — Text completions
- `GET /v1/models` — List loaded models
- `POST /v1/embeddings` — Text embeddings (if model supports)
- Full compatibility with any OpenAI SDK client (Python, TypeScript, etc.)

### 4B. Admin API (Opta-LMX Exclusive)
- `POST /admin/load` — Load a model into memory (by name or HuggingFace repo)
- `POST /admin/unload` — Unload a model, free memory
- `POST /admin/download` — Download model from HuggingFace
- `DELETE /admin/models/{name}` — Remove model from disk
- `GET /admin/status` — System status (memory, GPU, loaded models, throughput)
- `GET /admin/models` — All models (loaded + on disk + known available)
- `GET /admin/models/{name}` — Detailed model info (size, quant, context, speed stats)
- `POST /admin/bench` — Benchmark a model (tok/s prompt processing, tok/s generation)
- `POST /admin/config` — Update server config (sampling defaults, routing rules)
- `GET /admin/health` — Health check endpoint
- `GET /admin/metrics` — Prometheus-compatible metrics export

### 4C. Smart Router
- Classify incoming requests by task type (code, reasoning, chat, translation, etc.)
- Route to the optimal loaded model based on task + model capabilities
- Support explicit model selection (override routing)
- Fallback chains — if primary model OOM or slow, fall back to smaller model
- Load balancing across multiple loaded models

### 4D. Model Manager
- Download models from HuggingFace Hub (MLX-community preferred, GGUF fallback)
- Convert safetensors → MLX format if needed
- Track model inventory (on disk, loaded, available remotely)
- Memory-aware loading — check available RAM before loading, evict LRU if needed
- Disk space management — warn on low space, auto-cleanup old unused models

### 4E. Performance Engine
- MLX-native inference (zero-copy unified memory)
- Prompt caching — cache system prompts across sessions (huge for bots with identical prompts)
- KV-cache persistence — keep conversation context between messages
- Speculative decoding — small model drafts, big model verifies (2-3x speedup)
- Batch inference — process multiple requests simultaneously when possible
- Continuous batching — interleave requests for better throughput

---

## 5. Non-Negotiable Capabilities

These MUST be present before v1.0 release:

| # | Capability | Why Non-Negotiable |
|---|-----------|-------------------|
| 1 | **OpenAI-compatible API** | Every client (Opta CLI, OpenClaw, any tool) must work without modification |
| 2 | **MLX-native inference** | The entire point — Apple Silicon optimized, zero-copy memory |
| 3 | **Headless operation** | No GUI, no display session. Runs as a daemon/service. Bots need this |
| 4 | **Programmatic model management** | Bots must load/unload/download models via API without human intervention |
| 5 | **Memory monitoring** | Must know how much RAM is free and refuse to load models that won't fit |
| 6 | **Drop-in LM Studio replacement** | Must serve on same port (1234), same API. Zero config change for existing clients |
| 7 | **GGUF fallback** | Not all models have MLX weights. Must support GGUF via llama-cpp-python or similar |
| 8 | **Streaming** | SSE streaming for chat completions. All modern clients expect this |
| 9 | **Tool/function calling** | Must pass through tool schemas and handle tool_choice parameter |
| 10 | **Concurrent requests** | Multiple bots will hit the API simultaneously. Must queue, not crash |

---

## 6. Target Hardware

| Machine | RAM | Role |
|---------|-----|------|
| **Mono512** (Mac Studio M3 Ultra) | 512GB unified | Primary inference server |
| **MacBook M4 Max** | 48GB unified | Secondary (small models only) |

Primary deployment: Mono512. All design decisions optimized for 512GB unified memory on M3 Ultra.

---

## 7. Who Uses It

| Consumer | How | What They Need |
|----------|-----|---------------|
| **Opta CLI** | OpenAI API + Admin API | Inference + model selection + benchmarking |
| **OpenClaw bots** (Opta512, Mono, Floda, Saturday, Lin) | OpenAI API | Inference only (admin via Opta CLI or direct) |
| **OptaPlus** (macOS/iOS app) | OpenAI API (through bots) | Indirect — bots relay through LMX |
| **Claude Code Router** | OpenAI API | Inference only |
| **Any OpenAI-compatible tool** | OpenAI API | Inference only |

---

## 8. What It Replaces

| Current | Replaced By | Benefit |
|---------|-------------|---------|
| LM Studio (GUI app) | Opta-LMX (headless daemon) | No GUI dependency, bot-autonomous |
| LM Studio model browser | Admin API `/admin/download` | Programmatic, no clicking |
| LM Studio model loading UI | Admin API `/admin/load` | Bots can hot-swap models |
| LM Studio server mode | LMX inference API | MLX-native speed, better memory management |
| Manual model management | Auto-management + monitoring | Self-healing, memory-aware |

---

## 9. Tech Stack (Planned)

| Component | Technology | Why |
|-----------|-----------|-----|
| **Language** | Python 3.11+ | MLX is Python-native, fastest path to inference |
| **ML Framework** | MLX (Apple) | Zero-copy unified memory, Apple Silicon optimized |
| **GGUF Fallback** | llama-cpp-python | When MLX weights don't exist |
| **API Server** | FastAPI + Uvicorn | Async, fast, OpenAPI docs, SSE streaming |
| **Model Downloads** | huggingface_hub | Official HF library for model management |
| **Memory Monitoring** | psutil + MLX introspection | Track unified memory usage |
| **Process Manager** | launchd (macOS service) | Auto-start, auto-restart, persistent |
| **Config** | YAML/TOML + environment vars | Simple, human-readable |
| **Logging** | structlog or loguru | Structured, queryable logs |
| **Metrics** | prometheus_client (optional) | Grafana-compatible monitoring |

---

## 10. Relationship to Other Opta Apps

```
┌─────────────────────────────────────────────────┐
│                  OPTA ECOSYSTEM                  │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ OptaPlus │  │ Opta CLI │  │ OpenClaw Bots │ │
│  │ (Chat UI)│  │(Code AI) │  │ (Automation)  │ │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘ │
│       │              │               │           │
│       │    ┌─────────┴───────────────┘           │
│       │    │                                     │
│       ▼    ▼                                     │
│  ┌────────────────────────────────────────────┐ │
│  │              OPTA-LMX                       │ │
│  │     (Inference Engine + Model Manager)      │ │
│  │                                            │ │
│  │  Runs on: Mac Studio (Mono512, 512GB)      │ │
│  │  Serves: OpenAI-compatible API             │ │
│  │  Engine: MLX (primary) + GGUF (fallback)   │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Opta-LMX is the foundation.** Everything else builds on top of it.
