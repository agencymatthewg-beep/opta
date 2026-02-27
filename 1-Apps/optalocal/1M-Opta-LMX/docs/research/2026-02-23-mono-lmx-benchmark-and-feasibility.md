# Mono512 Opta-LMX Benchmark + Feasibility Report
Date: 2026-02-23
Host: Mono512 (M3 Ultra, 512GB)

## Executive Summary
- Mono bot config is valid, but Mono service was previously not loaded; it has now been started and `19001` is listening.
- Opta-LMX is running on `:1234` and currently serves **inferencerlabs/MiniMax-M2.5-MLX-6.5bit**.
- Benchmarks of currently loaded model are strong for this class after warmup: ~38-39 tok/s sustained.
- GLM-5 and Kimi caches exist on disk, but LMX load endpoint reports `download_required` for both, indicating model discovery/index mismatch (not pure storage absence).

## Mono/OpenClaw Config State
- Config file: `/Users/opta/.openclaw/openclaw.json`
- Gateway target: `port 19001`, `bind lan`, token/password configured.
- Validation:
  - `19001` now listening (Mono up)
  - `19000` still listening (Opta512)

## Opta-LMX Runtime State
- Process:
  - `python -m opta_lmx.main --config /Users/Shared/312/Opta/1-Apps/1M-Opta-LMX/config/mono512-current.yaml`
- API:
  - `GET /v1/models` => currently loaded model list contains one model:
    - `inferencerlabs/MiniMax-M2.5-MLX-6.5bit`
- Admin status:
  - loaded memory: **172.43 GB**
  - context length: **196,608**
  - batching: enabled

## Benchmark Results (Loaded Model)
Model benchmarked: `inferencerlabs/MiniMax-M2.5-MLX-6.5bit`

### Scenario A: short_64 (3 runs)
- max_tokens: 64
- avg tok/s: **30.59**
- avg TTFT: **1041.34 ms**
- avg total: **2625.51 ms**
- Note: first run cold-start TTFT ~2992 ms, subsequent runs ~64-68 ms

### Scenario B: medium_256 (3 runs)
- max_tokens: 256
- avg tok/s: **38.25**
- avg TTFT: **129.29 ms**
- avg total: **6697.74 ms**

### Scenario C: long_512 (2 runs)
- max_tokens: 512
- avg tok/s: **39.38**
- avg TTFT: **157.38 ms**
- avg total: **13003.13 ms**

## Analysis
### Performance profile of loaded model
- Warm steady-state throughput is stable around **38-39 tok/s**.
- TTFT is excellent after warmup (<300 ms), but cold-start spikes are material (2-3s range).
- For long responses, total latency scales near-linearly as expected with sustained tok/s.

### Comparison (within current measured evidence)
- Current loaded MiniMax performance is suitable for:
  - interactive coding/chat where first token after warmup matters
  - long-form generation where 35+ tok/s sustained is acceptable
- Earlier single-run ad hoc benchmark (~9 tok/s) is not representative of warm steady state; likely cold/warmup or config variance.

## GLM-5 + Kimi Feasibility with current Opta-LMX
### On-disk presence (HF cache)
- `/Users/opta/.cache/huggingface/hub/models--inferencerlabs--GLM-5-MLX-4.8bit` => present
- `/Users/opta/.cache/huggingface/hub/models--mlx-community--Kimi-K2.5-3bit` => present

### Load attempt outcome
- `POST /admin/models/load` for GLM-5 => `download_required`
- `POST /admin/models/load` for Kimi => `download_required`

### Interpretation
- This is a **model-resolution/discovery mismatch** between LMX loader and local cache indexing/path expectations.
- It is not simply “model files missing” according to direct filesystem checks.

## Risks / blockers
1. LMX config remains MiniMax-centric (`default_model`, `auto_load`, aliases).
2. GLM/Kimi load path likely needs either:
   - explicit local path loading, or
   - cache metadata repair/reindex, or
   - forced download confirmation to repair cache mapping.

## Recommendation
1. Keep MiniMax loaded as control baseline.
2. Fix GLM/Kimi load resolution first, then run same benchmark matrix on each:
   - short_64 (3 runs), medium_256 (3), long_512 (2)
3. Compare by:
   - avg tok/s
   - warm TTFT (exclude first run)
   - memory_gb loaded
   - stability (timeouts/errors)

## Next action command bundle (to execute in follow-up)
- Try explicit load via local snapshot path for GLM-5/Kimi.
- If rejected, run admin download-confirm flow to repair model index then reload.
- Re-run benchmark matrix and append this report with side-by-side model comparison.
