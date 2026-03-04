---
status: review
---

# Benchmark Suite Design

**Date:** 2026-02-26
**Status:** Approved — ready for implementation planning
**Author:** Matthew Byrden

---

## Goal

Build a model benchmark suite into Opta-LMX that measures performance (tok/s, TTFT) and capability quality (output coherence, tool calling, skills execution) for each loaded model. Results are compared against published LM Studio and Ollama numbers. The workflow is collaborative — for each model, a hypothesis is formed before running, then actual results are compared against both the hypothesis and published competitor data.

---

## Architecture

### New endpoints (in `api/admin.py` or new `api/benchmark.py`)

**`POST /admin/benchmark/run`**
Runs a benchmark against a currently-loaded model. Calls `engine.generate()` directly (no HTTP round-trip) for accurate server-side timing. Runs `warmup_runs` iterations (discarded), then `runs` iterations for stats. Saves result JSON to `~/.opta-lmx/benchmarks/`. Returns full result immediately.

**`GET /admin/benchmark/results`**
Returns all stored benchmark results. Accepts optional `?model_id=` filter.

### Reference data

**`benchmarks/reference/published.yaml`** — manually-maintained file mapping model IDs to published LM Studio and Ollama tok/s + TTFT numbers from community benchmarks. Added to as each model is tested. If no entry exists, the report shows `—` for competitor deltas and generates a hypothesis via the running LMX instance.

### Report script

**`scripts/benchmark-report.py`** — reads result JSONs (via `GET /admin/benchmark/results` or directly from disk), merges with reference YAML, and produces a self-contained HTML report. Append-only — each new model run adds a card; running the same model again adds a new timestamped card. Auto-opens in browser after each run.

---

## Data Model

### Request

```python
class BenchmarkRunRequest(BaseModel):
    model_id: str
    prompt: str = "Write a detailed explanation of how transformers work."
    num_output_tokens: int = Field(200, ge=50, le=2000)
    runs: int = Field(5, ge=1, le=20)
    temperature: float = Field(0.0, ge=0.0, le=2.0)
    warmup_runs: int = Field(1, ge=0, le=3)
```

### Tool call benchmark (optional, per-run)

```python
class ToolCallBenchmark(BaseModel):
    tool_definition: dict           # e.g. get_weather(location: str)
    expected_tool_name: str
    prompt_used: str                # e.g. "What's the weather in Sydney?"

    # Results
    call_produced: bool             # did the model emit a tool_calls block?
    tool_name_correct: bool
    params_valid_json: bool
    params_match_schema: bool
    raw_tool_call: dict | None
    latency_sec: float
```

### Skills benchmark (optional, per-run)

```python
class SkillsBenchmark(BaseModel):
    skill_name: str
    skill_invoked_successfully: bool
    skill_result_preview: str | None   # first 200 chars
    skill_latency_sec: float | None
    error: str | None
```

### Stats (computed from completed runs)

```python
class BenchmarkRunStats(BaseModel):
    # Performance
    ttft_p50_sec: float
    ttft_p95_sec: float
    ttft_mean_sec: float
    toks_per_sec_p50: float
    toks_per_sec_p95: float
    toks_per_sec_mean: float
    prompt_tokens: int
    output_tokens: int
    runs_completed: int
    warmup_runs_discarded: int

    # Output quality
    output_text: str                # full response from representative run
    output_token_count: int         # actual tokens generated vs target
    completed_naturally: bool       # hit stop token vs truncated at limit
    repetition_ratio: float         # 0.0–1.0: fraction of repeated 5-gram sequences
    coherence_flag: str             # "ok" | "truncated" | "repetitive" | "garbled"

    # Capability quality
    tool_call: ToolCallBenchmark | None    # None if model doesn't support tools
    skills: list[SkillsBenchmark]          # empty list if skills not enabled
```

### Stored result

```python
class BenchmarkResult(BaseModel):
    model_id: str
    backend: str          # "mlx-lm" | "gguf" | "vllm-mlx"
    timestamp: str        # ISO8601
    status: str           # "ok" | "insufficient_data"
    hardware: str         # e.g. "M3 Ultra 512GB"
    lmx_version: str
    prompt_preview: str   # first 100 chars of prompt
    stats: BenchmarkRunStats
```

Saved to: `~/.opta-lmx/benchmarks/<model_slug>_<timestamp>.json`

### Reference data format

```yaml
# benchmarks/reference/published.yaml
mlx-community/Qwen2.5-72B-Instruct-4bit:
  lm_studio:
    toks_per_sec: 18.2
    ttft_sec: 2.1
    source: "community/ycombinator-2026-02"
    hardware: "M3 Ultra 512GB"
  ollama:
    toks_per_sec: 16.4
    ttft_sec: 2.3
    source: "ollama-benchmarks-repo"
    hardware: "M3 Ultra 512GB"
```

---

## Report Card Format

Per-model card in the HTML report:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Model: mlx-community/Qwen2.5-72B-Instruct-4bit
 Backend: mlx-lm  |  Hardware: M3 Ultra 512GB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Hypothesis
  LM Studio (GGUF Q4_K_M):  ~18 tok/s,  TTFT ~2.1s
  Ollama (GGUF Q4_K_M):     ~16 tok/s,  TTFT ~2.3s
  LMX (MLX 4-bit):          ~22 tok/s,  TTFT ~1.8s

 Results (5 runs, 200 output tokens, temp=0)
  tok/s    p50: 23.4  p95: 22.9  mean: 23.1
  TTFT     p50: 1.71s p95: 1.84s mean: 1.74s

 vs Hypothesis:  +5% tok/s, -6% TTFT
 vs LM Studio:  +28% tok/s, -18% TTFT
 vs Ollama:     +41% tok/s, -24% TTFT

 Capability Matrix
  Text generation:  ✓  coherence: ok  (completed naturally)
  Tool calling:     ✓  correct call, params valid, schema match
  Skills (echo):    ✓  12ms
  Skills (search):  ✗  timeout at 30s

 Output Text [click to expand]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Summary table at top of report covers all tested models with columns:
`Model | Backend | tok/s (mean) | TTFT (mean) | vs LM Studio | vs Ollama | Tools | Skills | Quality`

---

## Coherence Flag Logic

| Flag | Condition |
|------|-----------|
| `"truncated"` | Output stopped exactly at `num_output_tokens` with no stop token |
| `"repetitive"` | `repetition_ratio > 0.3` (5-gram repetition detection) |
| `"garbled"` | No sentence-ending punctuation and no whitespace runs in output |
| `"ok"` | None of the above |

---

## Error Handling

| Failure | Behaviour |
|---------|-----------|
| Model not loaded | `409 Conflict` — `{"detail": "model_not_loaded"}`. Never auto-loads. |
| Partial run failure (OOM, timeout) | Records `runs_completed: N`, computes stats from completed runs. Requires ≥ 2 completed runs; below that, `status: "insufficient_data"` |
| Tool call / skills failure | Recorded as `call_produced: false` / `skill_invoked_successfully: false` with error string. Never fails the overall benchmark. |
| Missing reference data | Hypothesis block shows `"No published data — generating estimate..."`. Competitor delta columns show `—`. |

---

## Testing

### `tests/test_benchmark.py` (unit, uses `mock_engine`)

| Test | Verifies |
|------|----------|
| `test_benchmark_run_returns_stats` | All required fields present in response |
| `test_warmup_runs_discarded` | Stats computed from `runs - warmup_runs` only |
| `test_minimum_runs_enforcement` | `insufficient_data` when < 2 runs complete |
| `test_model_not_loaded_returns_409` | Correct error for unloaded model |
| `test_tool_call_benchmark_pass` | Detects valid `tool_calls` block in mock response |
| `test_tool_call_benchmark_fail` | Records `call_produced: false` for plain text response |
| `test_repetition_ratio_detection` | `coherence_flag = "repetitive"` for looping output |
| `test_result_persisted_to_disk` | JSON file written to benchmarks dir after run |
| `test_results_endpoint_returns_history` | `GET /admin/benchmark/results` returns all stored JSONs |

### `tests/test_benchmark_report.py` (integration)

| Test | Verifies |
|------|----------|
| `test_report_generated_from_fixtures` | Report script produces valid HTML from fixture JSONs |
| `test_hypothesis_block_with_reference_data` | Reference YAML entries appear in hypothesis block |
| `test_hypothesis_block_missing_reference` | Shows `—` gracefully when no published data exists |

### `tests/test_perf_gate.py` addition

`test_benchmark_endpoint_overhead` — the benchmark handler bookkeeping (excluding model generation) completes in under 50ms. Prevents the benchmark from introducing overhead into what it measures.

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| Create | `src/opta_lmx/api/benchmark.py` — router with run + results endpoints |
| Create | `src/opta_lmx/monitoring/benchmark.py` — `BenchmarkResult`, stats computation, persistence |
| Modify | `src/opta_lmx/main.py` — mount benchmark router |
| Create | `benchmarks/reference/published.yaml` — competitor reference data (start empty) |
| Create | `scripts/benchmark-report.py` — HTML report generator |
| Create | `tests/test_benchmark.py` |
| Create | `tests/test_benchmark_report.py` |
| Modify | `tests/test_perf_gate.py` — add overhead gate |

---

## Non-Goals

- Auto-loading models for benchmarking (caller must load first)
- Comparison against cloud APIs (local only)
- Automated scheduled benchmark runs (manual trigger only)
- Fine-grained per-token timing distribution (p50/p95/mean is sufficient)
