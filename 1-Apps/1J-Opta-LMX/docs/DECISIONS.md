---
title: DECISIONS.md — Settled Architecture Decisions
created: 2026-02-15
updated: 2026-02-15
type: architecture
audience: Architects, coders, reviewers
status: Active
---

# DECISIONS.md — Opta-LMX Architecture Decisions

This file documents **why** we chose each major technology, pattern, and design. Each decision is final (unless Phase 1 research changes everything). If you disagree, discuss with Matthew — don't work around it.

---

## Technology Stack Decisions

### Decision D-01: MLX Over llama.cpp

**Status:** ✅ Decided  
**Date:** 2026-02-15  
**Owner:** Phase 0 Research (Agent R2 + R5)

#### What We Chose
MLX (Apple's inference framework) as the primary inference engine.

#### Why (Not llama.cpp)
| Factor | MLX | llama.cpp |
|--------|-----|-----------|
| **Performance on Apple Silicon** | 15-30% faster (zero-copy unified memory) | Slower (GGUF quantization overhead) |
| **Maintainability** | Python-native, easier to hack | C++ codebase, harder to modify |
| **Model support** | Growing fast (MLX community) | Excellent (most models have GGUF) |
| **Deployment** | Native Python via uvicorn | Requires C++ binary compilation |
| **Our constraints** | Perfect fit | Works but suboptimal |

#### Implication
- Primary: MLX for all models that support it
- Fallback: llama-cpp-python for models without MLX weights (e.g., GLM-5 today)
- No pure llama.cpp server (we wrap it as fallback)

#### Decision Reversible?
Only if Phase 4 performance benchmarks show llama.cpp is faster in practice. Unlikely given unified memory architecture.

---

### Decision D-02: FastAPI Over Flask

**Status:** ✅ Decided  
**Date:** 2026-02-15

#### What We Chose
FastAPI + Uvicorn for the HTTP server.

#### Why (Not Flask)
| Factor | FastAPI | Flask |
|--------|---------|-------|
| **Async** | Native async/await throughout | Requires add-ons (gevent, etc.) |
| **Streaming** | Built-in SSE support | Manual implementation needed |
| **Validation** | Pydantic auto-validation | Manual schemas required |
| **OpenAPI docs** | Automatic Swagger docs | Manual setup |
| **Performance** | Higher throughput | Adequate but slower |
| **Development** | Type hints first | Looser typing |

#### Implication
- All code is async (see CLAUDE.md)
- Streaming responses are native (no custom SSE code)
- Request validation is declarative (Pydantic models)
- Server is Uvicorn ASGI (not Flask's WSGI)

#### Decision Reversible?
Only if we find Flask/similar with async support. FastAPI is the clear choice for this use case.

---

### Decision D-03: Python Over Rust/C++

**Status:** ✅ Decided  
**Date:** 2026-02-15

#### What We Chose
Python 3.11+ for all application code.

#### Why (Not Rust/C++)
| Factor | Python | Rust | C++ |
|--------|--------|------|-----|
| **MLX integration** | Native (MLX is Python) | Requires FFI | Requires FFI |
| **Dev velocity** | Fast iteration | Slower compilation | Slower compilation |
| **Maintainability** | Clear, readable | Steep learning curve | Steep learning curve |
| **Deployment** | pip install | Cross-compile complexity | Compilation per platform |
| **Our need** | Orchestration, not kernel code | Overkill | Overkill |

#### Implication
- No Rust/C++ bindings (use MLX Python API directly)
- All infrastructure is Python (config, admin, router)
- Fallback (llama-cpp-python) is also Python-wrapped

#### Decision Reversible?
No. Python + MLX is the right choice for an orchestration layer.

---

## API & Protocol Decisions

### Decision D-04: Port 1234 (Drop-in LM Studio Replacement)

**Status:** ✅ Decided  
**Date:** 2026-02-15

#### What We Chose
LMX listens on port 1234, same as LM Studio.

#### Why
- Every client is already pointing at port 1234
- Zero config change for Opta CLI, bots, Matthew
- Drop-in replacement = no risk of config mismatch
- LM Studio convention is already established

#### Implication
- No flexibility on port (hardcoded in launchd plist)
- Cannot run multiple LMX instances on same machine
- Easier integration testing (compare output directly)

#### Decision Reversible?
No. Changing port breaks every existing client.

---

### Decision D-05: OpenAI API Compatibility (Not a Custom API)

**Status:** ✅ Decided  
**Date:** 2026-02-15

#### What We Chose
LMX implements OpenAI's Chat Completions API exactly (request/response format).

#### Why
- Every client library already supports OpenAI format (Python SDK, JavaScript, etc.)
- Opta CLI can use standard OpenAI SDK (if we expose it)
- Bots expect this format (zero breaking change)
- OpenAI format is industry standard

#### What This Means
- `/v1/chat/completions` — exact OpenAI schema
- `/v1/models` — exact OpenAI models list format
- SSE streaming — exact OpenAI streaming format
- Error codes — match OpenAI conventions

#### What We DON'T Implement
- OpenAI models endpoint (we list OUR models, not OpenAI's)
- Fine-tuning (we don't support it)
- Vision API (we don't support images)
- File/batch operations (not in scope)

#### Decision Reversible?
Absolutely not. Breaking OpenAI compatibility = breaking all clients.

---

### Decision D-06: Admin API Separate from Inference API

**Status:** ✅ Decided  
**Date:** 2026-02-15

#### What We Chose
Two path prefixes:
- `/v1/*` — Inference API (OpenAI-compatible, public)
- `/admin/*` — Admin API (model management, internal only)

#### Why (Not Unified)
- Inference API is external-facing (bots, CLI)
- Admin API is bot-facing (model load/unload/download)
- Different security models (inference is stateless, admin has side effects)
- Easier versioning (admin can change, inference stays stable)

#### Implication
- `/v1/chat/completions` stays forever stable
- `/admin/model/load`, `/admin/model/download`, etc. can evolve
- LM Studio compatibility only requires `/v1/*` (good!)

#### Decision Reversible?
Could merge them, but no benefit. Keep separate.

---

## Deployment & Operations Decisions

### Decision D-07: launchd Daemon (Not systemd, Not Foreground)

**Status:** ✅ Decided  
**Date:** 2026-02-15

#### What We Chose
LMX runs as a launchd daemon on macOS (only platform).

#### Why
- macOS-native service management (no additional tools)
- Auto-start on boot (`RunAtLoad`)
- Auto-restart on crash (`KeepAlive`)
- Logs to persistent files (not volatile stdout)
- Standard macOS pattern (familiar to users)

#### What We DON'T Support
- systemd (Linux — not in scope)
- Docker (extra layer, not needed for single machine)
- Manual `python -m uvicorn` in production (only for dev)

#### Implication
- Must create `/Library/LaunchDaemons/com.opta.lmx.plist`
- Logs at `/var/log/opta-lmx/*.log`
- Deployment via `launchctl load/unload`
- Can't run on Linux (but that's not a goal)

#### Decision Reversible?
Not for this project. macOS-only is a constraint.

---

### Decision D-08: GGUF Fallback (Not Exclusive GGUF)

**Status:** ✅ Decided  
**Date:** 2026-02-15

#### What We Chose
Primary: MLX inference for models with MLX weights  
Fallback: llama-cpp-python for models without MLX weights  
Not: Switch entirely to GGUF

#### Why
- MLX is faster on Apple Silicon
- Not all models have MLX weights yet (e.g., GLM-5)
- Fallback provides coverage without sacrificing performance
- Same API regardless of backend (transparent to client)

#### Implication
- Load order: try MLX → fall back to GGUF if not found
- `/admin/model/load` auto-selects backend
- User doesn't choose MLX vs GGUF (system does)
- Some models will be slower (GGUF) than others (MLX)

#### Decision Reversible?
Only if we decide to drop GGUF support entirely (unlikely) or switch entirely to GGUF (would be slower).

---

## Model Management Decisions

### Decision D-09: Model Downloads Verified (SHA256)

**Status:** ✅ Decided  
**Date:** 2026-02-15

#### What We Chosen
Every model downloaded from HuggingFace must be verified with SHA256 before loading.

#### Why
- Model weights could be corrupted or compromised
- SHA256 is standard verification (not custom crypto)
- HuggingFace provides hashes for major models
- If hash fails, we know immediately (not at inference time)

#### Implication
- Model inventory includes SHA256 hashes
- `/admin/model/download` computes hash after download
- Mismatch → error, don't load
- Slight overhead (one hash computation), but worth it

#### Decision Reversible?
No. This is non-negotiable security. See GUARDRAILS.md G-LMX-02.

---

### Decision D-10: Config Format is YAML

**Status:** ✅ Decided  
**Date:** 2026-02-15

#### What We Chose
`~/.opta-lmx/config.yaml` for all configuration.

#### Why
- Human-readable (easier than JSON)
- Supports comments (easier to document)
- Standard in Python ecosystem (PyYAML)
- Opta CLI also uses YAML (consistency)

#### Implication
- Sample config provided in repo
- Code loads YAML at startup
- Can edit config without restarting (Phase 4 feature)

#### Decision Reversible?
Could switch to TOML (also good), but YAML is established pattern.

---

## Performance & Optimization Decisions

### Decision D-11: Async Everywhere (Not Mixed)

**Status:** ✅ Decided  
**Date:** 2026-02-15

#### What We Chose
All I/O is async/await. No synchronous blocking calls in critical path.

#### Why
- MLX generation can be slow (seconds per request)
- Async allows other requests to run while waiting
- FastAPI is async-native
- Python 3.11+ async/await is mature and readable

#### Implication
- No `time.sleep()` in critical path
- No `requests.get()` (use `aiohttp`)
- No blocking model loads (use `asyncio.to_thread` if needed)
- All routes are `async def`

#### Decision Reversible?
No. Async is the foundation of the server design.

---

### Decision D-12: Memory Limit is 90% of Available

**Status:** ✅ Decided  
**Date:** 2026-02-15

#### What We Chose
Never load a model if it would use > 90% of unified memory.

#### Why
- Beyond 90%, OOM risk is high
- Want buffer for other processes
- Mac Studio has 512GB, but much is shared with system
- Graceful degradation: unload a model if needed

#### Implication
- Model loader checks memory before loading
- If exceeds 90%: return error or auto-unload LRU
- Never crash on OOM
- See GUARDRAILS.md G-LMX-01

#### Decision Reversible?
Could be tuned (85% or 95%), but 90% is reasonable.

---

## Known Open Questions (For Phase 1)

These were listed in APP.md §10 but are now addressed:

| Question | Status | Decision |
|----------|--------|----------|
| Fork or build? | ✅ Resolved | Fork vllm-mlx v0.2.6 + Admin layer (see ARCHITECTURE.md §1) |
| Single or dual port? | ✅ Resolved | Single port 1234, separate path prefixes (/v1, /admin) |
| GGUF priority? | ✅ Resolved | Fallback (not primary) — MLX first, GGUF as safety net |
| Model format preferences? | ✅ Resolved | Auto-convert not needed; support both natively |
| Config format? | ✅ Resolved | YAML |
| Authentication? | ✅ Resolved | Trust LAN (no auth by default); X-Admin-Key optional |

---

## Summary Table

| Decision | Chosen | Alternative | Reversible |
|----------|--------|-------------|-----------|
| Inference | MLX | llama.cpp | No (unlikely) |
| API Server | FastAPI + Uvicorn | Flask | No |
| Language | Python | Rust/C++ | No |
| Port | 1234 | Other | No |
| API Format | OpenAI-compatible | Custom | No |
| Admin API | Separate `/admin/*` | Merged into `/v1/*` | Possible but not needed |
| Deployment | launchd daemon | Docker/systemd | No (macOS-only) |
| GGUF Strategy | Fallback | Exclusive | Possible |
| Config | YAML | TOML | Possible |
| Async | Yes (everywhere) | Mixed async/sync | No |
| Memory limit | 90% | 85%/95% | Tunable |

---

## How to Propose a Change

If you disagree with a decision (during Phase 0-1 especially):
1. **Document your concern** (e.g., "MLX doesn't support quantization yet")
2. **Propose alternative** (e.g., "Use llama.cpp instead")
3. **Discuss with Matthew** (don't implement it differently)
4. **Update this file** if decision changes

During implementation (Phase 2+):
- These decisions are locked
- Small variations OK (e.g., different config format) if approved
- Major changes require Matthew review

---

## References
- Project scope: `APP.md`
- Development phases: `docs/ROADMAP.md`
- Guardrails: `docs/GUARDRAILS.md`
- Research: `docs/research/` (0A-0E outputs)

---

*This file is the source of truth for architecture choices. Update it as new decisions are made, but lock settled ones.*
