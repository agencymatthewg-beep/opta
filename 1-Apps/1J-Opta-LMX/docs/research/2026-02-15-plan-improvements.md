# Opta-LMX Plan Improvements — Research Findings (2026-02-15)

## 🔴 Critical: vllm-mlx v0.2.6 Released (Feb 13)

Our plan was based on an older vllm-mlx. v0.2.6 shipped **massive** features that affect our fork strategy:

### New in v0.2.6 (since our research)
| Feature | Impact on LMX |
|---------|---------------|
| **Tool calling (12 parsers)** | Mistral, DeepSeek, Granite, Nemotron, GLM-4.7, Harmony, Qwen3-Coder streaming |
| **Embeddings API** | `/v1/embeddings` endpoint via mlx-embeddings — we planned this for Phase 3 |
| **Reasoning parser** | Chain-of-thought output parsing — we didn't plan this at all |
| **Anthropic Messages API** | `/v1/messages` endpoint — we listed this in architecture but vllm-mlx now has it natively |
| **Prefix cache improvements** | Agentic multi-turn scenarios, QuantizedKVCache fixes |
| **315 tests, CI on Apple Silicon** | Test suite we can inherit |
| **mlx-lm 0.30.5+ required** | Minimum version bump, transformers 5.0.0+ |

### Plan Changes Required
1. **Phase 2B (Inference Core):** Remove tool calling, embeddings, reasoning from our backlog — vllm-mlx already has them
2. **Phase 2C (API Layer):** `/v1/messages` Anthropic endpoint already exists — we only need Admin API
3. **Fork base:** Must fork from v0.2.6 tag, not main
4. **Our value-add narrows to:** Admin API (load/unload/swap), memory monitoring, YAML config, launchd service, multi-model management
5. **Estimated effort reduction:** ~30-40% less work than originally planned

### ⚠️ Risk: vllm-metal (Official vLLM Plugin)
Community mentions `vllm-project/vllm-metal` — an official Apple Silicon backend in development. This could eventually supersede vllm-mlx. Monitor but don't pivot yet; vllm-mlx is production-ready now, vllm-metal is not.

### ⚠️ Risk: GGUF catching up on Apple Silicon
Reddit reports GGUF with flash attention is now "slightly faster than MLX" on Mac Studio for some models. Our differentiation is continuous batching (multi-bot concurrent requests), not raw single-stream speed.

---

## Recommended Plan Updates

### claude-prompt-phase2-mvp.md Changes
1. Add instruction to fork from `v0.2.6` tag specifically
2. Remove tool calling implementation from scope (already done)
3. Remove embeddings implementation from scope (already done)
4. Add reasoning parser passthrough in API spec
5. Add Anthropic Messages API passthrough (already done by upstream)
6. Focus Phase 2C exclusively on Admin API endpoints
7. Add `mlx-lm>=0.30.5` and `transformers>=5.0.0` to dependency pins
8. Add prefix cache configuration to YAML config schema

### New Phase 2 Scope (Revised)
```
Phase 2A: Fork vllm-mlx v0.2.6, project scaffold
Phase 2B: Admin API only (load/unload/swap/status/health/memory)
Phase 2C: YAML config, memory monitoring, launchd service
Phase 2D: Integration testing (all endpoints, concurrent bots)
```

This is ~50% less work than original plan.
