# Opta-LMX Permanent Solutions Plan
Date: 2026-02-23
Owner: Opta Max
Status: Mostly Complete (code hardening done, live hardware validation pending)

## Objective
Implement production-grade permanent solutions for model reliability, compatibility, and operational safety on Mono512.

## Scope (Approved)
1. Model admission gate (integrity + compatibility + readiness state machine)
2. Deterministic error taxonomy for incomplete/unsupported/unstable models
3. Post-load health promotion via canary inference before routing
4. Crash containment and auto-quarantine/rollback on repeated failures
5. Compatibility registry (model x backend x version matrix)
6. Operator runbook + migration docs
7. Guardrail tests

## Workstreams

### WS1 — Compatibility Matrix & Evidence
**Output:** `docs/research/2026-02-23-lmx-compatibility-matrix.md`
- Capture runtime versions and model inventory
- Execute controlled load/unload + canary tests
- Record crash-loop signals and memory footprints
- Evaluate conservative config variants

### WS2 — Code Hardening
**Output:** `docs/research/2026-02-23-lmx-hardening-implementation.md`
- Strengthen snapshot completeness checks
- Add pre-load readiness check hook
- Add deterministic API error code paths

### WS3 — Kimi Repair & Validation
**Output:** `docs/research/2026-02-23-kimi-repair-validation.md`
- Repair corrupted/incomplete download state
- Validate complete shard set
- Run load + canary validation

### WS4 — Full Permanent Solution Integration
**Output:**
- `docs/research/2026-02-23-lmx-permanent-solutions-implementation.md`
- `docs/research/2026-02-23-lmx-operational-playbook.md`

Includes:
- Admission state machine wiring
- Quarantine + rollback automation
- Compatibility registry lifecycle
- Tests + deployment rollout notes

## Definition of Done
- [x] Deterministic failure reasons replace generic 500s for model admission failures — `ErrorCodes` + `AdmissionFailure` in `model_safety.py`
- [x] Canaries gate model routability — `ReadinessTracker` + `_run_load_canary()` in `engine.py`
- [x] Crash-looped models automatically quarantined — `mark_failure()` with `quarantine_threshold` in `ReadinessTracker`
- [ ] Compatibility registry populated for GLM/Kimi/MiniMax on current stack — `CompatibilityRegistry` class exists but needs live hardware validation runs
- [~] Runbook supports day-2 operations — operational playbook published (`docs/research/2026-02-23-lmx-operational-playbook.md`), covers load workflow, error codes, and quarantine; full runbook breadth still expanding
- [x] Core guardrail tests pass — chaos resilience + perf gate suites (`test_chaos_resilience.py`, `test_perf_gate.py`)

## Rollout Sequence
1. Deploy hardening changes to Mono512
2. Validate MiniMax baseline health
3. Validate GLM admission + canary behavior
4. Validate Kimi admission + canary behavior after repair
5. Enable quarantine/rollback controls
6. Publish operator playbook

## Risk Controls
- Safe, reversible changes only
- Keep MiniMax baseline operational during all changes
- Quarantine unsupported models instead of hard-failing service startup
- Preserve auditability via research/implementation reports
