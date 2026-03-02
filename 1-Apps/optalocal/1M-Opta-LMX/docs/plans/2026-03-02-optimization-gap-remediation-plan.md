---
title: Opta-LMX Optimization Gap Remediation Plan (Current Codebase)
date: 2026-03-02
status: Planned
supersedes: docs/plans/2026-03-02-complete-optimization-implementation-plan.md
---

# Opta-LMX Optimization Gap Remediation Plan (Current Codebase)

This plan replaces the earlier "complete optimization" plan and focuses only on gaps that still exist in the current codebase.

## Already Completed (Out of Scope for This Plan)

- `/v1/embeddings` endpoint and local `EmbeddingEngine` are implemented.
- `/v1/rerank` endpoint and local reranker integration are implemented.
- `kv_bits`, `kv_group_size`, and `prefix_cache_enabled` are implemented in config and engine lifecycle.
- Speculative telemetry schema/plumbing exists (`accepted/rejected/ignored/acceptance_ratio`), including benchmark response fields.
- Runtime compatibility guardrails for known GLM MoE signatures are implemented in backend policy/lifecycle.

---

## Phase 1: Make Speculative Decoding Actually Functional (P0)

### 1.1 Implement speculative in `mlx-lm` backend path

- File: `src/opta_lmx/inference/mlx_lm_backend.py`
- Add explicit draft-model lifecycle management:
  - Load and cache draft model/tokenizer when speculative is requested and allowed.
  - Wire `draft_model` and `num_draft_tokens` through to `mlx_lm.stream_generate(...)`.
- Extend backend generate/stream APIs to accept optional speculative options from model/runtime config.

### 1.2 Wire speculative options per request

- Files:
  - `src/opta_lmx/inference/backend.py`
  - `src/opta_lmx/inference/mlx_lm_backend.py`
  - `src/opta_lmx/inference/engine_generate.py`
  - `src/opta_lmx/inference/engine_lifecycle.py`
- Ensure `loaded.speculative_*` settings are passed into backend calls (not only stored as metadata).
- Keep existing vllm-mlx constructor capability checks/fallbacks unchanged.

### 1.3 Preserve safety gates

- File: `src/opta_lmx/inference/engine_lifecycle.py`
- Continue fail-safe behavior for unsupported/runtime-sensitive model families:
  - No speculative on unsupported backends.
  - Respect `speculative.require_supported`.

Acceptance criteria:
- For an `mlx-lm` loaded model with draft configured, benchmark/admin responses show non-zero accepted/rejected counters for at least one run.
- No regression for non-speculative requests.

---

## Phase 2: Introduce Explicit Dual-Lane Routing (P0)

### 2.1 Add deterministic lane policy

- Files:
  - `src/opta_lmx/api/inference.py`
  - `src/opta_lmx/inference/engine.py`
  - `src/opta_lmx/inference/engine_lifecycle.py`
- Define lane mapping:
  - Interactive lane: low-latency route (prefer `mlx-lm` + speculative when available).
  - Throughput lane: batched route (`vllm-mlx`, no speculative requirement).
- Use explicit request signal (header) with documented values; avoid overloading current `"high"` semaphore bypass semantics.

### 2.2 Add load/admin support for backend selection

- File: `src/opta_lmx/api/admin_models.py`
- Accept backend values aligned with runtime candidates (`vllm-mlx`, `mlx-lm`, `gguf`) and map legacy aliases if needed.

Acceptance criteria:
- Same model can be loaded with different backend preference intentionally.
- Request-level lane signal is observable in logs and produces expected backend behavior.

---

## Phase 3: Close Remaining KV/Cache Gaps (P1)

### 3.1 Decide and implement `quantized_kv_start` only if backend supports it

- Files:
  - `src/opta_lmx/config.py`
  - `src/opta_lmx/inference/engine_lifecycle.py`
- Add config surface and pass-through with capability detection; no-op with warning when unsupported.

### 3.2 Prefix cache persistence policy

- Decision first:
  - If using in-memory prefix caching only, document that and skip filesystem LRU work.
  - If persistent safetensors cache files are introduced, implement bounded LRU cleanup.

Acceptance criteria:
- Config options are explicit, validated, and behavior is deterministic across supported/unsupported backends.

---

## Phase 4: Benchmark and Guardrails (P0)

### 4.1 Build comparative perf matrix runner

- New file: `scripts/run_perf_matrix.py`
- Run matrix:
  - lane/backend combinations
  - speculative on/off
  - representative prompts
- Produce machine-readable output with TTFT/toks-per-sec/speculative acceptance metrics.
- Add threshold assertions as warnings first (not hard-fail) until baselines stabilize.

### 4.2 Fix metrics API mismatch

- Files:
  - `src/opta_lmx/api/admin.py`
  - `src/opta_lmx/monitoring/metrics.py`
- Resolve callsite mismatch (`metrics.record_speculative(...)`) by either:
  - implementing the method in `MetricsCollector`, or
  - removing/replacing the call with existing metrics pathways.

Acceptance criteria:
- Benchmark flow runs end-to-end without runtime attribute errors.
- Output includes speculative metrics and lane/backend context.

---

## Phase 5: Admin UI Visibility (P1)

- File: `docs/ops/monitoring/lm-admin.html`
- Surface:
  - active serving lane/backend for selected model
  - speculative acceptance ratio/counters from benchmark or metrics endpoints

Acceptance criteria:
- Operators can validate whether speculative is active and helping without reading logs.

---

## Suggested Execution Order

1. Phase 1 (functional speculative path in `mlx-lm`)
2. Phase 2 (dual-lane routing + backend selection cleanup)
3. Phase 4 (benchmark + metrics guardrails)
4. Phase 3 (KV/cache optional extensions)
5. Phase 5 (UI visibility)
