# Model Stack Design — Role-Based Model Routing with Remote Helpers

**Date:** 2026-02-17
**Status:** Approved
**Author:** Matthew Byrden + Claude

---

## Goal

Add a configurable, role-based model routing system to Opta LMX where each task type (coding, reasoning, chat, vision, embedding, reranking) maps to a specific model. Lightweight helper models (embedding, reranking) can run on distributed LAN devices (RTX 5080 16GB Windows PCs, M4 Max 48GB MacBook) to assist the main inference models on Mono512.

## Architecture

Two-tier system built on existing LMX infrastructure:

### Layer 1: Local Stack (extends existing TaskRouter)

The existing `RoutingConfig.aliases` maps alias names to ordered model preference lists. The Model Stack formalizes this with predefined roles. The CLI sends `model: "coding"` or `model: "reasoning"` and the `TaskRouter.resolve()` walks the preference list, returning the first loaded model.

**Zero CLI code changes needed** — clients set `OPTA_MODEL=coding` or use `--model reasoning`.

```yaml
routing:
  aliases:
    coding: ["mlx-community/Qwen2.5-Coder-32B-Instruct-4bit"]
    reasoning: ["mlx-community/QwQ-32B-4bit", "mlx-community/DeepSeek-R1-Distill-Qwen-32B-4bit"]
    chat: ["mlx-community/Qwen3-30B-A3B-4bit"]
    vision: ["mlx-community/Qwen2.5-VL-32B-Instruct-4bit"]
```

### Layer 2: Helper Nodes (config section)

Embedding and reranking models are internal services called by LMX for its own pipelines (embedding endpoint proxy, future RAG). These run on LAN devices via OpenAI-compatible HTTP endpoints. Helper Nodes are OFF by default — only enable if a Workstation opts in to contribute inference compute.

```yaml
helper_nodes:
  embedding:
    url: "http://192.168.188.20:1234"
    model: "nomic-embed-text-v1.5"
    timeout_sec: 10
    fallback: "local"
  reranking:
    url: "http://192.168.188.21:1234"
    model: "jina-reranker-v2-base"
    timeout_sec: 10
    fallback: "skip"
```

### Layer 3: Preset Integration (already works)

Each stack model has a preset YAML with `routing_alias` and `performance` overrides. Auto-applied on model load.

## Performance Design

- **Local routing**: Zero-cost dict lookup in TaskRouter
- **Helper nodes**: httpx.AsyncClient with connection pooling (keep-alive, max 4 connections)
- **Timeout + fallback**: 10s timeout, configurable fallback ("local" or "skip")
- **No retry loops**: Single attempt + fallback on LAN
- **Batch embedding**: Array input in single HTTP call
- **Not in hot path**: Helper nodes don't affect `/v1/chat/completions` latency

## CLI Integration

No Opta CLI code changes required. The CLI sends model names via the OpenAI SDK. To use the stack:
- Set `model.default: "coding"` in `~/.config/opta/config.json`
- Or use `--model reasoning` per-command

Future CLI enhancement: `GET /admin/stack` endpoint for `opta stack` display command.

## Implementation Components

| Component | Change Type | File |
|-----------|-------------|------|
| Config | `HelperNodesConfig` | `config.py` |
| Helper Client | Module | `helpers/client.py` |
| App Lifecycle | Wire clients | `main.py`, `deps.py` |
| Embeddings | Helper node proxy | `api/embeddings.py` |
| Admin API | Stack status | `api/admin.py` |
| Tests | Test files | `tests/test_helper_nodes.py` |

## Research Basis

Based on comprehensive MLX ecosystem research (Feb 2026):
- **Embeddings**: Highest ROI per GB — Qwen3-Embedding-0.6B (<1GB, matches OpenAI ada-002)
- **Reranking**: Highest ROI — Jina Reranker v3 (~1.2GB, +8-12% retrieval accuracy)
- **Coding**: Qwen2.5-Coder-32B (HumanEval 92.7% vs general 85%)
- **Reasoning**: QwQ-32B (MATH 90.6%, GPQA 65.2%)
- **Vision**: Qwen2.5-VL-32B (unlocks new capabilities entirely)

Full research: `gu-model-stack-research.html`
