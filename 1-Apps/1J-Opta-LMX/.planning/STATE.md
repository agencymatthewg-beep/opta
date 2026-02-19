# Opta-LMX Project State

**Last Updated:** 2026-02-19 03:30 AEDT
**Current Phase:** Complete (Phases 0-10 done)
**Overall Progress:** 100% (all 10 phases implemented)

---

## Current Status

### Phase 8: Model Stack & Distributed Inference — COMPLETE
- Circuit breaker for helper nodes (hand-rolled, ~40 lines)
- HelperNodeClient integration with circuit breaker
- Background health check loop for helper nodes
- Circuit breaker state in /admin/stack
- StackPresetConfig + BackendConfig in config
- Backends and stack presets exposed in /admin/stack

### Phase 9: Advanced RAG & Context — COMPLETE
- RAGConfig expanded with 11 Phase 9 fields
- Configurable RRF k + weighted fusion in hybrid search
- Markdown-header chunking strategy
- Embedding dimension tracking per collection
- RerankerEngine with lazy loading (rerankers library)
- Rerank parameter in query and context assembly endpoints
- RerankerEngine wired into app lifespan

### Phase 10: Production Hardening — COMPLETE
- P0: admin_key set in production config
- P0: Log file moved to /var/log/opta-lmx/
- P1: /readyz readiness probe
- P1: Enhanced deep health check (Metal, helpers, engine)
- P1: launchd plist improvements (ExitTimeOut 60s, caffeinate)
- P1: Bounded semaphore with timeout -> HTTP 429
- P1: lmx_queued_requests Prometheus gauge
- P2: Runtime state persistence
- P2: Crash loop detection (safe mode after 3 rapid restarts)
- P2: Load shedding middleware (503 at 95% memory)

---

## Accumulated Decisions

### From Phase 0-7:
- **D1**: vllm-mlx as primary inference engine (not raw mlx-lm)
- **D2**: FastAPI + Uvicorn for API (not Flask/Starlette)
- **D3**: Pydantic v2 for all API models
- **D4**: GGUF via llama-cpp-python as optional fallback
- **D5**: Preset YAML files for per-model configuration
- **D6**: httpx.AsyncClient for helper node communication (not aiohttp)
- **D7**: FAISS for vector search with NumPy fallback
- **D8**: BM25 + vector hybrid search via Reciprocal Rank Fusion
- **D9**: Priority queuing via asyncio for request scheduling
- **D10**: Structured output enforcement via prompt injection + post-validation

### From Phase 8-10:
- **D11**: Hand-rolled circuit breaker (not aiobreaker) — minimal deps philosophy
- **D12**: Health check failures do NOT trip circuit breaker
- **D13**: Reranking is opt-in (not default) — adds 100-500ms latency
- **D14**: Lazy loading for reranker (load on first request)
- **D15**: Load shedding via raw ASGI middleware (not BaseHTTPMiddleware)
- **D16**: Rate limiting deferred (slowapi not installed)

---

## Blockers

None currently.

---

## Deferred Issues

- Rate limiting via slowapi — dependency not installed yet
- SSE integration tests (httpx-sse) — dev dependency not installed
- Thermal throttling detection via macmon — Homebrew dep
- Metal cache maintenance loop — P3 stretch goal
- Load testing scripts (Locust) — P3 stretch goal
- FAISS segfault in unit tests — known issue, API-level tests work
- CLI migration (Phase 5A) — separate repo
- Benchmarks vs LM Studio/Ollama — stretch goal
