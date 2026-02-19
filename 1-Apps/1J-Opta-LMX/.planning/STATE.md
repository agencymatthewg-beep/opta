# Opta-LMX Project State

**Last Updated:** 2026-02-19 01:30 AEDT
**Current Phase:** Phase 8 (Research)
**Overall Progress:** 70% (Phases 0-7 complete, 8-10 remaining)

---

## Current Status

### Phase 8: Model Stack & Distributed Inference — RESEARCHING
- 3 parallel research agents investigating distributed inference, RAG, and production hardening
- Existing infrastructure: helpers/client.py (HelperNodeClient), router/strategy.py (TaskRouter), config.py (HelperNodesConfig)
- Design doc exists: `docs/plans/2026-02-17-model-stack-design.md`

### Phase 9: Advanced RAG & Context — RESEARCHING (parallel)
- Existing infrastructure: rag/ module (store.py, bm25.py, chunker.py, processors.py)
- Design doc exists: `docs/plans/2026-02-17-performance-optimization-design.md`

### Phase 10: Production Hardening — RESEARCHING (parallel)
- Existing infrastructure: launchd plist, log rotation, production config, 542 tests

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

---

## Blockers

None currently.

---

## Deferred Issues

- CLI migration (Phase 5A) — separate repo, not blocking LMX work
- OpenClaw integration (Phase 5B) — separate repo
- Benchmarks vs LM Studio/Ollama — Phase 10 stretch goal
- pytest-asyncio needed in Python 3.14 test environment
