# Opta CLI Mac Studio Model Startup Stability Report

Date: 2026-02-23
Scope: Model discovery, default selection, model loading flow, and remote-client stability when controlling a Mac Studio-hosted LMX from other devices.

## 1. Startup + Model Lifecycle (Observed Code Path)

### 1.1 Client-side startup path

When Opta CLI starts or model workflows are invoked from another device:

1. Config is loaded (`connection.host`, `connection.port`, `connection.adminKey`, `model.default`).
2. LMX admin endpoints are queried for current state:
   - `/admin/models` for loaded models
   - `/admin/models/available` for on-disk models
3. If a model load is requested:
   - CLI posts to `/admin/models/load`
   - then polls `/admin/models` until model appears as loaded.

### 1.2 Default model setting path

Default model is resolved from:

1. Explicit configured `model.default` (if valid)
2. First loaded model from `/admin/models` fallback
3. First on-disk model from `/admin/models/available` fallback

This keeps chat/model commands operable even when no explicit default has been set.

### 1.3 Use path in model manager

The interactive model manager flow is:

1. Build model catalog from loaded + on-disk inventory
2. Select model
3. Call `ensureModelLoaded(...)`
4. Persist default model + context limit

## 2. Root Cause of Instability

The failing behavior shown (`request timed out after 15s`) came from the LMX client’s generic HTTP timeout being applied to model-load POST requests.

Key issue:

- Load operations for very large models can take longer than 15s before the server responds.
- Client timed out before receiving the load response, even though the server-side load could still be in progress.
- This produced false-negative load failures in remote startup/model-manager workflows.

## 3. Stability Hardening Implemented

### 3.1 Per-request timeout overrides in LMX client

`LmxClient` now supports request-level timeout/retry overrides in its internal fetch path.

Impact:

- Long-running model load/unload requests can use longer timeout windows without changing global behavior of fast endpoints.

### 3.2 Load request timeout now follows lifecycle timeout

`ensureModelLoaded(...)` now passes an explicit timeout into `client.loadModel(...)` based on lifecycle load timeout.

Impact:

- If a load flow is configured to wait longer (e.g., 300s), the POST load request no longer hard-fails at 15s.

### 3.3 Timeout-resilient loading

`ensureModelLoaded(...)` now treats *client-side load request timeout* as non-fatal and continues readiness polling.

Impact:

- If POST response times out locally but load continues on server, CLI can still detect success via `/admin/models` polling.
- Generic connection failures (e.g., unreachable host) are still treated as hard errors.

### 3.4 Longer stability timeout for interactive load flows

Interactive/CLI model load paths now use a stable load timeout window of 300s:

- `opta models` load/swap flows
- `/load` slash flow
- `/model` on-disk load flow

Impact:

- Large model loads on Mac Studio are less likely to fail due premature client timeout when controlled remotely.

## 4. Verification Evidence

Commands run after implementation:

1. Targeted tests:

- `npx vitest run tests/lmx/client.test.ts tests/lmx/model-lifecycle.test.ts tests/commands/models.test.ts tests/commands/slash-smoke.test.ts`
- Result: passed (`4` files, `39` tests)

2. Typecheck:

- `npm run -s typecheck`
- Result: passed

3. Build:

- `npm run -s build`
- Result: passed

## 5. Remaining Operational Recommendations

1. Prefer model-load commands that preserve polling behavior (`opta models`, `/load`, `/model`) for large models.
2. Keep Mac Studio LMX endpoint stable and reachable over LAN/VPN to avoid true transport failures.
3. For very large models, expect minutes-scale cold loads and rely on CLI progress + polling rather than single-request response timing.
