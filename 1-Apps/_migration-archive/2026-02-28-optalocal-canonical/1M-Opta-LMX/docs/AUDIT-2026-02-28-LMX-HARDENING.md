# Opta LMX Hardening Audit — 2026-02-28

Scope: `/Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX`

Goal: Highest-impact improvements across reliability, performance, security, maintainability.

---

## Executive Verdict

Current state is **feature-rich but security-open by default in critical surfaces**. The largest risk is unauthenticated execution surfaces (`/v1/skills*`, `/v1/agents*`, websocket chat stream) combined with request-priority bypass and partial runtime guardrails. If exposed beyond localhost/LAN, this is an immediate abuse vector.

---

## Top 15 Issues (sorted by impact)

### 1) Unauthenticated Skills API enables remote tool execution (CRITICAL, Security)
- **Evidence:** `src/opta_lmx/api/skills.py` uses `router = APIRouter(tags=["skills"])` with no `Depends(verify_inference_key)`.
- **Risk:** Arbitrary skill invocation over HTTP; potential command/network/file actions depending on installed skills/policy.
- **Patch plan:**
  - Add auth dependency at router level:
    - `src/opta_lmx/api/skills.py`: import `Depends, verify_inference_key`; change router to `APIRouter(..., dependencies=[Depends(verify_inference_key)])`.
  - Add integration tests:
    - `tests/api/test_skills_auth.py`: assert 401 without API key, 200 with key.

### 2) Unauthenticated Agents API allows untrusted run creation/cancellation (CRITICAL, Security/Reliability)
- **Evidence:** `src/opta_lmx/api/agents.py` router has no auth dependency.
- **Risk:** Untrusted users can create agent runs, consume compute, alter/cancel active workflows.
- **Patch plan:**
  - `src/opta_lmx/api/agents.py`: add `Depends(verify_inference_key)` at router level.
  - `tests/api/test_agents_auth.py`: enforce auth behavior for run create/list/get/cancel/events.

### 3) WebSocket `/v1/chat/stream` has no auth and no per-client rate gate (CRITICAL, Security/DoS)
- **Evidence:** `src/opta_lmx/api/websocket.py` accepts connection immediately (`await websocket.accept()`), no API key/JWT verification.
- **Risk:** Anonymous token streaming and sustained connection abuse.
- **Patch plan:**
  - `src/opta_lmx/api/websocket.py`:
    - Parse auth from headers/query (`Authorization`, `X-Api-Key`) before `accept`.
    - Reuse existing `verify_inference_key` logic via shared helper extracted into reusable function (new helper in `api/deps.py`).
    - Reject with policy close code (e.g., 1008) for auth failures.
  - Add websocket auth tests in `tests/api/test_websocket_auth.py`.

### 4) `X-Priority: high` bypasses concurrency semaphores globally (CRITICAL, Reliability/Abuse)
- **Evidence:** `src/opta_lmx/inference/engine_concurrency.py` `_acquire_request_slots`: `if priority == "high": yield` (no slot acquisition).
- **Risk:** Any caller can bypass queue controls via header; can trigger memory pressure/OOM under load.
- **Patch plan:**
  - `src/opta_lmx/api/inference.py`: whitelist priority values and restrict `high` to trusted clients/admin.
  - `src/opta_lmx/inference/engine_concurrency.py`: change `high` to bounded lane (e.g., dedicated small semaphore), never unlimited bypass.
  - Tests: `tests/inference/test_priority_concurrency_limits.py`.

### 5) Rate limit identity ignores trusted-proxy config (HIGH, Security/Abuse)
- **Evidence:** `src/opta_lmx/api/rate_limit.py` uses `slowapi.util.get_remote_address` directly; config has `honor_x_forwarded_for/trusted_proxies` in `config.py` but limiter doesn’t use it.
- **Risk:** Incorrect client attribution behind reverse proxies; easy evasion or accidental global throttling.
- **Patch plan:**
  - `src/opta_lmx/api/rate_limit.py`: custom `key_func` using app state trusted-proxy parsing from `main.py`.
  - Reuse/centralize IP extraction helper in `api/deps.py` or `api/middleware.py`.
  - Tests: `tests/api/test_rate_limit_client_ip_resolution.py`.

### 6) mTLS middleware is a no-op despite config modes (HIGH, Security)
- **Evidence:** `src/opta_lmx/api/middleware.py` `MTLSMiddleware.__call__` is pass-through.
- **Risk:** Operators may assume `mtls_mode=required` is enforced when it is not.
- **Patch plan:**
  - Implement enforcement:
    - Verify client subject header presence in `required` mode.
    - Validate subject allowlist.
    - Reject with 401/403 and audit logs.
  - Add tests `tests/api/test_mtls_middleware.py`.

### 7) OpenTelemetry middleware is a no-op when enabled (HIGH, Observability/Reliability)
- **Evidence:** `src/opta_lmx/api/middleware.py` `OpenTelemetryMiddleware` pass-through.
- **Risk:** False observability confidence; incident triage latency.
- **Patch plan:**
  - Implement real tracing middleware or remove feature flag until complete.
  - If implemented, add trace IDs to request logs; verify export path.
  - Tests: `tests/api/test_otel_middleware.py` (enabled/disabled behavior).

### 8) Config hot-reload updates state but not all middleware/runtime controls (HIGH, Reliability)
- **Evidence:** `src/opta_lmx/api/admin_config.py` updates app state keys; middleware-level controls (CORS, rate limiter internals, mTLS policy) are not re-instantiated.
- **Risk:** Runtime config drift: UI says config updated, behavior remains stale until restart.
- **Patch plan:**
  - Define explicit `hot_reloadable` vs `restart_required` sections.
  - Return per-field reload status in `/admin/config/reload` response.
  - For rate limits, refresh limiter callables/state if supported.
  - `tests/api/test_config_reload_scope.py`.

### 9) Broad exception swallowing in critical loops obscures failures (MED-HIGH, Reliability/Maintainability)
- **Evidence:** multiple `except Exception` in `src/opta_lmx/main.py`, `api/admin_models.py`, `agents/scheduler.py`, `helpers/health.py` with minimal recovery logic.
- **Risk:** Silent degradation, hard-to-debug partial outages.
- **Patch plan:**
  - Replace broad catches with typed exceptions where possible.
  - For unavoidable broad catches, include `exc_info=True`, loop health counters, backoff, and alert events.
  - Start with: `main.py`, `agents/scheduler.py`, `helpers/health.py`.

### 10) Synchronous file reads in request path for large logs can block event loop (MED-HIGH, Performance)
- **Evidence:** `src/opta_lmx/api/journal_logs.py` uses `Path.read_text()` directly in async handlers.
- **Risk:** Admin log reads can block API responsiveness under large files.
- **Patch plan:**
  - Switch to `await asyncio.to_thread(target.read_text, encoding="utf-8")`.
  - Add max-byte guard and optional range/streaming for large logs.
  - Tests: `tests/api/test_journal_logs_large_file.py`.

### 11) Per-skill-call thread pool creation adds overhead and thread churn (MEDIUM, Performance)
- **Evidence:** `src/opta_lmx/skills/executors.py` `_call_with_timeout()` creates `ThreadPoolExecutor(max_workers=1)` for each call.
- **Risk:** Higher latency/jitter under burst traffic.
- **Patch plan:**
  - Promote to shared executor on `SkillExecutor` instance with bounded workers and clean shutdown.
  - Track queue depth and execution latency metrics.
  - Tests/bench: `tests/skills/test_executor_reuse.py`.

### 12) Internal/private attribute coupling (`engine._models`, `metrics._latency_sum`) (MEDIUM, Maintainability)
- **Evidence:** `src/opta_lmx/api/benchmark.py` and `src/opta_lmx/api/admin_diagnostics.py` read private internals.
- **Risk:** Fragile cross-module changes, hidden breakage.
- **Patch plan:**
  - Add public getters on engine/metrics classes.
  - Replace private reads with stable interfaces.
  - Add contract tests for diagnostics and benchmark payloads.

### 13) Load shedding only covers HTTP, not websocket transport (MEDIUM, Reliability)
- **Evidence:** `src/opta_lmx/api/load_shedding.py` checks `scope["type"] == "http"` only.
- **Risk:** Memory pressure can still be amplified via websocket streams.
- **Patch plan:**
  - Extend shedding policy to websocket accepts (pre-accept check) and per-message handling.
  - Wire into `api/websocket.py` with close-on-pressure behavior.

### 14) Worker queue persistence defaults to `/tmp` (MEDIUM, Reliability/Security hygiene)
- **Evidence:** `src/opta_lmx/config.py` `WorkersConfig.skill_queue_persist_path = "/tmp/opta-lmx-skill-queue.db"`.
- **Risk:** Volatile persistence across reboot, weaker filesystem guarantees/visibility.
- **Patch plan:**
  - Default to `~/.opta-lmx/skill-queue.db`.
  - Add migration warning if old `/tmp` path is detected.

### 15) Missing regression tests for auth boundaries on newly added APIs (MEDIUM, Security/Maintainability)
- **Evidence:** Security-critical surfaces (`skills`, `agents`, websocket) were introduced without mandatory auth tests.
- **Risk:** Future regressions re-open remote execution risks.
- **Patch plan:**
  - Add auth test matrix for all `/v1/*` and `/admin/*` endpoints.
  - Add CI gate: fail if any `/v1/*` route lacks explicit auth policy annotation.

---

## Exact File-Level Patch Plan

### A) Authentication + Abuse Control (highest ROI)
1. `src/opta_lmx/api/skills.py`
   - Add `Depends(verify_inference_key)` router dependency.
   - Optionally add per-endpoint scope checks for sensitive skill namespaces.
2. `src/opta_lmx/api/agents.py`
   - Add `Depends(verify_inference_key)` router dependency.
   - Enforce submitter identity binding from JWT claim (if available).
3. `src/opta_lmx/api/websocket.py`
   - Add pre-accept auth verification path.
   - Reject unauthenticated clients with close code `1008`.
   - Add per-connection max active requests and queue limits.
4. `src/opta_lmx/api/inference.py`
   - Sanitize/validate `x_priority` values.
   - Restrict `high` priority to trusted identities.
5. `src/opta_lmx/inference/engine_concurrency.py`
   - Replace hard bypass with bounded high-priority lane.
   - Emit telemetry for high-priority usage.
6. `src/opta_lmx/api/rate_limit.py`
   - Replace `get_remote_address` with trusted-proxy-aware key function.

### B) Transport Security + Observability Truthfulness
7. `src/opta_lmx/api/middleware.py`
   - Implement `MTLSMiddleware` behavior for `off/optional/required`.
   - Implement real OpenTelemetry request span handling or disable feature claim.

### C) Runtime Reliability + Performance
8. `src/opta_lmx/api/admin_config.py`
   - Introduce reload scope report (`applied`, `restart_required`, `failed`).
9. `src/opta_lmx/main.py`
   - Improve background task supervision (typed errors, backoff, structured error events).
10. `src/opta_lmx/api/journal_logs.py`
   - Move file I/O off event loop; add read size guards.
11. `src/opta_lmx/skills/executors.py`
   - Reuse shared thread pool instead of per-call executor.
12. `src/opta_lmx/api/benchmark.py`
13. `src/opta_lmx/api/admin_diagnostics.py`
   - Remove private-attribute reads via new public APIs.
14. `src/opta_lmx/api/load_shedding.py`
15. `src/opta_lmx/config.py`
   - Extend shedding to websocket; move worker queue default path from `/tmp`.

### D) Tests to add (blocking for merge)
- `tests/api/test_skills_auth.py`
- `tests/api/test_agents_auth.py`
- `tests/api/test_websocket_auth.py`
- `tests/inference/test_priority_concurrency_limits.py`
- `tests/api/test_rate_limit_client_ip_resolution.py`
- `tests/api/test_mtls_middleware.py`
- `tests/api/test_config_reload_scope.py`
- `tests/api/test_journal_logs_large_file.py`

---

## Delivery Buckets

## Fast Wins (<2h)
1. Add auth dependencies to `skills.py` and `agents.py`.
2. Block `x_priority=high` from untrusted callers (temporary allowlist).
3. Add websocket pre-accept auth check.
4. Change `/tmp/opta-lmx-skill-queue.db` default to durable user path.
5. Add minimal auth regression tests for skills/agents.

## Medium (1 day)
1. Trusted-proxy-aware rate-limit key function.
2. Config reload scope reporting (`hot_reloadable` vs `restart_required`).
3. Shared executor refactor for skills runtime.
4. Async/non-blocking journal log reads with size limits.
5. Replace top private-attribute usages with public interfaces.

## Deep (3+ days)
1. Full mTLS enforcement middleware + cert subject policy + end-to-end tests.
2. Real OpenTelemetry implementation with exporter/trace correlation.
3. Background task supervision framework (health state, retry policies, alert events).
4. Unified security policy annotations per route with CI enforcement.

---

## Validation Commands

> Note: On this machine, `pytest` is not currently installed in the active Python (`python3 -m pytest` failed). Run the environment setup first.

### Environment setup
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX
python3 -m pip install -e ".[dev,ratelimit]"
```

### Static checks
```bash
ruff check src tests
python3 -m mypy src/opta_lmx
```

### Targeted security tests
```bash
python3 -m pytest -q tests/api/test_skills_auth.py tests/api/test_agents_auth.py tests/api/test_websocket_auth.py
python3 -m pytest -q tests/inference/test_priority_concurrency_limits.py tests/api/test_rate_limit_client_ip_resolution.py
```

### Full regression
```bash
python3 -m pytest -q
```

### Manual verification (after start)
```bash
# Start server
opta-lmx --config config/config.yaml

# 1) Skills endpoint should reject without key
curl -i http://127.0.0.1:1234/v1/skills

# 2) Agents endpoint should reject without key
curl -i http://127.0.0.1:1234/v1/agents/runs

# 3) Inference still works with key
curl -s http://127.0.0.1:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $LMX_API_KEY" \
  -d '{"model":"auto","messages":[{"role":"user","content":"ping"}]}'
```

---

## Final Priority Sequence
1. **Immediately:** lock down `skills`, `agents`, and websocket auth.
2. **Next:** remove `high`-priority bypass and fix rate-limit identity.
3. **Then:** implement real mTLS/OTEL or explicitly disable those claims.
4. **Finally:** reliability/perf refinements (blocking I/O, executor reuse, loop supervision).
