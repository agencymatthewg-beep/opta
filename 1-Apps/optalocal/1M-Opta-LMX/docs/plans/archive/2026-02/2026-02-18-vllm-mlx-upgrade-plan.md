---
status: review
---

# vLLM-MLX Upgrade Plan for Opta-LMX

**Date:** 2026-02-18
**Author:** Opta Max (autonomous research)
**Status:** PROPOSAL — Awaiting Matthew's review

---

## Executive Summary

Replace the current `mlx_lm.server` instances on Mono512 with **vllm-mlx**, gaining:
- **Paged KV Cache** — 2-3x memory efficiency for concurrent users
- **Continuous Batching** — handle 6+ bot requests simultaneously without queuing
- **Prefix Cache Sharing** — shared system prompts across bots = less memory
- **Anthropic Messages API** — native Claude Code compatibility
- **MCP Tool Calling** — integrated Model Context Protocol support
- **Multimodal** — image/video/audio support for vision models

---

## Current Setup (Mono512)

| Port | Backend | Model | Features |
|------|---------|-------|----------|
| 10001 | mlx_lm.server | MiniMax-M2.5-4bit | Basic OpenAI API, no batching |
| 10002 | mlx_lm.server | MiniMax-M2.5-5bit | Basic OpenAI API, no batching |
| 1234 | Opta-LMX (custom) | Router/proxy | Admin API, model management |

### Current Limitations
1. No concurrent request handling (sequential inference)
2. No KV cache optimization (each request starts fresh)
3. No prefix sharing (system prompts regenerated every time)
4. No Anthropic API (bots using OpenClaw need OpenAI format only)
5. Model switching requires restart

---

## Proposed Setup

| Port | Backend | Model | Features |
|------|---------|-------|----------|
| 10001 | vllm-mlx | MiniMax-M2.5-4bit | Paged KV, batching, Anthropic API |
| 10002 | vllm-mlx | MiniMax-M2.5-5bit | Paged KV, batching, Anthropic API |
| 1234 | Opta-LMX | Router/admin | Routes to vllm-mlx backends |

### Key Command
```bash
vllm-mlx serve mlx-community/MiniMax-M2.5-4bit \
  --port 10001 \
  --host 0.0.0.0 \
  --continuous-batching \
  --use-paged-cache \
  --max-tokens 131072 \
  --enable-auto-tool-choice
```

---

## Performance Expectations

| Metric | Current (mlx_lm) | Expected (vllm-mlx) |
|--------|------------------|---------------------|
| Single-user tok/s | ~30-40 | ~35-45 (slight overhead) |
| Concurrent 6 users | Sequential (1 at a time) | Batched (all served) |
| Memory per user | Full context each | Shared prefix = ~40% less |
| TTFT (cached prompt) | ~2-5s | ~0.5-1s (prefix cache) |

---

## Migration Steps

### Phase 1: Install & Test (Low Risk)
1. Install vllm-mlx on Mono512: `uv pip install git+https://github.com/waybarrios/vllm-mlx.git`
2. Start on unused port (10003): `vllm-mlx serve mlx-community/MiniMax-M2.5-4bit --port 10003`
3. Test with OpenAI SDK from MacBook
4. Benchmark: compare tok/s with mlx_lm.server

### Phase 2: Replace mlx_lm.server (Medium Risk)
1. Stop mlx_lm.server on port 10001
2. Start vllm-mlx on port 10001 with same model
3. Test all bots can connect
4. Repeat for port 10002

### Phase 3: Update Opta-LMX (Low Risk)
1. Update Opta-LMX config to point to vllm-mlx backends
2. Update health checks for vllm-mlx API format
3. Add vllm-mlx-specific features (batch status, cache stats)

### Phase 4: Enable Advanced Features
1. Enable continuous batching
2. Enable paged KV cache
3. Enable prefix caching for shared system prompts
4. Test Anthropic Messages API with Claude Code

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| vllm-mlx doesn't support M2.5 | High | Test on port 10003 first |
| Performance regression | Medium | Benchmark before replacing |
| API incompatibility | Medium | Test all bot connections |
| Memory increase | Low | Monitor with admin API |

---

## Compatibility Check

### Required: MiniMax-M2.5 support in vllm-mlx
- vllm-mlx uses mlx-lm under the hood → should work with same MLX models
- Need to verify: model loading format, tokenizer compatibility

### API Compatibility
- OpenAI `/v1/chat/completions` ✅ (same as current)
- OpenAI `/v1/models` ✅
- Anthropic `/v1/messages` ✅ (NEW — bonus)
- Admin API — Different format, Opta-LMX needs update

---

## Decision Required

**Matthew:** Should we proceed with Phase 1 (install & test on unused port)?

- **Pro:** Significant improvement for multi-bot concurrent access
- **Con:** Adds dependency on third-party project
- **Effort:** ~2 hours for Phase 1, ~1 day for full migration

---

*Created during autonomous overnight session. Review when convenient.*
