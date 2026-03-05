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
- [x] vLLM backend for parallel batching

## Model Management

- [x] Model inventory API (`/admin/models`)
- [x] Dynamic load/unload API
- [x] Memory headroom enforcement (never crash on OOM)
- [x] Model health monitoring
- [x] HuggingFace model download integration
- [x] GGUF format support
- [ ] LoRA adapter loading
- [x] Model benchmarking suite

## API Compatibility

- [x] OpenAI `/v1/chat/completions`
- [x] OpenAI `/v1/models`
- [x] Health endpoint `/healthz`
- [x] Admin events SSE `/admin/events`
- [x] Rerank endpoint `/v1/rerank`
- [x] Skills API `/v1/skills`
- [x] Agents API `/v1/agents`
- [x] Embeddings endpoint `/v1/embeddings`
- [ ] Function calling (tool_use)

## Performance

- [x] ANE (Apple Neural Engine) utilization
- [x] Batch request coalescing
- [x] Throughput metrics (tokens/sec)
- [x] Active request tracking
- [ ] Auto-tune quantization per model size
- [ ] Thermal throttle detection

## Deployment Readiness

- [ ] Production LMX + Daemon configuration for status/admin/local-web health wiring

## Voice & Audio

- [x] Speech-to-text endpoint `POST /v1/audio/transcriptions` (mlx-whisper)
- [x] Text-to-speech endpoint `POST /v1/audio/speech` (mlx-audio + Kokoro)
- [x] Multipart form upload for audio files (WebM, WAV, MP3)
- [x] `soundfile` I/O for audio processing
- [ ] Real-time streaming transcription (WebSocket STT)
- [ ] Voice activity detection (VAD)

## Recent Updates

- 2026-03-05 — The Opta LMX Dashboard has been completely overhauled with the new Holographic HUD design language.

- 2026-03-04 — This update introduces native localized voice dictation, Text-to-Speech (TTS), and global audio p...

## Auto-Synced Features
- [x] Design: The Opta LMX Dashboard has been completely overhauled with the new Holographic H
- [x] Integrated the `mlx-whisper` package for STT processing at `POST /v1/audio/transcriptions` and `mlx-audio` for TTS generation at `POST /v1/audio/speech`. Handled natively using the MLX framework with no system-crashing processes.

<!-- opta-sync-applied: 0004-opta-core-voice-integration -->

<!-- opta-sync-applied: 0011-lmx-holographic-hud -->
