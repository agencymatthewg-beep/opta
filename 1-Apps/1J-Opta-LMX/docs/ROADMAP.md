---
title: ROADMAP.md — Development Phases & Milestones
created: 2026-02-15
updated: 2026-02-15
type: planning
audience: All (understanding timeline and phases)
status: Active
---

# ROADMAP.md — Opta-LMX Development Phases

This document maps out all development phases, what each delivers, and how the 12 non-negotiable capabilities (from APP.md §4) are satisfied by each phase.

---

## Overview

| Phase | Status | Focus | Duration | Output |
|-------|--------|-------|----------|--------|
| **Phase 0** | 🔄 In Progress | Research | 1-2 weeks | 5 research docs |
| **Phase 1** | ⏳ Planned | Design & Architecture | 1-2 weeks | 3 architecture docs |
| **Phase 2** | ⏳ Planned | Core Implementation | 4-6 weeks | Runnable MVP |
| **Phase 3** | ⏳ Planned | Admin & Management | 2-3 weeks | Full feature set |
| **Phase 4** | ⏳ Planned | Smart Features | 2-3 weeks | Advanced routing |
| **Phase 5** | ⏳ Planned | Integration & Hardening | 2-4 weeks | Production ready |

---

## Phase 0: Research (Current) 🔄

**Duration:** 1-2 weeks  
**Status:** Underway with 5 parallel sub-agents  
**Goal:** Understand the landscape before designing anything

### Outputs
1. **0A: `docs/research/existing-mlx-servers.md`** — Can we build on existing projects?
2. **0B: `docs/research/mlx-capabilities.md`** — What can MLX really do?
3. **0C: `docs/research/openai-api-spec.md`** — What API must we implement?
4. **0D: `docs/research/competitor-analysis.md`** — Learn from LM Studio, Ollama, etc.
5. **0E: `docs/research/apple-silicon-optimization.md`** — M3 Ultra optimization techniques

### Capabilities Addressed
- None (research phase — no code yet)

### Success Criteria
- ✓ All 5 research documents complete
- ✓ No major surprises (MLX is viable, OpenAI format is clear)
- ✓ Clear technology stack emerging (MLX + FastAPI consensus)
- ✓ Ready to design architecture (Phase 1)

### Research Outputs Location
```
docs/research/
├── existing-mlx-servers.md         (0A)
├── mlx-capabilities.md              (0B)
├── openai-api-spec.md               (0C)
├── competitor-analysis.md           (0D)
└── apple-silicon-optimization.md    (0E)
```

---

## Phase 1: Design & Architecture ⏳

**Duration:** 1-2 weeks  
**Prerequisite:** Phase 0 complete  
**Goal:** Lock down design before writing Python

### Outputs
1. **1A: `docs/plans/ARCHITECTURE.md`** — System design, modules, data flow
2. **1B: `docs/plans/TECH-DECISIONS.md`** — Why MLX? Why FastAPI? Why port 1234?
3. **1C: `docs/plans/API-SPEC.md`** (OpenAPI/Swagger) — Full API contract
4. **1D: Enhance `docs/OPTA-CLI-MIGRATION.md`** — Detailed CLI migration plan

### Capabilities Addressed
- None (design phase — decision-making)

### Success Criteria
- ✓ ARCHITECTURE.md defines all modules and data flow
- ✓ TECH-DECISIONS.md justifies every major choice (with research citations)
- ✓ API-SPEC.md matches OpenAI format exactly
- ✓ CLI migration plan is detailed and reviewed by Matthew
- ✓ Team consensus on design (no big changes in Phase 2)

### Deliverables Checklist
- [ ] Module structure defined (see CLAUDE.md project structure)
- [ ] Data flow diagram (request → inference → response)
- [ ] API contract (request/response schemas)
- [ ] Configuration schema (YAML format)
- [ ] Error handling strategy
- [ ] Logging strategy (structured, queryable)
- [ ] Deployment model (launchd plist details)

---

## Phase 2: Core Implementation 🔄

**Duration:** 4-6 weeks  
**Prerequisite:** Phase 1 architecture locked  
**Goal:** Get a working MVP that replaces LM Studio on port 1234

### Capabilities Satisfied (of 12)

| # | Capability | Implemented | Verified |
|---|-----------|-------------|----------|
| 1 | **OpenAI `/v1/chat/completions`** | Phase 2C ✓ | Phase 2D |
| 2 | **MLX-native inference** | Phase 2B ✓ | Phase 2B |
| 3 | **SSE streaming** | Phase 2C ✓ | Phase 2D |
| 4 | **Tool/function calling pass-through** | Phase 2C ✓ | Phase 2D |
| 5 | **Headless daemon operation** | Phase 2A ✓ | Phase 2D |
| 6 | **Admin API: load/unload** | Phase 3A | Phase 3B |
| 7 | **Admin API: download HuggingFace** | Phase 3B | Phase 3B |
| 8 | **Admin API: system status** | Phase 3A | Phase 3B |
| 9 | **Memory monitoring + OOM prevention** | Phase 2A + 3B | Phase 3B |
| 10 | **Concurrent request handling** | Phase 2C ✓ | Phase 2D |
| 11 | **GGUF fallback** | Phase 3C | Phase 3C |
| 12 | **Drop-in LM Studio replacement** | Phase 2D ✓ | Phase 2D |

### Sub-Phases

#### 2A: Project Scaffolding
**Deliverables:**
- [ ] `pyproject.toml` with dependencies pinned
- [ ] Project structure created (see CLAUDE.md structure)
- [ ] `src/opta_lmx/__init__.py` and `main.py` stubs
- [ ] `tests/conftest.py` with pytest fixtures
- [ ] CI/CD setup (if applicable)
- [ ] README.md with quick start

#### 2B: MLX Inference Core
**Deliverables:**
- [ ] `src/opta_lmx/inference/engine.py` — MLX model loading
- [ ] `src/opta_lmx/inference/schema.py` — Type models (Request, Response)
- [ ] Token generation loop (streaming)
- [ ] System prompt handling
- [ ] Temperature/top_p parameter support
- [ ] Tests: load real model, generate tokens

#### 2C: OpenAI-Compatible API
**Deliverables:**
- [ ] `src/opta_lmx/api/inference.py` — FastAPI routes
- [ ] `/v1/chat/completions` (streaming + non-streaming)
- [ ] `/v1/models` (list available models)
- [ ] SSE streaming format (match OpenAI exactly)
- [ ] Request validation (Pydantic)
- [ ] Error response format
- [ ] Tests: OpenAI SDK compatibility

#### 2D: Drop-in LM Studio Test
**Deliverables:**
- [ ] Start LMX on port 1234
- [ ] `opta connect` works (zero config change)
- [ ] `opta models` lists loaded models
- [ ] `opta do "test task"` gets streamed response
- [ ] OpenClaw bot can chat with it
- [ ] Verify: exact feature parity with LM Studio API

### Success Criteria
- ✓ MVP runs on port 1234
- ✓ Loads one MLX model (e.g., Mistral 7B)
- ✓ `/v1/chat/completions` works with streaming
- ✓ `/v1/models` returns correct format
- ✓ OpenAI Python SDK works without config change
- ✓ Opta CLI connects and can request inference
- ✓ All 5 core capabilities (1-3, 5, 10, 12) working

### Code Guidelines
- See CLAUDE.md (§1-7) for all Python standards
- Type hints everywhere
- Async first
- Structured logging
- Pydantic for all schemas

---

## Phase 3: Admin & Management API 🔄

**Duration:** 2-3 weeks  
**Prerequisite:** Phase 2 complete  
**Goal:** Let bots autonomously manage models

### Capabilities Satisfied (continuing from Phase 2)

| # | Capability | Phase 3 |
|---|-----------|---------|
| 6 | **Admin API: load/unload models** | 3A ✓ |
| 7 | **Admin API: download from HuggingFace** | 3B ✓ |
| 8 | **Admin API: system status** | 3A ✓ |
| 9 | **Memory monitoring + OOM prevention** | 3B ✓ |
| 11 | **GGUF fallback** | 3C ✓ |

### Sub-Phases

#### 3A: Admin API Endpoints
**Deliverables:**
- [ ] `src/opta_lmx/api/admin.py` — Admin routes
- [ ] `POST /admin/model/load` — Load model by ID
- [ ] `POST /admin/model/unload` — Unload loaded model
- [ ] `GET /admin/status` — Memory, loaded models, speed stats
- [ ] `GET /admin/health` — Health check
- [ ] OpenAPI docs for admin endpoints
- [ ] Request/response validation

#### 3B: Model Manager & HuggingFace Integration
**Deliverables:**
- [ ] `src/opta_lmx/manager/model.py` — Model inventory
- [ ] `src/opta_lmx/manager/memory.py` — Memory monitoring
- [ ] Download from HuggingFace with progress
- [ ] `POST /admin/model/download` endpoint
- [ ] SHA256 verification (see GUARDRAILS.md)
- [ ] Disk inventory tracking (~/Opta-LMX/models/)
- [ ] Tests: download, verify, load

#### 3C: GGUF Fallback
**Deliverables:**
- [ ] `src/opta_lmx/manager/gguf.py` — llama-cpp-python wrapper
- [ ] Detect model format (MLX vs GGUF)
- [ ] Load GGUF if MLX weights not available
- [ ] Unified API (same /v1/chat/completions regardless of backend)
- [ ] Fallback chain (MLX → GGUF → error)

### Success Criteria
- ✓ Admin API fully functional
- ✓ Can load/unload models without restart
- ✓ Can download models from HuggingFace
- ✓ Memory stays < 90% (never crashes on OOM)
- ✓ GGUF fallback works for models without MLX weights
- ✓ All 12 non-negotiable capabilities satisfied
- ✓ LM Studio replacement complete

---

## Phase 4: Smart Features 🔄

**Duration:** 2-3 weeks  
**Prerequisite:** Phase 3 complete  
**Goal:** Intelligent routing, caching, observability

### Capabilities Beyond Phase 3 (Not in original 12)

| Feature | Why | Deliverable |
|---------|-----|-------------|
| **Smart Router** | Auto-pick best model for task | `src/opta_lmx/router/strategy.py` |
| **Prompt Caching** | Faster repeated prompts | MLX integration (if available) |
| **Speculative Decoding** | Faster inference | MLX integration (if available) |
| **Prometheus Metrics** | Observable performance | `/metrics` endpoint |
| **Per-model Benchmarks** | Know which model is fastest for what | API endpoint |

### Sub-Phases

#### 4A: Smart Router
**Deliverables:**
- [ ] Task classifier (what type of request is this?)
- [ ] Model capability matcher (which models can do this?)
- [ ] Routing rules (prefer smaller models at night, etc.)
- [ ] Fallback chains (if preferred model is full, use next)
- [ ] Tests: routing logic correctness

#### 4B: Performance Optimization
**Deliverables:**
- [ ] Prompt caching (if MLX supports it)
- [ ] KV-cache persistence (if applicable)
- [ ] Speculative decoding (if MLX supports it)
- [ ] Request queuing and batching
- [ ] Performance benchmarks (tok/s vs LM Studio)

#### 4C: Monitoring & Telemetry
**Deliverables:**
- [ ] Prometheus metrics export
- [ ] Per-model speed tracking
- [ ] Memory usage history
- [ ] Request logging (structured)
- [ ] Health dashboard (optional)

### Success Criteria
- ✓ Smart routing working (picks best model)
- ✓ Performance = or exceeds LM Studio on same hardware
- ✓ Observable metrics available
- ✓ v1.0 feature complete

---

## Phase 5: Integration & Production Hardening 🔄

**Duration:** 2-4 weeks  
**Prerequisite:** Phase 4 complete  
**Goal:** Production-ready, fully integrated

### Sub-Phases

#### 5A: Opta CLI Provider
**Deliverables:**
- [ ] `src/opta_cli/providers/lmx.ts` — TypeScript provider
- [ ] Rewrite `connect.ts`, `models.ts` to use LMX API
- [ ] Add `serve.ts` command (start/stop LMX daemon)
- [ ] Update config schema (drop LM Studio refs)
- [ ] Tests: CLI commands work

#### 5B: OpenClaw Bot Integration
**Deliverables:**
- [ ] All 6 bots tested with LMX
- [ ] Update bot configs (if needed)
- [ ] Document any breaking changes
- [ ] Performance tuning (memory allocation, routing rules)

#### 5C: Production Deployment
**Deliverables:**
- [ ] launchd plist (for Mac Studio)
- [ ] Auto-start on boot (KeepAlive)
- [ ] Logs to `/var/log/opta-lmx/` (log rotation)
- [ ] Config at `~/.opta-lmx/config.yaml`
- [ ] Update mechanism (how to upgrade)
- [ ] Documentation for operations team

### Success Criteria
- ✓ Opta CLI fully migrated (zero LM Studio references)
- ✓ All 6 bots work seamlessly with LMX
- ✓ launchd daemon runs 24/7 without issues
- ✓ v1.0 production release

---

## Anti-Features (Never)

These are explicitly NOT planned:

| Anti-Feature | Why |
|--------------|-----|
| ❌ GUI / graphical interface | This is a daemon |
| ❌ Chat UI | That's OptaPlus / Telegram bots |
| ❌ Built-in coding tools | That's Opta CLI |
| ❌ Cloud API proxying | Use OpenRouter/LiteLLM for that |
| ❌ Multi-machine distributed inference | Single machine only |
| ❌ Training / fine-tuning | Separate tool, not LMX |
| ❌ Mobile support | macOS only, Apple Silicon |

---

## Key Dates & Milestones

| Milestone | Target Date | Status |
|-----------|------------|--------|
| Phase 0 research complete | ~2026-02-29 | 🔄 In Progress |
| Phase 1 architecture locked | ~2026-03-07 | ⏳ Planned |
| Phase 2 MVP (port 1234) | ~2026-04-04 | ⏳ Planned |
| Phase 3 full feature set | ~2026-04-25 | ⏳ Planned |
| Phase 4 smart features | ~2026-05-16 | ⏳ Planned |
| Phase 5 v1.0 ready | ~2026-06-13 | ⏳ Planned |

*Dates are estimates. Actual timeline depends on research findings and implementation complexity.*

---

## References
- Detailed capabilities: `APP.md` §4
- Current phase plan: `docs/plans/MASTER-PLAN.md`
- Architectural decisions: `docs/DECISIONS.md`
- Safety guardrails: `docs/GUARDRAILS.md`

---

*This roadmap guides development. Update it as reality emerges during each phase.*
