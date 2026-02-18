# Opta-LMX Master Plan

**Created:** 2026-02-15
**Status:** Active — Phase 6 Complete
**Rule:** Research and plan THOROUGHLY before writing any code.

---

## Development Philosophy

> **Research → Plan → Sub-plan → Verify → THEN Code.**
>
> Opta-LMX must be built on top of existing, proven libraries and patterns.
> We are NOT building an inference engine from scratch.
> We ARE building the orchestration, management, and API layer around MLX.
> Every design decision must be backed by research into what already exists.

---

## Phase 0: Research ✅ COMPLETE (2026-02-15)

### 0A. Existing MLX Inference Servers ✅
**Goal:** Find existing open-source MLX API servers we can build on or learn from.
**Sub-agent task:** Research the following and document in `docs/research/`:

1. **mlx-lm** (Apple's own) — What server capabilities does it have? Can it serve an API?
2. **mlx-community/mlx-server** — Does this exist? What does it do?
3. **FastMLX** — HuggingFace project for serving MLX models. Architecture? API?
4. **mlx-llm** — Another MLX inference library. Features?
5. **vLLM MLX support** — Has vLLM added MLX backend?
6. **LocalAI** — Go-based, supports multiple backends. MLX support?
7. **Nitro (Jan.ai)** — C++ inference server. MLX plans?
8. **Any other MLX API server projects**

**Output:** `docs/research/existing-mlx-servers.md`
**Key questions:**
- Can we fork/extend an existing project instead of building from scratch?
- What OpenAI-compatible server implementations exist for MLX?
- What's the most mature/maintained option?
- What gaps would we need to fill?

### 0B. MLX Capabilities Deep Dive ✅
**Goal:** Understand MLX's current capabilities for serving inference.
**Sub-agent task:**

1. What MLX version supports which model architectures?
2. Which models have MLX-community conversions on HuggingFace?
3. MLX quantization formats available (4-bit, 8-bit, what else?)
4. MLX speculative decoding — is it implemented?
5. MLX prompt caching — is it implemented?
6. MLX KV-cache management — API for persistence?
7. MLX batch inference — supported?
8. MLX continuous batching — supported?
9. MLX memory management — how to monitor, control?
10. MLX model loading/unloading — API for hot-swap?

**Output:** `docs/research/mlx-capabilities.md`

### 0C. OpenAI API Spec Analysis ✅
**Goal:** Document exactly what endpoints/features we need to implement.
**Sub-agent task:**

1. Full OpenAI Chat Completions API spec (all parameters)
2. Streaming (SSE) format spec
3. Tool/function calling format
4. Models endpoint format
5. What LM Studio implements vs. full OpenAI spec
6. What Ollama implements vs. full OpenAI spec
7. What parameters OpenClaw bots actually use
8. What parameters Opta CLI actually sends

**Output:** `docs/research/openai-api-spec.md`

### 0D. Competitor Analysis ✅
**Goal:** Learn from every local inference server's architecture.
**Sub-agent task:**

1. **LM Studio** — Architecture, what makes it good/bad for our use case
2. **Ollama** — Architecture, model management approach, Modelfile system
3. **llama.cpp server** — Raw performance, what it handles
4. **Jan.ai** — Architecture, local-first philosophy
5. **LMDeploy** — Serving optimization techniques
6. **text-generation-inference (TGI)** — HuggingFace's server architecture
7. **vLLM** — PagedAttention, continuous batching approach
8. **TabbyAPI** — ExLlamaV2 server, interesting features

**Output:** `docs/research/competitor-analysis.md`

### 0E. Apple Silicon Inference Optimization ✅
**Goal:** Understand hardware-specific optimizations for M3 Ultra.
**Sub-agent task:**

1. Unified memory architecture — how to maximize throughput
2. Metal Performance Shaders vs MLX for inference
3. Neural Engine — can it be used for inference? How?
4. Memory bandwidth considerations (M3 Ultra: 800GB/s)
5. Optimal GPU layer allocation for large models
6. Power management — how to balance speed vs thermal
7. Process affinity — P-cores vs E-cores for inference workloads

**Output:** `docs/research/apple-silicon-optimization.md`

---

## Phase 1: Design & Architecture ✅ COMPLETE (2026-02-15)

### 1A. Architecture Design
Based on Phase 0 research, design the full system.
**Output:** `docs/plans/ARCHITECTURE.md`

Contents:
- Module map (inference, admin, router, model manager, metrics)
- Data flow diagrams
- API endpoint specifications (full)
- Configuration schema
- Error handling strategy
- Logging strategy
- Deployment model (launchd plist, systemd, etc.)

### 1B. Technology Decisions
Document every technology choice with justification.
**Output:** `docs/plans/TECH-DECISIONS.md`

For each decision:
- What are the options?
- Pros/cons of each
- What we chose and why
- What we'd switch to and when

### 1C. API Specification
Full OpenAPI spec for both inference and admin APIs.
**Output:** `docs/plans/API-SPEC.md` (or OpenAPI YAML)

### 1D. Opta CLI Migration Spec
Detailed migration plan for CLI changes.
**Output:** Already created — `docs/OPTA-CLI-MIGRATION.md` (enhance with research findings)

---

## Phase 2: Core Implementation ✅ COMPLETE (2026-02-15)

### 2A. Project Scaffolding ✅
- Python project structure (pyproject.toml, src layout)
- Dependencies pinned (vllm-mlx 0.2.6, FastAPI, Pydantic v2)
- Dev tooling (pytest, httpx for testing)
- 31 tests passing

### 2B. MLX Inference Core ✅
- Model loading via vllm-mlx (SimpleEngine + BatchedEngine)
- Non-streaming + streaming chat completions
- Memory-aware loading with 90% threshold (G-LMX-01)
- LRU eviction for multi-model management
- Tool/function call pass-through

### 2C. OpenAI-Compatible API ✅
- `POST /v1/chat/completions` (streaming + non-streaming)
- `GET /v1/models`
- `POST /v1/completions` (501 stub)
- SSE streaming with G-LMX-05 mid-stream error handling
- OpenAI-format error responses

### 2D. Admin API (Phase 1) ✅
- `POST /admin/models/load` + `POST /admin/models/unload`
- `GET /admin/status` + `GET /admin/memory` + `GET /admin/models`
- `GET /admin/health`
- X-Admin-Key authentication (trust-LAN default)

### Code Review Cleanup ✅
- 4 Critical, 8 Major, 8 Minor issues resolved
- Version centralized, deps deduplicated, structured logging verified

---

## Phase 3: Admin & Management ✅ COMPLETE (2026-02-15)

### 3A. Model Manager (NEW MODULE)
- `ModelManager` class with HuggingFace Hub integration
- Async background downloads via `snapshot_download`
- Progress tracking with custom tqdm subclass
- Disk inventory via `scan_cache_dir()`
- Model deletion with loaded-model safety check

### 3B. Download & Delete API
- `POST /admin/models/download` — start async HF download
- `GET /admin/models/download/{id}/progress` — poll download status
- `DELETE /admin/models/{model_id:path}` — delete from disk (409 if loaded)
- Download verification trusts HF Hub's built-in ETag checks (G-LMX-02)

### 3C. GGUF Fallback ✅ COMPLETE
- `src/opta_lmx/inference/gguf_backend.py` — llama-cpp-python wrapper
- Engine auto-detects model format (MLX vs GGUF)
- Unified API — same `/v1/chat/completions` regardless of backend
- llama-cpp-python as optional dependency (`pip install .[gguf]`)
- 14 GGUF-specific tests passing

---

## Phase 4: Smart Features ✅ COMPLETE (2026-02-15)

> **vllm-mlx v0.2.6 update:** Tool calling (12 parsers), embeddings, reasoning
> parsers, Anthropic Messages API, and prefix caching are now upstream.
> Phase 4 scope reduced ~50% — focus on what vllm-mlx doesn't provide.

### 4A. Smart Router ✅
- `TaskRouter` with configurable alias resolution (`auto`, `code`, `reasoning`, `chat`)
- `RoutingConfig` in YAML — alias → model preference list mapping
- Stateless resolution at request time — adapts to loaded models automatically
- `update_config()` for hot-reload without restart
- 10 unit tests + 3 API integration tests

### 4B. Performance Optimization ✅
- ~~Prompt caching~~ → vllm-mlx prefix cache already built-in
- ~~Request batching~~ → vllm-mlx continuous batching already built-in
- KV-cache configuration ✅ — `kv_bits`, `kv_group_size` in config + engine pass-through
- Prefix cache control ✅ — `prefix_cache_enabled` in config, per-model override via presets
- Speculative decoding profiles ✅ — `speculative_model`, `speculative_num_tokens` with preset override
- Model performance profiles ✅ — 7 presets with `performance` section auto-applied on load
- 8 dedicated performance profile tests (`test_performance_profiles.py`)

### 4C. Monitoring & Telemetry ✅
- `MetricsCollector` with per-request tracking (latency, tokens, errors, models)
- `GET /admin/metrics` — Prometheus text exposition format for scraping
- `GET /admin/metrics/json` — JSON summary for admin dashboards
- Latency histogram with 9 buckets (0.1s to 60s)
- Per-model request counts, error counts, token counts
- 7 unit tests + 4 API tests

### 4D. Config Hot-Reload ✅
- `POST /admin/config/reload` — re-reads YAML, updates runtime state
- Updates routing aliases, memory thresholds, logging level, admin key
- Does NOT restart server or unload models
- 2 API tests (success + auth)

### 4E. GGUF Fallback ✅ (Completed in Phase 3C)
- llama-cpp-python integration — done in `gguf_backend.py`
- Automatic format detection (MLX vs GGUF) — engine auto-detects
- Same API regardless of backend — unified through inference engine

---

## Phase 5: Integration — PARTIALLY COMPLETE (2026-02-15)

> **vllm-mlx v0.2.6 update:** Upstream now ships `/v1/messages` (Anthropic),
> MCP tool integration, audio endpoints, and embeddings. OpenClaw bots can
> use tool calling natively without custom LMX code. Integration scope reduced.

### 5A. Opta CLI Provider (DEFERRED — separate repo)
- Create `lmx.ts` provider in `1D-Opta-CLI-TS/`
- Rewrite `connect.ts`, `models.ts`
- Add `serve.ts`
- Update config schema

### 5B. OpenClaw Integration (DEFERRED — separate repo)
- Verify all 6 bots work with LMX in `1I-OptaPlus/`
- ~~Custom tool calling layer~~ → vllm-mlx has 12 tool parsers built-in
- ~~Anthropic API adapter~~ → vllm-mlx ships `/v1/messages` natively
- Update bot configs (point at port 1234)

### 5C. Deployment ✅
- launchd plist for Mono512 (`docs/launchd/com.opta.lmx.plist`)
- Auto-start on boot (RunAtLoad + KeepAlive on crash)
- Log rotation (RotatingFileHandler: 50MB max, 5 backups)
- Production config (`config/production-config.yaml`)
- Setup script (`scripts/setup-production.sh`)

### 5D. Risk Monitoring
- Track vllm-metal (official vLLM Apple Silicon plugin) development
- Monitor vllm-mlx release cadence for merge compatibility
- Benchmark GGUF+flash-attention vs MLX periodically

---

## Phase 6: Polish & Hardening ✅ COMPLETE (2026-02-16)

> Code audit, model presets, enhanced SSE events, WebSocket support.

### 6A. Model Presets ✅
- Preset configurations for common models
- Quick-load via preset name

### 6B. SSE Events ✅
- Enhanced SSE event types for richer client integration
- Mid-stream error handling improvements

### 6C. WebSocket Support ✅
- WebSocket endpoint for persistent connections
- Bidirectional streaming

### 6D. Code Audit ✅
- Full codebase audit and cleanup
- 517 tests passing across 34 test files (3 skipped for optional deps)
- 35+ source files in `src/opta_lmx/`
- 23+ API endpoints implemented

---

## Sub-Agent Assignment Plan

### Research Phase (Phase 0) — 5 Parallel Agents

| Agent | Task | Output |
|-------|------|--------|
| **Agent R1** | Existing MLX servers research (0A) | `docs/research/existing-mlx-servers.md` |
| **Agent R2** | MLX capabilities deep dive (0B) | `docs/research/mlx-capabilities.md` |
| **Agent R3** | OpenAI API spec analysis (0C) | `docs/research/openai-api-spec.md` |
| **Agent R4** | Competitor analysis (0D) | `docs/research/competitor-analysis.md` |
| **Agent R5** | Apple Silicon optimization (0E) | `docs/research/apple-silicon-optimization.md` |

### Design Phase (Phase 1) — 2 Parallel Agents

| Agent | Task | Output |
|-------|------|--------|
| **Agent D1** | Architecture + API spec (1A, 1C) | `docs/plans/ARCHITECTURE.md`, `docs/plans/API-SPEC.md` |
| **Agent D2** | Tech decisions + CLI migration refinement (1B, 1D) | `docs/plans/TECH-DECISIONS.md` |

### Implementation Phase (Phase 2+) — Via Claude Code (Clauding Workflow)

| Step | Agent | Task |
|------|-------|------|
| 2A-2D | Claude Code | Core implementation — scaffolding through drop-in test |
| 3A-3C | Claude Code | Admin API + model manager |
| 4A-4C | Claude Code | Smart features |
| 5A-5C | Claude Code + Opta Max | Integration + deployment |

---

## Success Criteria

### v0.1 (Minimum Viable) ✅ ACHIEVED
- [x] Loads one MLX model
- [x] Serves `/v1/chat/completions` with streaming
- [x] Serves `/v1/models`
- [ ] Opta CLI `opta connect` + `opta do` works against it (Phase 5A — separate repo)
- [x] Runs as a daemon on Mono512 (launchd plist + setup script)

### v0.5 (LM Studio Replacement) ✅ ACHIEVED (2026-02-16)
- [x] All non-negotiable capabilities met (12/12 — see APP.md §4)
- [x] Admin API for load/unload (Phase 2)
- [x] Admin API for download/delete (Phase 3)
- [x] Multiple models can be loaded simultaneously
- [x] Smart routing — alias resolution for task-based model selection (Phase 4A)
- [x] Prometheus metrics + JSON summary (Phase 4C)
- [x] Config hot-reload without restart (Phase 4D)
- [x] Production deployment — launchd, log rotation, setup script (Phase 5C)
- [ ] OpenClaw bots work with zero config change (Phase 5B — deferred to OptaPlus repo)
- [x] GGUF fallback for models without MLX weights (gguf_backend.py, 14 tests, optional dep)
- [x] 517 tests passing across 34 test files
- [x] 35+ source files, 23+ API endpoints

### v1.0 (Full Product)
- [x] Smart routing (Phase 4A)
- [x] Prompt caching (upstream in vllm-mlx prefix cache)
- [x] Performance monitoring (Phase 4C — Prometheus + JSON metrics)
- [x] GGUF fallback (Phase 3C — fully wired)
- [x] WebSocket support (Phase 6C)
- [x] Model presets (Phase 6A)
- [x] Code audit clean (Phase 6D)
- [x] KV cache + speculative decoding profiles (Phase 4B)
- [x] Embedding endpoint with remote helper proxy
- [x] Reranking endpoint with remote helper proxy
- [x] RAG pipeline (vector store, BM25, hybrid search, chunking)
- [x] Adaptive concurrency + usage prediction
- [x] Model quantization pipeline
- [x] Multimodal content support (vision models)
- [x] Concurrent request limiting + inference timeout
- [x] 517 tests across 34 test files
- [x] 35+ source modules in `src/opta_lmx/`
- [ ] Opta CLI fully migrated (no LM Studio references) — Phase 5A, separate repo
- [ ] OpenClaw bots integrated — Phase 5B, separate repo
- [ ] Benchmarks published (vs LM Studio, vs Ollama) — Phase 4B-future
