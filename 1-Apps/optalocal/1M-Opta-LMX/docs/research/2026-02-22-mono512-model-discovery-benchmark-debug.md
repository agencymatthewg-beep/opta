# Mono512 Model Discovery and Benchmark Debug (2026-02-22)

## Scope
- Debug why models appear "missing" in Opta CLI.
- Validate model inventory vs loaded models on Mono512.
- Run live per-model benchmark/load validation.
- Stabilize service after repeated crash loops.

## What Was Verified
- `GET /v1/models` returns only loaded models (not all downloaded models).
- `GET /admin/models/available` returns on-disk Hugging Face cache models.
- This mismatch is the primary reason users see "missing models" in CLI workflows that only query loaded state.

## Critical Runtime Issues Found
- Disk exhaustion repeatedly caused startup/load failures:
  - `OSError: [Errno 28] No space left on device`
  - `No usable temporary directory found ...`
- Large model load attempts triggered process-level aborts:
  - `libc++abi ... [METAL] ... Insufficient Memory`
- Repeated crashes left launchd in restart loops.
- During one failure phase, service startup also hit:
  - `ModuleNotFoundError: No module named 'opta_lmx'` (venv package import broken).

## Live Remediations Applied on Mono512
- Cleaned partial HF artifacts:
  - Deleted `*.incomplete` and stale `.locks` under `~/.cache/huggingface/hub`.
  - Recovered ~32-35 GB each cleanup cycle.
- Updated active config (`config/mono512-current.yaml`) on Mono512:
  - `models.auto_load` reduced to a single model (`inferencerlabs/MiniMax-M2.5-MLX-6.5bit`) to avoid multi-model startup OOM.
  - `models.max_concurrent_requests` reduced to `2` for stability.
- Repaired venv package importability:
  - Ran `python -m pip install -e .` in remote app path.
- Restarted launchd service and revalidated:
  - `healthz` healthy.
  - `/admin/status` and `/v1/models` available.

## Per-Model Load/Benchmark Outcomes (Latest Run)
- `inferencerlabs/MiniMax-M2.5-MLX-6.5bit`: load failed (`curl rc=52`, empty reply / process crash window).
- `sentence-transformers/all-MiniLM-L6-v2`: load failed with internal error (not a chat-generation target model).
- `inferencerlabs/GLM-5-MLX-4.8bit`: load failed (`curl rc=52`, crash).
- `mlx-community/MiniMax-M2.5-4bit`: service not ready after restart/load cycle.
- `mlx-community/MiniMax-M2.5-8bit`: service not ready after restart/load cycle.
- `mlx-community/Kimi-K2.5-3bit`: service not ready after restart/load cycle.
- `mlx-community/MiniMax-M2.5-6bit`: service not ready in final loop phase.

## Confirmed Successful Benchmark Event From Logs
- `benchmark_complete` found in `/tmp/opta-lmx-service.log`:
  - model: `mlx-community/MiniMax-M2.5-6bit`
  - runs: `1`
  - avg tokens/sec: `27.26`
  - avg TTFT: `200.64 ms`
  - HTTP status: `200` on `/admin/benchmark`

## Codebase Hardening Added (This Workspace)
- `src/opta_lmx/runtime_state.py`
  - Runtime state writes now degrade gracefully under disk write failures (no startup crash on ENOSPC).
- `src/opta_lmx/manager/model.py`
  - Available model listing now skips incomplete cache entries (no completed revision files), reducing false-positive "available" models.
- Tests updated:
  - `tests/test_runtime_state.py`
  - `tests/test_model_manager.py`
- Targeted verification:
  - `PYTHONPATH=src .venv/bin/pytest -q tests/test_runtime_state.py tests/test_model_manager.py`
  - Result: `28 passed`.

## Current State at End of Run
- Mono512 service restored and reachable after venv repair.
- Service stable with single auto-loaded model configuration.
- Disk remains tight (roughly low tens of GB free), and heavy model switching can quickly re-enter unstable states without stricter model lifecycle controls.

## Follow-up Update (2026-02-22, evening)

### Confirmed Root Cause of "Missing Models" in Opta CLI
- `/v1/models` (no admin key) returns only currently loaded models.
- `/admin/models/available` requires `X-Admin-Key`; without it, response is `{"detail":"Invalid or missing admin key"}`.
- When CLI paths silently fallback to empty arrays on admin endpoint failure, this appears as "models not found" even though models exist on disk.

### Current On-Disk Inventory (Mono512)
- Total HF model repos detected: `8`.
- Largest repos:
  - `inferencerlabs/GLM-5-MLX-4.8bit` ~`418.08 GB`
  - `mlx-community/Kimi-K2.5-3bit` ~`362.32 GB`
  - `mlx-community/MiniMax-M2.5-8bit` ~`173.67 GB`
  - `inferencerlabs/MiniMax-M2.5-MLX-6.5bit` ~`173.08 GB`
  - `mlx-community/MiniMax-M2.5-6bit` ~`173.08 GB`
  - `mlx-community/MiniMax-M2.5-4bit` ~`119.85 GB`
- No single repo exceeded `1.5 TB`; aggregate cache usage is still very high and interacts badly with low free disk.

### Benchmarks and Load Outcomes (Verified)
- Successful `benchmark_complete` events:
  - `mlx-community/MiniMax-M2.5-4bit`: `46.22 tok/s`, `143.13 ms` TTFT (1 run)
  - `mlx-community/MiniMax-M2.5-6bit`: `38.16 tok/s`, `180.38 ms` TTFT (1 run)
  - `inferencerlabs/MiniMax-M2.5-MLX-6.5bit`: `38.35 tok/s`, `177.94 ms` TTFT (1 run)
- Direct probe failures during this pass:
  - `mlx-community/MiniMax-M2.5-8bit`: load timeout (`curl rc 28`, HTTP `000`)
  - `mlx-community/Kimi-K2.5-3bit`: load timeout (`curl rc 28`, HTTP `000`)
  - `inferencerlabs/GLM-5-MLX-4.8bit`: load failed with empty reply (`curl rc 52`, HTTP `000`)
  - `sentence-transformers/all-MiniLM-L6-v2`: repeated load `500` in prior attempts (not a chat-generation target model)

### Operational Notes
- Overlapping long-running benchmark shells caused additional instability and hidden contention; future automation should enforce single-runner locking.
- Service was restored and left healthy with:
  - loaded: `inferencerlabs/MiniMax-M2.5-MLX-6.5bit`
  - health endpoint: `{"status":"ok","version":"0.1.0"}`

### CLI Quick Fix Applied
- Opta CLI model command now surfaces non-fatal admin inventory failures (instead of silently showing empty lists):
  - unauthorized admin access now points users to `connection.adminKey`
  - connection failures now report an explicit LMX reachability warning
- Implemented in:
  - `1D-Opta-CLI-TS/src/commands/models.ts`
  - `1D-Opta-CLI-TS/tests/commands/models.test.ts`

## Follow-up Load Path Hardening (2026-02-22, late)

### Problem
- "Model already on disk" loads still used repo IDs at engine boundary, allowing backend/HF resolution paths to perform remote HEAD/token checks and stall/fail under disk/network pressure.
- Some disk-originated load failures were surfacing as generic `500` instead of actionable disk errors.

### Fixes Applied
- `src/opta_lmx/inference/engine.py`
  - Added local snapshot resolution for cached repo IDs before engine creation.
  - vllm-mlx now receives local snapshot directory paths when available.
  - Expanded context-length resolver to support direct local snapshot directories.
  - Preserved `OSError`/`MemoryError` from load path so admin API can classify failures.
- `src/opta_lmx/api/admin.py`
  - On-disk load path now maps `OSError` to structured `507 insufficient_disk`.
- `src/opta_lmx/manager/model.py`
  - Available-model `local_path` now prefers revision `snapshot_path` when present.

### Regression Tests Added
- `tests/test_performance_profiles.py`
  - Verifies cached repo IDs are passed to engine as local snapshot paths.
- `tests/test_admin.py`
  - Verifies on-disk load maps engine `OSError` to `507 insufficient_disk`.
- `tests/test_model_manager.py`
  - Verifies `local_path` prefers snapshot path over repo root.

### Verification
- Command:
  - `PYTHONPATH=src .venv/bin/pytest -q tests/test_admin.py tests/test_model_manager.py tests/test_performance_profiles.py`
- Result:
  - `67 passed`

## Follow-up Snapshot Integrity Fix (2026-02-22, late+)

### Root Cause Confirmed
- Some large-model snapshots passed `snapshot_download(..., local_files_only=True)` but were still incomplete.
- `model.safetensors.index.json` referenced shard files that were missing on disk (partial download after disk exhaustion).
- This produced opaque load failures (`Missing N parameters`) instead of a repair/download-required response.

### Additional Fixes Applied
- `src/opta_lmx/manager/model.py` (+ mirrored `src/opta_lmx/model.py`)
  - Added index-aware snapshot validation in `is_local_snapshot_complete`.
  - New `_validate_snapshot_files(...)` checks that all index-referenced shard files exist before a model is considered complete.
  - Incomplete index state now returns `False`, enabling admin repair flow (`202 download_required`) instead of runtime load crashes.

### Additional Tests
- `tests/test_model_manager.py`
  - Added `test_is_local_snapshot_complete_false_when_index_references_missing_files`.

### Re-Verification
- Command:
  - `PYTHONPATH=src .venv/bin/pytest -q tests/test_model_manager.py tests/test_admin.py tests/test_performance_profiles.py`
- Result:
  - `68 passed`

### Live Mono512 Validation After Deploy
- Deployed updated files to `/Users/Shared/312/Opta/1-Apps/1M-Opta-LMX` and restarted `launchctl` service (`com.opta.lmx`).
- `GET /admin/models/available` now reports snapshot directories (not repo roots) as `local_path`.
- `POST /admin/models/load` for `mlx-community/MiniMax-M2.5-8bit` now returns:
  - `202 download_required` with "Model cache is incomplete..." (instead of previous `500`).
- Logs confirm index-integrity detection:
  - `local_snapshot_incomplete ... missing_weight_files:11`
  - `model_snapshot_incomplete`
- With `auto_download=true` under low disk, endpoint now returns:
  - `507 insufficient_disk` with explicit free-space requirement message.
  - After final admin optimization, this path short-circuits without HF model-metadata fetch for snapshot-repair requests (latest observed request latency ~`71 ms` on Mono512).
