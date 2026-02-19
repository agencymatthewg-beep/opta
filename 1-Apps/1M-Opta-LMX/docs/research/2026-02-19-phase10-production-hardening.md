# Phase 10: Production Hardening — Research

**Date:** 2026-02-19
**Confidence:** HIGH (standard patterns, well-documented)

---

## 1. Testing Architecture

### Integration Tests
- Use `httpx.AsyncClient` with `ASGITransport` for in-process testing
- Use `asgi-lifespan` (`LifespanManager`) to properly test startup/shutdown
- Use `httpx-sse` for SSE stream parsing in tests (don't hand-parse `data:` lines)
- Test categories: health endpoints, model lifecycle, chat completions, streaming, error paths

### Load Testing
- **Locust** for HTTP load testing (Python, distributed, real-time web UI)
- **llm-locust** fork adds LLM-specific metrics (TTFT, tok/s, time-per-output-token)
- Key metrics: p50/p95/p99 latency, TTFT, throughput, error rate under load
- Test scenarios: sustained load, burst traffic, concurrent model loads, memory pressure

### Test Gaps
- Lifespan not triggered in current test fixtures (use `asgi-lifespan`)
- No SSE streaming tests (need `httpx-sse`)
- No integration tests for helper node failover
- No load/stress testing infrastructure

## 2. Health Checks (Three-Tier)

### Liveness: `/healthz`
- Always returns 200 if process is alive
- No dependency checks (avoids cascading failures)

### Readiness: `/readyz` (NEW — needed)
- Returns 200 only when at least one model is loaded and accepting requests
- Returns 503 during startup, model loading, or shutdown drain
- Used by load balancers/monitoring to route traffic

### Deep Health: `/admin/health` (enhance existing)
- All subsystems checked: engine, memory, Metal GPU, helper nodes, RAG store
- Per-component status with latency
- Metal memory: `mx.metal.get_active_memory()`, `get_peak_memory()`, `get_cache_memory()`

## 3. Crash Recovery

### Runtime State Persistence
- Save loaded model list + config to `~/.opta-lmx/runtime-state.json` on changes
- On startup: detect previous unclean shutdown, reload persisted models
- Fields: `loaded_models[]`, `last_clean_shutdown`, `pid`, `startup_count`

### Crash Loop Detection
- Track `startup_count` and `last_startup_at`
- If 3+ restarts within 60s: enter safe mode (skip auto-load, log warning)
- Safe mode only loads models via explicit admin API calls

## 4. Graceful Shutdown

### Current: 30s drain, model unload, RAG persist
### Needed:
- launchd `ExitTimeOut: 60` (currently default 20s — too short for large models)
- `caffeinate -i` wrapper in plist to prevent idle sleep
- Chain SIGTERM to Uvicorn's handler (don't override)

## 5. Resilience Patterns

### Bounded Semaphore with Timeout
- Current: `asyncio.Semaphore` with unbounded queue
- Fix: Add `asyncio.wait_for(sem.acquire(), timeout=30)`, return HTTP 429 on timeout
- Expose `lmx_queued_requests` gauge in Prometheus metrics

### Circuit Breaker for Helper Nodes
- Library: `aiobreaker` (async, <200 LOC)
- States: Closed → Open (after 3 failures) → Half-Open (after 30s)
- Wrap `HelperNodeClient.embed()` and `.rerank()` methods

### Load Shedding Middleware
- Raw ASGI middleware (not BaseHTTPMiddleware)
- Reject with 503 when memory > 95% (always allow `/healthz`, `/readyz`)
- Include `Retry-After` header

### Rate Limiting
- Library: `slowapi` (Starlette/FastAPI, in-memory storage)
- Inference: 60/minute per IP
- Admin: 10/minute per IP
- Health: no limit

## 6. macOS-Specific Production

### Sleep Prevention (Critical)
- `sudo pmset -c sleep 0` + `sudo pmset -c disksleep 0`
- `caffeinate -i` wrapper in launchd plist
- Verify in setup script

### Thermal Throttling Detection
- Tool: `macmon` (Rust, no sudo, JSON output)
- `brew install vladkens/tap/macmon`
- Integration: async subprocess call from health check
- Alert if GPU freq < 1000 MHz under load

### Metal Memory Monitoring
- `mx.metal.get_active_memory()`, `get_peak_memory()`, `get_cache_memory()`
- Periodic cache maintenance: clear Metal cache if > 50GB

### launchd Best Practices
| Setting | Current | Recommended |
|---------|---------|-------------|
| ExitTimeOut | Default (20s) | 60 |
| caffeinate | Not set | `-i` wrapper |
| AbandonProcessGroup | Not set | false |

## 7. Security Hardening

### P0: Set admin_key (currently null in production!)
```bash
python3 -c "import secrets; print(f'lmx-{secrets.token_urlsafe(32)}')"
```

### P1: Rate limiting via `slowapi`
### P2: Input validation (max 256 messages, max_tokens cap at 32K)
### Skip: TLS (LAN-only, admin key is the auth boundary)
### Keep: CORS `[*]` (pragmatic for LAN, admin key provides real security)

## 8. Logging & Observability

### Current: structlog + RotatingFileHandler (correct choices)
### Needed:
- Move log file from `/tmp/` to `/var/log/opta-lmx/` (survives reboot)
- Add TTFT (time-to-first-token) tracking in request logs
- Expose queue depth metric for backpressure detection

## 9. Don't-Hand-Roll List

| Component | Use Instead |
|-----------|-------------|
| Circuit breaker | `aiobreaker` |
| Rate limiting | `slowapi` |
| SSE test parsing | `httpx-sse` |
| Lifespan testing | `asgi-lifespan` |
| Load testing | `locust` / `llm-locust` |
| GPU monitoring | `macmon pipe` (CLI) |

## 10. Gap Analysis

### Already Excellent (No Changes)
- Async architecture, structlog, raw ASGI middleware
- Memory monitoring (psutil + threshold + LRU eviction)
- Adaptive concurrency, inference timeout, drain on shutdown
- Metal memory limits, request ID propagation
- 542 tests, async fixtures, mock engine

### Phase 10 Work Items (Prioritized)

| Priority | Feature | Effort |
|----------|---------|--------|
| P0 | Set admin_key in production config | 5 min |
| P0 | Move log file to /var/log/ | 5 min |
| P1 | Readiness probe `/readyz` | 30 min |
| P1 | Enhanced deep health check | 1 hr |
| P1 | launchd plist improvements | 10 min |
| P1 | Bounded semaphore + 429 | 1 hr |
| P2 | Runtime state persistence | 2 hr |
| P2 | Crash loop detection | 1 hr |
| P2 | Circuit breaker (aiobreaker) | 1 hr |
| P2 | Rate limiting (slowapi) | 1 hr |
| P2 | Load shedding middleware | 1 hr |
| P2 | SSE integration tests | 2 hr |
| P3 | Thermal throttling detection | 2 hr |
| P3 | Metal memory in health check | 30 min |
| P3 | Metal cache maintenance loop | 30 min |
| P3 | Load testing scripts (Locust) | 3 hr |
| P3 | Lifespan integration tests | 2 hr |

### New Dependencies
| Package | Purpose |
|---------|---------|
| `slowapi` >=0.1.9 | Rate limiting |
| `aiobreaker` >=1.2 | Circuit breaker |
| `httpx-sse` >=0.4 | SSE test parsing (dev) |
| `asgi-lifespan` >=2.1 | Lifespan testing (dev) |
| `macmon` (Homebrew) | Thermal monitoring |

---

*Research complete. Sources: FastAPI resilience patterns, macOS production best practices, aiobreaker/slowapi/httpx-sse documentation, macmon GPU monitoring.*
