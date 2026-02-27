---
title: 2026-02-23 — LMX Performance Gap + Speculative Decoding Investigation
created: 2026-02-23
updated: 2026-02-23
type: research
audience: Maintainers, performance engineering, Opta CLI/OpenClaw integrators
status: Active
---

# LMX Performance Gap + Speculative Decoding Investigation (2026-02-23)

## Scope

This document consolidates:

1. The current capability/performance gaps identified from LM Studio, Ollama, and MLX runtime research.
2. The exact current state of speculative decoding in Opta-LMX.
3. How speculative decoding works conceptually and how other runtimes use it.
4. The concrete implementation work and instrumentation required before production use.
5. The current measured numbers and the missing metrics we still need.

---

## Executive Summary

As of 2026-02-23, Opta-LMX has speculative decoding configuration surfaces but does not have a reliable production speculative path:

- With default settings (`use_batching: true`), speculative kwargs are intentionally removed before engine creation (`src/opta_lmx/inference/engine.py:503`).
- With batching disabled, current `vllm-mlx` constructor signatures in this environment do not accept `speculative_model` constructor kwargs; this can raise `TypeError` if speculative is enabled (`.venv/lib/python3.12/site-packages/vllm_mlx/engine/simple.py:29`, `.venv/lib/python3.12/site-packages/vllm_mlx/engine/batched.py:133`).
- No speculative-specific metrics are currently exported (no acceptance/rejection counters in `MetricsCollector` or benchmark responses).

Bottom line: speculative decoding is planned and partially wired, but not yet production-ready in the currently pinned runtime stack.

---

## A. Consolidated Performance Gaps To Address

### A1. Runtime/Backend Gaps

| Gap | Current State | Why It Matters | Priority |
|---|---|---|---|
| Speculative disabled in batched mode | `speculative_model` stripped when `use_batching=true` (`src/opta_lmx/inference/engine.py:505-513`) | Default deployment path cannot realize speculative speedups | P0 |
| Constructor/API mismatch risk for speculative in simple mode | Spec kwargs passed to engine ctor (`src/opta_lmx/inference/engine.py:481-483`) but current `vllm-mlx` ctor signatures have no speculative args (`.venv/lib/python3.12/site-packages/vllm_mlx/engine/simple.py:29-35`, `.venv/lib/python3.12/site-packages/vllm_mlx/engine/batched.py:133-139`) | Potential runtime failure when batching is disabled + speculative configured | P0 |
| No Ollama-native API compatibility layer | OpenAI `/v1/*` only; no `/api/chat`, `/api/generate`, Modelfile ingestion | Harder migration from Ollama-centric tooling | P1 |
| No distributed inference path in Opta-LMX runtime | Single-node runtime orchestration only | Limits scale for sustained multi-agent workloads | P2 |

### A2. Throughput/Latency Configuration Gaps

| Gap | Current State | Why It Matters | Priority |
|---|---|---|---|
| Conservative concurrency defaults | `workers=1`, `max_concurrent_requests=4`, `per_client_default_concurrency=2` (`src/opta_lmx/config.py:38`, `src/opta_lmx/config.py:54`, `src/opta_lmx/config.py:66`) | Underutilizes Mono512 during burst traffic | P0 |
| Conservative memory/load-shed defaults | 90% cap and 95% shed (`src/opta_lmx/config.py:209`, `src/opta_lmx/config.py:221`) + 15% load buffer (`src/opta_lmx/manager/memory.py:73-80`) | Stability-first behavior may reduce available throughput | P1 |
| Auto-routing hotspot behavior | `auto` resolves to configured default or first sorted loaded model (`src/opta_lmx/router/strategy.py:153-165`) | Can overload one model while others are idle | P1 |

### A3. Observability/Benchmark Gaps

| Gap | Current State | Why It Matters | Priority |
|---|---|---|---|
| No speculative acceptance/rejection counters | Request metrics track latency/tokens/errors only (`src/opta_lmx/monitoring/metrics.py:42-110`) | Cannot prove whether speculative helps or hurts | P0 |
| Benchmark endpoint lacks speculative fields | `/admin/benchmark` reports TTFT/total/tok/s only (`src/opta_lmx/api/admin.py:732-809`) | Missing operational evidence for draft quality and acceptance rate | P0 |
| Preset speculative policy not capability-gated | Presets can set speculative (`presets/glm-4.yaml:16-18`) but compatibility is not validated before load | Risk of silent no-op or crash behavior | P0 |

---

## B. Opta-LMX Speculative Decoding: Current State

## B1. Where Speculative Is Configured

- Global config fields exist:
  - `models.speculative_model`, `models.speculative_num_tokens` (`src/opta_lmx/config.py:150-155`).
- Per-preset overrides exist:
  - Example enabled pairing: `presets/glm-4.yaml:16-18`
  - Example disabled-by-policy comments for risky model types:
    - `presets/minimax-m2.yaml:17`
    - `presets/qwen3-30b-uncensored.yaml:14`

## B2. Runtime Path Today

1. Main injects global speculative values into `InferenceEngine` (`src/opta_lmx/main.py:146-147`).
2. `_create_engine()` builds `spec_kwargs` from preset/global values (`src/opta_lmx/inference/engine.py:477-483`).
3. If batching is enabled (default), speculative kwargs are stripped with warning (`src/opta_lmx/inference/engine.py:503-513`).
4. GGUF backend path has no speculative support implemented (`src/opta_lmx/inference/gguf_backend.py`).

## B3. Confirmed Behavior in This Environment

### Unit-test evidence

- Speculative wiring exists in constructor kwargs tests:
  - `tests/test_performance_profiles.py:108-116`
  - `tests/test_performance_profiles.py:133-148`
- Batched stripping behavior is explicitly asserted:
  - `tests/test_performance_profiles.py:166-183`
- Verification run:
  - `PYTHONPATH=src .venv/bin/pytest -q tests/test_performance_profiles.py`
  - Result: `9 passed` (2026-02-23)

### Runtime compatibility evidence

Current installed package versions:
- `mlx-lm==0.30.7`
- `vllm-mlx==0.2.6`

Observed constructor signatures in this environment:
- `SimpleEngine.__init__(model_name, trust_remote_code, enable_cache, force_mllm)`
- `BatchedEngine.__init__(model_name, trust_remote_code, scheduler_config, stream_interval, force_mllm)`

No speculative kwargs are present in these constructors:
- `.venv/lib/python3.12/site-packages/vllm_mlx/engine/simple.py:29-35`
- `.venv/lib/python3.12/site-packages/vllm_mlx/engine/batched.py:133-139`

Direct reproduction:

```bash
.venv/bin/python - <<'PY'
from vllm_mlx.engine.simple import SimpleEngine
try:
    SimpleEngine(model_name='dummy', speculative_model='dummy-draft')
except Exception as e:
    print(type(e).__name__, str(e))
PY
```

Output:

```text
TypeError SimpleEngine.__init__() got an unexpected keyword argument 'speculative_model'
```

Implication: speculative must be capability-gated and integrated through supported call points, not assumed at constructor level.

---

## C. How Speculative Decoding Works (Mechanics)

Speculative decoding uses two models:

1. Draft model proposes `k` future tokens quickly.
2. Target model verifies those proposed tokens.
3. Accepted tokens are committed; rejected tokens are regenerated by target model.
4. Repeat until completion.

Operationally important metrics:

- Accepted draft tokens
- Rejected draft tokens
- Acceptance rate = accepted / (accepted + rejected)
- TTFT delta vs non-speculative baseline
- Generation tok/s delta vs non-speculative baseline
- End-to-end p95 latency under concurrency (spec can improve single-request latency but harm throughput if integration is wrong)

---

## D. How Other Runtimes Use It

### D1. MLX-LM (reference behavior)

MLX-LM exposes speculative as first-class runtime options:

- CLI flags in `mlx_lm.generate`:
  - `--draft-model`, `--num-draft-tokens` (`.venv/lib/python3.12/site-packages/mlx_lm/generate.py:206-217`)
- Server flags in `mlx_lm.server`:
  - `--draft-model`, `--num-draft-tokens` (`.venv/lib/python3.12/site-packages/mlx_lm/server.py:1746-1757`)
- Runtime stream includes per-token `from_draft` marker (`.venv/lib/python3.12/site-packages/mlx_lm/generate.py:717-722`)
- Tokenizer compatibility warning for draft model is present (`.venv/lib/python3.12/site-packages/mlx_lm/server.py:511-517`)
- In server scheduling, draft-model presence disables batchability (`.venv/lib/python3.12/site-packages/mlx_lm/server.py:531-533`, `:675-681`)

This is a clear pattern: draft mode is explicit, and scheduling semantics adapt around it.

### D2. vLLM

vLLM exposes speculative decoding via explicit configuration (model + drafted-token count) and documents caveats:

- Configure via `--speculative_config` in the serve path.
- vLLM docs explicitly warn speculative is not always faster and has feature interactions/limits.

Source:
- [vLLM speculative decoding docs](https://docs.vllm.ai/en/latest/features/spec_decode.html)

### D3. LM Studio

LM Studio exposes speculative in runtime tuning and surfaces draft-token accounting in API stats fields:

- Example stats fields include accepted/rejected/ignored draft token counts.

Source:
- [LM Studio blog: Speculative Decoding in API](https://lmstudio.ai/blog/lmstudio-v0.3.15)
- [LM Studio blog: Parallel requests + dynamic batching](https://lmstudio.ai/blog/lmstudio-v0.3.9)

### D4. Ollama

As of 2026-02-23, official Ollama docs emphasize lifecycle/concurrency/context controls (`keep_alive`, context length, queue and parallel settings), but do not present speculative decoding as an exposed server feature.

Sources:
- [Ollama API](https://docs.ollama.com/api)
- [Ollama FAQ](https://docs.ollama.com/faq)
- [Ollama context length](https://docs.ollama.com/context-length)

---

## E. Numbers and Stats

## E1. Current Opta-LMX Observed Numbers (Non-Speculative Baselines)

From local structured logs (`~/.opta-lmx/logs/opta-lmx.log`) on 2026-02-22:

- 3 benchmark events found:
  - 36.49 tok/s, TTFT 94.48 ms
  - 36.55 tok/s, TTFT 93.92 ms
  - 58.16 tok/s, TTFT 68.27 ms
- Aggregate:
  - avg tok/s: 43.73
  - avg TTFT: 85.56 ms

From Mono512 investigation:
- `mlx-community/MiniMax-M2.5-4bit`: 46.22 tok/s, 143.13 ms TTFT
- `mlx-community/MiniMax-M2.5-6bit`: 38.16 tok/s, 180.38 ms TTFT
- `inferencerlabs/MiniMax-M2.5-MLX-6.5bit`: 38.35 tok/s, 177.94 ms TTFT

Source:
- `docs/research/2026-02-22-mono512-model-discovery-benchmark-debug.md:89-94`

## E2. Existing Speculative Speedup References Already in This Repo

The existing MLX capability research doc records example speculative speedups:

- Qwen2.5-32B-4bit: 7.30 -> 17.74 tok/s (2.43x)
- Llama-3.1-8B-4bit: 29.65 -> 50.91 tok/s (1.71x)

Source:
- `docs/research/mlx-capabilities.md:1677-1686`

These are reference expectations only, not yet validated through Opta-LMX production benchmark harness with acceptance-rate telemetry.

## E3. Current Measurement Blind Spots

Opta-LMX does not currently emit:

- draft accepted token count
- draft rejected token count
- draft ignored token count
- speculative acceptance ratio
- per-request speculative on/off marker

Evidence:
- `src/opta_lmx/monitoring/metrics.py:42-110`
- `src/opta_lmx/api/admin.py:732-809`

---

## F. What Must Be Done (Implementation Plan)

## F1. P0: Correctness and Safety

1. Add backend capability detection at startup/load:
   - Detect whether engine constructor and/or chat path supports speculative args.
   - Fail closed with actionable error if configured but unsupported.
2. Fix speculative integration point:
   - Stop assuming constructor-level speculative kwargs for `vllm-mlx`.
   - Route through supported inference-call kwargs if available.
3. Add draft-model compatibility validation:
   - Tokenizer vocab + template compatibility check before enabling speculative.
4. Enforce explicit policy matrix:
   - Enable only for validated model pairs.
   - Keep explicit deny-list for known-problem families (MoE / known divergence reports).

## F2. P0: Observability

1. Extend metrics:
   - `lmx_spec_draft_accepted_total`
   - `lmx_spec_draft_rejected_total`
   - `lmx_spec_draft_ignored_total`
   - `lmx_spec_acceptance_ratio` (gauge)
2. Extend benchmark response:
   - include speculative section: acceptance ratio, accepted/rejected counts, speculative active bool.

## F3. P1: Scheduler/Serving Architecture

1. Implement dual-lane serving:
   - Interactive lane: speculative enabled (low concurrency, low TTFT)
   - Throughput lane: continuous batching (speculative disabled)
2. Route requests by profile:
   - per-preset, per-client, or explicit request hint.
3. Add automatic draft-model lifecycle:
   - pre-load draft with target model
   - coordinated unload/keepalive policy

## F4. P1: Benchmark and CI Gates

1. Add benchmark matrix:
   - same prompt set x same model x speculative on/off x concurrency profile
2. Add pass/fail gates:
   - TTFT improvement target (interactive profile)
   - generation tok/s non-regression (throughput profile)
   - acceptance ratio floor for each approved model pair

---

## G. Immediate Next Execution Checklist

- [x] Implement capability probe + strict/fallback behavior for speculative config.
- [ ] Refactor speculative injection from constructor path to supported runtime path.
- [x] Add speculative metrics and benchmark response fields.
- [ ] Validate one known-good pair end-to-end on Mono512.
- [ ] Ship dual-lane routing/preset controls.
- [ ] Add CI perf gate for speculative regressions.

### Implementation Status (2026-02-23)

Completed in code:
- Engine now introspects backend constructor capabilities and supports strict mode (`speculative.require_supported=true`) or graceful downgrade (`false`, default) when unsupported.
- Loaded-model runtime metadata now captures speculative requested/active state and reason.
- Admin model/performance endpoints now expose speculative status for each loaded model.
- Benchmark response now includes per-run and aggregate speculative stats (`accepted/rejected/ignored/acceptance_ratio`) with explicit `telemetry="unavailable"` when backend counters are not exposed.
- Metrics now include speculative counters and acceptance ratio gauges:
  - `lmx_spec_draft_accepted_total`
  - `lmx_spec_draft_rejected_total`
  - `lmx_spec_draft_ignored_total`
  - `lmx_spec_acceptance_ratio`
- Added a speculative telemetry adapter path:
  - captures native speculative counters from backend payloads when present
  - falls back to `from_draft` flag inference when exposed
  - degrades to `ignored_tokens` with `telemetry="unavailable"` when backend telemetry is absent
  - propagated across OpenAI, Anthropic, WebSocket, and benchmark metrics paths

Validation snapshot:
- `PYTHONPATH=src .venv/bin/pytest -q tests/test_performance_profiles.py tests/test_metrics.py tests/test_admin.py::TestBenchmark::test_benchmark_returns_results tests/test_admin.py::TestPerformanceOverrides::test_performance_endpoint_returns_model_details tests/test_api.py::test_benchmark_returns_results tests/test_api.py::test_benchmark_multiple_runs`
  - Result: `26 passed`
- `PYTHONPATH=src .venv/bin/pytest -q tests/test_performance_profiles.py tests/test_metrics.py tests/test_admin.py::TestBenchmark::test_benchmark_returns_results tests/test_api.py::test_metrics_capture_speculative_telemetry_from_engine tests/test_api.py::test_benchmark_returns_results tests/test_api.py::test_benchmark_multiple_runs tests/test_anthropic.py tests/test_websocket.py`
  - Result: `52 passed`
- `PYTHONPATH=src .venv/bin/pytest -q tests/test_admin.py`
  - Result: `40 passed`

---

## References

### External

- [LM Studio v0.3.15 — Speculative Decoding in API](https://lmstudio.ai/blog/lmstudio-v0.3.15)
- [LM Studio v0.3.9 — Parallel requests and dynamic batching](https://lmstudio.ai/blog/lmstudio-v0.3.9)
- [vLLM speculative decoding docs](https://docs.vllm.ai/en/latest/features/spec_decode.html)
- [Ollama API docs](https://docs.ollama.com/api)
- [Ollama FAQ](https://docs.ollama.com/faq)
- [Ollama context length docs](https://docs.ollama.com/context-length)
- [Speculative decoding paper (Leviathan et al.)](https://arxiv.org/abs/2211.17192)

### Opta-LMX and local runtime evidence

- `src/opta_lmx/inference/engine.py`
- `src/opta_lmx/config.py`
- `src/opta_lmx/monitoring/metrics.py`
- `src/opta_lmx/api/admin.py`
- `tests/test_performance_profiles.py`
- `.venv/lib/python3.12/site-packages/vllm_mlx/engine/simple.py`
- `.venv/lib/python3.12/site-packages/vllm_mlx/engine/batched.py`
- `.venv/lib/python3.12/site-packages/mlx_lm/generate.py`
- `.venv/lib/python3.12/site-packages/mlx_lm/server.py`
- `docs/research/2026-02-22-mono512-model-discovery-benchmark-debug.md`
- `docs/research/mlx-capabilities.md`

---

## H. Live Matrix + Readiness (Executed)

Artifacts:
- `docs/research/artifacts/2026-02-23-speculative-readiness-matrix.json`
- `docs/research/artifacts/2026-02-23-speculative-readiness-scorecard.md`

Environment:
- `vllm-mlx==0.2.6`
- `mlx-lm==0.30.7`
- `mlx==0.30.6`
- model tested: `mlx-community/Qwen2.5-0.5B-Instruct-4bit`
- draft tested: `mlx-community/Qwen2.5-0.5B-Instruct-4bit`

Key measured outcomes:
- `interactive_spec_off` (use_batching=false): TTFT avg `72.41ms`, tok/s avg `356.42`.
- `throughput_spec_off` (use_batching=true): TTFT avg `13.05ms`, tok/s avg `441.64`.
- `throughput_spec_off` parallel c=4: aggregate tok/s `600.33`, TTFT p95 `228.43ms`.
- `interactive_spec_on`: **failed to load** (constructor unsupported speculative kwargs).
- `throughput_spec_on`: **failed to load** (constructor unsupported speculative kwargs).

Polish update (same day):
- Opta-LMX now defaults to graceful downgrade when speculative is requested but unsupported (`active=false`, reason set), and supports explicit strict mode with `speculative.require_supported=true` to preserve fail-closed behavior.
- This means subsequent matrix runs with default settings will execute spec-on lanes as non-spec fallback instead of hard load failure, while still surfacing unsupported capability in status/metrics.

Readiness verdict from live run:
- Score: `45/100`
- Status: **NOT READY** for speculative decoding rollout in current backend version.

Release gates before enabling speculative in production:
1. Backend support gate: speculative kwargs/callpath present in active `vllm-mlx` runtime.
2. Telemetry gate: accepted/rejected draft counters exposed (native or stable inferred path).
3. Performance gate: TTFT improvement and non-regression in throughput at target concurrency.
