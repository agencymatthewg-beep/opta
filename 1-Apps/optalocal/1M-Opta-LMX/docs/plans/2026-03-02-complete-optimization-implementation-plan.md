---
title: Complete Opta-LMX Optimization Implementation Plan
date: 2026-03-02
status: Planned
---

# Complete Opta-LMX Optimization Implementation Plan

This document provides a concrete, step-by-step implementation plan to address all outstanding performance and optimization gaps in Opta-LMX, with a primary focus on getting **Speculative Decoding** to a production-ready state on Apple Silicon (M3/M4 Ultra). 

## Phase 1: Speculative Decoding & Dual-Lane Architecture (High Priority)

**Context:** Speculative decoding is currently blocked in batched mode and raises constructor errors in simple mode because `vllm-mlx` does not accept speculative kwargs in its constructor. 

### Step 1.1: Fix the Backend Integration Point
*   **Action:** Modify `src/opta_lmx/inference/engine.py` (and specifically the engine wrapper) to stop passing `speculative_model` to the engine constructor.
*   **Action:** Instead, map speculative decoding configurations down to the `mlx-lm` base generation function `generate()` or `stream_generate()` via per-request `**kwargs`, where `--draft-model` and `--num-draft-tokens` are supported natively by `mlx-lm`. 
*   **Action:** Implement safe fallbacks: check if the underlying model is an MoE (Mixture of Experts) based on its architecture definition, and if so, forcibly disable speculative decoding at the routing level to avoid "expert activation divergence" crashes.

### Step 1.2: Implement Dual-Lane Serving
*   **Action:** Create a request-level routing mechanism.
    *   **Lane A (Interactive):** Triggered by low-concurrency presets, single-user API keys, or explicit request headers (e.g., `x-priority: interactive`). Disables continuous batching for that specific session/request and enables the `SimpleEngine` with speculative decoding.
    *   **Lane B (Throughput):** Triggered by multi-agent traffic. Enforces the `BatchedEngine` via `vllm-mlx` with speculative decoding stripped out.
*   **Action:** Coordinate the lifecycle of the draft model. When a target model (e.g., `GLM-4.7`) is loaded into the interactive lane, automatically pull and instantiate its designated draft model (e.g., `GLM-4.7-Flash`). 

### Step 1.3: Validate Speculative Telemetry
*   **Action:** Ensure the already added speculative telemetry (`speculative_accepted_tokens`, `speculative_rejected_tokens`, `acceptance_ratio`) is actively populated from the `mlx-lm` response objects and visible in the Admin WebUI and `/admin/benchmark` endpoints.

---

## Phase 2: KV Cache Optimization & Memory Efficiency

**Context:** The KV cache on massive models (70B+) can consume over 100GB of RAM at maximum context lengths. We must expose quantization for the KV cache to halve this footprint.

### Step 2.1: Implement KV Cache Overrides
*   **Action:** Update `src/opta_lmx/config.py` and `ModelsConfig` to explicitly support `kv_bits` (4 or 8), `kv_group_size` (64), and `quantized_kv_start`.
*   **Action:** Plumb these configuration values through `engine_lifecycle.py` directly to the `mlx-lm` cache initialization logic.

### Step 2.2: Enable Multi-Prompt Prefix Caching
*   **Action:** Ensure that the `prefix_cache_enabled` flag correctly invokes `mlx-lm`'s persistent prompt caching. 
*   **Action:** Create an LRU (Least Recently Used) cache manager specifically for these `safetensors` prefix caches so they don't bloat the local `.opta-lmx/cache/` directory indefinitely.

### Step 2.3: Base Weight Deduplication (LoRA Swapping)
*   **Action:** Refactor `ModelManager` to detect if two requested models share the exact same base weights (e.g., `Llama-3-70B-Base` and `Llama-3-70B-Instruct`).
*   **Action:** Load the base weights into unified memory exactly once. Apply the `<1GB` LoRA adapter on-the-fly per request instead of maintaining two separate 38GB models in memory.

---

## Phase 3: Native Embedding and Reranking

**Context:** RAG pipelines require embeddings and reranking. Running these on separate external services wastes the Mac Studio's unified memory advantage.

### Step 3.1: The `/v1/embeddings` Endpoint
*   **Action:** Add `mlx-embeddings` to `pyproject.toml`.
*   **Action:** Create `src/opta_lmx/api/embeddings.py` and implement the OpenAI-compatible embeddings route. 
*   **Action:** Add an `EmbeddingEngine` class that manages a persistent `bge-large-en-v1.5-4bit` (or similar) model in memory alongside the primary LLM.

### Step 3.2: The `/v1/rerank` Endpoint
*   **Action:** Integrate support for Jina Reranker v3 MLX (which runs natively and cross-attends candidates).
*   **Action:** Create `src/opta_lmx/api/rerank.py` to expose this endpoint to OpenClaw bots and other RAG clients.

---

## Phase 4: Production Automation & Quality Gates

### Step 4.1: Automated Benchmark Suite
*   **Action:** Write a chaos/benchmark script (`scripts/run_perf_matrix.py`) that boots Opta-LMX, runs a battery of queries against `GLM-4.7` with and without Speculative Decoding, and asserts that the TTFT (Time To First Token) improves by at least 1.5x.

### Step 4.2: Admin UI Surfacing
*   **Action:** Update the newly created `docs/ops/monitoring/lm-admin.html` WebUI to display the current "Serving Lane" (Interactive vs. Throughput) and real-time speculative acceptance ratios so users can visually verify the speedup. 

---

## Execution Order

1.  **Phase 1 (Speculative Fixes)** - Unblocks the largest single-stream performance gain.
2.  **Phase 2 (KV Cache)** - Prevents Out-Of-Memory (OOM) panics when users start utilizing the speedups for large-context generation.
3.  **Phase 3 (Embeddings)** - Completes the unified "Local AI Stack" vision for RAG.
4.  **Phase 4 (Validation)** - Locks in the performance gains so future updates don't cause regressions.
