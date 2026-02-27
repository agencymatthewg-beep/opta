# Implementation Plan: Simultaneous Multi-Agent + Skills-Native

**Date:** 2026-02-21
**Status:** Complete — All 6 phases implemented, 114 tests passing (10.55s). Enhancement sprint + Phase F hardening completed 2026-02-27.
**Research:** `docs/research/2026-02-21-multi-agent-skills-native-research.md`

---

## Objective

Implement a production-grade multi-agent runtime in Opta-LMX with native skill lifecycle, strict contracts, bounded concurrency, and optional distributed execution.

---

## Implementation Progress (Snapshot)

### Current State (2026-02-27)

**67 tests passing** across 9 test files. All core subsystems production-ready.

| Phase | Status | Progress Notes |
|---|---|---|
| Phase A — Foundations | **Complete** | Config blocks (`agents`, `skills`, `workers`) and all `agents/*` + `skills/*` modules fully implemented. Strict Pydantic validation, semver support, namespace-qualified naming. |
| Phase B — In-Process Runtime | **Complete** | Bounded queue scheduler (memory + SQLite backends), priority dispatch (`interactive`/`normal`/`batch`), `TaskGroup` concurrency, timeout/cancellation, `parallel_map`/`router`/`handoff` strategies, idempotency, retry logic with exponential backoff. |
| Phase C — APIs + MCP Alignment | **Complete** (core) | All REST endpoints: POST/GET/cancel agent runs, GET/list agent runs (paginated), SSE event streaming, GET/execute skills, MCP tools/list + tools/call, OpenClaw invoke shim. W3C trace context propagation. |
| Phase D — Persistence + Traceability | **Complete** (core) | JSON state store with atomic writes, startup recovery (fail incomplete runs), idempotency index persistence, trace events via NullTracer/LoggingTracer/OpenTelemetryTracer, `traceparent`/`tracestate` propagation. |
| Phase E — Distributed Worker Plane | **Complete** (in-process) | LocalSkillDispatcher + QueuedSkillDispatcher (memory + SQLite backends), worker pool, crash recovery, queue saturation with 429 + Retry-After. |
| Phase F — Hardening + Benchmarks | **Complete** | 114 tests passing (10.55s). Fault injection suite (13 tests: OOM, timeout, retry, cancellation, budget, recovery). SLO benchmarks (11 tests: p95 queue <1.5s, throughput >5 runs/s, error rate <1%, skill success >99%). |

### 2026-02-27 Enhancement Sprint

Implementing the 5 previously deferred items:

1. **Manifest schema breadth** — Adding `skill_id`, `output_schema`, `model_preferences`, `roots` constraints
2. **Budget-aware dispatch** — Token/cost budget tracking and enforcement per run
3. **MCP surface depth** — Prompt/resource exposure, list-changed notifications, MCP capabilities endpoint
4. **Trace/audit depth** — AuditEvent + AuditTrail, cross-service propagation, resumable checkpoint pointers
5. **Phase F hardening** — Fault injection tests, benchmark suite, SLO validation, guardrails

### 2026-02-21 Optimization Hotfixes

1. Queue saturation diagnostics improved for agent submission failures:
   - Scheduler now raises `RunQueueFullError(size, capacity)` with explicit `(current/capacity)` context.
   - Runtime now records a backoff-oriented failure message (`Retry when queue pressure drops.`) when queue saturation blocks submission.
2. Coverage added:
   - Scheduler test validates queue saturation metadata.
   - Runtime test validates failed run state includes queue saturation details.

### Deferred Items (Status as of 2026-02-27)

1. ~~Manifest schema breadth~~ → [x] **COMPLETE** — `skill_id`, `output_schema`, `model_preferences`, `roots` implemented in `skills/manifest.py`, 17 manifest tests passing
2. ~~Budget-aware dispatch~~ → [x] **COMPLETE** — `token_budget`, `cost_budget_usd`, `BudgetExhaustedError` in `agents/runtime.py`, 3 budget tests passing
3. External broker-backed workers (Celery/Redis/RabbitMQ) → [DEFERRED] — in-process worker plane sufficient for current scale
4. ~~MCP surface depth~~ → [x] **COMPLETE** — `prompts/list`, `prompts/get`, `resources/list`, `capabilities` endpoints, 4 MCP tests passing
5. ~~Trace/audit depth~~ → [x] **COMPLETE** — `AuditTrail`, `checkpoint_pointer`, `extract_trace_id` in `agents/tracing.py`, 9 tracing tests passing

---

## Success Criteria

1. [x] Run 5+ concurrent agents with bounded latency and no starvation — SLO benchmark validates p95 queue < 1.5s, starvation prevention tested.
2. [x] Skills are first-class assets with manifest validation, versioning, and permissions — strict Pydantic manifest with semver, 17 manifest tests.
3. [x] Skill discovery/execution APIs follow MCP-aligned primitives — `tools/list`, `tools/call`, `prompts/list`, `resources/list`, `capabilities` endpoints.
4. [x] Agent runs are resumable, traceable, and auditable — `AuditTrail`, `checkpoint_pointer`, startup recovery, W3C trace context.
5. [~] Orchestration scales from single-process to distributed workers without API redesign — in-process scaling proven; external broker path deferred but API contract is stable.

---

## Scope

In scope:

- Agent runtime, scheduler, graph execution, skill registry/executors.
- Config/schema/API additions.
- Observability, policy controls, and tests.
- Optional Celery worker-plane for heavy skills.

Out of scope (for this phase):

- Full GUI workflow builder.
- Cross-cluster federated agent mesh.
- Replacing existing inference engine internals.

---

## Architecture Target

Control plane (LMX API process):

- Agent API (`/v1/agents/*`) and lifecycle management.
- Orchestration graph engine (router/subagent/handoff).
- Skill registry + policy engine.
- State/checkpoint storage and trace propagation.

Data plane:

- In-process execution path for low-latency skills.
- Optional worker queue path (Celery) for heavy/long-running skills.
- Existing inference, rerank, embedding, helper-node integrations reused.

---

## Delivery Phases

## Phase A — Foundations (Schema + Config + Skeleton) — [x] COMPLETE

Deliverables:

1. New config sections in `src/opta_lmx/config.py`:
   - `agents.enabled`
   - `agents.max_parallel_agents`
   - `agents.max_steps_per_run`
   - `agents.default_timeout_sec`
   - `skills.directories`
   - `skills.strict_validation`
   - `skills.allow_shell`
   - `skills.require_approval_tags`
   - `workers.enabled`
   - `workers.broker_url`
   - `workers.result_backend`

2. New modules:
   - `src/opta_lmx/agents/models.py`
   - `src/opta_lmx/agents/runtime.py`
   - `src/opta_lmx/agents/scheduler.py`
   - `src/opta_lmx/agents/graph.py`
   - `src/opta_lmx/agents/state_store.py`
   - `src/opta_lmx/agents/tracing.py`
   - `src/opta_lmx/skills/manifest.py`
   - `src/opta_lmx/skills/registry.py`
   - `src/opta_lmx/skills/loader.py`
   - `src/opta_lmx/skills/executors.py`
   - `src/opta_lmx/skills/policy.py`
   - `src/opta_lmx/skills/mcp_bridge.py`

3. Pydantic skill manifest model (strict mode):
   - `skill_id`, `version`, `kind` (`tool|prompt|workflow`)
   - input/output JSON schema references
   - `permissions` (fs/network/shell)
   - `risk_tags` (`destructive`, `external_side_effect`, etc.)
   - `model_preferences` and `timeouts`
   - `roots` constraints for filesystem access

Acceptance criteria:

- Skill manifest validation rejects coercive/wrong types when strict mode is on.
- Skills can be loaded from configured directories and listed via registry.

---

## Phase B — In-Process Multi-Agent Runtime — [x] COMPLETE

Deliverables:

1. Structured concurrency execution:
   - `TaskGroup` fan-out/fan-in for subagents.
   - `asyncio.Queue(maxsize=...)` for bounded work ingestion.
   - Cancellation propagation and timeout envelopes.

2. Scheduling model:
   - global run queue + per-run step queue.
   - weighted priorities (`interactive`, `normal`, `batch`).
   - budget-aware dispatch using existing inference concurrency controls.

3. Orchestration patterns:
   - Router pattern for delegation.
   - Handoff pattern for active-agent transfer.
   - Parallel subagent map-reduce pattern.

Acceptance criteria:

- Simulated workload test demonstrates no deadlock/starvation with 5+ concurrent runs.
- Failure in one subagent branch cleanly cancels siblings when configured fail-fast.

---

## Phase C — Skills-Native APIs and MCP Alignment — [x] COMPLETE

Deliverables:

1. Agent and skills API routes:
   - `POST /v1/agents/runs`
   - `GET /v1/agents/runs/{run_id}`
   - `POST /v1/agents/runs/{run_id}/cancel`
   - `GET /v1/skills`
   - `GET /v1/skills/{skill_id}`
   - `POST /v1/skills/{skill_id}/execute`

2. MCP-aligned bridge:
   - `skills/list` (mapped to registry list)
   - `skills/call` (mapped to executor call)
   - prompt/resource exposure for skills that define them
   - list-changed notification hook when skills are reloaded

3. Approval and policy gates:
   - mandatory approval for skills tagged high-risk.
   - deny-by-default execution for disallowed capability tags.

Acceptance criteria:

- Skill discovery and invocation work via native API and MCP bridge adapter.
- Sensitive skills cannot execute without explicit approval state.

---

## Phase D — Persistence, Recovery, and Traceability — [x] COMPLETE

Deliverables:

1. Run state persistence:
   - `queued`, `running`, `waiting_approval`, `completed`, `failed`, `cancelled`.
   - step-level event log with inputs/outputs/error metadata.
   - resumable checkpoint pointer per run.

2. Trace context:
   - accept/propagate `traceparent` and `tracestate`.
   - emit trace IDs into logs/metrics/events.

3. Audit surface:
   - who triggered run
   - which skills were invoked
   - approval events and execution timestamps

Acceptance criteria:

- Process restart can recover in-progress runs to terminal or resumable state.
- A single trace ID correlates agent run + skill calls + model requests.

---

## Phase E — Distributed Worker Plane (Optional but Recommended) — [x] COMPLETE (in-process)

Deliverables:

1. Celery worker integration for heavy skills:
   - serializable task payloads
   - idempotency keys
   - retry strategy and dead-letter handling

2. Routing policy:
   - in-process for low-latency/light skills
   - worker-plane for CPU/IO heavy or long-running skills

3. Operational controls:
   - queue depth metrics
   - worker health endpoints
   - run timeout and stuck-task reaper

Acceptance criteria:

- Heavy skill execution no longer blocks API event loop.
- Worker outage degrades gracefully to retriable run state.

---

## Phase F — Hardening and Competitive Benchmarks — [x] COMPLETE

Deliverables:

1. Test matrix:
   - unit tests for scheduler/graph/policy/manifest validation
   - integration tests for agent run lifecycle and skill execution
   - fault injection tests (timeouts, partial failures, worker crash)

2. Benchmarks:
   - agent throughput (runs/min)
   - p95 queue wait
   - p95 time-to-first-action
   - skill success rate
   - recovery time after restart

3. Guardrails:
   - max step count per run
   - max recursion/handoff depth
   - run-level token/cost budget caps

Acceptance criteria:

- Meets baseline SLOs under load test:
  - p95 queue wait < 1.5s for interactive runs
  - <1% failed runs due to orchestration errors (excluding tool/business errors)

---

## Suggested File-Level Work Breakdown

1. `src/opta_lmx/config.py`
   - add `AgentsConfig`, `SkillsConfig`, `WorkersConfig`.

2. `src/opta_lmx/main.py`
   - initialize agent runtime and skill registry.
   - wire background loops and cleanup.

3. `src/opta_lmx/api/agents.py` (new)
   - run lifecycle endpoints.

4. `src/opta_lmx/api/skills.py` (new)
   - skill list/get/execute endpoints.

5. `src/opta_lmx/api/deps.py`
   - dependencies for runtime/registry/policy components.

6. `tests/test_agents_*.py` and `tests/test_skills_*.py` (new)
   - full lifecycle and policy coverage.

---

## Implementation Order (Execution Sequence)

1. Phase A schema + skeleton.
2. Phase B in-process runtime and scheduler.
3. Phase C APIs + MCP-aligned bridge.
4. Phase D persistence + tracing.
5. Phase E distributed workers.
6. Phase F benchmark hardening and SLO sign-off.

---

## Risks and Mitigations

1. Risk: event-loop blocking from heavy skills.
   - Mitigation: strict executor policy + worker offload threshold.

2. Risk: unbounded tool side effects.
   - Mitigation: manifest permission gates + mandatory approval tags.

3. Risk: orchestration complexity regressions.
   - Mitigation: deterministic graph tests + failure injection suite.

4. Risk: model contention under parallel runs.
   - Mitigation: scheduler budgets tied to existing inference semaphore limits.

---

## Definition of Done

1. [x] All phases implemented or explicitly deferred with recorded rationale — Phases A-F complete, external broker workers explicitly deferred.
2. [~] New APIs documented in `docs/plans/API-SPEC.md` — API routes implemented and tested, formal spec doc partially updated.
3. [x] CI covers new agent/skills test suites — 114 tests across 11 test files.
4. [~] Operational runbook updated in `docs/WORKFLOWS.md` — partially updated.
5. Demo scenario proves:
   - [x] parallel multi-agent run — covered by fault injection and SLO benchmark tests
   - [x] skill discovery/execution — covered by skills API and dispatch tests
   - [x] approval-gated high-risk skill — policy gate tests passing
   - [x] trace-linked observability across full run — W3C trace context propagation + audit trail tests

---

## Test Coverage Summary (2026-02-27)

### After Enhancement Sprint (90 tests)

| Test File | Test Count | Status |
|-----------|-----------|--------|
| test_agents_api.py | 9 | All passing |
| test_agents_runtime.py | 17 | All passing (+3 budget tests) |
| test_agents_scheduler.py | 4 | All passing |
| test_agents_state_store.py | 5 | All passing |
| test_agents_tracing.py | 9 | All passing (NEW — audit trail, checkpoint, trace extraction) |
| test_skills_api.py | 14 | All passing (+4 MCP prompts/resources/capabilities) |
| test_skills_dispatch.py | 4 | All passing |
| test_skills_executor.py | 8 | All passing |
| test_skills_manifest.py | 17 | All passing (+7 skill_id, output_schema, model_preferences, roots) |
| test_skills_registry.py | 3 | All passing |
| **Total** | **90** | **All passing (2.11s)** |

### Phase F Hardening (complete)

| Test File | Test Count | Status |
|-----------|-----------|--------|
| test_agents_fault_injection.py | 13 | All passing — OOM, timeout, retry exhaustion, cancellation, budget, recovery, parallelism guardrails |
| test_slo_benchmarks.py | 11 | All passing — p95 queue wait, throughput, skill success rate, recovery time, priority scheduling, starvation, error rate, import errors, dispatch overflow, policy gates |
| **Phase F Total** | **24** | **All passing** |
| **Grand Total** | **114** | **All passing (10.55s)** |

Key scenarios covered: multi-strategy execution, idempotency, queue saturation, cancellation, retry logic, W3C trace context, skill policies, SSE streaming, MCP adapter, argument validation, budget enforcement, audit trails, checkpoint pointers, manifest schema breadth, MCP prompts/resources/capabilities.
