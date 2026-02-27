# GLM Runtime Compatibility Debug (2026-02-23)

## Problem statement
- `POST /admin/models/load` for `inferencerlabs/GLM-5-MLX-4.8bit` can drop the connection or destabilize the process.
- Repeated unstable starts can trip runtime crash-loop safe mode.

## Why this is runtime compatibility, not download corruption
- Existing snapshot-integrity checks already verify local artifact completeness.
- Failure pattern is load-time engine bring-up instability (not deterministic missing-file errors).
- Prior evidence in this repo shows complete artifacts with process-level abort/timeout behavior during load.

## Root-cause conclusion
- High confidence: GLM signatures that resolve to `glm_moe_dsa` are currently load-unstable on the active runtime stack.
- Failure mode occurs during MLX engine initialization path, before stable serving state.

## Hardening implemented
1. Added model config preflight in inference engine:
   - Reads `config.json` from local path or HF cache.
   - Extracts `model_type` / `architectures`.
   - Detects blocked runtime signatures (`glm_moe_dsa`).
2. Added deterministic guardrail:
   - Default behavior: block known-unsafe model load before native engine bring-up.
   - Raises explicit compatibility error instead of attempting risky initialization.
3. Added explicit override for controlled debugging:
   - New admin request flag: `allow_unsupported_runtime` (default `false`).
   - When `true`, load attempt proceeds with warning logs.
4. Added API-level error mapping:
   - Compatibility failure now returns `400` with code `model_runtime_incompatible`.

## Verification
- Targeted tests pass:
  - `tests/test_admin.py` (new runtime-incompatible mapping + override forwarding)
  - `tests/test_gguf.py` (new compatibility detection + block/override behavior)
- Combined result:
  - `64 passed` across updated admin + gguf suites.

## Operational impact
- Prevents known crash-prone GLM load attempts from taking down runtime by default.
- Keeps an explicit, auditable escape hatch for manual experiments.
- Reduces chance of entering crash-loop safe mode from this known signature class.
