# Opta LMX OpenClaw Full Implementation Plan

Date: 2026-02-22
Status: Completed (execution run closed 2026-02-22)
Backlog source: `docs/plans/2026-02-22-openclaw-optimization-backlog.md`
Goal: deliver full OpenClaw-ready functionality with no compromise on protocol compatibility, reliability, security, performance, and operations.

Execution snapshot (2026-02-22 run):
- Completed: OC-001 through OC-046.
- Remaining: None.

Completion evidence:
- CI reproducibility and perf-gate wiring: `.github/workflows/opta-lmx-ci.yml`, `requirements-ci-lock.txt`, `tests/test_perf_gate.py`.
- Queue persistence + skills/runtime hardening: `src/opta_lmx/agents/scheduler.py`, `src/opta_lmx/skills/dispatch.py`, `src/opta_lmx/skills/registry.py`, `src/opta_lmx/skills/mcp_bridge.py`.
- Security/scale controls: `src/opta_lmx/config.py`, `src/opta_lmx/api/middleware.py`, `src/opta_lmx/api/rate_limit.py`, `src/opta_lmx/router/strategy.py`.
- Operations and governance closeout: `docs/ops/monitoring/`, `docs/plans/API-SPEC.md`, `docs/DECISIONS.md`.

## 1. Success Definition (No Compromise)

The project is complete only when all conditions below are true.

1. Protocol compatibility
- OpenAI-compatible endpoints required by OpenClaw are implemented and validated (`/v1/chat/completions`, `/v1/models`, `/v1/responses`).
- Request and response behavior for required fields is deterministic (supported or explicit 4xx for unsupported).
- Streaming behavior is stable across SSE and WebSocket with consistent overload semantics.

2. Reliability
- Backpressure and overload paths return machine-readable retry guidance.
- Fairness controls prevent one bot from starving others.
- Agent and skill queues provide robust saturation behavior and observability.

3. Security
- Inference auth is configurable and production-ready.
- Trusted proxy and client identity handling are correct.
- Tenant-aware limits and secure transport controls exist for non-LAN deployments.

4. Performance and scale
- Multi-bot load profile targets pass with confidence.
- Regression gates for latency and throughput are in CI.
- Scale architecture path (sharding and routing strategy) is documented and validated.

5. Operability
- End-to-end tracing and dashboard visibility exist.
- Alerting and run analytics provide actionable operations signals.
- Compatibility matrix and deprecation policy are published.

## 2. Workstreams

WS-A: API and protocol parity  
WS-B: Inference scheduling, fairness, and performance  
WS-C: Agents runtime hardening  
WS-D: Skills runtime hardening  
WS-E: Security and tenancy  
WS-F: Observability and operations  
WS-G: CI, quality, and governance

## 3. Phase Plan (All 46 backlog items mapped)

| Phase | Scope | Backlog IDs |
|---|---|---|
| Phase 0 | Program controls and baseline quality rails | OC-001, OC-018, OC-036, OC-037 |
| Phase 1 | API and protocol parity | OC-002, OC-003, OC-004, OC-005, OC-012, OC-019, OC-020, OC-021, OC-022, OC-023, OC-024, OC-046 |
| Phase 2 | Backpressure, fairness, and performance core | OC-006, OC-007, OC-008, OC-011, OC-032, OC-033, OC-034, OC-038 |
| Phase 3 | Agents runtime productionization | OC-013, OC-014, OC-025, OC-026, OC-027, OC-028 |
| Phase 4 | Skills runtime productionization | OC-015, OC-016, OC-029, OC-030, OC-042 |
| Phase 5 | Security and tenancy hardening | OC-009, OC-010, OC-031, OC-040, OC-041 |
| Phase 6 | Observability and operations maturity | OC-017, OC-043, OC-044 |
| Phase 7 | System resilience, scale architecture, governance closeout | OC-035, OC-039, OC-045 |

## 4. Detailed Phase Execution

## Phase 0 - Program Controls and Baseline

Objectives:
- Establish conformance and quality harnesses before broad feature work.
- Ensure every later phase is gated by testable outcomes.

Implementation:
1. Add OpenClaw compatibility contract suite skeleton and fixtures.
2. Publish compatibility matrix doc and fill current status.
3. Expand CI to run required suites across dependency groups.
4. Move CI dependency install to reproducible lockfile workflow.

Primary files:
- `tests/test_openclaw_compat.py` (new)
- `.github/workflows/opta-lmx-ci.yml`
- `docs/ECOSYSTEM.md`
- `docs/WORKFLOWS.md`

Exit gate:
- Compatibility test harness exists and runs in CI.
- CI is reproducible and green in baseline branch.

## Phase 1 - API and Protocol Parity

Objectives:
- Achieve predictable OpenAI/OpenClaw API behavior across HTTP and streaming paths.

Implementation packages:
1. Schema expansion and deterministic behavior:
- Implement `n`, `seed`, `logprobs`, `top_logprobs`, `stream_options`.
- Define strict policy for unsupported options with explicit error responses.

2. Responses API:
- Implement `/v1/responses` endpoint with compatibility adapter over existing inference path.

3. Streaming consistency:
- Align overload and retry contract for SSE and WebSocket.
- Add heartbeat and structured error chunk behavior.
- Implement `stream_options.include_usage`.

4. Model metadata improvements:
- Add `GET /v1/models/{id}`.
- Add richer model capability metadata and name normalization utilities.

5. GGUF parity:
- Ensure GGUF path honors tools and `response_format` contract with MLX-equivalent behavior.

Primary files:
- `src/opta_lmx/inference/schema.py`
- `src/opta_lmx/api/inference.py`
- `src/opta_lmx/api/websocket.py`
- `src/opta_lmx/inference/streaming.py`
- `src/opta_lmx/inference/gguf_backend.py`
- `src/opta_lmx/router/strategy.py`
- `src/opta_lmx/api/errors.py`

Exit gate:
- OpenClaw compatibility suite passes for API protocol layer.
- HTTP and WS overload tests show uniform machine-readable retry behavior.
- No silent parameter drop for required fields.

## Phase 2 - Backpressure, Fairness, and Performance Core

Objectives:
- Make multi-bot behavior stable and fair under contention.

Implementation packages:
1. Queue instrumentation:
- Add true inference wait queue tracking.
- Expose accurate queue depth in metrics and admin endpoints.

2. Fair scheduling:
- Add per-client and per-model concurrency controls.
- Implement fairness policy (weighted fair or equivalent) for inference slots.

3. Budget and admission controls:
- Add prompt token budget guardrails and input admission checks.

4. Performance adaptation:
- Add latency-aware adaptive concurrency.
- Add model warm-pool and prefetch logic.

5. Load profile and regression gates:
- Implement 6+ bot load profile tests.
- Add p95 latency/throughput thresholds in CI.

Primary files:
- `src/opta_lmx/inference/engine.py`
- `src/opta_lmx/monitoring/metrics.py`
- `src/opta_lmx/api/admin.py`
- `src/opta_lmx/inference/context.py`
- `tests/`
- `scripts/`

Exit gate:
- Load test passes with stable success rate and bounded latency.
- Fairness tests demonstrate no starvation.
- Performance gates run in CI and pass.

## Phase 3 - Agents Runtime Productionization

Objectives:
- Make agent orchestration safe for retries, saturation, and live monitoring.

Implementation packages:
1. Saturation and retry contract:
- Return machine-readable queue saturation errors from agents API.

2. Idempotency:
- Add idempotency key support for run creation and deduplicate duplicate submits.

3. Run observability:
- Add run event stream endpoint.

4. Reliability:
- Add step retry and backoff policy for transient failures.
- Add role-specific templates and execution constraints.

5. Persistence:
- Add external queue backend path for higher reliability workloads.

Primary files:
- `src/opta_lmx/api/agents.py`
- `src/opta_lmx/agents/runtime.py`
- `src/opta_lmx/agents/graph.py`
- `src/opta_lmx/agents/state_store.py`
- `src/opta_lmx/config.py`
- `src/opta_lmx/main.py`

Exit gate:
- Duplicate requests are idempotent.
- Queue pressure is surfaced with machine-readable contract.
- Live run streaming and retries work under failure injection tests.

## Phase 4 - Skills Runtime Productionization

Objectives:
- Make tool execution deterministic, safe, and evolvable.

Implementation packages:
1. Argument schema:
- Add structured input schema to manifests and enforce validation.

2. Overload behavior:
- Replace generic queue-full errors with structured retry responses.

3. Versioning and namespacing:
- Add skill name/version conventions for safe contract evolution.

4. External tool plane:
- Add remote MCP bridge connector support.

5. Sandboxing:
- Add hardened skill execution profiles for untrusted entrypoints.

Primary files:
- `src/opta_lmx/skills/manifest.py`
- `src/opta_lmx/api/skills.py`
- `src/opta_lmx/skills/dispatch.py`
- `src/opta_lmx/skills/registry.py`
- `src/opta_lmx/skills/executors.py`
- `src/opta_lmx/skills/mcp_bridge.py`

Exit gate:
- Skill execution is fully schema-validated.
- Overload and policy outcomes are machine-readable.
- Sandboxed profile passes security and functionality tests.

## Phase 5 - Security and Tenancy Hardening

Objectives:
- Move from trusted-LAN defaults to production-safe deployment options.

Implementation packages:
1. Inference auth:
- Add configurable API key auth for inference endpoints.

2. Proxy identity trust:
- Implement trusted proxy list and correct client identity extraction.

3. Deployment security profiles:
- Add policy presets (`lan`, `trusted-gateway`, `internet`).

4. Transport security:
- Add documented and tested mTLS option between gateway and LMX.

5. Tenant controls:
- Add tenant-aware quotas and rate limits.

Primary files:
- `src/opta_lmx/api/deps.py`
- `src/opta_lmx/api/rate_limit.py`
- `src/opta_lmx/config.py`
- `src/opta_lmx/main.py`
- `config/default-config.yaml`
- deployment docs

Exit gate:
- Auth and tenant controls validated in integration tests.
- Proxy identity correctness proven in test matrix.
- Security profiles documented and runnable.

## Phase 6 - Observability and Operations Maturity

Objectives:
- Provide complete runtime visibility and actionable operations data.

Implementation packages:
1. Tracing:
- Add OpenTelemetry spans for request, run, and skill lifecycle.

2. Dashboards and alerts:
- Provide Prometheus/Grafana dashboards and baseline alerts.

3. Analytics:
- Add long-horizon analytics for success/failure by role, model, and tool.

Primary files:
- `src/opta_lmx/api/middleware.py`
- `src/opta_lmx/agents/tracing.py`
- `src/opta_lmx/monitoring/metrics.py`
- monitoring docs/config

Exit gate:
- End-to-end traces visible across API, agents, and skills.
- Alert packs and dashboards are versioned and deployable.

## Phase 7 - Resilience, Scale Architecture, and Governance Closeout

Objectives:
- Finalize long-term stability and lifecycle management.

Implementation packages:
1. Chaos suite:
- Add cancellation, timeout, queue-pressure, and dependency-failure chaos tests.

2. Scale architecture:
- Finalize and validate multi-instance sharding and sticky routing strategy.

3. API lifecycle:
- Publish and enforce deprecation/version policy.

Primary files:
- `tests/`
- `src/opta_lmx/router/strategy.py`
- `docs/plans/API-SPEC.md`
- `docs/DECISIONS.md`

Exit gate:
- Chaos tests pass in CI.
- Multi-instance strategy validated by load profile.
- Version policy adopted and referenced by API docs.

## 5. Parallelization Strategy

Execution can run in parallel by workstream once Phase 0 is complete.

Parallel group A:
- WS-A (API parity), WS-B (scheduling/perf), WS-G (CI/gates)

Parallel group B:
- WS-C (agents), WS-D (skills) after WS-A base contracts are stable

Parallel group C:
- WS-E (security), WS-F (observability) after initial API and runtime behavior is stable

Rule:
- No phase exits without passing automated gate criteria.
- No compromise overrides for failing security, conformance, or reliability gates.

## 6. Test and Validation Matrix

Required test layers:
1. Unit tests
- Schema handling, parser behavior, queueing, policies.

2. Integration tests
- Endpoint behavior, agent/skill execution paths, auth and rate limits.

3. Compatibility tests
- OpenClaw payload and response contracts, including retry and error semantics.

4. Load and soak tests
- 6+ concurrent bot profile, long-running stability.

5. Chaos tests
- Forced cancellations, timeouts, worker failures, queue saturation.

CI gating:
- Fast lane on pull requests: lint, typecheck, unit and key integration.
- Full lane on main/nightly: compatibility, load profile, chaos subset, performance thresholds.

## 7. Delivery Milestones

M1 (end Phase 1):
- Protocol-complete API behavior for OpenClaw target paths.

M2 (end Phase 2):
- Fair and stable multi-bot inference under sustained load.

M3 (end Phase 4):
- Agents and skills are production-safe and operationally observable.

M4 (end Phase 6):
- Security and operations are production-grade.

M5 (end Phase 7):
- Resilience, scale path, and governance fully closed.

## 8. Risk Register and Mitigations

1. Protocol drift between OpenClaw and LMX
- Mitigation: contract tests in CI and explicit compatibility matrix ownership.

2. Performance regressions from added controls
- Mitigation: p95 regression gates and load tests on every release candidate.

3. Security hardening breaking existing local flows
- Mitigation: profile-based rollout (`lan` defaults plus stricter profiles).

4. Queue fairness adding latency for interactive clients
- Mitigation: weighted fairness and priority classes with strict tests.

5. External worker complexity
- Mitigation: keep in-process defaults, add worker backend as controlled profile.

## 9. Release and Rollout Plan

1. Local validation
- Full suite in dev environment with compatibility and load tests.

2. Canary
- Route subset of OpenClaw traffic to new build, monitor error and latency deltas.

3. Staged rollout
- Increase traffic only when gates hold for 24h windows.

4. Full rollout
- Promote when all SLO and compatibility criteria are met.

5. Post-rollout audit
- Verify dashboards, alerts, and deprecation policy enforcement.

## 10. Definition of Done Checklist (Project Close)

- [x] All OC-001 through OC-046 implemented and merged.
- [x] All phase exit gates passed.
- [x] No open P0 or P1 defects in current backlog scope.
- [x] Compatibility suite green against current OpenClaw contract.
- [x] Security profiles and operations docs published.
- [x] Performance and reliability targets met in load and soak tests.
