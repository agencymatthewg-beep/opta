# Audit — Feature Regression & Pipeline Sanity
**Date:** 2026-03-01 (Australia/Melbourne)  
**Scope:** `1P-Opta-Code-Desktop` + `1M-Opta-LMX` recent changes  
**Focus:** onboarding/setup wizard paths, daemon connectivity assumptions, packaging/build pipeline sanity  
**Method:** non-destructive local checks only

---

## Executive verdict
- **Desktop core build stability:** ✅ solid (typecheck, unit tests, production build, Tauri bundle all pass locally).
- **Desktop onboarding/setup regression risk:** ⚠️ medium (wizard probe assumptions diverge from current LMX API; hostname handling bug in Rust connectivity test).
- **Desktop e2e coverage health:** ❌ failing smoke test (assertion drift with current UI).
- **LMX runtime test health:** ✅ strong (1094 passed, 1 skipped).
- **LMX CI/lint/type hygiene:** ❌ not release-clean (ruff failure in `src/`, strict mypy backlog large).
- **LMX packaging:** ✅ `uv build` succeeds (sdist + wheel).

---

## Checks executed

### 1P-Opta-Code-Desktop
1. `npm run check:desktop` ✅
   - typecheck pass
   - vitest pass (28/28)
   - vite build pass
2. `cargo test -q` in `src-tauri` ✅
   - 2/2 Rust tests pass
3. `npm run tauri:build` ✅
   - release binary + macOS `.app` + `.dmg` produced successfully
4. `npm run test:e2e` ❌
   - 1 smoke test failed (details below)

### 1M-Opta-LMX
1. `uv run pytest -q` ✅
   - **1094 passed, 1 skipped**
2. `uv build` ✅
   - `dist/opta_lmx-0.1.0.tar.gz`
   - `dist/opta_lmx-0.1.0-py3-none-any.whl`
3. `uv run ruff check src/` ❌
   - 1 error in `src/opta_lmx/api/admin.py`
4. `uv run mypy src` ❌
   - 138 errors across 35 files (strict mode)
5. CI-equivalent type command sanity
   - `uv run mypy src/opta_lmx --ignore-missing-imports` not reached due ruff failing first in combined command

---

## Breakages and exact next fixes

## P0/P1 (fix now)

### 1) Desktop e2e smoke test is out of sync with current UI
**Evidence**
- Failing test: `tests/e2e/smoke.spec.ts`
- Current assertion expects heading: `Opta Code Desktop` (not present).
- Actual page snapshot shows no such heading; app renders ASCII logo + onboarding overlay (`Daemon not detected`).

**Why it matters**
- Pipeline false negatives on every e2e run.
- Masks real regressions because baseline is already red.

**Exact fix**
- Update `tests/e2e/smoke.spec.ts` to assert stable, current selectors:
  - `button[name="Sessions"]`, `button[name="Models"]`, `button[name="Operations"]`
  - `heading[name="Runtime"]`
  - optionally assert onboarding overlay when disconnected (`heading[name="Daemon not detected"]`) OR dismiss it before continuing.

---

### 2) Setup wizard LMX probe uses legacy endpoint (`/health`) while LMX exposes `/healthz`
**Evidence**
- Desktop probe code: `1P-Opta-Code-Desktop/src-tauri/src/setup_wizard.rs` sends `GET /health`.
- LMX routes: `1M-Opta-LMX/src/opta_lmx/api/health.py` defines `/healthz`, `/readyz`, `/admin/health` (no `/health`).

**Why it matters**
- TCP test can pass, but metadata probe (version/model_count/status) becomes unreliable/empty.
- Onboarding confidence signal degrades and can look like a partial failure.

**Exact fix**
- In `setup_wizard.rs`, change request path to `/healthz`.
- Prefer extraction fallback keys:
  - `version`
  - model count: `models_loaded` first, then legacy aliases.
  - `status`
- Optional hardening: if `/healthz` returns parseable JSON, explicitly set `reachable=true` with status.

---

### 3) Wizard TCP test rejects hostname inputs (e.g., `localhost`) due `SocketAddr::from_str`
**Evidence**
- `test_lmx_connection()` and `probe_lmx_server()` parse `"host:port"` with `SocketAddr::from_str`.
- This parser only accepts IP literals, not DNS hostnames.

**Why it matters**
- Valid user entries like `localhost` or `mystudio.local` fail as “Invalid address”.
- Breaks expected onboarding flow for common local setups.

**Exact fix**
- Replace direct `SocketAddr::from_str` parse with resolution via `ToSocketAddrs`:
  - resolve `(host.as_str(), port).to_socket_addrs()`
  - iterate/connect first reachable address with timeout
- Apply to both `test_lmx_connection()` and `probe_lmx_server()`.

---

## P2 (important cleanup)

### 4) Wizard collects `configDir` and `shell` but backend explicitly ignores both
**Evidence**
- `SetupConfig` includes `config_dir` and `shell`.
- File comment in `setup_wizard.rs`: `#[allow(dead_code)] // ... received from JS wizard but not written to conf JSON`.

**Why it matters**
- UX says these are configured, persisted summary shows them, but save path doesn’t persist equivalent values.
- Risk of user trust mismatch and config drift.

**Exact fix options (pick one and align UI copy):**
1. **Implement persistence** into the canonical CLI config schema; or
2. **Remove/disable fields in wizard** until schema support exists; or
3. **Keep fields but label as preview/non-persistent** in Step 3 + Step 4 summary.

---

### 5) LMX CI currently not green due ruff violation in `src/`
**Evidence**
- `uv run ruff check src/` fails with import order issue in:
  - `src/opta_lmx/api/admin.py` (inline import block unsorted)

**Why it matters**
- GitHub `ci.yml` runs `ruff check src/`; this is a hard gate.

**Exact fix**
- Run `ruff check src/opta_lmx/api/admin.py --fix` or manually reorder imports.
- Re-run `ruff check src/`.

---

## P3 (tech debt / quality bar)

### 6) Strict mypy profile is far from passing
**Evidence**
- `uv run mypy src` reports 138 errors / 35 files.
- Includes API typing, protocol mismatches, missing stubs, and model interface drift.

**Why it matters**
- Not an immediate runtime blocker (tests are strong), but high maintenance drag.
- Increases risk for future refactors in inference/session/admin surfaces.

**Exact fix strategy**
- Keep CI on pragmatic mode (`--ignore-missing-imports`) short-term.
- Add a staged strict rollout:
  1. enforce strict on a narrow module set (e.g., `api/health.py`, `helpers/*`)
  2. baseline remaining files with per-module config
  3. burn down by domain (inference → api → sessions → manager)

---

## Packaging/build pipeline sanity summary

### Desktop (Tauri)
- Local release packaging works end-to-end on macOS (binary + app + dmg).
- New signing/notarization workflows look structurally coherent.
- Main risk observed is not packaging itself, but e2e gate drift and onboarding probe assumptions.

### LMX (Python)
- Wheel/sdist packaging works locally (`uv build`).
- Runtime tests are strong.
- Pipeline risk is quality gates (`ruff`, strict typing debt), not packaging mechanics.

---

## Recommended immediate sequence (fastest path to green)
1. Fix Desktop `tests/e2e/smoke.spec.ts` selector drift + onboarding overlay handling.
2. Patch `setup_wizard.rs`:
   - `/health` → `/healthz`
   - hostname resolution via `ToSocketAddrs`
3. Fix LMX ruff import-order issue in `src/opta_lmx/api/admin.py`.
4. Re-run:
   - Desktop: `npm run test:e2e && npm run check:desktop && npm run tauri:build`
   - LMX: `uv run ruff check src/ && uv run pytest -q && uv build`

---

## Optimization scan (beyond asked)
⚠️ Also noticed: setup UX and backend persistence contract are misaligned (`configDir`, `shell`). This is a **product-level trust bug**, not just a code smell. Recommendation: either persist these fields properly in canonical config immediately, or visibly mark them non-persistent to prevent “configured-but-ignored” behavior.

⚠️ Also noticed: Desktop wizard defaults to `192.168.188.11:1234` while app connection defaults use `127.0.0.1:9999` in session hook. Recommendation: unify defaults behind one source-of-truth config contract to avoid first-run confusion and split-brain connection behavior.
