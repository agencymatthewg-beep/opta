# Opta LMX OpenClaw Optimization Backlog

Date: 2026-02-22
Scope: Optimize Opta LMX so any OpenClaw bot can connect reliably, at scale, with predictable performance.
Implementation plan: `docs/plans/2026-02-22-openclaw-full-implementation-plan.md`

## Current Snapshot

Working now:
- OpenAI-style `/v1/chat/completions` and `/v1/models` are implemented.
- OpenAI-compatible `/v1/responses` and OpenClaw invoke shim `/v1/skills/openclaw/invoke` are implemented.
- SSE and WebSocket streaming overload semantics are aligned (`429`/`retry_after` contract).
- Agents runtime and skills runtime now support persistent SQLite queue backends.
- Skill namespacing/version resolution and remote MCP bridge support are implemented.
- Security profile presets, mTLS policy enforcement, tenant-aware quotas, and skill sandbox profiles are implemented.
- Latency-aware adaptive concurrency, warm-pool prefetching, and performance/chaos gates are implemented.
- Sharding and sticky routing controls are implemented.
- Dedicated app CI exists at `.github/workflows/opta-lmx-ci.yml` with lockfile + perf gate wiring.
- Operations pack artifacts are versioned in `docs/ops/monitoring/`.

Known gaps:
- No open items remain in OC-001 through OC-046 backlog scope for this app path.

## Quick Fixes Applied During Investigation

1. Added `user` field to chat completion request schema.
   - File: `src/opta_lmx/inference/schema.py`
2. Added OpenClaw-aware client identity fallback (`x-openclaw-agent-id`, `x-openclaw-session-key`, `user`) for metrics tagging.
   - File: `src/opta_lmx/api/inference.py`
3. Added OpenClaw-aware rate-limit keying preference (stable headers before source IP).
   - File: `src/opta_lmx/api/rate_limit.py`
4. Added streaming overload handling path for 429 alignment and tests covering new behavior.
   - Files: `src/opta_lmx/api/inference.py`, `tests/test_api.py`

## Implementation Progress (This Run)

Implemented now:
- OC-001, OC-002, OC-003, OC-004, OC-005, OC-006, OC-007, OC-008,
  OC-009, OC-010, OC-011, OC-012, OC-013, OC-014, OC-015, OC-016,
  OC-017, OC-018, OC-019, OC-020, OC-021, OC-022, OC-023, OC-024,
  OC-025, OC-026, OC-027, OC-028, OC-029, OC-030, OC-031, OC-032,
  OC-033, OC-034, OC-035, OC-036, OC-037, OC-038, OC-039, OC-040,
  OC-041, OC-042, OC-043, OC-044, OC-045, OC-046.

Still open:
- None.

## Full Improvement Inventory

Priority legend:
- P0: Required for robust production compatibility.
- P1: High-value optimization.
- P2: Strategic or scale maturity.

| ID | Priority | Improvement | Why it matters for OpenClaw bots | Primary files |
|---|---|---|---|---|
| OC-001 | P0 | Add dedicated `tests/test_openclaw_compat.py` contract suite | Prevents regressions against OpenClaw payload/response expectations | `tests/` |
| OC-002 | P0 | Implement/validate OpenAI request fields: `n`, `seed`, `logprobs`, `top_logprobs`, `stream_options` | Many gateways/SDKs pass these fields | `src/opta_lmx/inference/schema.py`, `src/opta_lmx/api/inference.py`, `src/opta_lmx/inference/engine.py` |
| OC-003 | P0 | Add deterministic behavior for unsupported fields (explicit 400 or full support) | Avoids silent incompatibility | `src/opta_lmx/inference/schema.py`, `src/opta_lmx/api/errors.py` |
| OC-004 | P0 | Add `/v1/responses` compatibility endpoint | OpenClaw supports OpenAI Responses API path | `src/opta_lmx/api/inference.py` or new `src/opta_lmx/api/responses.py` |
| OC-005 | P0 | Ensure all overload/saturation paths return consistent `429 + Retry-After` semantics | OpenClaw retry logic depends on clear throttling signals | `src/opta_lmx/api/inference.py`, `src/opta_lmx/inference/streaming.py`, `src/opta_lmx/api/websocket.py` |
| OC-006 | P0 | Add true inference wait-queue depth tracking (not estimate) | Needed to tune multi-bot concurrency | `src/opta_lmx/inference/engine.py`, `src/opta_lmx/api/admin.py`, `src/opta_lmx/monitoring/metrics.py` |
| OC-007 | P0 | Add per-client fairness queueing (weighted fair sharing) | Stops one bot from starving others | `src/opta_lmx/inference/engine.py` |
| OC-008 | P0 | Add per-model concurrency caps | Prevents one hot model from exhausting slots | `src/opta_lmx/inference/engine.py`, `src/opta_lmx/config.py` |
| OC-009 | P0 | Add inference API-key auth (separate from admin key) | Required for non-trusted network or multi-bot deployments | `src/opta_lmx/api/deps.py`, `src/opta_lmx/config.py`, `config/default-config.yaml` |
| OC-010 | P0 | Harden reverse-proxy identity handling (`X-Forwarded-For`, trusted proxies) | Correct rate limits and attribution behind gateway/proxy | `src/opta_lmx/api/rate_limit.py`, `src/opta_lmx/main.py` |
| OC-011 | P0 | Add OpenClaw load profile test (6+ bots concurrent) | Validates target architecture behavior | `tests/`, `scripts/` |
| OC-012 | P0 | Add GGUF tools/`response_format` parity with MLX path | Avoids feature drift when bots target GGUF models | `src/opta_lmx/inference/gguf_backend.py` |
| OC-013 | P0 | Add API-level signal for agents queue saturation (429/503 with machine code) | OpenClaw-style orchestration can handle backpressure better | `src/opta_lmx/api/agents.py`, `src/opta_lmx/agents/runtime.py` |
| OC-014 | P0 | Add idempotency key for `/v1/agents/runs` creation | Safe retries under network errors | `src/opta_lmx/api/agents.py`, `src/opta_lmx/agents/state_store.py` |
| OC-015 | P0 | Add skill argument schema validation | Prevents runtime failures from bad tool args | `src/opta_lmx/skills/manifest.py`, `src/opta_lmx/api/skills.py`, `src/opta_lmx/skills/executors.py` |
| OC-016 | P0 | Add structured skill dispatch overload errors (`code`, `retry_after`) | Better automatic retry behavior for bots | `src/opta_lmx/skills/dispatch.py`, `src/opta_lmx/api/skills.py` |
| OC-017 | P0 | Add OpenTelemetry spans for request/run/skill lifecycle | Cross-system tracing with OpenClaw gateways | `src/opta_lmx/api/middleware.py`, `src/opta_lmx/agents/tracing.py` |
| OC-018 | P0 | Add explicit OpenClaw integration doc + compatibility matrix | Speeds setup and reduces config mistakes | `docs/ECOSYSTEM.md`, `docs/WORKFLOWS.md` |
| OC-019 | P1 | Add `GET /v1/models/{id}` and richer model metadata | Better model capability introspection by clients | `src/opta_lmx/api/inference.py` |
| OC-020 | P1 | Add model name normalization hooks (`provider/model`, alias transforms) | Smoothes gateway naming differences | `src/opta_lmx/router/strategy.py`, `src/opta_lmx/config.py` |
| OC-021 | P1 | Add `stream_options.include_usage` terminal chunk support | Improves accounting in streaming clients | `src/opta_lmx/inference/streaming.py`, `src/opta_lmx/api/inference.py` |
| OC-022 | P1 | Add SSE heartbeat comments for long generations | Reduces idle disconnects through proxies | `src/opta_lmx/inference/streaming.py` |
| OC-023 | P1 | Add structured mid-stream error chunk contract (machine-readable) | Better bot-side handling than free-text `[Error: ...]` | `src/opta_lmx/inference/streaming.py` |
| OC-024 | P1 | Add WebSocket overload semantics parity with HTTP (`retry_after`, error code) | Consistent retry behavior across transports | `src/opta_lmx/api/websocket.py` |
| OC-025 | P1 | Add run event stream endpoint for agents (`/v1/agents/runs/{id}/events`) | Enables live orchestration UI/monitoring | `src/opta_lmx/api/agents.py`, `src/opta_lmx/agents/runtime.py` |
| OC-026 | P1 | Add retries/backoff policy for failed agent steps | Improves completion under transient inference faults | `src/opta_lmx/agents/runtime.py`, `src/opta_lmx/agents/graph.py` |
| OC-027 | P1 | Add per-role prompt templates/tool constraints in agents | Better specialization for bot roles | `src/opta_lmx/agents/models.py`, `src/opta_lmx/agents/runtime.py` |
| OC-028 | P1 | Add persistent queue backend option (Redis/Celery) for skills and runs | Reliability across restarts and spikes | `src/opta_lmx/config.py`, `src/opta_lmx/main.py` |
| OC-029 | P1 | Add skill namespacing/versioning | Safe evolution of tool contracts | `src/opta_lmx/skills/manifest.py`, `src/opta_lmx/skills/registry.py` |
| OC-030 | P1 | Add remote MCP connector bridge for external skill hosts | Lets OpenClaw-style tools live outside LMX process | `src/opta_lmx/skills/mcp_bridge.py`, `src/opta_lmx/api/skills.py` |
| OC-031 | P1 | Add security policy profiles (`lan`, `trusted-gateway`, `internet`) | Faster safe deployment defaults | `src/opta_lmx/config.py`, `config/default-config.yaml` |
| OC-032 | P1 | Add request budget guardrails (prompt token admission control) | Prevents runaway requests from destabilizing service | `src/opta_lmx/inference/context.py`, `src/opta_lmx/api/inference.py` |
| OC-033 | P1 | Add latency-aware adaptive concurrency (not only memory-aware) | Better throughput under variable models/prompts | `src/opta_lmx/inference/engine.py`, `src/opta_lmx/monitoring/metrics.py` |
| OC-034 | P1 | Add model warm-pool and prefetch strategy for anticipated bot traffic | Reduces cold-start latency | `src/opta_lmx/inference/engine.py`, `src/opta_lmx/manager/model.py` |
| OC-035 | P1 | Add chaos tests for cancellation/timeouts/queue pressure | Verifies resilience under failure modes | `tests/` |
| OC-036 | P1 | Expand CI matrix with optional dependency groups (`rag`, `gguf`, `ratelimit`) | Prevents integration drift hidden by minimal env | `.github/workflows/opta-lmx-ci.yml` |
| OC-037 | P1 | Use lockfile-driven dependency install in CI | Improves reproducibility | `pyproject.toml`, `requirements-dev.txt`, `.github/workflows/opta-lmx-ci.yml` |
| OC-038 | P1 | Add performance regression gates (p95 latency/throughput) | Protects OpenClaw bot UX under updates | `tests/`, `scripts/`, CI workflow |
| OC-039 | P2 | Add multi-instance sharding strategy (router + sticky model placement) | Scales beyond single host constraints | `src/opta_lmx/router/strategy.py`, deployment docs |
| OC-040 | P2 | Add mTLS between gateway and LMX | Strong service-to-service trust | reverse proxy + app config/docs |
| OC-041 | P2 | Add tenant-aware quotas and limits | Safer shared deployments | `src/opta_lmx/api/rate_limit.py`, `src/opta_lmx/config.py` |
| OC-042 | P2 | Add skill sandbox profiles (seccomp/containerized runners) | Safer execution for untrusted skill code | `src/opta_lmx/skills/executors.py` and worker runtime |
| OC-043 | P2 | Add admin dashboards and alerting packs (Prometheus/Grafana) | Faster operations and incident response | `docs/`, monitoring deployment files |
| OC-044 | P2 | Add long-horizon run analytics (success rate by role/model/tool) | Data-driven optimization for bot fleets | `src/opta_lmx/monitoring/metrics.py`, state store exports |
| OC-045 | P2 | Add formal deprecation/version policy for API behavior | Keeps OpenClaw integrations stable over time | `docs/plans/API-SPEC.md`, `docs/DECISIONS.md` |
| OC-046 | P2 | Add compatibility shim for OpenClaw tools invoke patterns when needed | Easier direct tool-runtime interop options | `src/opta_lmx/api/skills.py` or dedicated adapter |

## Execution Order (Recommended)

1. P0 compatibility and overload semantics (OC-001 through OC-018).
2. P1 reliability/performance hardening (OC-019 through OC-038).
3. P2 scale/security maturity (OC-039 through OC-046).

## Notes

- This backlog assumes OpenClaw remains upstream and Opta LMX adapts for compatibility.
- Revisit fork decision only if required behavior cannot be achieved via provider/gateway configuration and thin compatibility shims.
