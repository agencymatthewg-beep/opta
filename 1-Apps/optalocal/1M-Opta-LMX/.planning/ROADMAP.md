---
status: review
---

# Opta-LMX Roadmap

**Created:** 2026-02-19
**Last Updated:** 2026-02-19

---

## Completed Phases

### Phase 0: Research ✅ (2026-02-15)
Research into MLX servers, capabilities, OpenAI API spec, competitors, Apple Silicon optimization.

### Phase 1: Design & Architecture ✅ (2026-02-15)
Architecture design, tech decisions, API specification.

### Phase 2: Core Implementation ✅ (2026-02-15)
Project scaffolding, MLX inference core, OpenAI-compatible API, Admin API.

### Phase 3: Admin & Management ✅ (2026-02-15)
Model manager, download/delete API, GGUF fallback.

### Phase 4: Smart Features ✅ (2026-02-15)
Smart router, performance optimization (KV cache, speculative decoding, prefix cache), monitoring & telemetry, config hot-reload.

### Phase 5: Integration ✅ PARTIAL (2026-02-15)
Deployment (launchd, log rotation, production config). CLI and OpenClaw integration deferred to separate repos.

### Phase 6: Polish & Hardening ✅ (2026-02-16)
Model presets, enhanced SSE events, WebSocket support, code audit. 523 tests, 35+ source modules.

### Phase 7: Performance Optimization ✅ (2026-02-19)
7A: Engine hardening (Metal limits, speculative guard, warmup, stream interval).
7B: Request intelligence (priority queuing, client metrics, per-model TTL, scheduler config).
7C: Output & context quality (structured output enforcement, per-request context, rich presets).

---

## Active Phases

### Phase 8: Model Stack & Distributed Inference
**Status:** Research
**Research:** Required — distributed inference, helper node coordination, service discovery
**Description:** Role-based model routing formalization, helper node distribution across LAN, Model Stack configuration system, embedding/reranking on GPU workers.

**Scope:**
- Formalize Model Stack as a named configuration concept
- Admin API for stack status (`GET /admin/stack`)
- Helper node health monitoring with circuit breakers
- Service discovery for LAN inference nodes (static + mDNS)
- Embedding model auto-management on helper nodes
- Reranking integration with helper node fallback
- Stack presets (pre-defined role→model configurations)

### Phase 9: Advanced RAG & Context
**Status:** Research
**Research:** Required — KV cache persistence, hybrid search optimization, context compression
**Description:** KV cache persistence, hybrid vector+BM25 search optimization, RAG pipeline optimization, context compression.

**Scope:**
- KV cache persistence for session continuity
- Hybrid search tuning (RRF weights, query expansion)
- FAISS optimization for Apple Silicon
- Context compression techniques
- Document processing pipeline improvements
- Embedding quality optimization (model selection, dimension reduction)
- Reranking integration in RAG pipeline

### Phase 10: Production Hardening
**Status:** Research
**Research:** Required — integration testing, load testing, crash recovery
**Description:** Integration test suite, load testing, crash recovery, launchd production deployment hardening, log rotation improvements.

**Scope:**
- Integration test suite (httpx.AsyncClient, SSE testing, mock model loading)
- Load testing framework (Locust/k6 scripts)
- Crash recovery (graceful SIGTERM, state persistence, model re-loading)
- Enhanced health checks (deep model health, GPU status, memory pressure)
- Security hardening (API key rotation, rate limiting, CORS)
- Log management improvements (structured logging, correlation IDs)
- macOS production hardening (sleep prevention, thermal detection)

---

## Metrics

| Phase | Tests | Source Files | API Endpoints |
|-------|-------|-------------|---------------|
| Phase 6 (baseline) | 523 | 35+ | 24+ |
| Phase 7 (current) | 542 | 53 | 43 |
| Phase 10 (target) | 650+ | 60+ | 50+ |
