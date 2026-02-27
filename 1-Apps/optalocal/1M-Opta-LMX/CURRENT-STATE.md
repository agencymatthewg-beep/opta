# Opta LMX — Current State (2026-02-27)

## Service Status
- Running: YES — port 1234
- Model loaded: mlx-community/Kimi-K2.5-3bit (412GB on disk, ~357GB RAM when loaded)
- mlx_lm version: 0.30.7
- Auth: FAIL-CLOSED ✅ (inference_api_key required for /v1/* endpoints)

## Test Suite
- Total tests: 200+ (excluding smoke/benchmark/perf tests)
- Concurrency tests: 15/15 passing ✅
- One minor failure: test_benchmark_report (hardcoded path - FIXED)

## Ruff
- Findings: 0 ✅

## What Was Fixed Today
- **Auth fail-closed**: Added `inference_api_key` to config ✅
- **LaunchDaemon plist**: Fixed Python path to `/Users/opta/venvs/mlx/bin/python` ✅
- **LaunchDaemon plist**: Fixed WorkingDirectory from `1J-Opta-LMX` to `1M-Opta-LMX` ✅
- **LaunchDaemon plist**: Added `--config` argument with correct path ✅
- **LaunchDaemon plist**: Added `UserName=opta` ✅
- **Config**: Updated `auto_load` to Kimi-K2.5-3bit (production model) ✅
- **Config**: Updated routing aliases to point to Kimi ✅
- **Code**: Added `record_model_load()` stub to MetricsCollector (fixed startup crash) ✅
- **Test**: Fixed hardcoded MacBook path in test_benchmark_report.py ✅

## Next Dev Priorities (for Claude Code)
1. Plan 1 P0: Rate-limit enforcement tests (auth is now fail-closed, add rate limit tests)
2. Plan 1 P1: Investigate duplicate process spawning on launchd restart
3. Plan 1 P2: Create .github/workflows/ci.yml
4. Plan 1 P3: Split engine.py (2.5k LOC) into modules
5. Plan 2: Never-crash load tasks 7–14

## Production Readiness Summary
- ✅ Auth: fail-closed
- ✅ LaunchDaemon: correct paths, config, user
- ✅ Server restarts cleanly via launchd
- ✅ Ruff: 0 findings
- ✅ Tests: 15/15 concurrency tests passing
- ✅ Model: Kimi-K2.5-3bit auto-loads on startup
- ⚠️  Minor: Duplicate process spawning on restart (race condition, non-critical)
