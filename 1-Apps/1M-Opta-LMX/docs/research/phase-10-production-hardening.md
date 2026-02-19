# Phase 10: Production Hardening — Research Notes

**Date:** 2026-02-19
**Author:** Claude Opus 4.6 (research agent)
**Scope:** Integration testing, load testing, crash recovery, logging, health checks, graceful degradation, macOS concerns, security hardening
**Target system:** Opta-LMX on Mac Studio M3 Ultra 512GB (Mono512), FastAPI + Uvicorn, launchd daemon

---

## Table of Contents

1. [Integration Testing for FastAPI Inference Servers](#1-integration-testing)
2. [Load Testing Python Inference Servers](#2-load-testing)
3. [Crash Recovery for Python Daemons on macOS](#3-crash-recovery)
4. [Log Management for Production Python Services](#4-log-management)
5. [Health Check Patterns for ML Inference Servers](#5-health-checks)
6. [Graceful Degradation Under Load](#6-graceful-degradation)
7. [macOS-Specific Production Concerns](#7-macos-specific)
8. [Security Hardening](#8-security-hardening)
9. [Don't-Hand-Roll List](#9-dont-hand-roll)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Recommended Architecture Summary](#11-architecture-summary)
12. [Gap Analysis: What Opta-LMX Already Has vs Needs](#12-gap-analysis)

---

## 1. Integration Testing for FastAPI Inference Servers {#1-integration-testing}

**Confidence:** HIGH (well-established ecosystem, tested patterns in codebase already)

### Current State in Opta-LMX

The codebase already has a solid async testing foundation:
- `pytest-asyncio` with `asyncio_mode = "auto"` in `pyproject.toml`
- `httpx.AsyncClient` + `ASGITransport` fixtures in `tests/conftest.py`
- 35 test files, 542 test cases
- Mock engine pattern avoids requiring MLX hardware in CI

### What to Add for Phase 10

#### A. SSE Streaming Response Testing

Current `test_streaming.py` tests the `format_sse_stream()` utility function directly (unit-level). Phase 10 should add integration tests that hit the actual `/v1/chat/completions?stream=true` endpoint through `httpx.AsyncClient` and verify the full SSE contract.

**Recommended approach:** Use `httpx-sse` library with `aconnect_sse()`:

```python
# tests/test_integration_sse.py
import pytest
from httpx import ASGITransport, AsyncClient
from httpx_sse import aconnect_sse

@pytest.mark.asyncio
async def test_sse_stream_full_contract(client_with_model):
    """Verify SSE stream through the full FastAPI stack."""
    payload = {
        "model": "test-model",
        "messages": [{"role": "user", "content": "Hello"}],
        "stream": True,
    }
    async with aconnect_sse(
        client_with_model, "POST",
        "http://test/v1/chat/completions",
        json=payload,
    ) as event_source:
        events = []
        async for sse in event_source.aiter_sse():
            events.append(sse)

        # First event: role chunk
        first = json.loads(events[0].data)
        assert first["choices"][0]["delta"]["role"] == "assistant"

        # Last data event before [DONE]: finish_reason = "stop"
        last_data = json.loads(events[-2].data)
        assert last_data["choices"][0]["finish_reason"] == "stop"

        # Final sentinel
        assert events[-1].data == "[DONE]"
```

**Key library:** `httpx-sse` (PyPI) provides `aconnect_sse()` and `aiter_sse()` for clean SSE testing. Authored by Florimondmanca, the same developer who maintains `httpx` middleware.

**Important caveat:** `httpx.ASGITransport` does NOT truly stream responses in the way a real TCP connection would. It buffers the full response before returning. For true streaming verification, use a real server in a background thread or process. For contract verification (correct JSON shapes, correct event sequence), ASGITransport is sufficient.

#### B. Mocking MLX Model Loading

Current mock pattern in `conftest.py` replaces `_create_engine` with a `MagicMock`. This is correct for unit tests. For integration tests that need to verify the full load -> generate -> unload cycle:

```python
@pytest.fixture
async def loaded_mock_engine(mock_engine):
    """Engine with a model pre-loaded via the mock pathway."""
    await mock_engine.load_model("test-org/test-model-4bit")
    yield mock_engine
    # Cleanup handled by test teardown
```

#### C. Lifespan Event Testing

The current `conftest.py` creates the app via `create_app()` but manually injects state, bypassing the lifespan context manager. For integration tests that need to verify startup/shutdown behavior:

```python
from asgi_lifespan import LifespanManager

@pytest.fixture
async def full_app_client():
    """Client that triggers FastAPI lifespan events."""
    app = create_app(test_config)
    async with LifespanManager(app) as manager:
        async with AsyncClient(
            transport=ASGITransport(app=manager.app),
            base_url="http://test",
        ) as client:
            yield client
```

**Library:** `asgi-lifespan` by Florimondmanca. Required because `httpx.AsyncClient` does NOT trigger lifespan events on its own.

#### D. pyproject.toml Additions

```toml
[project.optional-dependencies]
dev = [
    # ... existing ...
    "httpx-sse>=0.4",         # SSE testing
    "asgi-lifespan>=2.1",     # Lifespan event testing
]
```

### Sources

- [FastAPI Async Tests Documentation](https://fastapi.tiangolo.com/advanced/async-tests/)
- [httpx-sse (PyPI)](https://pypi.org/project/httpx-sse/)
- [httpx Discussion #2629: AsyncClient and StreamingResponse](https://github.com/encode/httpx/discussions/2629)
- [FastAPI Discussion #9126: Testing streaming async responses](https://github.com/fastapi/fastapi/discussions/9126)
- [asgi-lifespan (GitHub)](https://github.com/florimondmanca/asgi-lifespan)

---

## 2. Load Testing Python Inference Servers {#2-load-testing}

**Confidence:** HIGH (mature tooling, LLM-specific tools emerging)

### Tool Comparison for Opta-LMX

| Tool | Language | LLM-Aware | Streaming SSE | Best For |
|------|----------|-----------|---------------|----------|
| **LLM Locust** | Python | YES | YES (built-in) | Token-level LLM benchmarks |
| **Locust** | Python | No | Manual | General HTTP load testing |
| **k6** | JS/Go | Via plugins | Yes | CI pipelines, high-concurrency |
| **wrk2** | C | No | No | Raw HTTP throughput |
| **hey** | Go | No | No | Quick smoke tests |
| **Periscope** | k6+Grafana | YES | YES | OpenAI-endpoint load testing |

### Recommended: LLM Locust (Primary) + hey (Smoke)

**LLM Locust** is the clear winner for Opta-LMX because:
1. Python-native (matches LMX stack)
2. Measures LLM-specific metrics: TTFT, tokens/s, inter-token latency
3. Handles SSE streaming correctly (parses chunks, tokenizes responses)
4. Sends results to a FastAPI metrics backend for real-time dashboards
5. Written by TrueFoundry, actively maintained

**Key gotcha:** Locust uses greenlets under Python's GIL. Tokenization is CPU-bound and can block the event loop, skewing results. LLM Locust addresses this by offloading tokenization to a separate metrics daemon.

### LLM-Specific Metrics to Measure

These are the industry-standard metrics for inference servers (per NVIDIA, BentoML, Anyscale):

| Metric | Definition | Target for LMX |
|--------|-----------|-----------------|
| **TTFT** (Time to First Token) | Delay from request send to first SSE chunk received | < 500ms (4-bit) |
| **Output tok/s** | Tokens generated per second per request | > 30 tok/s (4-bit on M3 Ultra) |
| **Inter-Token Latency** | Time between consecutive SSE chunks | < 50ms |
| **RPS** (Requests Per Second) | Concurrent requests handled | 4 (semaphore limit) |
| **p50/p95/p99 latency** | Latency distribution | p95 < 2x p50 |
| **Throughput** (aggregate tok/s) | Total tokens across all concurrent requests | Scales with concurrency |

### Example Locust Test for LMX

```python
# loadtest/locustfile.py
from locust import HttpUser, task, between

class LMXUser(HttpUser):
    wait_time = between(1, 5)
    host = "http://192.168.188.11:1234"

    @task(3)
    def chat_streaming(self):
        """Streaming chat completion -- most common workload."""
        with self.client.post(
            "/v1/chat/completions",
            json={
                "model": "mlx-community/MiniMax-M2.5-4bit",
                "messages": [{"role": "user", "content": "Explain quantum computing in 3 sentences."}],
                "stream": True,
                "max_tokens": 256,
            },
            stream=True,
            catch_response=True,
            name="/v1/chat/completions (stream)",
        ) as response:
            tokens = 0
            for line in response.iter_lines():
                if line.startswith(b"data: ") and line != b"data: [DONE]":
                    tokens += 1
            if tokens == 0:
                response.failure("No tokens received")

    @task(1)
    def chat_non_streaming(self):
        """Non-streaming chat -- batch workload."""
        self.client.post(
            "/v1/chat/completions",
            json={
                "model": "mlx-community/MiniMax-M2.5-4bit",
                "messages": [{"role": "user", "content": "What is 2+2?"}],
                "stream": False,
                "max_tokens": 32,
            },
            name="/v1/chat/completions (non-stream)",
        )
```

### Quick Smoke Test with hey

```bash
# Non-streaming smoke test (10 requests, 2 concurrent)
hey -n 10 -c 2 -m POST \
    -H "Content-Type: application/json" \
    -d '{"model":"mlx-community/MiniMax-M2.5-4bit","messages":[{"role":"user","content":"Hi"}],"max_tokens":16}' \
    http://192.168.188.11:1234/v1/chat/completions
```

### Sources

- [LLM Locust: Benchmarking LLM Performance at Scale](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [Periscope: K6 + Grafana for OpenAI-like endpoints](https://github.com/wizenheimer/periscope)
- [BentoML LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics)
- [NVIDIA LLM Benchmarking Fundamental Concepts](https://developer.nvidia.com/blog/llm-benchmarking-fundamental-concepts/)
- [Anyscale LLM Latency/Throughput Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics)
- [SageMaker Load Testing with Locust](https://garystafford.medium.com/finding-your-llms-breaking-point-load-testing-sagemaker-real-time-inference-endpoints-with-locust-5b60cd1dfbf5)

---

## 3. Crash Recovery for Python Daemons on macOS {#3-crash-recovery}

**Confidence:** HIGH (launchd is mature, patterns well-documented by Apple)

### Current State

Opta-LMX already has:
- `com.opta.lmx.plist` with `RunAtLoad: true` and `KeepAlive.SuccessfulExit: false`
- `ThrottleInterval: 10` (wait 10s between restart attempts)
- `SoftResourceLimits.NumberOfFiles: 4096`
- FastAPI lifespan with drain + model unload on shutdown

### What to Improve

#### A. SIGTERM Handling in Uvicorn

**The problem:** When launchd sends SIGTERM, Uvicorn has 20 seconds (default `ExitTimeOut`) to shut down before receiving SIGKILL. Uvicorn passes SIGTERM to workers, which triggers its own graceful shutdown. But if model unloading takes longer than 20 seconds (e.g., flushing a 100GB model's Metal cache), launchd will SIGKILL the process.

**The fix:** Add explicit signal handling AND increase ExitTimeOut in the plist:

```python
# In main.py or a dedicated signals module
import signal
import asyncio

_shutdown_event = asyncio.Event()

def _handle_sigterm(signum, frame):
    """Handle SIGTERM from launchd -- trigger graceful shutdown."""
    logger.info("sigterm_received", extra={"signal": signum})
    _shutdown_event.set()

# Register before uvicorn.run()
signal.signal(signal.SIGTERM, _handle_sigterm)
```

**Important:** Do NOT perform complex operations (model unload, file I/O) inside the signal handler itself. Signal handlers in Python must be simple flag-setters. The actual cleanup should happen in the FastAPI lifespan `yield` teardown, which Uvicorn triggers after receiving SIGTERM.

The current lifespan already does this correctly via the `drain()` + model unload sequence after `yield`. The lifespan pattern is the recommended approach.

#### B. Plist Improvements

```xml
<!-- Add to com.opta.lmx.plist -->

<!-- Increase exit timeout to 60s for large model cleanup -->
<key>ExitTimeOut</key>
<integer>60</integer>

<!-- Throttle restart if daemon exits too quickly (crash loop prevention) -->
<!-- Already present: ThrottleInterval = 10 -->

<!-- Ensure child processes are cleaned up on shutdown -->
<key>AbandonProcessGroup</key>
<false/>
```

The `AbandonProcessGroup: false` ensures child processes (if any) are also terminated on shutdown, preventing orphan processes.

#### C. State Persistence Across Restarts

**Problem:** When LMX restarts after a crash, it loses knowledge of what models were loaded. The `auto_load` config handles the happy path, but doesn't track models loaded at runtime via the admin API.

**Solution:** Persist a lightweight state file:

```python
# State file: ~/.opta-lmx/runtime-state.json
{
    "loaded_models": ["mlx-community/MiniMax-M2.5-4bit"],
    "last_shutdown": "2026-02-19T10:30:00Z",
    "shutdown_reason": "sigterm",
    "uptime_seconds": 86400
}
```

On startup, the lifespan can check this file and re-load models that were active before the crash (in addition to auto_load). This is especially useful for runtime-loaded models that aren't in config.

#### D. Crash Loop Detection

**Problem:** If LMX crashes repeatedly (e.g., bad model in auto_load), launchd restarts it every 10 seconds forever. This can consume resources and fill logs.

**Solution:** Track consecutive crashes in the state file:

```python
# On startup
state = load_runtime_state()
if state.consecutive_crashes > 3:
    logger.critical("crash_loop_detected", extra={
        "crashes": state.consecutive_crashes,
        "action": "starting_in_safe_mode",
    })
    # Safe mode: skip auto_load, start with minimal config
    config.models.auto_load = []
```

### Sources

- [Apple: Creating Launch Daemons and Agents](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)
- [Apple: The Life Cycle of a Daemon](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/Lifecycle.html)
- [launchd.info Tutorial](https://www.launchd.info/)
- [Python signal.SIGTERM Best Practices](https://runebook.dev/en/docs/python/library/signal/signal.SIGTERM)
- [Restarting macOS apps automatically on crash](https://notes.alinpanaitiu.com/Restarting-macOS-apps-automatically-on-crash)
- [FastAPI Lifespan Events](https://fastapi.tiangolo.com/advanced/events/)
- [graceful-shutdown PyPI](https://pypi.org/project/graceful-shutdown/)

---

## 4. Log Management for Production Python Services {#4-log-management}

**Confidence:** HIGH (structlog already integrated, patterns proven)

### Current State

Opta-LMX already has an excellent logging foundation:
- `structlog` integrated with stdlib `logging` via `ProcessorFormatter`
- Sensitive key redaction (`_filter_sensitive_keys` catches keys, tokens, passwords)
- `RotatingFileHandler` (50MB max, 5 backups = 300MB max disk)
- JSON renderer in production, console renderer in development
- Request ID middleware (`RequestIDMiddleware`) binding to `structlog.contextvars`
- Quiet path suppression for `/healthz` and `/admin/events`

### What to Improve

#### A. Correlation ID Propagation

The current `RequestIDMiddleware` generates/propagates `X-Request-ID`. This is good but could be enhanced:

**Add `asgi-correlation-id` for standards-compliant correlation:**

```python
# pip install asgi-correlation-id
from asgi_correlation_id import CorrelationIdMiddleware

app.add_middleware(
    CorrelationIdMiddleware,
    header_name="X-Request-ID",  # Reuse existing header
)
```

**Assessment:** The current custom middleware already does this correctly. Adding `asgi-correlation-id` would add a dependency for minimal gain. **Recommend keeping current implementation** but adding the correlation ID to Uvicorn's access log format.

#### B. Log File Location

**Current:** `/tmp/opta-lmx.log` (from `mono512-current.yaml`)

**Problem:** `/tmp` is cleared on reboot on macOS. Logs from before a reboot are lost.

**Recommended:** Move to `/var/log/opta-lmx/opta-lmx.log` (matching the plist's `StandardOutPath`):

```yaml
logging:
  file: "/var/log/opta-lmx/opta-lmx.log"  # Persistent across reboots
```

**Also:** The plist already writes stdout/stderr to `/var/log/opta-lmx/`, but the structured JSON logs go to `/tmp/`. These should be co-located. With both in `/var/log/opta-lmx/`, you get:
- `opta-lmx.log` -- structured JSON logs (rotated by Python)
- `opta-lmx.stdout.log` -- raw stdout (launchd captures)
- `opta-lmx.stderr.log` -- raw stderr (launchd captures)

#### C. Log Shipping (Optional, LAN-Only)

For a single-machine deployment, local logs are sufficient. If monitoring from the MacBook is desired:

**Option 1 (simplest):** Tail logs over SSH:
```bash
ssh mono512 'tail -f /var/log/opta-lmx/opta-lmx.log | jq .'
```

**Option 2:** Expose a log-tail endpoint (already partially exists via `/admin/events` SSE):
```python
@router.get("/admin/logs")
async def stream_logs(n: int = 100):
    """Return last N structured log lines."""
    # Read from log file, return as JSON array
```

**Option 3 (heavier):** Run a Prometheus + Loki stack for log aggregation. Overkill for a single machine but useful if you add more helper nodes.

#### D. Inference-Specific Log Fields

Add structured fields to inference request logs for better queryability:

```python
logger.info("inference_complete", extra={
    "request_id": request_id,
    "model_id": model_id,
    "prompt_tokens": prompt_tokens,
    "completion_tokens": completion_tokens,
    "latency_ms": round(elapsed * 1000, 1),
    "stream": True,
    "ttft_ms": round(ttft * 1000, 1),  # NEW: Time to first token
    "client_id": client_id,             # NEW: Which bot/app made the request
    "priority": priority,               # NEW: "high" or "normal"
})
```

### Sources

- [FastAPI + Structlog Integration](https://wazaari.dev/blog/fastapi-structlog-integration)
- [Production-Grade Logging for FastAPI (Feb 2026)](https://medium.com/@laxsuryavanshi.dev/production-grade-logging-for-fastapi-applications-a-complete-guide-f384d4b8f43b)
- [Setting Up Structured Logging in FastAPI with structlog](https://ouassim.tech/notes/setting-up-structured-logging-in-fastapi-with-structlog/)
- [asgi-correlation-id (PyPI)](https://pypi.org/project/asgi-correlation-id/)
- [structlog FastAPI logging setup gist](https://gist.github.com/nymous/f138c7f06062b7c43c060bf03759c29e)

---

## 5. Health Check Patterns for ML Inference Servers {#5-health-checks}

**Confidence:** HIGH (industry-standard patterns from NVIDIA Triton, Kubernetes)

### Current State

Opta-LMX has:
- `GET /healthz` -- unauthenticated liveness probe (returns `{"status": "ok", "version": "..."}`)
- `GET /admin/health` -- authenticated, checks memory > 95% then returns "degraded"

### Industry Standard: Three-Tier Health Checks

Based on NVIDIA Triton Inference Server and Kubernetes patterns:

| Probe | Purpose | Frequency | Auth | Fail Action |
|-------|---------|-----------|------|-------------|
| **Liveness** (`/healthz`) | "Is the process alive?" | Every 10s | None | Restart |
| **Readiness** (`/readyz`) | "Can it handle requests?" | Every 5s | None | Remove from LB |
| **Deep** (`/admin/health`) | "Is everything working?" | Every 30s | Admin | Alert |

### What to Add

#### A. Readiness Probe (`/readyz`)

```python
@router.get("/readyz")
async def readyz(engine: Engine) -> dict[str, Any]:
    """Readiness probe -- returns 200 only when server can handle inference.

    Checks:
    1. At least one model is loaded
    2. Memory usage below threshold
    3. Not in drain mode (shutting down)
    """
    loaded_count = len(engine.get_loaded_models())
    if loaded_count == 0:
        raise HTTPException(
            status_code=503,
            detail="No models loaded -- server not ready for inference",
        )

    memory_pct = memory.usage_percent()
    if memory_pct >= memory.threshold_percent:
        raise HTTPException(
            status_code=503,
            detail=f"Memory at {memory_pct:.1f}% -- above threshold",
        )

    return {
        "status": "ready",
        "models_loaded": loaded_count,
        "memory_percent": round(memory_pct, 1),
    }
```

#### B. Enhanced Deep Health Check

The current `/admin/health` only checks memory. A production deep health should also verify:

```python
@router.get("/admin/health")
async def health_check_deep(
    _auth: AdminAuth, engine: Engine, memory: Memory
) -> dict[str, Any]:
    """Deep health check -- verifies all subsystems."""
    checks: dict[str, Any] = {}
    overall = "ok"

    # 1. Memory check
    usage = memory.usage_percent()
    if usage > 95:
        checks["memory"] = {"status": "critical", "usage_pct": usage}
        overall = "critical"
    elif usage > 85:
        checks["memory"] = {"status": "warning", "usage_pct": usage}
        if overall == "ok":
            overall = "degraded"
    else:
        checks["memory"] = {"status": "ok", "usage_pct": usage}

    # 2. Model availability
    loaded = engine.get_loaded_models()
    checks["models"] = {
        "status": "ok" if loaded else "warning",
        "loaded_count": len(loaded),
        "model_ids": [m.model_id for m in loaded],
    }
    if not loaded and overall == "ok":
        overall = "degraded"

    # 3. GPU/Metal health (detect thermal throttling)
    try:
        import mlx.core as mx
        metal_active = mx.metal.is_available()
        checks["metal"] = {"status": "ok" if metal_active else "critical"}
        if not metal_active:
            overall = "critical"
    except Exception as e:
        checks["metal"] = {"status": "unknown", "error": str(e)}

    # 4. Inference capacity
    in_flight = engine.in_flight_count
    max_concurrent = engine.max_concurrent_requests
    capacity_pct = (in_flight / max_concurrent * 100) if max_concurrent > 0 else 0
    checks["inference"] = {
        "status": "ok" if capacity_pct < 90 else "saturated",
        "in_flight": in_flight,
        "max_concurrent": max_concurrent,
        "capacity_pct": round(capacity_pct, 1),
    }

    # 5. Uptime
    checks["uptime_seconds"] = round(time.time() - app.state.start_time, 1)

    return {
        "status": overall,
        "version": __version__,
        "checks": checks,
    }
```

#### C. Health Check Response Codes

| Status | HTTP Code | Meaning |
|--------|-----------|---------|
| `ok` | 200 | All systems nominal |
| `degraded` | 200 | Functional but impaired (high memory, no models) |
| `critical` | 503 | Cannot serve inference requests |

**Important:** Liveness (`/healthz`) should ALWAYS return 200 unless the process is truly dead. Even if models are unloaded or memory is high, the process is alive. Returning non-200 from liveness causes unnecessary restarts.

### Sources

- [NVIDIA Triton Inference Server HTTP API](https://docs.nvidia.com/deeplearning/triton-inference-server/archives/triton_inference_server_1120/triton-inference-server-guide/docs/http_grpc_api.html)
- [Implementing Health Checks for ML Inference Containers](https://apxml.com/courses/docker-for-ml-projects/chapter-5-containerizing-ml-inference/health-checks-inference)
- [Health Checks for ML Model Deployments](https://www.tekhnoal.com/health-checks-for-ml-model-deployments)
- [FastAPI Health Check Best Practices](https://www.index.dev/blog/how-to-implement-health-check-in-python)

---

## 6. Graceful Degradation Under Load {#6-graceful-degradation}

**Confidence:** HIGH (patterns well-established, good library support)

### Current State

Opta-LMX already has several degradation mechanisms:
- Inference semaphore (`max_concurrent_requests: 4`) -- excess requests queue
- Adaptive concurrency (`adapt_concurrency()`) -- reduces parallelism under memory pressure
- Inference timeout (`inference_timeout_sec: 600`) -- kills hung requests
- LRU eviction under memory pressure
- Priority bypass (CLI "high" priority skips semaphore)
- Drain on shutdown with configurable timeout

### What to Add

#### A. Request Queue with Bounded Depth

Currently, when all 4 semaphore slots are taken, additional requests wait indefinitely on `asyncio.Semaphore.acquire()`. Under sustained load, this can lead to unbounded queue growth and OOM.

**Solution: Bounded queue with backpressure**

```python
# In engine or middleware
_QUEUE_DEPTH = 16  # Max queued requests beyond concurrent limit

async def acquire_or_reject(self, timeout_sec: float = 30.0) -> bool:
    """Acquire inference slot or reject with 429 after timeout."""
    try:
        await asyncio.wait_for(
            self._inference_semaphore.acquire(),
            timeout=timeout_sec,
        )
        return True
    except asyncio.TimeoutError:
        return False  # Caller returns HTTP 429
```

**HTTP 429 response for overloaded state:**
```python
if not await engine.acquire_inference_slot(timeout_sec=30):
    raise HTTPException(
        status_code=429,
        detail="Server at capacity. Retry after 5 seconds.",
        headers={"Retry-After": "5"},
    )
```

#### B. Circuit Breaker for Helper Nodes

The `HelperNodeClient` already tracks health (`is_healthy`) and has per-request error handling. Phase 10 should add a proper circuit breaker to avoid hammering a dead helper node:

**Recommended library:** `aiobreaker` (async fork of `pybreaker`, supports asyncio natively)

```python
from aiobreaker import CircuitBreaker

class HelperNodeClient:
    def __init__(self, config: HelperNodeEndpoint) -> None:
        self._breaker = CircuitBreaker(
            fail_max=3,                    # Open after 3 failures
            reset_timeout=timedelta(seconds=30),  # Half-open after 30s
        )
        ...

    @_breaker
    async def embed(self, texts: list[str]) -> list[list[float]]:
        # Existing implementation -- aiobreaker wraps it
        ...
```

**States:**
- **Closed:** Requests pass through normally
- **Open:** All requests immediately fail (fast-fail, no network call)
- **Half-Open:** After reset_timeout, one request is allowed to test recovery

**Why not hand-roll:** The state machine (closed -> open -> half-open), thread safety, and reset timing are easy to get wrong. `aiobreaker` is < 200 LOC and well-tested.

#### C. Load Shedding Middleware

For extreme overload (server at 95%+ memory, all inference slots full), shed non-critical requests:

```python
class LoadSheddingMiddleware:
    """Reject requests with 503 when server is critically overloaded."""

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        # Always allow health checks
        if path in ("/healthz", "/readyz"):
            await self.app(scope, receive, send)
            return

        # Check if we should shed load
        memory_pct = self._memory.usage_percent()
        if memory_pct > 95:
            response = JSONResponse(
                status_code=503,
                content={"error": "Server under extreme load", "retry_after": 10},
                headers={"Retry-After": "10"},
            )
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)
```

#### D. Backpressure via Semaphore + Queue Depth Metric

Expose queue depth in Prometheus metrics so monitoring can detect backpressure building:

```
# HELP lmx_queued_requests Requests waiting for inference slot
# TYPE lmx_queued_requests gauge
lmx_queued_requests 3
```

### Sources

- [FastAPI Resiliency: Circuit Breakers, Rate Limiting](https://www.aritro.in/post/fastapi-resiliency-circuit-breakers-rate-limiting-and-external-api-management/)
- [Circuit Breaker Pattern in FastAPI](https://blog.stackademic.com/system-design-1-implementing-the-circuit-breaker-pattern-in-fastapi-e96e8864f342)
- [FastAPI Under Fire: HTTP/2, Backpressure, p999 Wins](https://medium.com/@hadiyolworld007/fastapi-under-fire-http-2-backpressure-and-p999-wins-dd50c53a51a8)
- [Managing async I/O backpressure](https://tech-champion.com/programming/python-programming/manage-async-i-o-backpressure-using-bounded-queues-and-timeouts/)
- [aiobreaker (PyPI)](https://pypi.org/project/aiobreaker/)
- [FastAPI Circuit Breakers with Resilience Patterns (Dec 2025)](https://medium.com/@kaushalsinh73/fastapi-circuit-breakers-with-resilience-patterns-surviving-downstream-failures-4af0920799d3)

---

## 7. macOS-Specific Production Concerns {#7-macos-specific}

**Confidence:** MEDIUM-HIGH (Apple Silicon server use is niche, but patterns are documented)

### A. Prevent Sleep (Critical)

Mac Studio must NEVER sleep while serving inference. Multiple layers of protection:

**Layer 1: System Settings**
```bash
# On Mac Studio (one-time setup)
sudo pmset -c sleep 0         # Never sleep on AC power
sudo pmset -c disksleep 0     # Never spin down disks
sudo pmset -c displaysleep 5  # Display can sleep (saves energy)
```

**Layer 2: caffeinate in plist**

Wrap the daemon in `caffeinate -i` to programmatically prevent sleep:

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

The `-i` flag prevents idle sleep as long as the process is alive. Since launchd's `KeepAlive` ensures the process is always alive, this effectively prevents sleep permanently.

**Layer 3: Verify in setup script**

```bash
# In setup-production.sh
echo "[6/6] Configuring energy settings..."
sudo pmset -c sleep 0
sudo pmset -c disksleep 0
# Verify
current_sleep=$(pmset -g | grep "^ sleep" | awk '{print $2}')
if [ "$current_sleep" != "0" ]; then
    echo "WARNING: Sleep not disabled! Currently set to $current_sleep"
fi
```

### B. Thermal Throttling Detection

The M3 Ultra in the Mac Studio has excellent cooling, but sustained GPU load (100% for hours) can cause thermal throttling that silently reduces tok/s.

**Tool: macmon** (Rust, no sudo required)

macmon uses an undocumented Apple private API (same as `powermetrics` but without requiring root) to read GPU frequency, temperature, and power.

```bash
# Install
brew install vladkens/tap/macmon

# Stream JSON metrics (pipe to monitoring)
macmon pipe --interval 5000 | jq -c '{
    gpu_freq_mhz: .gpu.freq_mhz,
    gpu_temp_c: .gpu.temp,
    gpu_power_w: .gpu.power,
    cpu_power_w: .cpu.power
}'
```

**Integration with LMX health check:**

```python
import asyncio
import json

async def check_thermal_status() -> dict[str, Any]:
    """Read thermal metrics from macmon (non-blocking)."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "macmon", "pipe", "--count", "1",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5.0)
        data = json.loads(stdout.decode())
        return {
            "gpu_freq_mhz": data.get("gpu", {}).get("freq_mhz"),
            "gpu_temp_c": data.get("gpu", {}).get("temp"),
            "thermal_throttled": data.get("gpu", {}).get("freq_mhz", 9999) < 1000,
        }
    except Exception:
        return {"thermal_status": "unknown"}
```

**Throttling detection heuristic:** If GPU frequency drops below ~1000 MHz while utilization remains high (> 80%), the chip is thermally throttling. Alert via log and/or health check degradation.

### C. Unified Memory Monitoring (Beyond psutil)

`psutil.virtual_memory()` reports total system memory correctly on Apple Silicon, but doesn't distinguish between CPU and GPU memory usage. Since unified memory is shared, this is actually fine for threshold checks.

**MLX-specific memory tracking:**

```python
import mlx.core as mx

# Metal memory (GPU allocations only)
metal_active = mx.metal.get_active_memory()   # Currently allocated
metal_peak = mx.metal.get_peak_memory()        # High watermark
metal_cache = mx.metal.get_cache_memory()       # Buffer cache

# Add to health check
checks["metal_memory"] = {
    "active_gb": round(metal_active / (1024**3), 2),
    "peak_gb": round(metal_peak / (1024**3), 2),
    "cache_gb": round(metal_cache / (1024**3), 2),
}
```

### D. Metal GPU Stability Under Sustained Load

**Known issue:** MLX can throw a fatal `SIGABRT` if Metal buffer allocation exceeds the device limit. The current code already sets `mx.metal.set_memory_limit()` with `relaxed=True` in the lifespan, which is the correct mitigation.

**Additional protection:** Periodically check Metal memory and proactively clear cache:

```python
async def _metal_maintenance_loop():
    """Periodically check Metal memory and clear cache if needed."""
    while True:
        await asyncio.sleep(60)
        try:
            cache_gb = mx.metal.get_cache_memory() / (1024**3)
            if cache_gb > 50:  # 50GB cache is excessive
                mx.metal.clear_cache()
                logger.info("metal_cache_cleared", extra={"freed_gb": round(cache_gb, 1)})
        except Exception:
            pass
```

### E. launchd Best Practices Summary

| Setting | Current | Recommended | Why |
|---------|---------|-------------|-----|
| `KeepAlive` | `SuccessfulExit: false` | Keep | Restart on crash, not on clean exit |
| `ThrottleInterval` | 10 | Keep | Prevents rapid restart loops |
| `ExitTimeOut` | Default (20s) | **60** | Large model cleanup needs more time |
| `ProcessType` | Standard | **Adaptive** or keep Standard | Adaptive lets macOS manage CPU priority |
| `AbandonProcessGroup` | Not set | **false** | Clean up child processes |
| `Nice` | Not set | Consider **-5** | Slightly higher priority for inference |
| Sleep prevention | Not set | **caffeinate -i** wrapper | Prevents idle sleep |

### Sources

- [macmon: Sudoless Apple Silicon Monitoring](https://github.com/vladkens/macmon)
- [Monitor macOS Apple Silicon GPU with macmon](https://www.metricfire.com/blog/monitor-apple-silicon-gpu-on-macos-with-macmon-hosted-graphite/)
- [asitop: Apple Silicon CLI Monitor](https://github.com/tlkh/asitop)
- [Building a macOS Thermal Throttling App](https://stanislas.blog/2025/12/macos-thermal-throttling-app/)
- [Apple Silicon vs NVIDIA CUDA: AI 2025](https://scalastic.io/en/apple-silicon-vs-nvidia-cuda-ai-2025/)
- [pmset Man Page](https://ss64.com/mac/pmset.html)
- [macOS Prevent Sleep on Sequoia](https://mackeeper.com/blog/prevent-mac-from-sleeping-on-sequoia/)

---

## 8. Security Hardening {#8-security-hardening}

**Confidence:** HIGH (standard web security, adapted for LAN)

### Current State

- `SecurityConfig` with `admin_key` field (currently `null` in production config)
- `AdminAuth` dependency checks header against `admin_key`
- CORS `allow_origins=["*"]` (permissive, appropriate for LAN)
- No rate limiting
- No TLS (plain HTTP on LAN)
- Request ID middleware (traceability)
- Sensitive key redaction in logs

### What to Improve

#### A. Set Admin Key (Critical -- Currently Null)

The production config has `admin_key: null`. This means ALL admin endpoints (`/admin/load`, `/admin/unload`, `/admin/config/reload`) are completely unauthenticated. Any device on the LAN can load/unload models.

```yaml
# config/mono512-current.yaml
security:
  admin_key: "lmx-<random-32-char-string>"  # MUST SET
```

Generate a key:
```bash
python3 -c "import secrets; print(f'lmx-{secrets.token_urlsafe(32)}')"
```

**Distribute to authorized clients via environment variable:**
```bash
# On MacBook (in .zshrc or per-bot config)
export LMX_ADMIN_KEY="lmx-..."
```

#### B. Rate Limiting with slowapi

**Library:** `slowapi` (Starlette/FastAPI rate limiter, production-proven)

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# Inference endpoints: generous limit (bots make many requests)
@router.post("/v1/chat/completions")
@limiter.limit("60/minute")
async def chat_completions(...):
    ...

# Admin endpoints: tighter limit
@router.post("/admin/models/load")
@limiter.limit("10/minute")
async def load_model(...):
    ...

# Health checks: no limit (monitoring systems poll frequently)
@router.get("/healthz")
async def healthz():  # No rate limit decorator
    ...
```

**Storage:** For a single-machine deployment, in-memory storage is fine. No need for Redis.

**429 response:**
```python
from slowapi.errors import RateLimitExceeded

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(
        status_code=429,
        content={"error": "Rate limit exceeded", "retry_after": exc.detail},
        headers={"Retry-After": str(exc.detail)},
    )
```

#### C. CORS Tightening

Current: `allow_origins=["*"]` -- any origin can make requests.

For LAN-only use, restrict to known origins:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://192.168.188.*",       # LAN devices
        "http://localhost:*",          # Local development
        "http://127.0.0.1:*",         # Loopback
    ],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID", "X-Client-ID"],
)
```

**Note:** FastAPI's CORSMiddleware doesn't support wildcards in the middle of origins (e.g., `192.168.188.*`). For LAN-only deployments, `["*"]` is pragmatically acceptable. The admin key provides the real security boundary.

**Assessment:** Keep `["*"]` for now. The admin key is the authentication layer, CORS is defense-in-depth for browser-based clients.

#### D. TLS Termination (Optional)

For a LAN-only service, TLS is defense-in-depth, not critical. Options:

**Option 1: Self-signed cert with Uvicorn**
```bash
# Generate self-signed cert
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Run with TLS
uvicorn src.opta_lmx.main:app --ssl-keyfile key.pem --ssl-certfile cert.pem
```

**Option 2: Caddy reverse proxy (simplest TLS)**
```
# Caddyfile
:443 {
    reverse_proxy localhost:1234
    tls internal  # Self-signed, auto-renewed
}
```

**Assessment:** For a trusted home LAN, TLS adds complexity without meaningful security gain. **Skip for Phase 10**, revisit if helper nodes are added from untrusted networks.

#### E. Input Validation Hardening

The current Pydantic models validate request structure, but some additional guards would help:

```python
# Prevent extremely large requests
class ChatCompletionRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., max_length=256)  # Max 256 messages
    max_tokens: int | None = Field(None, le=32768)            # Cap at 32K
    temperature: float = Field(0.7, ge=0, le=2.0)
    # ... existing fields ...
```

### Sources

- [FastAPI Security Best Practices](https://blog.greeden.me/en/2025/07/29/fastapi-security-best-practices-from-authentication-authorization-to-cors/)
- [Securing FastAPI Applications (GitHub Guide)](https://github.com/VolkanSah/Securing-FastAPI-Applications)
- [slowapi: Rate Limiter for Starlette/FastAPI](https://github.com/laurentS/slowapi)
- [Rate Limiting in FastAPI for ML Endpoints](https://fullstackdatascience.com/blogs/rate-limiting-in-fastapi-essential-protection-for-ml-api-endpoints-d5xsqw)
- [Building Production-Ready APIs with FastAPI](https://dev-faizan.medium.com/building-production-ready-apis-with-fastapi-complete-guide-with-authentication-rate-limiting-and-391028cc623c)

---

## 9. Don't-Hand-Roll List {#9-dont-hand-roll}

Components where the codebase should use established libraries instead of custom implementations:

| Component | Don't Hand-Roll | Use Instead | Why |
|-----------|----------------|-------------|-----|
| Circuit breaker | State machine, timers | `aiobreaker` | Easy to get half-open timing wrong |
| Rate limiting | Token bucket, IP tracking | `slowapi` | Thread-safe, Redis-ready, well-tested |
| SSE test parsing | Manual `data:` line parsing | `httpx-sse` | Handles multi-line data, event types, retries |
| Lifespan testing | Manual app startup/shutdown | `asgi-lifespan` | Correctly manages ASGI lifespan protocol |
| Structured logging | Custom JSON formatters | `structlog` | **Already using** (correct choice) |
| Prometheus metrics | Custom text formatting | `prometheus-client` | **Consider** -- current hand-rolled Prometheus text works but misses histograms properly |
| Load testing | Custom HTTP loops | `locust` / `llm-locust` | Needs proper concurrency, reporting, distribution |
| ASGI middleware | `BaseHTTPMiddleware` | Raw ASGI pattern | **Already using** raw ASGI (correct choice to avoid SSE buffering) |
| Memory monitoring | Manual `/proc/meminfo` parsing | `psutil` | **Already using** (correct choice) |
| GPU monitoring | subprocess + powermetrics | `macmon pipe` | No sudo, JSON output, Rust performance |

### Libraries Already Correctly Used

These are correct choices that should NOT be replaced:
- `structlog` for logging (over `loguru` or bare `logging`)
- `psutil` for memory monitoring
- `httpx.AsyncClient` for test fixtures
- `pydantic-settings` for config (env var overrides)
- Raw ASGI middleware (over `BaseHTTPMiddleware`)

---

## 10. Common Pitfalls {#10-common-pitfalls}

### macOS-Specific Gotchas

| Pitfall | Impact | Mitigation |
|---------|--------|------------|
| **Mac Studio sleeps on idle** | Server goes offline, all bots lose inference | `pmset -c sleep 0` + `caffeinate -i` in plist |
| **launchd SIGKILL after 20s** | Model unload interrupted, Metal cache leaked | Set `ExitTimeOut: 60` in plist |
| **launchd crash loop** | CPU spike from rapid restart cycles | `ThrottleInterval: 10` (already set) + crash loop detection in code |
| **`/tmp` cleared on reboot** | Structured logs lost | Move log file to `/var/log/opta-lmx/` |
| **Metal SIGABRT on OOM** | Fatal crash, unrecoverable | `mx.metal.set_memory_limit(relaxed=True)` (already set) |
| **Energy Saver enables sleep** | Silent service interruption | Verify with `pmset -g` in setup script |
| **macOS updates reboot** | Daemon restarts, models re-load (slow) | `KeepAlive` + `RunAtLoad` handle this automatically |
| **Thermal throttling under sustained load** | Reduced tok/s without error signals | Monitor GPU freq via macmon, alert if < 1000 MHz |
| **Unified memory pressure from non-LMX processes** | Less memory for models than expected | Monitor total system memory, not just MLX allocations |

### Python/FastAPI Gotchas

| Pitfall | Impact | Mitigation |
|---------|--------|------------|
| **BaseHTTPMiddleware buffers StreamingResponse** | Memory spike during SSE | Use raw ASGI middleware (already done) |
| **signal handlers doing complex work** | Deadlock, race conditions | Signal handler only sets flag; cleanup in lifespan |
| **`asyncio.Semaphore` unbounded queuing** | Memory growth under sustained overload | Add timeout to acquire(), return 429 |
| **Custom SIGTERM handler overrides Uvicorn's** | Uvicorn reload breaks | Chain to previous handler via `signal.getsignal()` |
| **Multiple Uvicorn workers** | State not shared between workers | Keep `workers: 1` (already configured) -- MLX is single-process |
| **pytest-asyncio loop scope mismatch** | Tests hang or fail intermittently | `asyncio_mode = "auto"` (already configured) |
| **Lifespan not triggered in tests** | Startup/shutdown logic untested | Use `asgi-lifespan.LifespanManager` |
| **Prometheus histogram buckets not cumulative** | Grafana displays wrong values | Current implementation is cumulative (correct) |

### Inference-Specific Gotchas

| Pitfall | Impact | Mitigation |
|---------|--------|------------|
| **Model load during inference** | Memory spike causes OOM | Load lock prevents concurrent loads (already implemented) |
| **Semaphore swap with in-flight requests** | Orphaned waiters | Only swap when `in_flight == 0` (already implemented) |
| **KV cache growing unbounded** | Gradual memory leak | `mx.metal.set_cache_limit()` (already set in lifespan) |
| **No warmup = slow first request** | First user sees 10x latency | Warmup on load (already implemented) |
| **Context window overflow** | Model generates garbage or crashes | `fit_to_context()` truncation (already implemented) |

---

## 11. Recommended Architecture Summary {#11-architecture-summary}

### Standard Stack for Production Python Services on macOS

```
                    +--------------------------------------+
                    |           launchd                     |
                    |  RunAtLoad + KeepAlive + caffeinate   |
                    |  ExitTimeOut: 60s                     |
                    +------------------+-------------------+
                                       | SIGTERM / SIGKILL
                    +------------------v-------------------+
                    |         Uvicorn (single worker)       |
                    |    host: 0.0.0.0:1234                 |
                    +------------------+-------------------+
                                       | ASGI
     +---------------------------------v----------------------------------+
     |                    FastAPI Application                              |
     |  +-------------------------------------------------------------+   |
     |  |                 Middleware Stack                              |   |
     |  |  1. LoadSheddingMiddleware (reject at 95% memory)           |   |
     |  |  2. RateLimitMiddleware (slowapi)                           |   |
     |  |  3. RequestIDMiddleware (structlog contextvars)              |   |
     |  |  4. RequestLoggingMiddleware (latency, status)               |   |
     |  |  5. CORSMiddleware (allow_origins=["*"])                     |   |
     |  +-------------------------------------------------------------+   |
     |                                                                     |
     |  +--------------+  +--------------+  +----------------+            |
     |  | /healthz     |  | /readyz      |  | /v1/chat/...   |            |
     |  | /admin/health|  |              |  | /v1/models     |            |
     |  | /admin/...   |  |              |  | /v1/embeddings |            |
     |  +--------------+  +--------------+  +--------+-------+            |
     |                                               |                     |
     |  +--------------------------------------------v---------------+    |
     |  |              InferenceEngine                                |    |
     |  |  - Semaphore (bounded, with timeout -> 429)                |    |
     |  |  - Adaptive concurrency (memory-aware)                     |    |
     |  |  - Drain support (graceful shutdown)                       |    |
     |  |  - vllm-mlx BatchedEngine / SimpleEngine                   |    |
     |  |  - GGUF fallback via llama-cpp-python                      |    |
     |  +------------------------------------------------------------+    |
     |                                                                     |
     |  +------------------+  +--------------------------+                |
     |  | HelperNodeClient |  | MetricsCollector          |                |
     |  | + CircuitBreaker |  | + Prometheus + JSON       |                |
     |  +------------------+  +--------------------------+                |
     |                                                                     |
     |  +------------------------------------------------------+          |
     |  |              structlog (JSON -> file)                 |          |
     |  |  - Sensitive key redaction                            |          |
     |  |  - Request ID correlation                             |          |
     |  |  - RotatingFileHandler (50MB x 5)                     |          |
     |  +------------------------------------------------------+          |
     +-----------------------------------------------------------------+
                               |
                    +----------v---------------------------+
                    |  /var/log/opta-lmx/                   |
                    |    opta-lmx.log (structured JSON)     |
                    |    opta-lmx.stdout.log (launchd)      |
                    |    opta-lmx.stderr.log (launchd)      |
                    +--------------------------------------+
```

### Resilient Inference Server Patterns

1. **Never crash on OOM:** Memory check before load, threshold enforcement, graceful degradation to 503
2. **Bounded everything:** Concurrency semaphore, queue depth limit, request timeout, Metal memory limit
3. **Adaptive capacity:** Reduce concurrency under memory pressure, increase when memory frees up
4. **Three-tier health:** Liveness (always 200), readiness (models loaded?), deep (all subsystems)
5. **State persistence:** Save loaded model list to disk, restore on crash recovery
6. **Circuit breaker:** For all external calls (helper nodes), fail fast when downstream is dead
7. **Structured logging:** Every event has request_id, model_id, latency -- queryable via jq

---

## 12. Gap Analysis: What Opta-LMX Already Has vs Needs {#12-gap-analysis}

### Already Excellent (No Changes Needed)

| Feature | Assessment |
|---------|-----------|
| Async architecture | Fully async, correct patterns |
| structlog integration | JSON + redaction + contextvars |
| Raw ASGI middleware | Avoids BaseHTTPMiddleware buffering |
| Memory monitoring | psutil + threshold + LRU eviction |
| Adaptive concurrency | Dynamic semaphore based on memory |
| Inference timeout | asyncio.wait_for / asyncio.timeout |
| Drain on shutdown | 30s drain before model unload |
| Metal memory limits | set_memory_limit(relaxed=True) |
| Request ID propagation | structlog.contextvars binding |
| Prometheus metrics | Per-model counters, latency histogram |
| Test infrastructure | 542 tests, async fixtures, mock engine |

### Needs Addition (Phase 10 Work Items)

| Priority | Feature | Effort | Library/Approach |
|----------|---------|--------|-----------------|
| **P0** | Set admin_key in production config | 5 min | Config change |
| **P0** | Move log file from `/tmp/` to `/var/log/` | 5 min | Config change |
| **P1** | Readiness probe (`/readyz`) | 30 min | New endpoint |
| **P1** | Enhanced deep health check | 1 hr | Expand `/admin/health` |
| **P1** | ExitTimeOut: 60 in plist | 5 min | Plist edit |
| **P1** | caffeinate wrapper in plist | 5 min | Plist edit |
| **P1** | pmset sleep prevention in setup script | 10 min | Script edit |
| **P1** | Bounded semaphore acquire (429 on timeout) | 1 hr | Code change |
| **P2** | Runtime state persistence (crash recovery) | 2 hr | New module |
| **P2** | Crash loop detection (safe mode) | 1 hr | Startup logic |
| **P2** | Circuit breaker for helper nodes | 1 hr | `aiobreaker` |
| **P2** | Rate limiting | 1 hr | `slowapi` |
| **P2** | Load shedding middleware | 1 hr | New middleware |
| **P2** | SSE integration tests via httpx-sse | 2 hr | New test file |
| **P3** | Thermal throttling detection | 2 hr | `macmon pipe` |
| **P3** | Metal memory tracking in health check | 30 min | `mx.metal.get_*_memory()` |
| **P3** | Metal cache maintenance loop | 30 min | Background task |
| **P3** | Load testing scripts (Locust) | 3 hr | New `loadtest/` dir |
| **P3** | TTFT tracking in request logs | 1 hr | Code change |
| **P3** | Lifespan integration tests | 2 hr | `asgi-lifespan` |

### Estimated Total Effort

- **P0 (Critical, do first):** ~10 minutes
- **P1 (High priority):** ~4 hours
- **P2 (Medium priority):** ~8 hours
- **P3 (Nice to have):** ~11 hours
- **Total:** ~23 hours of implementation work

### New Dependencies

| Package | Version | Purpose | Size |
|---------|---------|---------|------|
| `slowapi` | >=0.1.9 | Rate limiting | Tiny (wraps limits) |
| `aiobreaker` | >=1.2 | Async circuit breaker | Tiny (~200 LOC) |
| `httpx-sse` | >=0.4 | SSE test parsing (dev only) | Tiny |
| `asgi-lifespan` | >=2.1 | Lifespan testing (dev only) | Tiny |
| `macmon` | Latest | Thermal monitoring (CLI, not pip) | Homebrew install |

---

*Research complete. All findings cross-verified across multiple sources. Confidence levels noted per section.*
