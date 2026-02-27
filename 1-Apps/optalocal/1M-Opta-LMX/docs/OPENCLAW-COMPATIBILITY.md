# OpenClaw Compatibility Matrix

Updated: 2026-02-22
Primary contract tests: `tests/test_openclaw_compat.py`

## Endpoint Compatibility

| Capability | Status | Notes |
|---|---|---|
| `POST /v1/chat/completions` | Supported | Streaming + non-streaming; OpenClaw identity headers accepted. |
| `GET /v1/models` | Supported | OpenAI-style list. |
| `GET /v1/models/{id}` | Supported | Direct lookup for loaded model IDs. |
| `POST /v1/responses` | Supported | Compatibility adapter implemented for non-streaming and SSE streaming. |
| `POST /v1/agents/runs` | Supported | Includes queue saturation contract (`429`, machine-readable code) and idempotency key handling. |
| `GET /v1/agents/runs/{id}/events` | Supported | SSE run-update stream (`run.update`, `run.completed`). |
| `POST /v1/completions` | Not supported | Returns 501 with guidance to `/v1/chat/completions`. |
| WebSocket `/v1/chat/stream` | Supported | Includes overload retry metadata (`rate_limit_exceeded`, `retry_after`) and optional inference API-key auth. |

## Parameter Compatibility (Chat)

| Parameter | Status | Behavior |
|---|---|---|
| `model` | Supported | Alias resolution + loaded model validation. |
| Provider-prefixed models (`provider/model`) | Supported | Normalization hook can map provider aliases to loaded model IDs. |
| `messages` | Supported | Text and multimodal content. |
| `tools`, `tool_choice`, `response_format` | Supported | Passed to engine; tool parsing supported. |
| `stream` | Supported | SSE chunks with `[DONE]`. |
| `stream_options.include_usage` | Supported | Emits terminal usage chunk with empty choices. |
| SSE heartbeat comments | Supported | Emits `: keep-alive` for long token gaps. |
| Mid-stream structured error chunk | Supported | Emits machine-readable `error` object in chunk payload. |
| `user` | Supported | Used for client attribution fallback. |
| `n` | Constrained | `n=1` only; otherwise explicit 400. |
| `seed` | Not supported | Explicit 400 (deterministic behavior). |
| `logprobs`, `top_logprobs` | Not supported | Explicit 400 (deterministic behavior). |

## Retry and Overload Contract

| Surface | Overload Behavior |
|---|---|
| HTTP chat completions | `429` + `Retry-After: 5` + `code=rate_limit_exceeded` |
| SSE chat completions | Prefetch guard returns HTTP 429 before stream body when immediately overloaded; mid-stream failures emit structured error chunks |
| WebSocket chat stream | `chat.error` with `code=rate_limit_exceeded` and `retry_after=5` |
| Agents run creation | `429` + `Retry-After: 5` + `code=queue_saturated` when scheduler queue is full |
| Skills execution | `429` + `Retry-After` + `code=skill_queue_saturated` when skills queue is full |

## Security and Identity

| Capability | Status | Notes |
|---|---|---|
| Inference API key auth | Supported | `Authorization: Bearer <key>` or `X-API-Key` when configured. |
| Trusted proxy identity handling | Supported | `X-Forwarded-For`/`X-Real-IP` only honored for configured trusted proxies. |
| Security profiles | Supported | `lan`, `trusted-gateway`, and `internet` with profile-aware validation. |
| mTLS policy mode | Supported | `off`, `optional`, `required` via middleware (`security.mtls_mode`). |
| Tenant-aware limits | Supported | Tenant header + per-tenant chat/default/embedding rate limit overrides. |
| Skill sandbox profiles | Supported | `trusted`, `restricted`, `strict` entrypoint policy modes. |

## Completion Notes

- OC-001 through OC-046 backlog scope is complete for this app path.
- Parameter constraints (`seed`, `logprobs`, `top_logprobs`, `n>1`) remain explicit deterministic `400` behavior by design; they are treated as compatibility-safe constraints, not missing support.
- Monitoring and governance artifacts are published in `docs/ops/monitoring/`, `docs/plans/API-SPEC.md`, and `docs/DECISIONS.md`.
