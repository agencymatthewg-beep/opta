---
status: review
---

# Opta-LMX Performance Optimization Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Maximize inference performance, memory efficiency, and model flexibility on the Mac Studio M3 Ultra (512GB) through KV cache optimization, speculative decoding profiles, embedding/reranking endpoints, and auto-tuned model performance profiles.

**Architecture:** Smart Orchestration — keep vllm-mlx as the inference engine, expose its performance features through LMX's config/admin layer, add embedding + reranking pipelines, and create per-model performance profiles that auto-tune settings on load.

**Tech Stack:** Python 3.12, FastAPI, vllm-mlx v0.2.6+, mlx-lm v0.30.7, mlx-embeddings, Jina Reranker v3 MLX

---

## Research Findings Summary

### KV Cache

- **Quantized KV Cache**: Available in mlx-lm v0.30.4+. Parameters: `--kv-bits` (4/8), `--kv-group-size` (64), `--quantized-kv-start` (5000). 8-bit = ~50% cache memory savings vs FP16.
- **Prefix Caching**: 5.8x TTFT speedup on 512-token shared prefix (245ms cold → 42ms cached). Multi-prompt cache in mlx-lm v0.30.4+.
- **Rotating KV Cache**: Fixed-size cache via `--max-kv-size n`. Trades quality for memory.

### Speculative Decoding

- mlx-lm supports `--draft-model` and `--num-draft-tokens`
- 20-50% single-stream speedup reported
- Apple ReDrafter: up to 2.3x on Metal GPUs
- **MoE models**: Unpredictable — expert activation divergence during verification. Qwen3 bug (issue #846) produces incorrect output. Do NOT enable for MoE without testing.
- **Best pairing**: Same-family draft models (GLM-4.7-Flash → GLM-4.7)

### Embedding Models on MLX

- vllm-mlx has `/v1/embeddings` via mlx-embeddings library
- Models: `bge-large-en-v1.5-4bit` (~500MB), `all-MiniLM-L6-v2-4bit`, `embeddinggemma-300m-6bit`
- Performance: Qwen3-0.6B embedding at 44K tok/s on M2 Max
- Zero additional infrastructure — OpenAI API compatible

### Reranking on MLX

- Jina Reranker v3 MLX: 0.6B params, native MLX, listwise reranking
- Cross-attention across query + all candidates
- ~1.2GB memory
- No vllm-mlx endpoint yet — needs custom integration

### RAG Assessment

- **Deferred**. Long context (128K-256K) sufficient for most personal use cases
- Foundation: embedding endpoint + optional reranker
- When needed: ChromaDB embedded mode (zero-infra), Faiss-mlx (Metal-accelerated)

### Target Model Capabilities

| Model | Quant | Memory | Context | Spec-Decode | Notes |
|-------|-------|--------|---------|-------------|-------|
| MiniMax M2.5 | 4-bit | ~129GB | 200K | No (MoE) | 10B active, SOTA coding |
| GLM-4.7 | 4-bit | ~200GB | 128K | Yes (Flash draft) | 32B active, excellent tools |
| GLM-4.7-Flash | 4-bit | ~15GB | 128K | N/A (IS draft) | 3B active, ultra-fast |
| Kimi K2.5 | 3.6-bit | ~440GB | 256K | No (MoE, untested) | 32B active, needs 8-bit KV |
| GLM-5 | 4.8-bit | ~417GB | 200K | No (experimental arch) | Wait for mlx-lm support |
| Josiefied Qwen3 | 4-bit | ~8-15GB | 128K | Avoid (bug #846) | Uncensored, secondary use |

---

## Design Decisions

### D1: KV Cache Config Pass-Through

Add `kv_bits`, `kv_group_size`, and `prefix_cache_enabled` to `ModelsConfig`. Pass through to vllm-mlx engine constructors. Per-model overrides via preset `performance` section.

### D2: Speculative Decoding Profiles

Extend presets with `speculative.draft_model` and `speculative.num_tokens`. Auto-load draft model when target loads. Only enable for validated pairs (GLM-4.7 + Flash). Explicit skip for MoE models.

### D3: Embedding Endpoint

New `/v1/embeddings` route using mlx-embeddings. Lazy-load on first request or pre-load via `embedding_model` config. OpenAI API compatible. Separate from inference engine — independent lifecycle.

### D4: Reranking Endpoint (Deferred)

New `/v1/rerank` route using Jina Reranker v3 MLX. Lazy-load. Only implement after embedding endpoint is proven valuable.

### D5: Model Performance Profiles

Extend preset YAML with `performance` section: `kv_bits`, `prefix_cache`, `speculative`, `max_concurrent`, `memory_estimate_gb`. Engine reads and applies on model load.

---

## Feature Specifications

### Feature 1: KV Cache Configuration

**Files:**
- `src/opta_lmx/config.py` — Add fields to ModelsConfig
- `src/opta_lmx/inference/engine.py` — Pass to _create_engine()
- `src/opta_lmx/main.py` — Wire config to engine
- `src/opta_lmx/api/admin.py` — Expose cache stats in /admin/memory

**Config fields:**
```python
class ModelsConfig(BaseModel):
    kv_bits: int | None = Field(None, description="KV cache quantization bits (4 or 8)")
    kv_group_size: int = Field(64, ge=1, description="KV cache quantization group size")
    prefix_cache_enabled: bool = Field(True, description="Enable prefix caching for multi-turn")
```

### Feature 2: Model Performance Profiles

**Files:**
- `src/opta_lmx/presets/schema.py` — Add PerformanceConfig to preset schema
- `src/opta_lmx/presets/manager.py` — Parse performance section
- `src/opta_lmx/inference/engine.py` — Apply profile on load
- `presets/*.yaml` — Add performance sections

**Preset schema extension:**
```yaml
performance:
  kv_bits: 8
  prefix_cache: true
  speculative:
    draft_model: "model-id"
    num_tokens: 5
  max_concurrent: 2
  memory_estimate_gb: 129
```

### Feature 3: Speculative Decoding Profiles

**Files:**
- `presets/glm-4.yaml` — Add speculative section
- `src/opta_lmx/inference/engine.py` — Auto-load draft model
- `src/opta_lmx/api/admin.py` — Show draft model status

### Feature 4: Embedding Endpoint

**Files:**
- `src/opta_lmx/api/embeddings.py` — New route
- `src/opta_lmx/inference/embedding_engine.py` — New engine
- `src/opta_lmx/config.py` — Add embedding_model field
- `src/opta_lmx/main.py` — Mount router, init engine
- `pyproject.toml` — Add mlx-embeddings dependency
- `tests/test_embeddings.py` — Tests

### Feature 5: Reranking Endpoint (Deferred)

**Files:**
- `src/opta_lmx/api/rerank.py` — New route
- `src/opta_lmx/inference/reranker.py` — Jina integration
- Only implement after Feature 4 is validated

### Feature 6: Updated Model Presets

**Files:**
- `presets/minimax-m2.yaml` — Add performance config
- `presets/glm-4.yaml` — Add speculative + performance
- `presets/glm-4-flash.yaml` — Mark as draft model
- `presets/kimi-k2.yaml` — Add 8-bit KV config
- New: `presets/qwen3-30b-uncensored.yaml`

---

## Implementation Priority

| # | Feature | Effort | Impact | Depends On |
|---|---------|--------|--------|------------|
| 1 | KV Cache config | ~2h | High | None |
| 2 | Model performance profiles | ~1h | High | #1 |
| 3 | Speculative decoding profiles | ~1h | Medium | Existing config |
| 4 | Embedding endpoint | ~3h | Medium | mlx-embeddings |
| 5 | Reranking endpoint | ~2h | Low | #4 (deferred) |
| 6 | Updated presets with perf configs | ~1h | High | #1, #2, #3 |

---

## Verification Strategy

1. All existing 213 tests must continue passing
2. New tests for each feature (target ~20 new tests)
3. Benchmark with/without KV quantization on GLM-4.7
4. Benchmark speculative decoding speedup on GLM-4.7 + Flash
5. Verify embedding endpoint returns valid vectors
6. Memory profiling: confirm KV cache savings match expectations
