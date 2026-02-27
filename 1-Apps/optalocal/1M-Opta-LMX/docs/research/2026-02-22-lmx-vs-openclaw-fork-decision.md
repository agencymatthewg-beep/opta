# Decision Analysis: Optimize Opta-LMX vs Fork OpenClaw

Date: 2026-02-22  
Status: Recommended path recorded

## Executive Recommendation

Do **not** fork OpenClaw right now.

Most of the required Opta-LMX fit can be achieved faster and with lower long-term risk by:

1. hardening Opta-LMX overload/telemetry behavior, and  
2. using OpenClaw gateway configuration + existing protocol methods.

Fork only if specific gateway-level capabilities are proven impossible without server changes.

## Why this is the current best path

### A) OpenClaw already exposes configuration and protocol surface needed for integration

- OpenClaw client stack in OptaPlus is gateway-protocol based (not direct LMX API calls):
  - `../1I-OptaPlus/Shared/Sources/OptaMolt/Networking/OpenClawClient.swift`
  - `../1I-OptaPlus/Shared/Sources/OptaMolt/Networking/ChatViewModel.swift`
  - `../1I-OptaPlus/docs/ECOSYSTEM.md`
- Protocol methods used already include operational controls (`config.patch`, `gateway.restart`, `models.list`, `health`, `status`, `sessions.list`, `device.pair`):
  - `../1I-OptaPlus/Shared/Sources/OptaMolt/Networking/OpenClawProtocol.swift`
  - `../1I-OptaPlus/Shared/Sources/OptaMolt/Networking/OpenClawClient.swift`
- Gateway-side behavior is designed to be adjusted via config patching (origins/proxy policy), reducing need for code forks:
  - `../1I-OptaPlus/docs/cloud-relay/plans/SUB-PLAN-B-GATEWAY.md`

### B) Opta-LMX is already intentionally OpenAI-compatible for bot integrations

- Compatibility policy is explicit and non-negotiable:
  - `docs/DECISIONS.md` (D-05)
- Core endpoints are present and tested:
  - `src/opta_lmx/api/inference.py`
  - `src/opta_lmx/inference/streaming.py`
  - `tests/test_api.py`
  - `tests/test_sse_integration.py`
  - `tests/test_anthropic.py`
- Project roadmap explicitly treats OpenClaw integration as deferred validation work, not missing foundational architecture:
  - `docs/ROADMAP.md` (Phase 5B deferred)
  - `docs/plans/MASTER-PLAN.md` (Phase 5B deferred)

### C) Highest-value gaps are in LMX hardening, not gateway replacement

Current operational bottlenecks are local to LMX:

- Streaming branch currently maps broad errors to internal error path instead of clear retry/backoff semantics:
  - `src/opta_lmx/api/inference.py`
- Agents queue saturation signaling can be improved at API boundary:
  - `src/opta_lmx/api/agents.py`
  - `src/opta_lmx/agents/scheduler.py`
  - `src/opta_lmx/agents/runtime.py`
- Skills dispatch queue saturation remains generic runtime failure:
  - `src/opta_lmx/skills/dispatch.py`
- OpenClaw-specific regression coverage is still absent:
  - no dedicated `tests/test_openclaw_compat.py` yet

These are all fixable without forking OpenClaw.

## Decision Matrix

### Option 1: Optimize Opta-LMX + Gateway Config (Recommended now)

- Time to impact: High (fastest).
- Maintenance burden: Low-medium.
- Upstream compatibility risk: Low.
- Control: High for inference/runtime; medium for gateway internals.
- Best when: OpenClaw protocol/config is sufficient and gaps are around queueing, retries, telemetry, tests.

### Option 2: Fork OpenClaw Gateway/Core now

- Time to impact: Medium-low (initially slower).
- Maintenance burden: High (permanent rebase/security/compat tax).
- Upstream compatibility risk: High.
- Control: Maximum.
- Best when: You need non-negotiable gateway behavior that cannot be achieved with config, plugin/hooks, or client-side adaptation.

## Fork Trigger Criteria (Only fork if >=1 is true and verified)

1. Required LMX-specific scheduler semantics must be enforced inside gateway core and cannot be expressed via existing config/methods.
2. Required protocol/event fields for OptaPlus/agents are impossible to deliver without gateway schema changes.
3. Required auth/multi-tenant/security behavior cannot be safely achieved through existing gateway controls.
4. Required attachment/tool transport semantics cannot be implemented via supported methods and break core product flows.

If none are proven, do not fork.

## Recommended Implementation Sequence

1. **Finish no-fork optimization path first**
   - Improve LMX saturation/backpressure signaling for HTTP, SSE, agents, and skills.
   - Add OpenClaw-specific compatibility tests.
   - Validate six-bot load and record outcomes.

2. **Introduce a thin integration layer (if needed)**
   - Keep OpenClaw upstream intact.
   - Maintain only config templates and protocol-safe adapters in Opta repos.

3. **Re-evaluate fork only after measured failures**
   - Run against trigger criteria above.
   - If triggered, scope a minimal fork (targeted patches), not a full divergence.

## Concrete Files to Prioritize Next (No-fork path)

- `src/opta_lmx/api/inference.py`
- `src/opta_lmx/api/websocket.py`
- `src/opta_lmx/api/agents.py`
- `src/opta_lmx/skills/dispatch.py`
- `src/opta_lmx/monitoring/metrics.py`
- `tests/test_openclaw_compat.py` (new)
- `docs/ECOSYSTEM.md` (update with validated 6-bot results)

## External References Consulted

- OpenClaw configuration reference (models/provider config surface):
  - https://docs.openclaw.ai/configuration/reference
- OpenClaw OpenAI HTTP API docs:
  - https://docs.openclaw.ai/api/openai-http-api
- OpenClaw protocol docs:
  - https://docs.openclaw.ai/protocols/typebox-events
  - https://docs.openclaw.ai/protocols/v3/api-reference
