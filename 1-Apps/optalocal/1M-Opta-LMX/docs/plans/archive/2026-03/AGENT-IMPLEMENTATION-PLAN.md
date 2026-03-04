# Opta LMX — Agent Implementation Plan

This document outlines the optimal execution strategy for autonomous agents (like Claude Code or Gemini) to complete the outstanding tasks for the Opta LMX headless inference engine. The tasks are prioritized based on system stability, code maintainability, and feature completeness.

## General Agent Directives
- **Verification First:** Before starting any sub-plan, run the test suite to establish a baseline. After each sub-task, run tests and `ruff` to ensure no regressions.
- **Atomic Commits:** (If applicable) Commit changes after each completed sub-plan.
- **Fail-Safe Iteration:** If a test fails, do not proceed to the next step. Diagnose and fix the issue immediately.

---

## Sub-Plan 1: System Stability (Launchd Race Condition)
**Priority:** High (P1)
**Goal:** Investigate and resolve the race condition causing duplicate process spawning when the server is restarted via launchd.

### Execution Steps:
1. **Analysis:**
   - Inspect the LaunchDaemon plist file (`docs/launchd/com.opta.lmx.plist`) and the startup logic in `run.py` and `src/opta_lmx/main.py`.
   - Identify how signals (SIGTERM, SIGINT) are handled in `main.py` and `src/opta_lmx/inference/engine.py` to ensure graceful shutdown before a new process binds to port 1234.
2. **Implementation:**
   - Implement strict PID file tracking or an exclusive socket binding check with immediate failure if the port is already in use, allowing launchd to back off.
   - Ensure graceful shutdown hooks (e.g., `asyncio.CancelledError` handling) properly clean up the uvicorn/fastapi server and MLX memory allocations.
3. **Validation:**
   - Write a script to simulate rapid restart signals and verify only one process survives.
   - Run the concurrency test suite (`pytest tests/ -k concurrency`).

---

## Sub-Plan 2: Core Refactoring (`api/inference.py` & `engine.py` Modularization)
**Priority:** High (P3)
**Goal:** Continue modularizing the oversized core files. While `src/opta_lmx/inference/engine.py` has been partially structured, files like `src/opta_lmx/api/inference.py` (~1.2k LOC) and the broader inference flow need further splitting without breaking existing functionality.

### Execution Steps:
1. **Analysis:**
   - Read `src/opta_lmx/api/inference.py` and `src/opta_lmx/inference/engine.py`.
   - Identify logical domains that can be abstracted out: e.g., Request Validation, Chat Template Parsing, SSE Streaming logic, and Tool Calling parsing.
2. **Implementation:**
   - Create or expand files in `src/opta_lmx/inference/` (e.g., `stream_handler.py`, `validation.py`).
   - Move classes and functions to their respective modules.
   - Update imports across the codebase.
3. **Validation:**
   - Run the entire test suite (`pytest`).
   - Run `ruff check .` to ensure import paths are clean and no unused imports remain.
   - Run a manual inference test using the `/v1/chat/completions` endpoint.

---

## Sub-Plan 3: Admin WebUI Implementation
**Priority:** Medium
**Goal:** Implement a lightweight, static `lm-admin.html` dashboard that connects to the existing Admin API SSE feed for real-time visualization, serving as a simpler alternative to the existing Grafana dashboard.

### Execution Steps:
1. **Analysis:**
   - Review `src/opta_lmx/api/admin.py` to understand the data structure emitted by the SSE feed (memory stats, model status, load).
2. **Implementation:**
   - Create `docs/ops/monitoring/lm-admin.html` (or in a `public/` directory if served by FastAPI).
   - Write Vanilla JS to consume the `/admin/events` (or equivalent) SSE endpoint.
   - Build a simple, robust CSS layout (avoid heavy frameworks) displaying:
     - Current loaded model and RAM usage (progress bar against the 90% threshold).
     - Request throughput/RPS.
     - Active generation tasks.
3. **Validation:**
   - Serve the HTML file locally and ensure it successfully connects to a running Opta LMX instance.
   - Verify that the UI updates in real-time without memory leaks in the browser.

---

## Sub-Plan 4: Rate-Limit Enforcement Tests
**Priority:** Medium (P0)
**Goal:** `slowapi` rate limiting is already implemented (`src/opta_lmx/api/rate_limit.py`). Since auth is now fail-closed, the priority is to implement and verify comprehensive rate-limit enforcement *tests* for the API.

### Execution Steps:
1. **Analysis:**
   - Check existing tests in `tests/test_rate_limit.py`.
   - Identify gaps in testing the interaction between the fail-closed auth and the rate limiter.
2. **Implementation:**
   - Write tests in `tests/test_rate_limit.py` that intentionally breach the limit and expect a `429 Too Many Requests` response.
   - Write tests verifying that requests with invalid API keys are rejected *before* consuming rate limit quota, or vice versa depending on the desired security posture.
3. **Validation:**
   - Run `pytest tests/test_rate_limit.py -v`.
   - Verify all tests pass and coverage is comprehensive.

---

## Sub-Plan 5: Never-Crash Load Tasks (Tasks 7-14) & CI/CD
**Priority:** Low/Medium (P2)
**Goal:** Execute the specific Tasks 7-14 from the `2026-02-23-never-crash-load-multi-backend-autotune-implementation-plan.md` and establish CI/CD pipelines.

### Execution Steps:
1. **Never-Crash Implementation (Tasks 7-14):**
   - Refer to `docs/plans/2026-02-23-never-crash-load-multi-backend-autotune-implementation-plan.md`.
   - Implement the Multi-Backend Candidate Policy (Task 7) and Direct MLX-LM Backend Adapter (Task 8).
   - Follow through to Task 14 (Reliability + Performance Gates in CI).
2. **CI/CD Implementation:**
   - Create `.github/workflows/ci.yml`.
   - Configure it to run on PR and main branch: Install Python/UV, run `ruff check .`, and execute `pytest`.
3. **Validation:**
   - Run the full reliability suite (`pytest tests/test_chaos_resilience.py`).

---

## Sub-Plan 6: Quantization Background Jobs Integration
**Priority:** Low
**Goal:** Expose the existing background quantization capabilities (`src/opta_lmx/manager/quantize.py`) via the CLI and the new WebUI.

### Execution Steps:
1. **Analysis:**
   - Analyze `src/opta_lmx/manager/quantize.py` to understand how quantization jobs are spawned and monitored.
2. **Implementation:**
   - Add a CLI command (via `run.py`) to trigger quantization: `python run.py quantize --model <path>`.
   - Add an Admin API endpoint `/admin/quantize` that spawns a background task.
   - Update `lm-admin.html` (from Sub-Plan 3) to display the progress of active quantization jobs.
3. **Validation:**
   - Run a test quantization job on a small dummy model and verify the SSE feed emits progress updates.
