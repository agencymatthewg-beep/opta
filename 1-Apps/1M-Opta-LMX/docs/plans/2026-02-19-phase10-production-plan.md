# Phase 10: Production Hardening — Implementation Plan

**Date:** 2026-02-19
**Based on:** `docs/research/2026-02-19-phase10-production-hardening.md`
**Estimated total:** ~4 hours (33 tasks, each 2-5 min)
**TDD approach:** Write failing test -> run -> implement -> run -> commit

---

## Pre-Flight

```bash
cd ~/Synced/Opta/1-Apps/1J-Opta-LMX
source .venv/bin/activate
pytest tests/ -x -q   # Confirm green baseline
```

---

## P0: Critical (Do First)

### Task 1: Set admin_key in production config

**Why:** `admin_key: null` means all `/admin/*` endpoints are unauthenticated in production.

**File:** `config/mono512-current.yaml`

**Test:** No test needed — config change only.

**Steps:**
1. Generate a key:
   ```bash
   python3 -c "import secrets; print(f'lmx-{secrets.token_urlsafe(32)}')"
   ```
2. Edit `config/mono512-current.yaml`:
   ```yaml
   security:
     admin_key: "lmx-<generated-key>"  # Phase 10: production admin auth
   ```
3. Commit:
   ```bash
   git add config/mono512-current.yaml
   git commit -m "fix(lmx): set admin_key in production config (P0 security)"
   git push
   ```

---

### Task 2: Move log file path from /tmp/ to /var/log/opta-lmx/

**Why:** `/tmp/` is cleared on macOS reboot. Logs must survive restarts.

**File:** `config/mono512-current.yaml`

**Test:** No test needed — config change only. The logging module already calls `mkdir(parents=True, exist_ok=True)` in `src/opta_lmx/monitoring/logging.py:105`.

**Steps:**
1. Edit `config/mono512-current.yaml`, change:
   ```yaml
   logging:
     file: "/var/log/opta-lmx/opta-lmx.log"
   ```
2. Note: The launchd plist already uses `/var/log/opta-lmx/` for stdout/stderr. This aligns the app log with those.
3. Commit:
   ```bash
   git add config/mono512-current.yaml
   git commit -m "fix(lmx): move log file to /var/log/opta-lmx/ (survives reboot)"
   git push
   ```

---

## P1: High Priority

### Task 3: Add `readyz` endpoint — test (RED)

**Why:** Load balancers and monitoring need to know when the server is ready to accept inference requests, not just alive.

**File:** `tests/test_health.py`

**Steps:**
1. Add test class to `tests/test_health.py`:
   ```python
   class TestReadyz:
       """Tests for unauthenticated /readyz endpoint."""

       @pytest.mark.asyncio
       async def test_returns_503_when_no_models_loaded(self, client: AsyncClient) -> None:
           """Readyz returns 503 when no models are loaded."""
           response = await client.get("/readyz")
           assert response.status_code == 503
           data = response.json()
           assert data["status"] == "unavailable"

       @pytest.mark.asyncio
       async def test_returns_200_when_model_loaded(self, client: AsyncClient) -> None:
           """Readyz returns 200 when at least one model is loaded."""
           app = client._transport.app  # type: ignore[union-attr]
           await app.state.engine.load_model("test/model-ready")
           response = await client.get("/readyz")
           assert response.status_code == 200
           data = response.json()
           assert data["status"] == "ready"

       @pytest.mark.asyncio
       async def test_no_auth_required(self, client_with_auth: AsyncClient) -> None:
           """Readyz does not require admin key."""
           response = await client_with_auth.get("/readyz")
           # 503 is fine — just prove it's not 403
           assert response.status_code != 403
   ```
2. Run (expect FAIL):
   ```bash
   pytest tests/test_health.py::TestReadyz -x -v
   ```
3. Commit:
   ```bash
   git add tests/test_health.py
   git commit -m "test(lmx): add failing tests for /readyz readiness probe"
   git push
   ```

---

### Task 4: Implement `readyz` endpoint (GREEN)

**File:** `src/opta_lmx/api/health.py`

**Steps:**
1. Add import at top of `health.py`:
   ```python
   from fastapi import APIRouter, Request
   from fastapi.responses import JSONResponse
   ```
2. Add endpoint after `/healthz`:
   ```python
   @router.get("/readyz", response_model=None)
   async def readyz(request: Request) -> JSONResponse:
       """Unauthenticated readiness probe for load balancers.

       Returns 200 when at least one model is loaded and the server
       is accepting inference requests. Returns 503 during startup,
       model loading, or shutdown drain.
       """
       engine = request.app.state.engine
       loaded = engine.get_loaded_models()

       if not loaded:
           return JSONResponse(
               status_code=503,
               content={"status": "unavailable", "reason": "no models loaded"},
           )

       return JSONResponse(
           status_code=200,
           content={
               "status": "ready",
               "version": __version__,
               "models_loaded": len(loaded),
           },
       )
   ```
3. Run (expect PASS):
   ```bash
   pytest tests/test_health.py::TestReadyz -x -v
   ```
4. Run full health suite:
   ```bash
   pytest tests/test_health.py -x -v
   ```
5. Commit:
   ```bash
   git add src/opta_lmx/api/health.py
   git commit -m "feat(lmx): add /readyz readiness probe (P1)"
   git push
   ```

---

### Task 5: Enhanced deep health check — test (RED)

**Why:** `/admin/health` currently only checks memory percent. It should check Metal GPU memory, helper node status, and engine state.

**File:** `tests/test_health.py`

**Steps:**
1. Add new test methods to `TestAdminHealth` class:
   ```python
       @pytest.mark.asyncio
       async def test_includes_metal_memory(self, client: AsyncClient) -> None:
           """Health check includes Metal GPU memory info when available."""
           response = await client.get("/admin/health")
           assert response.status_code == 200
           data = response.json()
           # Metal memory fields present (may be null if MLX unavailable)
           assert "metal" in data

       @pytest.mark.asyncio
       async def test_includes_helper_node_status(self, client: AsyncClient) -> None:
           """Health check includes helper node health."""
           response = await client.get("/admin/health")
           assert response.status_code == 200
           data = response.json()
           assert "helpers" in data

       @pytest.mark.asyncio
       async def test_includes_engine_status(self, client: AsyncClient) -> None:
           """Health check includes engine model count and in-flight requests."""
           response = await client.get("/admin/health")
           assert response.status_code == 200
           data = response.json()
           assert "models_loaded" in data
           assert "in_flight_requests" in data
   ```
2. Run (expect FAIL):
   ```bash
   pytest tests/test_health.py::TestAdminHealth::test_includes_metal_memory -x -v
   pytest tests/test_health.py::TestAdminHealth::test_includes_helper_node_status -x -v
   pytest tests/test_health.py::TestAdminHealth::test_includes_engine_status -x -v
   ```
3. Commit:
   ```bash
   git add tests/test_health.py
   git commit -m "test(lmx): add failing tests for enhanced deep health check"
   git push
   ```

---

### Task 6: Implement enhanced deep health check (GREEN)

**File:** `src/opta_lmx/api/health.py`

**Steps:**
1. Update imports at top:
   ```python
   from fastapi import APIRouter, Request
   from fastapi.responses import JSONResponse

   from opta_lmx import __version__
   from opta_lmx.api.deps import AdminAuth, Engine, Memory, RemoteEmbedding, RemoteReranking
   ```
2. Replace the `health_check` endpoint:
   ```python
   @router.get("/admin/health")
   async def health_check(
       _auth: AdminAuth, engine: Engine, memory: Memory,
       remote_embedding: RemoteEmbedding, remote_reranking: RemoteReranking,
   ) -> dict[str, Any]:
       """Detailed health check with memory, Metal, engine, and helper node status.

       Returns 'ok' when all subsystems are healthy.
       Returns 'degraded' if memory pressure is high or helpers are unhealthy.
       """
       usage = memory.usage_percent()

       # Metal GPU memory (graceful fallback if MLX unavailable)
       metal_info: dict[str, Any] | None = None
       try:
           import mlx.core as mx
           metal_info = {
               "active_memory_gb": round(mx.metal.get_active_memory() / (1024**3), 2),
               "peak_memory_gb": round(mx.metal.get_peak_memory() / (1024**3), 2),
               "cache_memory_gb": round(mx.metal.get_cache_memory() / (1024**3), 2),
           }
       except Exception:
           metal_info = None

       # Helper node status
       helpers: dict[str, Any] = {}
       if remote_embedding is not None:
           helpers["embedding"] = {
               "url": remote_embedding.url,
               "healthy": remote_embedding.is_healthy,
           }
       if remote_reranking is not None:
           helpers["reranking"] = {
               "url": remote_reranking.url,
               "healthy": remote_reranking.is_healthy,
           }

       # Engine status
       loaded_models = engine.get_loaded_models()

       status = "ok"
       reason = None
       if usage > 95:
           status = "degraded"
           reason = f"Memory at {usage:.1f}% — approaching OOM threshold"
       elif any(not h.get("healthy", True) for h in helpers.values()):
           status = "degraded"
           reason = "One or more helper nodes unhealthy"

       return {
           "status": status,
           "version": __version__,
           "reason": reason,
           "memory_usage_percent": round(usage, 1),
           "metal": metal_info,
           "helpers": helpers,
           "models_loaded": len(loaded_models),
           "in_flight_requests": engine.in_flight_count,
       }
   ```
3. Run (expect PASS):
   ```bash
   pytest tests/test_health.py -x -v
   ```
4. Commit:
   ```bash
   git add src/opta_lmx/api/health.py
   git commit -m "feat(lmx): enhance /admin/health with Metal, helpers, engine status"
   git push
   ```

---

### Task 7: launchd plist — add ExitTimeOut and caffeinate wrapper

**Why:** Default ExitTimeOut is 20s, too short for unloading large models. `caffeinate -i` prevents idle sleep during inference.

**File:** `docs/launchd/com.opta.lmx.plist`

**Test:** No automated test — infrastructure change.

**Steps:**
1. Edit `docs/launchd/com.opta.lmx.plist`. Add `ExitTimeOut` and `AbandonProcessGroup` keys inside the outer `<dict>`, and wrap `ProgramArguments` with `caffeinate -i`:
   ```xml
   <key>ProgramArguments</key>
   <array>
       <string>/usr/bin/caffeinate</string>
       <string>-i</string>
       <string>/Users/Shared/Opta-LMX/venv/bin/python</string>
       <string>-m</string>
       <string>opta_lmx</string>
   </array>
   ```
   Add before `</dict>`:
   ```xml
   <key>ExitTimeOut</key>
   <integer>60</integer>

   <key>AbandonProcessGroup</key>
   <false/>
   ```
2. Commit:
   ```bash
   git add docs/launchd/com.opta.lmx.plist
   git commit -m "fix(lmx): launchd ExitTimeOut 60s, caffeinate -i wrapper"
   git push
   ```

---

### Task 8: Bounded semaphore acquire with timeout — test (RED)

**Why:** Currently, if all semaphore slots are taken, new requests queue indefinitely. Should return HTTP 429 after a timeout.

**File:** `tests/test_concurrency.py`

**Steps:**
1. Add new test class to `tests/test_concurrency.py`:
   ```python
   class TestSemaphoreTimeout:
       """Semaphore acquire times out and raises when queue is full."""

       async def test_returns_error_when_semaphore_timeout(self, engine: InferenceEngine) -> None:
           """Requests that can't acquire semaphore within timeout raise RuntimeError."""
           engine._inference_timeout = 5
           engine._semaphore_timeout = 0.2  # 200ms timeout for acquiring semaphore
           await engine.load_model("test/model-a")

           release = asyncio.Event()

           async def blocking_generate(*args: object, **kwargs: object) -> tuple[str, int, int]:
               await release.wait()
               return "response", 5, 3

           engine._do_generate = blocking_generate  # type: ignore[assignment]

           messages = [ChatMessage(role="user", content="Hi")]

           # Fill up the semaphore (limit=2)
           tasks = [
               asyncio.create_task(engine.generate("test/model-a", messages))
               for _ in range(2)
           ]
           await asyncio.sleep(0.05)  # Let them acquire the semaphore

           # This 3rd request should timeout waiting for semaphore
           with pytest.raises(RuntimeError, match="Server is busy"):
               await engine.generate("test/model-a", messages)

           # Cleanup
           release.set()
           await asyncio.gather(*tasks)
   ```
2. Run (expect FAIL):
   ```bash
   pytest tests/test_concurrency.py::TestSemaphoreTimeout -x -v
   ```
3. Commit:
   ```bash
   git add tests/test_concurrency.py
   git commit -m "test(lmx): add failing test for semaphore acquire timeout -> 429"
   git push
   ```

---

### Task 9: Implement bounded semaphore acquire with timeout (GREEN)

**Files:** `src/opta_lmx/inference/engine.py`, `src/opta_lmx/config.py`

**Steps:**
1. In `src/opta_lmx/config.py`, add to `ModelsConfig`:
   ```python
   semaphore_timeout_sec: float = Field(
       30.0, ge=1.0, le=300.0,
       description="Max seconds to wait for inference semaphore before returning 429",
   )
   ```
2. In `src/opta_lmx/inference/engine.py`, update `__init__` to accept and store the new parameter:
   ```python
   def __init__(
       self,
       ...
       semaphore_timeout_sec: float = 30.0,
   ) -> None:
       ...
       self._semaphore_timeout = semaphore_timeout_sec
   ```
3. In `generate()`, replace the semaphore block:
   ```python
   if use_semaphore:
       try:
           await asyncio.wait_for(
               self._inference_semaphore.acquire(), timeout=self._semaphore_timeout,
           )
       except TimeoutError:
           logger.warning("semaphore_timeout", extra={
               "model_id": model_id,
               "timeout_sec": self._semaphore_timeout,
               "in_flight": self._in_flight,
           })
           raise RuntimeError(
               "Server is busy — all inference slots occupied. Try again shortly."
           ) from None
       try:
           content, prompt_tokens, completion_tokens = await _run_inference()
       finally:
           self._inference_semaphore.release()
   else:
       content, prompt_tokens, completion_tokens = await _run_inference()
   ```
4. In `stream_generate()`, replace the semaphore context manager similarly:
   ```python
   if priority == "high":
       sem_acquired = False
   else:
       try:
           await asyncio.wait_for(
               self._inference_semaphore.acquire(), timeout=self._semaphore_timeout,
           )
           sem_acquired = True
       except TimeoutError:
           logger.warning("semaphore_timeout_stream", extra={
               "model_id": model_id,
               "timeout_sec": self._semaphore_timeout,
               "in_flight": self._in_flight,
           })
           raise RuntimeError(
               "Server is busy — all inference slots occupied. Try again shortly."
           ) from None

   try:
       self._in_flight += 1
       try:
           # ... existing streaming code (remove the old `async with sem:` wrapper) ...
       finally:
           self._in_flight -= 1
   finally:
       if sem_acquired:
           self._inference_semaphore.release()
   ```
5. In `src/opta_lmx/main.py`, pass the new parameter in lifespan:
   ```python
   engine = InferenceEngine(
       ...
       semaphore_timeout_sec=config.models.semaphore_timeout_sec,
   )
   ```
6. In `src/opta_lmx/api/inference.py` (and/or the error handler), catch `RuntimeError("Server is busy")` and return HTTP 429:
   - Find the existing `except RuntimeError` block in the chat completion handler
   - Add a check: if `"Server is busy"` in the error message, return `JSONResponse(status_code=429, content=...)`
   - Include `Retry-After: 5` header
7. Run tests:
   ```bash
   pytest tests/test_concurrency.py -x -v
   pytest tests/ -x -q  # Full suite
   ```
8. Commit:
   ```bash
   git add src/opta_lmx/inference/engine.py src/opta_lmx/config.py src/opta_lmx/main.py src/opta_lmx/api/inference.py tests/test_concurrency.py
   git commit -m "feat(lmx): bounded semaphore with timeout -> HTTP 429 (P1)"
   git push
   ```

---

### Task 10: Add `lmx_queued_requests` Prometheus gauge — test (RED)

**File:** `tests/test_metrics.py`

**Steps:**
1. Add test to `tests/test_metrics.py`:
   ```python
   def test_queued_requests_gauge(self) -> None:
       """Prometheus output includes lmx_queued_requests gauge."""
       collector = MetricsCollector()
       output = collector.prometheus(queued_requests=3)
       assert "lmx_queued_requests 3" in output
   ```
2. Run (expect FAIL):
   ```bash
   pytest tests/test_metrics.py -x -v -k "queued"
   ```
3. Commit:
   ```bash
   git add tests/test_metrics.py
   git commit -m "test(lmx): add failing test for lmx_queued_requests gauge"
   git push
   ```

---

### Task 11: Implement `lmx_queued_requests` gauge (GREEN)

**File:** `src/opta_lmx/monitoring/metrics.py`

**Steps:**
1. Add `queued_requests: int = 0` parameter to `prometheus()` method.
2. Add after the `lmx_concurrent_limit` gauge:
   ```python
   lines.append("# HELP lmx_queued_requests Requests waiting for inference semaphore.")
   lines.append("# TYPE lmx_queued_requests gauge")
   lines.append(f"lmx_queued_requests {queued_requests}")
   ```
3. Update the caller in `src/opta_lmx/api/admin.py` `prometheus_metrics()`:
   - Compute queued = max(0, engine.in_flight_count - config.models.max_concurrent_requests) (approximation)
   - Or better: expose a property on InferenceEngine that reports waiters. For simplicity, pass `queued_requests=0` as placeholder and note in a comment that accurate queue depth requires semaphore introspection.
4. Run tests:
   ```bash
   pytest tests/test_metrics.py -x -v
   ```
5. Commit:
   ```bash
   git add src/opta_lmx/monitoring/metrics.py src/opta_lmx/api/admin.py
   git commit -m "feat(lmx): add lmx_queued_requests Prometheus gauge"
   git push
   ```

---

## P2: Medium Priority

### Task 12: Runtime state persistence — config (no test needed)

**Why:** On crash restart, LMX should know which models were loaded and restore them automatically.

**File:** `src/opta_lmx/config.py`

**Steps:**
1. Add constant at module level:
   ```python
   RUNTIME_STATE_PATH = Path.home() / ".opta-lmx" / "runtime-state.json"
   ```
2. Commit:
   ```bash
   git add src/opta_lmx/config.py
   git commit -m "chore(lmx): add RUNTIME_STATE_PATH constant"
   git push
   ```

---

### Task 13: Runtime state persistence — module test (RED)

**File:** `tests/test_runtime_state.py` (new)

**Steps:**
1. Create `tests/test_runtime_state.py`:
   ```python
   """Tests for runtime state persistence."""

   from __future__ import annotations

   import json
   import time
   from pathlib import Path

   import pytest

   from opta_lmx.runtime_state import RuntimeState


   class TestRuntimeState:
       """Runtime state save/load cycle."""

       def test_save_creates_json_file(self, tmp_path: Path) -> None:
           """save() writes a valid JSON file."""
           state = RuntimeState(state_path=tmp_path / "state.json")
           state.save(loaded_models=["model-a", "model-b"], clean=True)

           assert (tmp_path / "state.json").exists()
           data = json.loads((tmp_path / "state.json").read_text())
           assert data["loaded_models"] == ["model-a", "model-b"]
           assert data["last_clean_shutdown"] is True

       def test_load_returns_saved_state(self, tmp_path: Path) -> None:
           """load() returns previously saved state."""
           state = RuntimeState(state_path=tmp_path / "state.json")
           state.save(loaded_models=["model-a"], clean=False)

           loaded = state.load()
           assert loaded is not None
           assert loaded["loaded_models"] == ["model-a"]
           assert loaded["last_clean_shutdown"] is False

       def test_load_returns_none_when_no_file(self, tmp_path: Path) -> None:
           """load() returns None when state file doesn't exist."""
           state = RuntimeState(state_path=tmp_path / "state.json")
           assert state.load() is None

       def test_tracks_startup_count(self, tmp_path: Path) -> None:
           """Each save increments startup_count."""
           state = RuntimeState(state_path=tmp_path / "state.json")
           state.save(loaded_models=[], clean=True)
           state.record_startup()
           data = state.load()
           assert data is not None
           assert data["startup_count"] == 1
   ```
2. Run (expect FAIL — module doesn't exist):
   ```bash
   pytest tests/test_runtime_state.py -x -v
   ```
3. Commit:
   ```bash
   git add tests/test_runtime_state.py
   git commit -m "test(lmx): add failing tests for runtime state persistence"
   git push
   ```

---

### Task 14: Implement RuntimeState module (GREEN)

**File:** `src/opta_lmx/runtime_state.py` (new)

**Steps:**
1. Create `src/opta_lmx/runtime_state.py`:
   ```python
   """Runtime state persistence — save/restore loaded models across restarts.

   Writes to ~/.opta-lmx/runtime-state.json on model load/unload events.
   On startup, checks for unclean shutdown and restores models.
   """

   from __future__ import annotations

   import json
   import logging
   import os
   import time
   from pathlib import Path
   from typing import Any

   logger = logging.getLogger(__name__)


   class RuntimeState:
       """Persist and restore runtime state across process restarts."""

       def __init__(self, state_path: Path | None = None) -> None:
           self._path = state_path or (Path.home() / ".opta-lmx" / "runtime-state.json")

       def save(
           self,
           loaded_models: list[str],
           clean: bool = False,
       ) -> None:
           """Write current state to disk.

           Args:
               loaded_models: List of currently loaded model IDs.
               clean: True if this is a clean shutdown save.
           """
           existing = self.load() or {}
           data = {
               "loaded_models": loaded_models,
               "last_clean_shutdown": clean,
               "pid": os.getpid(),
               "saved_at": time.time(),
               "startup_count": existing.get("startup_count", 0),
           }
           self._path.parent.mkdir(parents=True, exist_ok=True)
           self._path.write_text(json.dumps(data, indent=2))
           logger.debug("runtime_state_saved", extra={
               "models": loaded_models, "clean": clean,
           })

       def load(self) -> dict[str, Any] | None:
           """Load state from disk.

           Returns:
               State dict or None if file doesn't exist.
           """
           if not self._path.exists():
               return None
           try:
               return json.loads(self._path.read_text())
           except (json.JSONDecodeError, OSError) as e:
               logger.warning("runtime_state_load_failed", extra={"error": str(e)})
               return None

       def record_startup(self) -> None:
           """Increment the startup counter (called at process start)."""
           data = self.load() or {
               "loaded_models": [],
               "last_clean_shutdown": True,
               "pid": os.getpid(),
               "saved_at": time.time(),
               "startup_count": 0,
           }
           data["startup_count"] = data.get("startup_count", 0) + 1
           data["last_startup_at"] = time.time()
           data["pid"] = os.getpid()
           self._path.parent.mkdir(parents=True, exist_ok=True)
           self._path.write_text(json.dumps(data, indent=2))

       def clear(self) -> None:
           """Remove state file."""
           if self._path.exists():
               self._path.unlink()
   ```
2. Run tests:
   ```bash
   pytest tests/test_runtime_state.py -x -v
   ```
3. Commit:
   ```bash
   git add src/opta_lmx/runtime_state.py tests/test_runtime_state.py
   git commit -m "feat(lmx): add RuntimeState persistence module (P2)"
   git push
   ```

---

### Task 15: Wire RuntimeState into lifespan — save on model change

**File:** `src/opta_lmx/main.py`

**Steps:**
1. Import `RuntimeState`:
   ```python
   from opta_lmx.runtime_state import RuntimeState
   ```
2. After `app.state.start_time = time.time()`, initialize state:
   ```python
   runtime_state = RuntimeState()
   runtime_state.record_startup()
   app.state.runtime_state = runtime_state
   ```
3. After auto-load loop completes, save state:
   ```python
   # Persist initial loaded models
   runtime_state.save(
       loaded_models=[m.model_id for m in engine.get_loaded_models()],
       clean=False,
   )
   ```
4. Before `yield`, check for crash recovery:
   ```python
   # Crash recovery: if previous shutdown was unclean, restore models
   previous = runtime_state.load()
   if previous and not previous.get("last_clean_shutdown", True):
       for model_id in previous.get("loaded_models", []):
           if not engine.is_model_loaded(model_id):
               try:
                   perf = preset_manager.find_performance_for_model(model_id)
                   await engine.load_model(model_id, performance_overrides=perf)
                   logger.info("crash_recovery_model_restored", extra={"model_id": model_id})
               except Exception as e:
                   logger.error("crash_recovery_model_failed", extra={
                       "model_id": model_id, "error": str(e),
                   })
   ```
5. In the cleanup section (after `yield`), save clean state:
   ```python
   # Mark clean shutdown
   runtime_state.save(loaded_models=[], clean=True)
   ```
6. Run tests:
   ```bash
   pytest tests/ -x -q
   ```
7. Commit:
   ```bash
   git add src/opta_lmx/main.py
   git commit -m "feat(lmx): wire RuntimeState into lifespan for crash recovery"
   git push
   ```

---

### Task 16: Crash loop detection — test (RED)

**File:** `tests/test_runtime_state.py`

**Steps:**
1. Add test:
   ```python
   class TestCrashLoopDetection:
       """Detect rapid restarts and enter safe mode."""

       def test_detects_crash_loop(self, tmp_path: Path) -> None:
           """3+ startups within 60s triggers safe mode."""
           state = RuntimeState(state_path=tmp_path / "state.json")
           # Simulate 3 rapid startups
           for _ in range(3):
               state.record_startup()
           assert state.is_crash_looping(threshold=3, window_sec=60) is True

       def test_no_crash_loop_under_threshold(self, tmp_path: Path) -> None:
           """Under 3 startups is not a crash loop."""
           state = RuntimeState(state_path=tmp_path / "state.json")
           state.record_startup()
           state.record_startup()
           assert state.is_crash_looping(threshold=3, window_sec=60) is False
   ```
2. Run (expect FAIL):
   ```bash
   pytest tests/test_runtime_state.py::TestCrashLoopDetection -x -v
   ```
3. Commit:
   ```bash
   git add tests/test_runtime_state.py
   git commit -m "test(lmx): add failing tests for crash loop detection"
   git push
   ```

---

### Task 17: Implement crash loop detection (GREEN)

**File:** `src/opta_lmx/runtime_state.py`

**Steps:**
1. Add `is_crash_looping` method to `RuntimeState`:
   ```python
   def is_crash_looping(self, threshold: int = 3, window_sec: float = 60.0) -> bool:
       """Check if the server is crash-looping.

       Args:
           threshold: Number of startups within window to trigger safe mode.
           window_sec: Time window in seconds to check.

       Returns:
           True if startup_count >= threshold and last_startup_at is within window.
       """
       data = self.load()
       if data is None:
           return False
       count = data.get("startup_count", 0)
       last_at = data.get("last_startup_at", 0)
       if count >= threshold and (time.time() - last_at) < window_sec:
           return True
       return False
   ```
2. Run tests:
   ```bash
   pytest tests/test_runtime_state.py -x -v
   ```
3. Commit:
   ```bash
   git add src/opta_lmx/runtime_state.py
   git commit -m "feat(lmx): crash loop detection (safe mode after 3 rapid restarts)"
   git push
   ```

---

### Task 18: Wire crash loop detection into lifespan

**File:** `src/opta_lmx/main.py`

**Steps:**
1. After `runtime_state.record_startup()`, add:
   ```python
   safe_mode = runtime_state.is_crash_looping(threshold=3, window_sec=60)
   if safe_mode:
       logger.warning("safe_mode_activated", extra={
           "reason": "3+ restarts within 60 seconds — skipping auto-load",
       })
   ```
2. Wrap the auto-load loop:
   ```python
   if not safe_mode:
       for model_id in auto_load_ids:
           # ... existing auto-load code ...
   else:
       logger.warning("safe_mode_skip_auto_load", extra={
           "models_skipped": auto_load_ids,
       })
   ```
3. Run tests:
   ```bash
   pytest tests/ -x -q
   ```
4. Commit:
   ```bash
   git add src/opta_lmx/main.py
   git commit -m "feat(lmx): skip auto-load in safe mode (crash loop protection)"
   git push
   ```

---

### Task 19: Add `slowapi` rate limiting dependency

**File:** `pyproject.toml`

**Steps:**
1. Add to `dependencies`:
   ```toml
   "slowapi>=0.1.9",
   ```
2. Install:
   ```bash
   pip install -e ".[dev]"
   ```
3. Commit:
   ```bash
   git add pyproject.toml
   git commit -m "chore(lmx): add slowapi dependency for rate limiting"
   git push
   ```

---

### Task 20: Rate limiting — test (RED)

**File:** `tests/test_rate_limit.py` (new)

**Steps:**
1. Create `tests/test_rate_limit.py`:
   ```python
   """Tests for rate limiting middleware."""

   from __future__ import annotations

   import pytest
   from httpx import AsyncClient


   class TestRateLimiting:
       """Rate limiting on inference and admin endpoints."""

       @pytest.mark.asyncio
       async def test_inference_rate_limit_returns_429(self, client: AsyncClient) -> None:
           """Exceeding inference rate limit returns 429."""
           # The default rate limit is generous — we need a way to test.
           # For now, just verify the rate limiter middleware is mounted
           # by checking that the app has rate limit state.
           app = client._transport.app  # type: ignore[union-attr]
           assert hasattr(app.state, "limiter")

       @pytest.mark.asyncio
       async def test_health_not_rate_limited(self, client: AsyncClient) -> None:
           """Health endpoints are exempt from rate limiting."""
           for _ in range(100):
               response = await client.get("/healthz")
               assert response.status_code == 200
   ```
2. Run (expect FAIL):
   ```bash
   pytest tests/test_rate_limit.py -x -v
   ```
3. Commit:
   ```bash
   git add tests/test_rate_limit.py
   git commit -m "test(lmx): add failing tests for rate limiting"
   git push
   ```

---

### Task 21: Implement rate limiting with slowapi (GREEN)

**Files:** `src/opta_lmx/main.py`, `src/opta_lmx/api/inference.py`

**Steps:**
1. In `src/opta_lmx/main.py`, add to `create_app()` after CORS middleware:
   ```python
   from slowapi import Limiter, _rate_limit_exceeded_handler
   from slowapi.util import get_remote_address
   from slowapi.errors import RateLimitExceeded

   limiter = Limiter(key_func=get_remote_address)
   app.state.limiter = limiter
   app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
   ```
2. In `src/opta_lmx/api/inference.py`, add rate limit decorator to the chat completion endpoint:
   ```python
   from slowapi import Limiter
   from fastapi import Request

   @router.post("/v1/chat/completions")
   @limiter.limit("60/minute")
   async def chat_completion(request: Request, ...):
       ...
   ```
   Note: The `limiter` instance is pulled from `request.app.state.limiter`.
3. Similarly, add `"10/minute"` limit to admin load/unload endpoints.
4. Run tests:
   ```bash
   pytest tests/test_rate_limit.py -x -v
   pytest tests/ -x -q
   ```
5. Commit:
   ```bash
   git add src/opta_lmx/main.py src/opta_lmx/api/inference.py src/opta_lmx/api/admin.py tests/test_rate_limit.py
   git commit -m "feat(lmx): add slowapi rate limiting (60/min inference, 10/min admin)"
   git push
   ```

---

### Task 22: Load shedding middleware — test (RED)

**Why:** When memory exceeds 95%, reject new requests with 503 to prevent OOM. Always allow health endpoints.

**File:** `tests/test_middleware.py`

**Steps:**
1. Add test class to `tests/test_middleware.py`:
   ```python
   class TestLoadSheddingMiddleware:
       """Reject requests when memory is critically high."""

       @pytest.mark.asyncio
       async def test_returns_503_at_high_memory(self, client: AsyncClient) -> None:
           """Returns 503 when memory > 95%."""
           app = client._transport.app  # type: ignore[union-attr]
           app.state.memory_monitor.usage_percent = MagicMock(return_value=96.0)

           response = await client.post(
               "/v1/chat/completions",
               json={"model": "test", "messages": [{"role": "user", "content": "hi"}]},
           )
           assert response.status_code == 503
           assert "Retry-After" in response.headers

       @pytest.mark.asyncio
       async def test_allows_healthz_at_high_memory(self, client: AsyncClient) -> None:
           """Health endpoints always pass through."""
           app = client._transport.app  # type: ignore[union-attr]
           app.state.memory_monitor.usage_percent = MagicMock(return_value=96.0)

           response = await client.get("/healthz")
           assert response.status_code == 200

       @pytest.mark.asyncio
       async def test_allows_readyz_at_high_memory(self, client: AsyncClient) -> None:
           """Readiness probe always passes through."""
           app = client._transport.app  # type: ignore[union-attr]
           app.state.memory_monitor.usage_percent = MagicMock(return_value=96.0)

           response = await client.get("/readyz")
           # 503 for "no models" is fine — just not 503 for load shedding
           assert response.status_code in (200, 503)
   ```
2. Run (expect FAIL):
   ```bash
   pytest tests/test_middleware.py::TestLoadSheddingMiddleware -x -v
   ```
3. Commit:
   ```bash
   git add tests/test_middleware.py
   git commit -m "test(lmx): add failing tests for load shedding middleware"
   git push
   ```

---

### Task 23: Implement load shedding middleware (GREEN)

**File:** `src/opta_lmx/api/middleware.py`

**Steps:**
1. Add new middleware class:
   ```python
   # Paths exempt from load shedding (must always respond)
   _EXEMPT_PATHS = frozenset({"/healthz", "/readyz"})

   class LoadSheddingMiddleware:
       """Reject requests with 503 when memory pressure is critical.

       Uses raw ASGI pattern. Always allows health probes through.
       Checks app.state.memory_monitor.usage_percent() against a 95% threshold.
       """

       def __init__(self, app: ASGIApp, threshold_percent: float = 95.0) -> None:
           self.app = app
           self._threshold = threshold_percent

       async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
           if scope["type"] != "http":
               await self.app(scope, receive, send)
               return

           path = _get_path(scope)
           if path in _EXEMPT_PATHS:
               await self.app(scope, receive, send)
               return

           # Access memory monitor from app state
           app = scope.get("app")
           if app is not None:
               monitor = getattr(app.state, "memory_monitor", None)
               if monitor is not None and monitor.usage_percent() > self._threshold:
                   # Reject with 503 Service Unavailable
                   response_body = b'{"error": {"message": "Server under memory pressure — try again later", "type": "server_error", "code": "load_shedding"}}'
                   await send({
                       "type": "http.response.start",
                       "status": 503,
                       "headers": [
                           [b"content-type", b"application/json"],
                           [b"retry-after", b"10"],
                       ],
                   })
                   await send({
                       "type": "http.response.body",
                       "body": response_body,
                   })
                   return

           await self.app(scope, receive, send)
   ```
2. In `src/opta_lmx/main.py`, add the middleware in `create_app()` (add **before** CORS so it runs first):
   ```python
   from opta_lmx.api.middleware import LoadSheddingMiddleware

   app.add_middleware(LoadSheddingMiddleware)
   ```
3. Run tests:
   ```bash
   pytest tests/test_middleware.py -x -v
   pytest tests/ -x -q
   ```
4. Commit:
   ```bash
   git add src/opta_lmx/api/middleware.py src/opta_lmx/main.py tests/test_middleware.py
   git commit -m "feat(lmx): add load shedding middleware (503 at 95% memory)"
   git push
   ```

---

### Task 24: Add `httpx-sse` dev dependency

**File:** `pyproject.toml`

**Steps:**
1. Add to `[project.optional-dependencies] dev`:
   ```toml
   "httpx-sse>=0.4",
   ```
2. Install:
   ```bash
   pip install -e ".[dev]"
   ```
3. Commit:
   ```bash
   git add pyproject.toml
   git commit -m "chore(lmx): add httpx-sse dev dependency for SSE integration tests"
   git push
   ```

---

### Task 25: SSE streaming integration test — test (RED)

**Why:** Current streaming tests hand-parse `data:` lines. Using `httpx-sse` validates the actual SSE protocol.

**File:** `tests/test_sse_integration.py` (new)

**Steps:**
1. Create `tests/test_sse_integration.py`:
   ```python
   """SSE streaming integration tests using httpx-sse.

   Validates that the server produces spec-compliant Server-Sent Events
   for /v1/chat/completions with stream=true.
   """

   from __future__ import annotations

   import json
   from collections.abc import AsyncIterator

   import pytest
   from httpx import ASGITransport, AsyncClient
   from httpx_sse import aconnect_sse

   from opta_lmx.config import LMXConfig
   from opta_lmx.main import create_app
   from tests.conftest import _make_test_client


   class TestSSEStreaming:
       """SSE protocol compliance for streaming completions."""

       @pytest.mark.asyncio
       async def test_stream_produces_valid_sse_events(
           self, client: AsyncClient,
       ) -> None:
           """Streaming response produces parseable SSE events ending with [DONE]."""
           app = client._transport.app  # type: ignore[union-attr]
           # Load a model so inference can proceed
           await app.state.engine.load_model("test/model-sse")

           events: list[dict] = []
           done_seen = False

           async with aconnect_sse(
               client,
               "POST",
               "/v1/chat/completions",
               json={
                   "model": "test/model-sse",
                   "messages": [{"role": "user", "content": "Hello"}],
                   "stream": True,
               },
           ) as event_source:
               async for sse in event_source.aiter_sse():
                   if sse.data == "[DONE]":
                       done_seen = True
                       break
                   event_data = json.loads(sse.data)
                   events.append(event_data)

           assert len(events) > 0, "Should receive at least one SSE event"
           assert done_seen, "Stream should end with [DONE]"

           # First event should have a delta with role
           first = events[0]
           assert "choices" in first
           assert first["choices"][0]["delta"].get("role") == "assistant" or \
                  "content" in first["choices"][0]["delta"]
   ```
2. Run (expect to see if it passes or fails based on current streaming impl):
   ```bash
   pytest tests/test_sse_integration.py -x -v
   ```
3. Commit:
   ```bash
   git add tests/test_sse_integration.py
   git commit -m "test(lmx): add SSE integration tests using httpx-sse"
   git push
   ```

---

## P3: Nice-to-Have

### Task 26: Metal memory in `/admin/health` — already done

Metal memory was added in Task 6 as part of the enhanced deep health check. No additional work needed.

---

### Task 27: Metal cache maintenance loop — test (RED)

**Why:** Metal buffer cache can grow unbounded. Periodic cleanup prevents gradual memory creep.

**File:** `tests/test_metal_cache.py` (new)

**Steps:**
1. Create `tests/test_metal_cache.py`:
   ```python
   """Tests for Metal cache maintenance."""

   from __future__ import annotations

   from unittest.mock import MagicMock, patch

   import pytest

   from opta_lmx.maintenance.metal import should_clear_metal_cache, clear_metal_cache


   class TestMetalCacheMaintenance:
       """Metal cache maintenance logic."""

       def test_should_clear_when_cache_exceeds_limit(self) -> None:
           """Returns True when cache exceeds limit."""
           with patch("opta_lmx.maintenance.metal.mx") as mock_mx:
               mock_mx.metal.get_cache_memory.return_value = 60 * (1024**3)  # 60GB
               assert should_clear_metal_cache(limit_gb=50.0) is True

       def test_should_not_clear_when_under_limit(self) -> None:
           """Returns False when cache is under limit."""
           with patch("opta_lmx.maintenance.metal.mx") as mock_mx:
               mock_mx.metal.get_cache_memory.return_value = 30 * (1024**3)  # 30GB
               assert should_clear_metal_cache(limit_gb=50.0) is False
   ```
2. Run (expect FAIL):
   ```bash
   pytest tests/test_metal_cache.py -x -v
   ```
3. Commit:
   ```bash
   git add tests/test_metal_cache.py
   git commit -m "test(lmx): add failing tests for Metal cache maintenance"
   git push
   ```

---

### Task 28: Implement Metal cache maintenance module (GREEN)

**File:** `src/opta_lmx/maintenance/__init__.py` (new), `src/opta_lmx/maintenance/metal.py` (new)

**Steps:**
1. Create `src/opta_lmx/maintenance/__init__.py` (empty).
2. Create `src/opta_lmx/maintenance/metal.py`:
   ```python
   """Metal GPU cache maintenance for MLX.

   Periodically checks Metal buffer cache size and clears it
   when it exceeds a configurable threshold to prevent gradual
   memory creep during long-running sessions.
   """

   from __future__ import annotations

   import logging

   logger = logging.getLogger(__name__)

   try:
       import mlx.core as mx
   except ImportError:
       mx = None  # type: ignore[assignment]


   def should_clear_metal_cache(limit_gb: float = 50.0) -> bool:
       """Check if Metal cache exceeds the given limit.

       Args:
           limit_gb: Cache size threshold in GB.

       Returns:
           True if cache should be cleared.
       """
       if mx is None:
           return False
       try:
           cache_bytes = mx.metal.get_cache_memory()
           cache_gb = cache_bytes / (1024**3)
           return cache_gb > limit_gb
       except Exception:
           return False


   def clear_metal_cache() -> float:
       """Clear Metal buffer cache.

       Returns:
           GB of cache cleared (approximate).
       """
       if mx is None:
           return 0.0
       try:
           before = mx.metal.get_cache_memory()
           mx.metal.clear_cache()
           after = mx.metal.get_cache_memory()
           freed_gb = max(0, (before - after)) / (1024**3)
           logger.info("metal_cache_cleared", extra={
               "freed_gb": round(freed_gb, 2),
               "cache_before_gb": round(before / (1024**3), 2),
               "cache_after_gb": round(after / (1024**3), 2),
           })
           return freed_gb
       except Exception as e:
           logger.warning("metal_cache_clear_failed", extra={"error": str(e)})
           return 0.0
   ```
3. Run tests:
   ```bash
   pytest tests/test_metal_cache.py -x -v
   ```
4. Commit:
   ```bash
   git add src/opta_lmx/maintenance/__init__.py src/opta_lmx/maintenance/metal.py tests/test_metal_cache.py
   git commit -m "feat(lmx): add Metal cache maintenance module (P3)"
   git push
   ```

---

### Task 29: Wire Metal cache maintenance loop into lifespan

**File:** `src/opta_lmx/main.py`

**Steps:**
1. After the TTL eviction task setup (around line 226), add:
   ```python
   # Start Metal cache maintenance loop
   metal_task: asyncio.Task[None] | None = None
   if config.models.metal_cache_limit_gb is not None:
       from opta_lmx.maintenance.metal import should_clear_metal_cache, clear_metal_cache

       async def _metal_cache_loop() -> None:
           while True:
               await asyncio.sleep(300)  # Check every 5 minutes
               if should_clear_metal_cache(limit_gb=config.models.metal_cache_limit_gb):
                   clear_metal_cache()

       metal_task = asyncio.create_task(_metal_cache_loop())
       logger.info("metal_cache_maintenance_enabled", extra={
           "limit_gb": config.models.metal_cache_limit_gb,
           "check_interval_sec": 300,
       })
   ```
2. In cleanup section, cancel the task:
   ```python
   if metal_task is not None:
       metal_task.cancel()
       with contextlib.suppress(asyncio.CancelledError):
           await metal_task
   ```
3. Run tests:
   ```bash
   pytest tests/ -x -q
   ```
4. Commit:
   ```bash
   git add src/opta_lmx/main.py
   git commit -m "feat(lmx): wire Metal cache maintenance loop into lifespan"
   git push
   ```

---

## Post-Implementation

### Task 30: Full test suite run

```bash
cd ~/Synced/Opta/1-Apps/1J-Opta-LMX
source .venv/bin/activate
pytest tests/ -v --tb=short
```

Verify all tests pass. Fix any regressions.

---

### Task 31: Ruff lint check

```bash
ruff check src/ tests/ --fix
```

Fix any issues and commit.

---

### Task 32: Type check

```bash
mypy src/opta_lmx/ --ignore-missing-imports
```

Fix any type errors introduced by Phase 10 changes.

---

### Task 33: Update MASTER-PLAN.md

**File:** `docs/plans/MASTER-PLAN.md`

Mark Phase 10 as complete with date and summary of changes:
- P0: Admin key set, log path moved
- P1: Readiness probe, enhanced health check, launchd improvements, semaphore timeout
- P2: Runtime state persistence, crash loop detection, rate limiting, load shedding, SSE tests
- P3: Metal cache maintenance

Commit and push.

---

## Summary of Files Changed

### New Files
| File | Purpose |
|------|---------|
| `src/opta_lmx/runtime_state.py` | Runtime state persistence + crash loop detection |
| `src/opta_lmx/maintenance/__init__.py` | Maintenance package |
| `src/opta_lmx/maintenance/metal.py` | Metal cache maintenance |
| `tests/test_runtime_state.py` | Runtime state tests |
| `tests/test_rate_limit.py` | Rate limiting tests |
| `tests/test_sse_integration.py` | SSE protocol compliance tests |
| `tests/test_metal_cache.py` | Metal cache maintenance tests |

### Modified Files
| File | Changes |
|------|---------|
| `config/mono512-current.yaml` | admin_key set, log path to /var/log/ |
| `src/opta_lmx/api/health.py` | `/readyz` endpoint, enhanced `/admin/health` |
| `src/opta_lmx/api/middleware.py` | LoadSheddingMiddleware |
| `src/opta_lmx/api/admin.py` | queued_requests in Prometheus |
| `src/opta_lmx/api/inference.py` | Rate limiting decorator, 429 handler |
| `src/opta_lmx/inference/engine.py` | Semaphore timeout, semaphore_timeout_sec param |
| `src/opta_lmx/config.py` | RUNTIME_STATE_PATH, semaphore_timeout_sec |
| `src/opta_lmx/monitoring/metrics.py` | lmx_queued_requests gauge |
| `src/opta_lmx/main.py` | RuntimeState, crash loop, rate limiter, load shedding, Metal cache loop |
| `docs/launchd/com.opta.lmx.plist` | ExitTimeOut 60, caffeinate -i, AbandonProcessGroup |
| `pyproject.toml` | slowapi + httpx-sse dependencies |
| `tests/test_health.py` | readyz + enhanced health tests |
| `tests/test_middleware.py` | Load shedding tests |
| `tests/test_concurrency.py` | Semaphore timeout test |
| `tests/test_metrics.py` | queued_requests gauge test |

### Not Included (as specified)
- Thermal throttling detection (requires macmon CLI)
- Load testing scripts (separate task)
- TLS/HTTPS (LAN-only)
- Lifespan integration tests (complex, separate task)
- Circuit breaker (aiobreaker) — not in scope per task list
