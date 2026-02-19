---
title: "TECH-DECISIONS.md — Opta-LMX Phase 1 Technical Decisions"
created: 2026-02-15
updated: 2026-02-15
type: architecture
audience: Architects, coders, reviewers
status: Active
---

# Technical Decisions for Opta-LMX Phase 1

This document provides **deep technical justifications** for 12 key architectural decisions, backed by research evidence from Phase 0 investigation.

---

## TD-01: MLX Over llama.cpp

**Decision:** MLX (Apple's inference framework) as the primary inference engine.

**Alternatives Rejected:**
- **llama.cpp:** Cross-platform, but 21-87% slower on Apple Silicon (zero-copy unified memory advantage lost). Requires GGUF format only; slower adaptation to new model architectures (C++ recompilation cycle vs Python iteration).

**Research Evidence:**
- **vllm-mlx benchmarks (R1):** Qwen3-0.6B 525 tok/s (MLX) vs 281 tok/s (llama.cpp) = **1.87x speedup**. Qwen3-8B: 143 tok/s (MLX) vs 86 tok/s (llama.cpp) = **1.66x speedup**.
- **M3 Ultra performance (R4):** Zero-copy unified memory eliminates 8-12ms per-token PCIe latency overhead common in discrete GPU systems. MLX native design exploits this; llama.cpp adapted from CUDA architecture, retains pre-allocated KV cache overhead.
- **Architecture support (R2):** MLX-lm supports 100+ model architectures, including cutting-edge (Qwen-5, DeepSeek-V3.2, GLM-5). New model support deployable in days (Python) vs weeks (C++ recompile).

**Risk:** MLX smaller ecosystem than llama.cpp; community is growing but less mature for some niche models.

**Mitigation:** GGUF fallback (capability #11) provides safety net. If model lacks MLX weights, wrap llama-cpp-python. Most models now have MLX community conversions (mlx-community org: 1,000+ models).

---

## TD-02: Fork vllm-mlx vs Build from Scratch

**Decision:** Fork and extend vllm-mlx rather than building inference engine from scratch.

**Alternatives Rejected:**
- **Build from scratch:** Requires 3-6 months reimplementing: continuous batching (complex paging logic), model loading/unloading, quantization pipeline, multi-modal support. All solved by vllm-mlx.
- **Wrap as dependency:** Tight coupling to upstream release cycle; can't extend APIs; can't fix bugs in fork.

**Research Evidence:**
- **vllm-mlx capabilities (R1):** Already provides 6/12 non-negotiable capabilities: OpenAI API, streaming, tool calling (MCP), multi-modal support, continuous batching (see below), inference endpoint.
- **Continuous batching performance (R1):** 5 concurrent requests = **3.4x throughput** (Qwen3-0.6B: 328 tok/s single → 1112 tok/s batched). No other MLX server offers this. Community implementations would take weeks.
- **Architecture maturity (R1):** vllm-mlx has 365 GitHub stars, Apache 2.0 license, actively maintained (updated daily). Clean codebase, well-documented. Lower fork/extend friction than competitors (mlx-omni-server, mlx-openai-server have same features but less polish).

**Risk:** Upstream changes break compatibility; maintenance burden of keeping sync with vllm-mlx updates.

**Mitigation:** Keep upstream sync discipline; PR back improvements; use git subtree for selective merges. If upstream diverges, have clear fork point. Admin UI additions are orthogonal to core inference — easy to maintain.

---

## TD-03: FastAPI Over Flask/Starlette

**Decision:** FastAPI + Uvicorn for HTTP server.

**Alternatives Rejected:**
- **Flask:** Synchronous, requires add-ons for async. No native streaming, manual OpenAPI docs.
- **Starlette:** Lighter than FastAPI but no built-in Pydantic validation, must write schemas manually.
- **Raw ASGI:** Full control but reinvents routing, middleware, validation.

**Research Evidence:**
- **vllm-mlx uses FastAPI (R1):** Proven in production. Async-native, Pydantic validation built-in, automatic Swagger/OpenAPI docs. Handles concurrent requests without thread pool overhead.
- **Streaming performance:** FastAPI's `StreamingResponse` + `async def` enables efficient SSE (no blocking I/O). Competitors using Flask require gevent/async patches.

**Risk:** FastAPI has dependencies (Pydantic, Starlette, Python 3.7+); larger attack surface than minimal frameworks.

**Mitigation:** Pin versions, security audits. FastAPI's simplicity is asset (fewer surprises than Flask extensions).

---

## TD-04: Python 3.11+ Over Rust/C++

**Decision:** Python 3.11+ for all application code (orchestration, API, model management).

**Alternatives Rejected:**
- **Rust/C++:** Would require FFI to MLX (Python-native framework). No performance gain — MLX handles hot path (matrix ops). Adds complexity for zero throughput benefit.

**Research Evidence:**
- **MLX is Python-native (R2):** mlx, mlx-lm, mlx-vlm all expose Python APIs. FFI would lose performance (marshalling overhead) and maintainability.
- **Python 3.11+ performance (R4):** 10-60% faster than 3.10 (faster startup, better JIT). Mature async/await. Type hints fully supported.
- **Precedent:** vllm-mlx, Ollama (Go wrapper), TabbyAPI all use Python for app layer, C/C++ only for inference kernels.

**Risk:** Python overhead vs native; slower startup time; GIL contention for CPU-bound tasks.

**Mitigation:** Use async/await to avoid GIL blocking. Inference (GPU-bound) dominates — Python overhead negligible. Tokenization (CPU-bound) is small % of total latency.

---

## TD-05: Port 1234 (Drop-in LM Studio Replacement)

**Decision:** LMX serves on port 1234, same as LM Studio.

**Alternatives Rejected:**
- **Port 8000/5000:** Would require configuration change for Opta CLI, bots, OpenClaw — migration day risk.
- **Dual ports:** Possible (inference on 1234, admin on 1235), but adds complexity.

**Research Evidence:**
- **Ecosystem convention (R3, R4):** LM Studio uses 1234. Ollama uses 11434. TabbyAPI uses 5000. Our goal is drop-in replacement, so 1234 is correct.
- **Zero config change:** Every client already points at localhost:1234. On migration day, kill LM Studio, start Opta-LMX, nothing breaks.

**Risk:** Port 1234 might conflict with other services on user's machine.

**Mitigation:** Clear error message if port busy; provide configuration option to override (but default hardcoded to 1234 in launchd plist).

---

## TD-06: Separate Admin API vs Unified API

**Decision:** Two path prefixes: `/v1/*` (inference, OpenAI standard) and `/admin/*` (model management, our addition).

**Alternatives Rejected:**
- **Merge into `/v1/*`:** Would pollute OpenAI spec with non-standard endpoints (e.g., `/v1/models/load`). Future tool breaking changes.

**Research Evidence:**
- **API isolation (R1, R3):** TabbyAPI, llama-swap, LocalAI all use separate admin paths. Keeps inference API stable and compatible with any OpenAI SDK.
- **Security:** Different auth schemes (API key for inference, admin key for management). Easier to restrict admin access.

**Risk:** Duplicate routing/auth logic; clients must know about both APIs.

**Mitigation:** Admin API optional (can run without it for pure inference). Well-documented. Auto-generated Swagger docs for both.

---

## TD-07: YAML Config Over JSON/TOML

**Decision:** `~/.opta-lmx/config.yaml` for server configuration.

**Alternatives Rejected:**
- **JSON:** Machine-readable but poor for human editing; no comments.
- **TOML:** Fine, but YAML more standard in Python ecosystem (PyYAML ubiquitous).
- **Env variables only:** Don't scale (dozens of settings); hard to version control.

**Research Evidence:**
- **Precedent (R3):** Ollama uses Modelfile (YAML-like). mlx-openai-server uses YAML. Standard in Python tools (Docker Compose, Kubernetes, Ansible).
- **Launchd friendliness:** YAML templates easily substituted for environment paths, model names, etc.

**Risk:** YAML whitespace sensitivity; requires PyYAML dependency.

**Mitigation:** Validate YAML on startup; provide sample config with comments; use strict YAML parsing (no Python eval).

---

## TD-08: launchd Daemon Over systemd/Docker

**Decision:** launchd for service management on macOS.

**Alternatives Rejected:**
- **systemd:** Linux-only; not applicable to Mac Studio.
- **Docker:** Adds complexity, overhead; single-machine deployment doesn't benefit from containerization.
- **Manual `python -m uvicorn`:** Not production-ready; requires user terminal, no auto-restart, no logging.

**Research Evidence:**
- **macOS standard (R4, R3):** launchd is macOS-native service manager. Every macOS daemon uses it. Built-in, zero dependencies.
- **Features:** Auto-start on boot (`RunAtLoad`), auto-restart on crash (`KeepAlive`), process ownership, log routing to system log.

**Risk:** launchd plist syntax arcane; launchd debugging harder than systemd.

**Mitigation:** Provide pre-written plist template; document common issues (permissions, file paths); use `launchctl list com.opta.lmx` for status.

---

## TD-09: Memory Management Strategy

**Decision:** Monitor unified memory with `psutil` + MLX stats. Refuse to load model if >90% threshold would be exceeded. Graceful degradation: unload least-recently-used model on memory pressure.

**Alternatives Rejected:**
- **No memory monitoring:** OOM kills process unpredictably.
- **Strict 100% limit:** No headroom for OS, system daemons.
- **Per-model memory check only:** Doesn't account for KV cache growth during inference.

**Research Evidence:**
- **M3 Ultra capacity (R4):** 512GB unified memory, ~460GB usable (after OS, other processes). Qwen3-32B model (18GB) + max context KV cache (30GB+) + headroom = 90% threshold sensible.
- **Memory pressure monitoring:** macOS provides memory pressure states (Green/Yellow/Red). Monitor with Activity Monitor or `vm_stat`. Swap to SSD is 100x slower than RAM.
- **LRU eviction (R3):** Ollama and llama-swap both use TTL-based auto-unloading. TabbyAPI uses LRU. Works in practice.

**Risk:** Complex eviction logic; potential race conditions under high load.

**Mitigation:** Implement queue lock for model loading/unloading. Log all memory decisions. Test with 70B model + high concurrency.

---

## TD-10: HuggingFace Hub for Model Downloads

**Decision:** `huggingface_hub` Python library for model acquisition (auth, resume, checksum).

**Alternatives Rejected:**
- **Manual wget/curl:** No resume, no auth, no checksum verification.
- **Custom implementation:** Reinvents wheel; huggingface_hub already handles all edge cases.

**Research Evidence:**
- **Standard (R1, R3):** LM Studio, Ollama, LocalAI, vllm-mlx all use huggingface_hub. Same ecosystem everyone uses.
- **Features (R2):** Progress callbacks enable SSE streaming to admin clients (real-time download progress). Token-based auth for gated models. Automatic checksum verification (SHA256).

**Risk:** Dependency on HuggingFace Hub uptime; account rate limits.

**Mitigation:** Graceful fallback if HF down. Local model mirror option (documented in OPERATIONS.md). Cache credentials securely.

---

## TD-11: Structured Logging (JSON)

**Decision:** All logs as JSON (machine-parseable), human-readable with `jq` or standard log viewer.

**Alternatives Rejected:**
- **Plain text:** Hard to parse, grep, aggregate for monitoring.
- **Syslog format:** Legacy; JSON is modern standard.

**Research Evidence:**
- **Observability (R1, R3, R4):** vLLM, LMDeploy, LocalAI all use JSON logging. Industry standard for cloud/production. Enables structured queries.
- **macOS integration:** launchd logs to `/var/log/system.log`; JSON structured logs easily parsed by log analysis tools.

**Risk:** Verbose output; slight performance overhead.

**Mitigation:** Sampled logging for high-frequency events. Compress old logs.

---

## TD-12: vllm-mlx Continuous Batching

**Decision:** Leverage vllm-mlx's continuous batching (Paged KV cache + request queue) to handle concurrent requests.

**Alternatives Rejected:**
- **Sequential processing:** One request at a time. 6 bots = 6x latency. Unacceptable.
- **Naive batching:** Load N prompts at once, wait for longest to finish. Inefficient for variable-length sequences.

**Research Evidence:**
- **vllm-mlx performance (R1):** 5 concurrent requests = **3.4x throughput** (Qwen3-0.6B: 328→1112 tok/s). No competing MLX server offers this (mlx-omni-server, mlx-openai-server lack it).
- **Multi-bot workload (APP.md):** 6 OpenClaw bots hitting same endpoint. Continuous batching essential. Without it, requests queue up, latency explodes.
- **Architecture (R1):** Paged KV cache (inspired by vLLM's PagedAttention) enables non-contiguous memory blocks. Allows interleaved generation of multiple sequences.

**Risk:** Complex scheduler logic; potential for fairness issues (some requests starved).

**Mitigation:** Request priority queue; timeouts for long-running requests; load testing with 10+ concurrent requests before production.

---

## Summary

| Decision | Choice | Why |
|----------|--------|-----|
| **Inference** | MLX | 21-87% faster on Apple Silicon, Python-native |
| **Server** | vllm-mlx fork | 3.4x throughput via continuous batching |
| **API Server** | FastAPI | Async-native, streaming, OpenAPI docs |
| **Language** | Python 3.11+ | MLX is Python, no FFI overhead |
| **Port** | 1234 | Drop-in LM Studio replacement |
| **API Split** | `/v1/*` + `/admin/*` | Separate concerns, stable inference API |
| **Config** | YAML | Human-readable, launchd-friendly |
| **Service** | launchd | macOS-native, zero dependencies |
| **Memory** | 90% threshold + LRU | Prevent OOM, graceful degradation |
| **Models** | HuggingFace Hub | Standard, authenticated, checksummed |
| **Logging** | JSON | Structured, machine-parseable |
| **Batching** | Continuous (vllm-mlx) | 3.4x throughput for concurrent requests |

---

## References

- **R1:** `docs/research/existing-mlx-servers.md` — vllm-mlx benchmarks, architecture comparison
- **R2:** `docs/research/mlx-capabilities.md` — MLX model architecture support, quantization, batching
- **R3:** `docs/research/competitor-analysis.md` — Ollama, LM Studio, TabbyAPI, llama.cpp analysis
- **R4:** `docs/research/apple-silicon-optimization.md` — M3 Ultra specs, memory bandwidth, thermal management
- **APP.md:** Project scope, 12 non-negotiable capabilities

---

*Last updated: 2026-02-15*  
*Status: Approved for Phase 2 Implementation*
