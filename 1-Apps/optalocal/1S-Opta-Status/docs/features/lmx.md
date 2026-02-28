# Opta LMX Features

## Inference Server
- [x] MLX-native inference on Apple Silicon
- [x] OpenAI-compatible `/v1/chat/completions` endpoint
- [x] Streaming SSE responses
- [x] GGUF model loading (llama.cpp fallback)
- [x] Automatic quantization selection
- [x] Model hot-swap without restart
- [x] Concurrent request handling
- [x] KV cache management
- [x] Context length enforcement
- [ ] vLLM backend for parallel batching

## Model Management
- [x] Model inventory API (`/admin/models`)
- [x] Dynamic load/unload API
- [x] Memory headroom enforcement (never crash on OOM)
- [x] Model health monitoring
- [x] HuggingFace model download integration
- [x] GGUF format support
- [ ] LoRA adapter loading
- [ ] Model benchmarking suite

## API Compatibility
- [x] OpenAI `/v1/chat/completions`
- [x] OpenAI `/v1/models`
- [x] Health endpoint `/healthz`
- [x] Admin events SSE `/admin/events`
- [x] Rerank endpoint `/v1/rerank`
- [x] Skills API `/v1/skills`
- [x] Agents API `/v1/agents`
- [ ] Embeddings endpoint `/v1/embeddings`
- [ ] Function calling (tool_use)

## Performance
- [x] ANE (Apple Neural Engine) utilization
- [x] Batch request coalescing
- [x] Throughput metrics (tokens/sec)
- [x] Active request tracking
- [ ] Auto-tune quantization per model size
- [ ] Thermal throttle detection
