# Kimi-K2.5-3bit Repair + Validation Report
Date: 2026-02-23
Operator: OpenClaw subagent (`lmx-kimi-repair-run`)

## Scope Requested
Repair and validate `mlx-community/Kimi-K2.5-3bit` on Mono512:
1. Inspect snapshot state
2. Clean redownload if needed
3. Verify full shard set
4. Load test + canary generation via Opta-LMX

## Environment Actually Reachable During Run
- Active Opta-LMX endpoint reachable: `http://127.0.0.1:1234`
- Node status showed `Mono512` paired but **disconnected** from current session tooling.
- Mono512 remote command execution was not available from this session.

## Findings

### 1) Snapshot inspection (local reachable host)
- Local HF cache did **not** contain `models--mlx-community--Kimi-K2.5-3bit`.
- `POST /admin/models/load` with `{"model_id":"mlx-community/Kimi-K2.5-3bit"}` returned:
  - `status: "download_required"`
  - confirmation token provided.

### 2) Clean redownload attempt
Two redownload paths were attempted:
- `POST /admin/models/load/confirm` (using confirmation token)
- `POST /admin/models/download` (direct)

Both failed immediately with the same runtime error from download progress endpoint:
- `error: "'function' object has no attribute 'get_lock'"`
- `status: "failed"`
- `downloaded_bytes: 0`

This indicates repair is blocked by a downloader implementation bug in current Opta-LMX runtime, not by transient network conditions.

### 3) Full shard set verification (authoritative upstream)
Verified expected shard manifest from Hugging Face model metadata (`https://huggingface.co/api/models/mlx-community/Kimi-K2.5-3bit`):
- Total sibling files: `108`
- `safetensors` model shards: **`91`**
  - from `model-00001-of-00091.safetensors`
  - to `model-00091-of-00091.safetensors`
- Index present: `model.safetensors.index.json`

Result:
- Expected full shard set = **91/91 + index**
- Reachable local host currently has **0/91** for this repo (no local snapshot present)

### 4) Load test + canary generation via Opta-LMX
Because Kimi could not be downloaded/loaded due downloader failure, Kimi-specific canary could not be executed.

To validate server generation path itself (control test), ran canary on an already cached small model:
- Loaded `mlx-community/Qwen2.5-0.5B-Instruct-4bit` successfully.
- Chat completion prompt: `Canary test: reply with EXACT text CANARY_OK`
- Response content: `CANARY_OK`
- Confirms inference path is working; blocker is model download/repair path.

## Conclusion
`mlx-community/Kimi-K2.5-3bit` repair on the reachable runtime is currently blocked by a reproducible downloader bug:
- `"'function' object has no attribute 'get_lock'"`

No successful redownload occurred, so Kimi cannot be loaded or canary-tested yet.

## Recommended Next Actions (targeted)
1. Fix downloader bug in Opta-LMX (`get_lock` call path in download manager/progress synchronization).
2. Re-run redownload for `mlx-community/Kimi-K2.5-3bit`.
3. Validate local snapshot completeness against expected **91 shards + index**.
4. Execute Kimi load + canary generation test via `/admin/models/load` and `/v1/chat/completions`.
5. If this work must be specifically on Mono512, ensure Mono512 node/session is connected before rerun so runtime and cache checks are host-accurate.

## Raw Evidence (key API responses)
- `/admin/models/load` => `download_required` + confirmation token
- `/admin/models/load/confirm` => `downloading` + `download_id`
- `/admin/models/download/{id}/progress` => `failed`, error `"'function' object has no attribute 'get_lock'"`
- HF metadata for repo => 91 shard files (`model-00001`..`model-00091`) + index file present
