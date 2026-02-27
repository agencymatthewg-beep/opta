# OpenClaw x Opta-LMX Readiness Investigation

Date: 2026-02-22  
Status: Investigated (protocol-ready, integration-partial)

## Scope

Assess whether Opta-LMX is currently optimal for OpenClaw bot workloads:

1. API/protocol compatibility.
2. OpenClaw-side integration path.
3. Concurrent multi-agent + skills runtime readiness.
4. Test/CI coverage quality.

## Evidence Summary

### 1) Protocol Compatibility: Strong

- OpenAI compatibility is an explicit project decision:
  - `docs/DECISIONS.md` (Decision D-05: exact `/v1/chat/completions`, `/v1/models`, SSE format).
- Inference API surface is implemented:
  - `src/opta_lmx/api/inference.py` (`/v1/chat/completions`, `/v1/models`).
- Streaming contract is implemented and tested:
  - `src/opta_lmx/inference/streaming.py`
  - `tests/test_sse_integration.py`
- Tool-calling compatibility exists:
  - `src/opta_lmx/inference/tool_parser.py` (MiniMax XML -> OpenAI `tool_calls`).
- Anthropic compatibility exists:
  - `src/opta_lmx/api/anthropic.py`
  - `tests/test_anthropic.py`

### 2) OpenClaw Integration Path: Gateway-Mediated

- OptaPlus uses OpenClaw gateway WebSocket protocol, not direct LMX HTTP:
  - `../1I-OptaPlus/Shared/Sources/OptaMolt/Networking/OpenClawClient.swift`
  - `../1I-OptaPlus/Shared/Sources/OptaMolt/Networking/ChatViewModel.swift`
- LMX docs define bot-side gateway config path for LMX-backed inference:
  - `docs/ECOSYSTEM.md` (OpenClaw integration checklist, network architecture, `lm_studio_url`/OpenAI base mapping).

### 3) Concurrent Runtime Readiness: Good Foundation, Not Fully Productized

- Agent queue is bounded + priority-based:
  - `src/opta_lmx/agents/scheduler.py`
- Multi-agent strategies and parallelism controls exist:
  - `src/opta_lmx/agents/graph.py`
  - `src/opta_lmx/agents/runtime.py`
- Inference concurrency controls and high-priority bypass exist:
  - `src/opta_lmx/inference/engine.py`
- Skills queue dispatcher exists for worker-mode execution:
  - `src/opta_lmx/skills/dispatch.py`
  - `src/opta_lmx/main.py`

### 4) Coverage/CI: Strong General Coverage, Missing OpenClaw-Specific Contract Test

- Concurrency tests exist:
  - `tests/test_concurrency.py`
- API/streaming coverage exists:
  - `tests/test_api.py`, `tests/test_sse_integration.py`, `tests/test_websocket.py`
- Dedicated app-path CI exists:
  - `/Users/matthewbyrden/Synced/Opta/.github/workflows/opta-lmx-ci.yml`
- No OpenClaw-specific test file currently exists under `tests/` (no OpenClaw references).

## Verdict

Opta-LMX is **protocol-ready** for OpenClaw-style LLM traffic, but **not yet fully optimized end-to-end** for OpenClaw deployment because Phase 5B integration and bot-matrix validation remain incomplete.

## Primary Gaps Blocking “Optimal”

1. No explicit OpenClaw compatibility regression suite (payload/stream behavior from gateway-shaped traffic).
2. Integration checklist items for six-bot validation remain open (`docs/ECOSYSTEM.md`).
3. Backpressure signaling for saturation needs clearer API semantics for orchestrators during burst load.

## High-Impact Next Actions

1. Add `tests/test_openclaw_compat.py`:
   - Validate representative OpenClaw bot payloads against `/v1/chat/completions`.
   - Assert streaming sequence and tool-call deltas.
2. Execute six-bot gateway-to-LMX soak/compat run and record outcomes in `docs/ECOSYSTEM.md`.
3. Improve overload signaling in agents/skills paths (queue saturation should produce deterministic throttling semantics for orchestrators).

## Notes

- Queue saturation diagnostics were improved in current code via `RunQueueFullError(size, capacity)` and runtime failure context updates:
  - `src/opta_lmx/agents/scheduler.py`
  - `src/opta_lmx/agents/runtime.py`
- Associated tests were added:
  - `tests/test_agents_scheduler.py`
  - `tests/test_agents_runtime.py`
