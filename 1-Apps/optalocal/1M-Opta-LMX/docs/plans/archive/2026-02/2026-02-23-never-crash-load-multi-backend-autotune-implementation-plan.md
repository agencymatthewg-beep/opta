---
status: review
---

# Never-Crash Load + Multi-Backend Routing + Autotune Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure Opta-LMX can load and run large/unstable model families (including GLM-5 class failures) without crashing the API process, while maximizing compatibility and per-model performance.

**Architecture:** Move model bring-up behind an isolated child runtime process with deterministic timeout/crash classification, then route each model through a backend policy (`vllm-mlx -> mlx-lm -> gguf`) backed by a persisted compatibility registry. Add a per-model/backend autotune loop that benchmarks candidate knobs and persists the best profile for future loads.

**Tech Stack:** FastAPI, asyncio subprocess (`asyncio.create_subprocess_exec` + `asyncio.wait_for`), vllm-mlx, mlx-lm, llama.cpp GGUF, JSON persistence registries, pytest.

---

## Current Baseline (Already Implemented)

- Admission + readiness + canary + quarantine are already present:
  - `src/opta_lmx/model_safety.py`
  - `src/opta_lmx/inference/engine.py`
  - `src/opta_lmx/api/admin.py`
- Runtime incompatibility blocking already exists for GLM signature class in `engine.py`.
- Speculative telemetry and benchmark fields already exist in `/admin/benchmark`.
- Existing tests reportedly green in current branch:
  - `tests/test_admin.py`
  - `tests/test_api.py`
  - `tests/test_gguf.py`

This plan only covers the remaining gaps for P0/P1/P2.

---

## Target Outcomes and Acceptance Gates

### P0 (Never-Crash Load)
- API process survives 100% of loader crash/hang scenarios (no process exit).
- Incompatible load returns deterministic code within timeout budget.
- Model/backend/version combo is quarantined/persisted after failure.
- Chaos gate: 500 repeated forced loader failures with zero API process crashes.

### P1 (Multi-Backend Compatibility Routing)
- Backend selection order enforced: `vllm-mlx` first, fallback `mlx-lm`, optional `gguf`.
- `/admin/models/probe` reports compatibility outcomes before full load.
- `/admin/models/compatibility` exposes persisted history and latest status.

### P2 (Per-Model/Backend Autotuning)
- Tuned profile persistence for each model/backend pair.
- Tunables persisted: batching, scheduler params, KV bits/group, prefix cache, speculative policy.
- Load path automatically applies best-known profile unless caller overrides.

---

## Data Contract Decisions

### Compatibility registry key
`(model_id, backend, backend_version, runtime_signature, architecture, os)`

### Compatibility record schema (append-only)
```json
{
  "ts": 0,
  "model_id": "inferencerlabs/GLM-5-MLX-4.8bit",
  "backend": "vllm-mlx",
  "backend_version": "0.2.6",
  "runtime_signature": "glm_moe_dsa",
  "architecture": "arm64",
  "os": "darwin",
  "outcome": "fail",
  "reason": "loader_crash:signal=6",
  "metadata": {
    "timeout_sec": 90,
    "canary": "failed"
  }
}
```

### Autotune record schema
```json
{
  "ts": 0,
  "model_id": "mlx-community/MiniMax-M2.5-4bit",
  "backend": "vllm-mlx",
  "backend_version": "0.2.6",
  "profile": {
    "use_batching": true,
    "scheduler": {
      "max_num_seqs": 256,
      "prefill_batch_size": 8,
      "completion_batch_size": 32,
      "cache_memory_percent": 0.2
    },
    "kv_bits": 8,
    "kv_group_size": 64,
    "prefix_cache": true,
    "speculative": {
      "enabled": false,
      "draft_model": null,
      "num_tokens": null,
      "require_supported": false
    }
  },
  "metrics": {
    "avg_tokens_per_second": 0,
    "avg_ttft_ms": 0,
    "avg_total_ms": 0,
    "error_rate": 0,
    "acceptance_ratio": null
  },
  "score": 0
}
```

---

## Task 1: Fix Schema Duplication + Reserve New Error Codes

**Files:**
- Modify: `src/opta_lmx/inference/schema.py`
- Modify: `src/opta_lmx/model_safety.py`
- Test: `tests/test_admin.py`

**Step 1: Write failing tests**
- Add test asserting `AdminLoadRequest` has one `allow_unsupported_runtime` field.
- Add test asserting new deterministic loader codes are valid API error codes.

**Step 2: Run tests to verify failure**
- Run: `PYTHONPATH=src .venv/bin/pytest -q tests/test_admin.py -k "allow_unsupported_runtime or loader"`
- Expected: FAIL due duplicate field assumptions / missing loader codes.

**Step 3: Implement minimal code**
- Remove duplicated `allow_unsupported_runtime` declaration.
- Extend `ErrorCodes` with:
  - `MODEL_LOAD_TIMEOUT = "model_load_timeout"`
  - `MODEL_LOADER_CRASHED = "model_loader_crashed"`
  - `MODEL_PROBE_FAILED = "model_probe_failed"`

**Step 4: Run tests to verify pass**
- Same command, expected PASS.

**Step 5: Commit**
```bash
git add src/opta_lmx/inference/schema.py src/opta_lmx/model_safety.py tests/test_admin.py
git commit -m "fix: dedupe load request schema and add loader error codes"
```

---

## Task 2: Upgrade Compatibility Registry to Queryable V2

**Files:**
- Modify: `src/opta_lmx/model_safety.py`
- Test: `tests/test_model_safety.py` (create if missing)

**Step 1: Write failing tests**
- Add tests:
  - `test_compatibility_registry_query_filters_by_model_backend_outcome`
  - `test_compatibility_registry_latest_returns_newest_record`

**Step 2: Run tests to verify failure**
- Run: `PYTHONPATH=src .venv/bin/pytest -q tests/test_model_safety.py`
- Expected: FAIL (query methods absent).

**Step 3: Implement minimal code**
- Add methods to `CompatibilityRegistry`:
  - `list_records(model_id=None, backend=None, outcome=None, since_ts=None, limit=200)`
  - `latest_record(model_id, backend=None)`
  - `summary_by_model()`
- Preserve append-only semantics and backward compatibility with existing row shape.

**Step 4: Run tests to verify pass**
- Same command, expected PASS.

**Step 5: Commit**
```bash
git add src/opta_lmx/model_safety.py tests/test_model_safety.py
git commit -m "feat: add query and summary APIs to compatibility registry"
```

---

## Task 3: Define Child Loader IPC Protocol

**Files:**
- Create: `src/opta_lmx/runtime/loader_protocol.py`
- Test: `tests/test_loader_protocol.py`

**Step 1: Write failing tests**
- Add serialization/deserialization roundtrip tests for `LoadSpec`, `LoadResult`, `LoaderFailure`.

**Step 2: Run tests to verify failure**
- Run: `PYTHONPATH=src .venv/bin/pytest -q tests/test_loader_protocol.py`
- Expected: FAIL (module missing).

**Step 3: Write minimal implementation**
```python
@dataclass
class LoadSpec:
    model_id: str
    backend: str
    use_batching: bool
    performance_overrides: dict[str, Any]
    probe_only: bool = False

@dataclass
class LoadResult:
    ok: bool
    backend: str
    reason: str | None = None
    telemetry: dict[str, Any] = field(default_factory=dict)
```

**Step 4: Run tests to verify pass**
- Same command, expected PASS.

**Step 5: Commit**
```bash
git add src/opta_lmx/runtime/loader_protocol.py tests/test_loader_protocol.py
git commit -m "feat: add child loader IPC protocol types"
```

---

## Task 4: Implement Child Loader Worker Entrypoint

**Files:**
- Create: `src/opta_lmx/runtime/child_loader_worker.py`
- Modify: `src/opta_lmx/inference/gguf_backend.py` (if shared helper needed)
- Test: `tests/test_child_loader_worker.py`

**Step 1: Write failing tests**
- Test worker returns structured failure on invalid model/backend.
- Test worker returns readiness success for mocked backend constructor.

**Step 2: Run tests to verify failure**
- Run: `PYTHONPATH=src .venv/bin/pytest -q tests/test_child_loader_worker.py`
- Expected: FAIL.

**Step 3: Implement minimal worker**
- Worker accepts JSON `LoadSpec` over stdin.
- It attempts backend creation (`vllm-mlx` first), runs a tiny canary, and writes one JSON `LoadResult` line to stdout.
- On failure: always exits with non-zero and structured `LoaderFailure` JSON on stderr.

**Step 4: Run tests to verify pass**
- Same command, expected PASS.

**Step 5: Commit**
```bash
git add src/opta_lmx/runtime/child_loader_worker.py tests/test_child_loader_worker.py src/opta_lmx/inference/gguf_backend.py
git commit -m "feat: add isolated child loader worker with structured results"
```

---

## Task 5: Implement Parent Supervisor (Timeout + Crash Classification)

**Files:**
- Create: `src/opta_lmx/runtime/child_loader_supervisor.py`
- Test: `tests/test_child_loader_supervisor.py`

**Step 1: Write failing tests**
- `test_supervisor_times_out_and_returns_model_load_timeout`
- `test_supervisor_maps_exit_signal_to_model_loader_crashed`
- `test_supervisor_returns_ok_result_when_worker_succeeds`

**Step 2: Run tests to verify failure**
- Run: `PYTHONPATH=src .venv/bin/pytest -q tests/test_child_loader_supervisor.py`
- Expected: FAIL.

**Step 3: Implement minimal supervisor**
- Use `asyncio.create_subprocess_exec`.
- Wrap waits with `asyncio.wait_for`.
- Always terminate/kill on timeout and drain stdio.
- Map failures to deterministic reason codes.

**Step 4: Run tests to verify pass**
- Same command, expected PASS.

**Step 5: Commit**
```bash
git add src/opta_lmx/runtime/child_loader_supervisor.py tests/test_child_loader_supervisor.py
git commit -m "feat: add child loader supervisor with timeout and crash mapping"
```

---

## Task 6: Integrate P0 Never-Crash Load Flow in InferenceEngine

**Files:**
- Modify: `src/opta_lmx/inference/engine.py`
- Modify: `src/opta_lmx/config.py`
- Modify: `src/opta_lmx/main.py`
- Test: `tests/test_gguf.py`
- Test: `tests/test_admin.py`
- Test: `tests/test_chaos_resilience.py`

**Step 1: Write failing tests**
- Add tests asserting:
  - load path invokes supervisor before model is marked routable,
  - timeout/quarantine mapping returns deterministic errors,
  - repeated loader failures increment crash counts and quarantine.

**Step 2: Run tests to verify failure**
- Run:
```bash
PYTHONPATH=src .venv/bin/pytest -q tests/test_admin.py tests/test_gguf.py tests/test_chaos_resilience.py -k "loader or quarantine or canary"
```
- Expected: FAIL.

**Step 3: Implement minimal code**
- Add config fields:
  - `models.loader_isolation_enabled: bool = True`
  - `models.loader_timeout_sec: int = 120`
- In `InferenceEngine._do_load`, call supervisor for MLX bring-up/canary probe before in-process routing exposure.
- On timeout/crash:
  - `ReadinessTracker.mark_failure(...)`
  - `CompatibilityRegistry.record(..., outcome="fail", reason="...")`
  - raise deterministic runtime error mapped by admin layer.

**Step 4: Run tests to verify pass**
- Same command, expected PASS.

**Step 5: Commit**
```bash
git add src/opta_lmx/inference/engine.py src/opta_lmx/config.py src/opta_lmx/main.py tests/test_admin.py tests/test_gguf.py tests/test_chaos_resilience.py
git commit -m "feat: isolate model bring-up with child loader supervision"
```

---

## Task 7: Add Backend Policy Resolver (P1)

**Files:**
- Create: `src/opta_lmx/inference/backend_policy.py`
- Modify: `src/opta_lmx/inference/engine.py`
- Modify: `src/opta_lmx/config.py`
- Test: `tests/test_performance_profiles.py`
- Test: `tests/test_admin.py`

**Step 1: Write failing tests**
- Tests for policy ordering and fallback sequence:
  - first candidate `vllm-mlx`, then `mlx-lm`, then `gguf` when enabled.

**Step 2: Run tests to verify failure**
- Run: `PYTHONPATH=src .venv/bin/pytest -q tests/test_performance_profiles.py tests/test_admin.py -k "backend policy or fallback"`

**Step 3: Implement minimal resolver**
- Add policy function:
```python
def backend_candidates(model_id: str, cfg: ModelsConfig, registry: CompatibilityRegistry) -> list[str]:
    ...
```
- Skip known failed combos from latest compatibility rows unless override flag is set.

**Step 4: Run tests to verify pass**
- Same command, expected PASS.

**Step 5: Commit**
```bash
git add src/opta_lmx/inference/backend_policy.py src/opta_lmx/inference/engine.py src/opta_lmx/config.py tests/test_performance_profiles.py tests/test_admin.py
git commit -m "feat: add multi-backend candidate policy with compatibility-aware fallback"
```

---

## Task 8: Add Direct MLX-LM Backend Adapter (P1 Fallback)

**Files:**
- Create: `src/opta_lmx/inference/mlx_lm_backend.py`
- Modify: `src/opta_lmx/inference/backend.py`
- Modify: `src/opta_lmx/inference/engine.py`
- Test: `tests/test_mlx_real_smoke.py`
- Test: `tests/test_performance_profiles.py`

**Step 1: Write failing tests**
- Add test that backend policy can choose `mlx-lm` when `vllm-mlx` probe fails.

**Step 2: Run tests to verify failure**
- Run: `PYTHONPATH=src .venv/bin/pytest -q tests/test_performance_profiles.py tests/test_mlx_real_smoke.py -k "mlx-lm"`

**Step 3: Implement minimal backend adapter**
- Wrap `mlx_lm.server`/generation path under `InferenceBackend` interface.
- Support non-stream + stream + speculative knobs where supported.
- Normalize response + token accounting to existing engine telemetry contract.

**Step 4: Run tests to verify pass**
- Same command, expected PASS.

**Step 5: Commit**
```bash
git add src/opta_lmx/inference/mlx_lm_backend.py src/opta_lmx/inference/backend.py src/opta_lmx/inference/engine.py tests/test_performance_profiles.py tests/test_mlx_real_smoke.py
git commit -m "feat: add direct mlx-lm backend fallback"
```

---

## Task 9: Add Optional GGUF Equivalence Fallback Resolver (P1)

**Files:**
- Create: `src/opta_lmx/inference/gguf_resolver.py`
- Modify: `src/opta_lmx/inference/engine.py`
- Modify: `src/opta_lmx/config.py`
- Test: `tests/test_gguf.py`

**Step 1: Write failing tests**
- Add tests for finding local GGUF equivalent by name/revision pattern.
- Add tests for disabled-by-default behavior.

**Step 2: Run tests to verify failure**
- Run: `PYTHONPATH=src .venv/bin/pytest -q tests/test_gguf.py -k "resolver or equivalent"`

**Step 3: Implement minimal resolver**
- Best-effort mapping from MLX repo ID -> local GGUF candidate path list.
- Apply only when `models.gguf_fallback_enabled=true`.

**Step 4: Run tests to verify pass**
- Same command, expected PASS.

**Step 5: Commit**
```bash
git add src/opta_lmx/inference/gguf_resolver.py src/opta_lmx/inference/engine.py src/opta_lmx/config.py tests/test_gguf.py
git commit -m "feat: add optional gguf equivalence fallback"
```

---

## Task 10: Add `/admin/models/probe` Endpoint (P1)

**Files:**
- Modify: `src/opta_lmx/inference/schema.py`
- Modify: `src/opta_lmx/api/admin.py`
- Modify: `src/opta_lmx/inference/engine.py`
- Test: `tests/test_admin.py`

**Step 1: Write failing tests**
- `test_admin_probe_returns_candidate_backends_and_outcomes`
- `test_admin_probe_respects_allow_unsupported_runtime`

**Step 2: Run tests to verify failure**
- Run: `PYTHONPATH=src .venv/bin/pytest -q tests/test_admin.py -k "models/probe"`

**Step 3: Implement minimal endpoint**
- Request:
```json
{"model_id":"...","timeout_sec":90,"allow_unsupported_runtime":false}
```
- Response includes per-backend probe outcome and selected recommendation.

**Step 4: Run tests to verify pass**
- Same command, expected PASS.

**Step 5: Commit**
```bash
git add src/opta_lmx/inference/schema.py src/opta_lmx/api/admin.py src/opta_lmx/inference/engine.py tests/test_admin.py
git commit -m "feat: add admin model probe endpoint"
```

---

## Task 11: Add `/admin/models/compatibility` Endpoint (P1)

**Files:**
- Modify: `src/opta_lmx/inference/schema.py`
- Modify: `src/opta_lmx/api/admin.py`
- Modify: `src/opta_lmx/model_safety.py`
- Test: `tests/test_admin.py`

**Step 1: Write failing tests**
- Add list/filter tests (model_id/backend/outcome/since/limit).

**Step 2: Run tests to verify failure**
- Run: `PYTHONPATH=src .venv/bin/pytest -q tests/test_admin.py -k "models/compatibility"`

**Step 3: Implement minimal endpoint**
- GET `/admin/models/compatibility?model_id=...&backend=...&outcome=...`
- Return rows + total + optional summary section.

**Step 4: Run tests to verify pass**
- Same command, expected PASS.

**Step 5: Commit**
```bash
git add src/opta_lmx/inference/schema.py src/opta_lmx/api/admin.py src/opta_lmx/model_safety.py tests/test_admin.py
git commit -m "feat: add compatibility registry admin endpoint"
```

---

## Task 12: Add Autotune Registry and Scoring Engine (P2)

**Files:**
- Create: `src/opta_lmx/inference/autotune_registry.py`
- Create: `src/opta_lmx/inference/autotune_scoring.py`
- Modify: `src/opta_lmx/monitoring/benchmark.py`
- Test: `tests/test_perf_gate.py`
- Test: `tests/test_performance_profiles.py`

**Step 1: Write failing tests**
- Add tests for persistence roundtrip and score ordering.

**Step 2: Run tests to verify failure**
- Run: `PYTHONPATH=src .venv/bin/pytest -q tests/test_performance_profiles.py tests/test_perf_gate.py -k "autotune or score"`

**Step 3: Implement minimal code**
- Persist per `(model_id, backend, backend_version)` best profile + metrics.
- Scoring formula v1:
```python
score = tok_s - 0.015 * ttft_ms - 50.0 * error_rate
```
- Add tie-breakers: lower avg_total_ms, then lower queue_wait.

**Step 4: Run tests to verify pass**
- Same command, expected PASS.

**Step 5: Commit**
```bash
git add src/opta_lmx/inference/autotune_registry.py src/opta_lmx/inference/autotune_scoring.py src/opta_lmx/monitoring/benchmark.py tests/test_performance_profiles.py tests/test_perf_gate.py
git commit -m "feat: add autotune registry and scoring"
```

---

## Task 13: Add Autotune Execution API and Load-Time Application (P2)

**Files:**
- Modify: `src/opta_lmx/inference/schema.py`
- Modify: `src/opta_lmx/api/admin.py`
- Modify: `src/opta_lmx/inference/engine.py`
- Modify: `src/opta_lmx/presets/manager.py`
- Test: `tests/test_admin.py`
- Test: `tests/test_presets.py`

**Step 1: Write failing tests**
- Add endpoint tests:
  - `POST /admin/models/autotune`
  - `GET /admin/models/{model_id}/autotune`
- Add load test proving tuned profile is auto-applied when no explicit override is passed.

**Step 2: Run tests to verify failure**
- Run: `PYTHONPATH=src .venv/bin/pytest -q tests/test_admin.py tests/test_presets.py -k "autotune"`

**Step 3: Implement minimal code**
- Add admin autotune endpoint to run benchmark matrix and persist best config.
- Load flow precedence:
  1) explicit request overrides
  2) tuned profile
  3) preset profile
  4) global defaults

**Step 4: Run tests to verify pass**
- Same command, expected PASS.

**Step 5: Commit**
```bash
git add src/opta_lmx/inference/schema.py src/opta_lmx/api/admin.py src/opta_lmx/inference/engine.py src/opta_lmx/presets/manager.py tests/test_admin.py tests/test_presets.py
git commit -m "feat: add model autotune APIs and load-time profile application"
```

---

## Task 14: Reliability + Performance Gates in CI

**Files:**
- Modify: `tests/test_chaos_resilience.py`
- Modify: `tests/test_perf_gate.py`
- Modify: `docs/GUARDRAILS.md`
- Modify: `docs/WORKFLOWS.md`

**Step 1: Write failing tests**
- Add loader chaos test validating API survives synthetic loader crashes/timeouts.
- Add perf gate baseline test that fails when tuned profile regresses beyond threshold.

**Step 2: Run tests to verify failure**
- Run:
```bash
PYTHONPATH=src .venv/bin/pytest -q tests/test_chaos_resilience.py tests/test_perf_gate.py
```

**Step 3: Implement minimal thresholds**
- Reliability gate: zero API process crashes.
- Perf regression gate: fail if `avg_tokens_per_second` drops >15% vs stored baseline for tuned profile.

**Step 4: Run tests to verify pass**
- Same command, expected PASS.

**Step 5: Commit**
```bash
git add tests/test_chaos_resilience.py tests/test_perf_gate.py docs/GUARDRAILS.md docs/WORKFLOWS.md
git commit -m "test: enforce never-crash loader and autotune performance gates"
```

---

## Rollout Strategy

1. Ship P0 behind config flag (`loader_isolation_enabled=true` default in dev, false in prod for one canary day).  
2. Enable P0 in production after 24h crash-free canary.  
3. Ship P1 fallback policy + probe/compat endpoints.  
4. Enable `mlx-lm` fallback for known failing signatures first (`glm_moe_dsa` family).  
5. Ship P2 autotune in dry-run mode (record only).  
6. Enable autotune application after benchmark confidence thresholds are met.

---

## Operational Playbook Updates Required

- Add runbook section: "Loader Timeout vs Loader Crash vs Probe Failure" with exact API codes.
- Add runbook section: "How to unquarantine a model/backend/version combo safely".
- Add runbook section: "Autotune rollback to last-known-good profile".

---

## Primary References (External)

- Python asyncio subprocess + timeout control:  
  - https://docs.python.org/3/library/asyncio-subprocess.html  
  - https://docs.python.org/3/library/subprocess.html
- vLLM speculative decoding limitations and feature interactions:  
  - https://docs.vllm.ai/en/stable/features/spec_decode.html
- Ollama API keep_alive lifecycle controls (for behavior comparison):  
  - https://docs.ollama.com/api
- llama.cpp OpenAI-compatible server and GGUF ecosystem context:  
  - https://raw.githubusercontent.com/ggerganov/llama.cpp/master/README.md

---

## Local Runtime Evidence References

- `vllm-mlx==0.2.6`, `mlx-lm==0.30.7` constructor/runtime observations in local environment.
- `mlx_lm` draft-model and speculative flags in local package:
  - `.venv/lib/python3.12/site-packages/mlx_lm/server.py`
  - `.venv/lib/python3.12/site-packages/mlx_lm/generate.py`

---

## Final Verification Command (End of Plan Execution)

```bash
PYTHONPATH=src .venv/bin/pytest -q \
  tests/test_admin.py \
  tests/test_api.py \
  tests/test_gguf.py \
  tests/test_performance_profiles.py \
  tests/test_perf_gate.py \
  tests/test_chaos_resilience.py
```

Expected: all PASS with deterministic loader error behavior, probe/compat endpoints live, and autotune persistence validated.
