# Opta-LMX Compatibility Matrix — GLM-5, Kimi-K2.5, MiniMax (Mono512)
Date: 2026-02-23
Host scope: **Mono512** (Mac Studio M3 Ultra, 512GB)
Method: Non-destructive evidence synthesis from live runtime logs + prior validated runbooks/reports.

## 1) Version + Runtime Baseline (captured)

### Confirmed
- **Opta-LMX API version:** `0.1.0`
  - Evidence: health payload in prior Mono512 validation (`{"status":"ok","version":"0.1.0"}`)
  - Source: `docs/research/2026-02-22-mono512-model-discovery-benchmark-debug.md`
- **Service profile:** `lan`, `safe_mode: False`, listening on `:1234`
  - Source: `12-Session-Logs/2026-02-23-1530-mono512-lan-runtime-session.md`, `...1600...md`
- **Active production config:** `config/mono512-current.yaml`
  - Notable conservative tuning in-file: single-model auto-load + reduced concurrency

### Relevant dependency/compat notes (explicitly documented)
- `config/mono512-current.yaml` notes:
  - Kimi 3.6-bit variant marked **incompatible with `mlx_lm v0.30.7`**
- Latest speculative scorecard indicates current backend build lacks speculative kwargs support for both SimpleEngine/BatchedEngine (feature gating issue, not core load API failure).

---

## 2) Available Model Inventory on Mono512 (on-disk)

From validated Mono512 inventory pass:
- `inferencerlabs/GLM-5-MLX-4.8bit` (~418.08 GB)
- `mlx-community/Kimi-K2.5-3bit` (~362.32 GB)
- `inferencerlabs/MiniMax-M2.5-MLX-6.5bit` (~173.08 GB)
- `mlx-community/MiniMax-M2.5-8bit` (~173.67 GB)
- `mlx-community/MiniMax-M2.5-6bit` (~173.08 GB)
- `mlx-community/MiniMax-M2.5-4bit` (~119.85 GB)

Source: `docs/research/2026-02-22-mono512-model-discovery-benchmark-debug.md`

---

## 3) Controlled Load/Unload + Canary Outcomes

## 3.1 Evidence Summary Matrix

### MiniMax family
- **inferencerlabs/MiniMax-M2.5-MLX-6.5bit**
  - Load/unload: **PASS (repeated)**
    - Evidence events:
      - `model_loaded` @ 14:37 (28.33s), unload @ 14:37
      - `model_loaded` @ 15:30 (30.52s), unload @ 16:00
      - `model_loaded` @ 16:00 (29.18s), unload @ 16:01
      - `model_loaded` @ 16:02 (10.85s), unload @ 16:17, reload @ 16:18
  - Canary inference: **PASS**
    - Benchmarks: ~38.25 tok/s (256), ~39.38 tok/s (512), warm TTFT ~129-157 ms
    - Source: `docs/research/2026-02-23-mono-lmx-benchmark-and-feasibility.md`
  - Compatibility verdict: **Compatible / stable baseline**

- **mlx-community/MiniMax-M2.5-4bit**
  - Load: **PASS (observed)**
    - Evidence: `model_loaded` @ 16:19 (20.83s)
  - Canary inference: **PASS (historical verified benchmark)**
    - ~46.22 tok/s, TTFT ~143 ms
    - Source: `docs/research/2026-02-22-mono512-model-discovery-benchmark-debug.md`
  - Compatibility verdict: **Compatible (fastest observed MiniMax variant)**

- **mlx-community/MiniMax-M2.5-6bit**
  - Load: mixed historical readiness during unstable window
  - Canary inference: **PASS (historical benchmark_complete)**
    - ~38.16 tok/s, TTFT ~180 ms
  - Compatibility verdict: **Conditionally compatible** (works when runtime is stable)

- **mlx-community/MiniMax-M2.5-8bit**
  - Load: **FAIL / blocked**
    - historical timeout (`curl rc 28`, HTTP 000)
    - later improved to actionable `202 download_required` on incomplete snapshot
  - Canary: **NOT RUN (no stable successful load evidence)**
  - Compatibility verdict: **Not currently compatible without cache repair/download flow**

### GLM-5
- **inferencerlabs/GLM-5-MLX-4.8bit**
  - Load: **MIXED (regression/recovery behavior)**
    - historical failure: `curl rc 52`, empty reply/crash window
    - later event evidence: `model_loaded` @ 16:20 (76.41s, 202.73 GB)
  - Unload: **not observed in captured 16:20 event file**
  - Canary inference: **NOT YET CONFIRMED after latest successful load event**
  - Compatibility verdict: **Partial / pending canary confirmation**

### Kimi-K2.5
- **mlx-community/Kimi-K2.5-3bit**
  - Load: **FAIL / blocked**
    - historical timeout (`curl rc 28`, HTTP 000)
  - Download/repair path: **FAIL observed**
    - `download_failed` with `'function' object has no attribute 'get_lock'`
  - Canary inference: **FAIL (no successful load)**
  - Compatibility verdict: **Not compatible in current runtime state**

---

## 4) Crash-Loop / Instability Evidence (required)

Observed and documented on Mono512:
- Disk exhaustion / tempdir failures:
  - `OSError: [Errno 28] No space left on device`
  - `No usable temporary directory found ...`
- Large-model load aborts:
  - `libc++abi ... [METAL] ... Insufficient Memory`
- Launchd restart-loop behavior during repeated failures
- Broken import phase during unstable period:
  - `ModuleNotFoundError: No module named 'opta_lmx'`

Source: `docs/research/2026-02-22-mono512-model-discovery-benchmark-debug.md`

---

## 5) Conservative Config Variant Test (required)

## Variant tested (stability-first)
Applied on Mono512 and validated:
- `models.auto_load` reduced to one model:
  - `inferencerlabs/MiniMax-M2.5-MLX-6.5bit`
- `models.max_concurrent_requests` reduced to `2`

Outcome:
- Service restored to healthy state
- Repeated controlled load/unload cycles succeeded for baseline model
- Benchmark canary resumed successfully

Source: `docs/research/2026-02-22-mono512-model-discovery-benchmark-debug.md`, `12-Session-Logs/2026-02-23-*mono512-lan-events.jsonl`

---

## 6) Non-Destructive Command Bundle (repro/verification)

```bash
# Health + version
curl -s http://<mono512>:1234/admin/health

# Loaded models (OpenAI surface)
curl -s http://<mono512>:1234/v1/models

# Full status
curl -s http://<mono512>:1234/admin/status

# Available on-disk models (admin key required)
curl -s -H "X-Admin-Key: $LMX_ADMIN_KEY" \
  http://<mono512>:1234/admin/models/available

# Controlled load
curl -s -X POST http://<mono512>:1234/admin/models/load \
  -H 'Content-Type: application/json' \
  -H "X-Admin-Key: $LMX_ADMIN_KEY" \
  -d '{"model":"inferencerlabs/GLM-5-MLX-4.8bit"}'

# Controlled unload
curl -s -X POST http://<mono512>:1234/admin/models/unload \
  -H 'Content-Type: application/json' \
  -H "X-Admin-Key: $LMX_ADMIN_KEY" \
  -d '{"model":"inferencerlabs/GLM-5-MLX-4.8bit"}'

# Canary inference (short)
curl -s http://<mono512>:1234/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
        "model":"inferencerlabs/GLM-5-MLX-4.8bit",
        "messages":[{"role":"user","content":"Reply with exactly: CANARY_OK"}],
        "max_tokens":16,
        "temperature":0
      }'

# Runtime event evidence
tail -n 200 /tmp/opta-lmx-events.jsonl
```

---

## 7) Final Compatibility Verdict (Mono512, current state)

- **Green (usable now):**
  - `inferencerlabs/MiniMax-M2.5-MLX-6.5bit`
  - `mlx-community/MiniMax-M2.5-4bit`
- **Yellow (partial / needs targeted retest):**
  - `inferencerlabs/GLM-5-MLX-4.8bit` (latest load success seen, but no paired canary result yet)
  - `mlx-community/MiniMax-M2.5-6bit` (historically benchmarked but unstable-window caveat)
- **Red (currently blocked):**
  - `mlx-community/Kimi-K2.5-3bit`
  - `mlx-community/MiniMax-M2.5-8bit`

---

## 8) Recommendations

1. **Keep MiniMax-6.5 as control baseline** for production while compatibility work proceeds.
2. **Run immediate GLM-5 canary pair** (load → one deterministic chat call → unload) and append outcome to close the yellow gap.
3. **Fix Kimi download path bug** (`get_lock` failure) before any further compatibility conclusion.
4. **Maintain conservative startup policy** (single auto-load + low concurrency) until disk headroom and cache integrity checks are consistently green.
5. **Promote load outcome taxonomy in automation** (`loaded`, `download_required`, `insufficient_disk`, transport timeout, empty-reply crash) so matrix status is machine-generated per run.

---

## Evidence Files Referenced
- `docs/research/2026-02-22-mono512-model-discovery-benchmark-debug.md`
- `docs/research/2026-02-23-mono-lmx-benchmark-and-feasibility.md`
- `config/mono512-current.yaml`
- `12-Session-Logs/2026-02-23-142854-mono512-lan-events.jsonl`
- `12-Session-Logs/2026-02-23-153015-mono512-lan-events.jsonl`
- `12-Session-Logs/2026-02-23-160024-mono512-lan-events.jsonl`
- `12-Session-Logs/2026-02-23-160151-mono512-lan-events.jsonl`
- `12-Session-Logs/2026-02-23-161808-mono512-lan-events.jsonl`
- `12-Session-Logs/2026-02-23-161929-mono512-lan-events.jsonl`
