# IMPLEMENTATION — 2026-02-28 — Priority Lane Hardening

## Scope
Follow-up hardening for inference request priority handling:
- Remove remaining `high`-priority bypass semantics.
- Replace with a bounded privileged lane.
- Preserve fairness constraints (global/model/client controls still apply).
- Ensure untrusted headers cannot bypass concurrency controls.
- Add auth/priority tests.

## What changed

### 1) Bounded privileged lane in concurrency controller
**File:** `src/opta_lmx/inference/engine_concurrency.py`

#### Before
- `priority == "high"` bypassed slot acquisition entirely.
- This could skip global and fairness semaphores, enabling abuse and overload under spoofable/requested high priority.

#### After
- Added bounded lane model:
  - Global semaphore always enforced for all requests.
  - Optional reserved high-priority lane (`_high_priority_lane_semaphore`) is used only for `priority == "high"`.
  - Normal traffic uses `_normal_lane_semaphore` only when a high lane is reserved.
  - Model and client semaphores still apply to all requests (including high).
- Added lane wait counters (`_waiting_normal_lane_slot`, `_waiting_high_lane_slot`) into queue depth accounting.
- Added semaphore rebuild helper for adaptive concurrency transitions:
  - `_rebuild_global_semaphores(limit)` now rebuilds global + lane semaphores together.
- High lane sizing policy:
  - `0` reserved slots when concurrency limit `< 3`.
  - `1` reserved slot when concurrency limit `>= 3`.

**Net effect:** `high` is now privileged but bounded; no unlimited bypass path remains.

---

### 2) Preserve per-client fairness in inference API path
**File:** `src/opta_lmx/api/inference.py`

#### Issue found
- API resolved `effective_client_id` (`x-client-id` / `x-openclaw-agent-id`) but did **not** pass it into `engine.generate()` / `engine.stream_generate()`.
- That silently disabled client-level fairness controls for normal API traffic.

#### Fix
- Passed `client_id=effective_client_id` into both streaming and non-streaming inference calls.
- Also aligned busy-path metrics to report `effective_client_id` consistently.

**Net effect:** fairness controls are now actually enforced for API callers.

---

### 3) Added/updated tests

#### New priority lane behavior tests
**File:** `tests/test_concurrency.py`
- `TestPriorityLaneHardening.test_high_priority_is_bounded_by_privileged_lane`
  - Verifies high-priority parallelism is bounded by lane capacity (no bypass).
- `TestPriorityLaneHardening.test_normal_lane_preserves_fairness_capacity`
  - Verifies normal lane capacity is constrained when high lane reservation is active.

#### New auth/priority gating tests
**File:** `tests/test_security_hardening.py`
- `TestInferencePriorityAuth.test_high_priority_without_admin_key_downgrades_to_normal`
- `TestInferencePriorityAuth.test_high_priority_with_wrong_admin_key_downgrades_to_normal`
- `TestInferencePriorityAuth.test_high_priority_with_valid_admin_key_is_allowed`
- `TestInferencePriorityAuth.test_non_high_priority_passes_without_admin_header`

These verify untrusted headers cannot unlock privileged lane behavior.

---

## Validation
Executed:

```bash
.venv/bin/python -m pytest -q tests/test_concurrency.py tests/test_security_hardening.py
```

Result:
- **64 passed**, 0 failed.

---

## Security/abuse outcome
- `X-Priority: high` is no longer an unlimited escape hatch.
- High priority is now an authenticated, bounded, capacity-aware lane.
- Untrusted callers cannot bypass concurrency controls via headers.
- Fairness (client/model/global constraints) remains enforced under both normal and high priority traffic.
