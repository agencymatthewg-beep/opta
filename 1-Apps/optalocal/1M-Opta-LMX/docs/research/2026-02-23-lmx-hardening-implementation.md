# 2026-02-23 — Opta-LMX hardening implementation

Implemented hardening for incomplete downloads, pre-load readiness checks, and shard completeness validation.

## Changes made

### 1) Deterministic incomplete download error code

**Files changed:**
- `src/opta_lmx/inference/types.py`
- `src/opta_lmx/inference/schema.py`
- `src/opta_lmx/manager/model.py`
- `src/opta_lmx/api/admin.py`

**Details:**
- Added `error_code: str | None` to `DownloadTask`.
- Added `error_code: str | None` to `DownloadProgressResponse` payload.
- Added deterministic constants in model manager:
  - `INCOMPLETE_DOWNLOAD_ERROR_CODE = "incomplete_download"`
  - `DOWNLOAD_CANCELLED_ERROR_CODE = "download_cancelled"`
- Download failures now carry machine-readable `error_code`:
  - cancelled flow sets `download_cancelled`
  - known incomplete/missing/shard-related failures classify to `incomplete_download`
- Post-download integrity verification now runs before marking completion; if snapshot is incomplete, task is marked failed with `error_code="incomplete_download"`.

### 2) Pre-load readiness check (auto-load worker)

**File changed:**
- `src/opta_lmx/api/admin.py`

**Details:**
- In `_load_after_download(...)`, added an explicit readiness guard before `engine.load_model(...)`:
  - `await manager.is_local_snapshot_complete(model_id)`
- If readiness fails, auto-load is skipped and warning is logged (`auto_load_skipped_snapshot_incomplete`) instead of attempting a potentially unstable load.

### 3) Robust shard completeness handling

**File changed:**
- `src/opta_lmx/manager/model.py`

**Details:**
- Expanded `_validate_snapshot_files(...)` to cover additional shard/index layouts:
  - validates both:
    - `model.safetensors.index.json`
    - `pytorch_model.bin.index.json`
  - checks all index-referenced weight files exist.
- Improved heuristic shard-count validation:
  - now recognizes `-00001-of-000NN.(safetensors|bin)` patterns
  - checks consistency of declared totals
  - checks missing shard count deterministically

## Tests updated

**Files changed:**
- `tests/test_model_manager.py`
- `tests/test_auto_download.py`

**Added coverage:**
- bin-index missing shard detection (`pytorch_model.bin.index.json`)
- deterministic `error_code` surfaced via download progress endpoint
- auto-load worker pre-load readiness guard (load skipped when snapshot incomplete)

## Validation run

Executed:

```bash
.venv/bin/pytest -q tests/test_model_manager.py tests/test_auto_download.py tests/test_admin.py
```

Result: **84 passed**.
