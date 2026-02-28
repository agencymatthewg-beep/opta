# Model Download Guardrails (LMX)

This document defines the **download lifecycle guardrails** for HuggingFace model artifacts in Opta-LMX.

## Scope

Applies to:
- `POST /admin/models/download`
- `POST /admin/models/load` when `auto_download=true`
- background model cache maintenance in app lifespan

Code integration points:
- `src/opta_lmx/config.py` (`ModelsConfig` download/sweeper settings)
- `src/opta_lmx/main.py` (ModelManager wiring + sweeper task lifecycle)
- `src/opta_lmx/model.py` (download preflight checks, single-flight cap, incomplete artifact sweeper)

---

## 1) Free-space floor policy

### Policy
A download is blocked before any network transfer when free disk is below:
- `models.download_free_space_floor_gb` (hard floor), and
- if size estimate is available: `estimated_size * models.download_estimate_margin_ratio`.

### Config
```yaml
models:
  download_free_space_floor_gb: 5.0
  download_estimate_margin_ratio: 1.10
```

---

## 2) Single-concurrency download recommendation

### Policy
Default to one active download at a time to avoid:
- cache lock contention,
- highly fragmented partial snapshots,
- I/O saturation impacting live inference.

### Config
```yaml
models:
  max_concurrent_downloads: 1
```

### Runtime behavior
If active downloads already hit the cap, new downloads fail fast:
- `Download concurrency limit reached: N/N active`

Duplicate requests for the exact same repo/revision/pattern set still dedupe and reuse the existing in-flight download ID.

---

## 3) Incomplete artifact sweeper cadence

### Policy
Run periodic cleanup of stale/incomplete HF snapshots.

A revision is treated as incomplete when `model.safetensors.index.json` references shard files missing on disk.

### Config
```yaml
models:
  incomplete_artifact_sweeper_enabled: true
  incomplete_artifact_sweeper_interval_sec: 1800.0
  incomplete_artifact_min_age_sec: 1800.0
```

### Runtime behavior
Background loop in app lifespan calls:
- `ModelManager.sweep_incomplete_artifacts(min_age_sec=...)`

Sweeper result payload:
- `checked_revisions`
- `incomplete_revisions`
- `deleted_revisions`
- `freed_bytes`
- `errors`

---

## 4) Preflight checks (download lifecycle)

Preflight order in `ModelManager.start_download()`:
1. prune stale completed download metadata
2. dedupe exact duplicate in-flight requests
3. enforce active-download cap (`max_concurrent_downloads`)
4. free-space hard floor check
5. remote estimated-size check + safety margin
6. spawn async download and track progress

---

## Ops command snippets

```bash
# Verify effective guardrail config
python - <<'PY'
from opta_lmx.config import load_config
c = load_config()
print({
  'download_free_space_floor_gb': c.models.download_free_space_floor_gb,
  'download_estimate_margin_ratio': c.models.download_estimate_margin_ratio,
  'max_concurrent_downloads': c.models.max_concurrent_downloads,
  'incomplete_artifact_sweeper_enabled': c.models.incomplete_artifact_sweeper_enabled,
  'incomplete_artifact_sweeper_interval_sec': c.models.incomplete_artifact_sweeper_interval_sec,
  'incomplete_artifact_min_age_sec': c.models.incomplete_artifact_min_age_sec,
})
PY

# Start a download (tests preflight + concurrency guardrails)
curl -sS -X POST http://127.0.0.1:1234/admin/models/download \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"repo_id":"mlx-community/Qwen2.5-0.5B-Instruct-4bit"}' | jq

# Inspect logs for guardrail events
rg -n "download_started|download_reused|incomplete_artifact_sweep_completed|incomplete_snapshot_detected" ~/.opta-lmx/*.log
```
