# Opta LMX Features

Opta LMX (`1M-Opta-LMX`) is an Apple Silicon–native MLX inference server with an OpenAI-compatible API.

## Inference API

- [x] `POST /v1/chat/completions` — OpenAI-compatible chat completions
- [x] `POST /v1/completions` — legacy completions endpoint
- [x] Server-Sent Events (SSE) streaming — token-level streaming via `stream: true`
- [x] Tool/function calling support — schema-driven tool definitions
- [x] Multi-turn context — session history maintained per request
- [x] `POST /v1/embeddings` — text embedding generation
- [ ] `POST /v1/images/generations` — image generation (planned with vision models)
- [ ] Batch inference — async batch job API

## Model Management

- [x] `/v3/lmx/models` — list available and loaded models
- [x] `POST /v3/lmx/models/load` — load model by name
- [x] `POST /v3/lmx/models/unload` — unload model and free memory
- [x] Multiple simultaneous models — load multiple models, route by name
- [x] GGUF model support — load quantized GGUF models
- [x] Model inventory — scan filesystem for available model files
- [x] MLX model lifecycle — download, cache, and manage model weights
- [ ] Automatic model selection — route by task type

## Health & Observability

- [x] `GET /healthz` — liveness probe (no auth required)
- [x] `GET /readyz` — readiness probe with model-loaded check
- [x] `GET /admin/health` — full diagnostics: memory %, Metal GPU stats, helper node status
- [x] Metal GPU memory breakdown — active / peak / cache via MLX
- [x] In-flight request counter — real-time request metrics
- [x] `GET /admin/events` — SSE stream of throughput and health events

## Reliability

- [x] OOM-safe model loading — unload and degrade instead of crashing
- [x] Worker pool — concurrent request handling with queue
- [x] Request timeout — configurable inference timeout
- [x] Auto-recovery — restart helpers on failure without restarting server
- [ ] Circuit breaker — automatic fallback on sustained failures

## Advanced Inference

- [x] `POST /v1/rerank` — cross-encoder reranking for RAG pipelines
- [x] Embedding service — helper process for fast embedding generation
- [x] Rerank service — helper process for reranking
- [x] Streaming cancellation — abort in-progress inference
- [ ] Speculative decoding — draft model acceleration
- [ ] LoRA adapter loading — fine-tuned adapter support

## Backend Backends

- [x] MLX backend — Apple Silicon ANE + GPU acceleration
- [ ] vLLM backend — multi-GPU Linux server support
- [ ] llama.cpp backend — CPU fallback

## Configuration

- [x] `config.py` — typed configuration with env var overrides
- [x] Performance profiles — tuning presets for different hardware
- [x] Cloudflare Tunnel support — public exposure via tunnel config
- [x] Admin auth — Bearer token for `/admin/*` endpoints

## Recent Updates

- 2026-02-26 — Benchmark suite design completed
- 2026-02-23 — Never-crash OOM handling with auto-tune implementation
- 2026-02-22 — OpenClaw compatibility layer improvements
- 2026-02-19 — Phase 10 production hardening complete
