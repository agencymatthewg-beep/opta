# Opta-LMX Operational Playbook — Model Admission, Readiness, and Quarantine

## Purpose
This runbook defines how operators load models safely, interpret readiness states, and recover from unstable/crash-looping model behavior.

## Readiness State Machine
- `admitted` — request accepted by gate
- `loading` — backend initialization in progress
- `canary_pending` — loaded into memory; not yet routable
- `routable` — safe for inference traffic
- `quarantined` — blocked from routing due to instability/incompatibility

Inference traffic is allowed only when state is `routable`.

## Deterministic Error Codes (Operator-facing)
- `model_unsupported_arch` (422)
- `model_unsupported_backend` (422)
- `model_incomplete` (400/409 depending call site)
- `model_not_ready` (409)
- `model_unstable` (409)
- `model_canary_failed` (409)

## Normal Load Workflow
1. `POST /admin/models/load` with `model_id`
2. If missing on disk, confirm/auto-download flow applies
3. On load success, model runs warmup + canary
4. Model becomes routable only after canary passes

## Unsafe Runtime Override (Use Sparingly)
`allow_unsupported_runtime=true` may bypass known runtime blocklist checks for diagnostic testing.

Use only when:
- You understand the specific compatibility risk
- You can tolerate process instability
- You are actively collecting evidence for a backend/model fix

## Quarantine + Crash Containment Behavior
- Repeated runtime inference failures increment per-model failure counter
- Threshold breach auto-transitions model to `quarantined`
- Quarantined models are not routable and return deterministic 409 errors

## Compatibility Registry
Persistent pass/fail metadata:
- Path: `~/.opta-lmx/compatibility-registry.json`
- Recorded fields: model, backend, backend_version, outcome, reason, metadata, timestamp

Use this registry to:
- Build allow/deny recommendations
- Detect regressions after dependency upgrades
- Compare behavior across runtime versions

## Incident Response: Model Unstable / Quarantined
1. Confirm status via `GET /admin/models` readiness fields
2. Check latest compatibility registry entries for same model/backend
3. Unload model if still resident: `POST /admin/models/unload`
4. Load fallback model/preset
5. If needed, run controlled override load with `allow_unsupported_runtime=true` in non-critical window
6. Capture resulting pass/fail in ops notes

## Migration Notes
- Existing clients that only checked `is loaded` should now consider `readiness.state`
- Inference callers should handle `409 model_not_ready/model_unstable`
- Admin automation can safely retry load after transient failures; repeated failures will quarantine model deterministically

## Validation Commands
```bash
.venv/bin/pytest -q tests/test_admin.py tests/test_api.py tests/test_gguf.py
.venv/bin/pytest -q tests/test_gguf.py tests/test_tool_parser.py tests/test_openclaw_compat.py
```

## Rollback Plan
If rollback needed:
1. Revert files touched in this change set
2. Restart service
3. Confirm legacy load/inference behavior
4. Keep compatibility-registry file as historical artifact (optional)
