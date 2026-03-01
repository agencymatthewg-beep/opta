# Opta LMX Connection, Pairing, and Discovery Audit

Date: 2026-02-28  
Scope: `/src/opta_lmx`, `config/*`, `docs/*` in this repository.

## Summary

Opta LMX already supports multiple connection surfaces (OpenAI, Anthropic, WebSocket, admin APIs) and outbound pairing to helper nodes, but pairing/discovery has been mostly static-config driven.  
This update adds first-class discovery endpoints so clients can auto-configure without requiring manual host commands.

## Inbound Connection Surfaces (How Clients Connect to LMX)

1. OpenAI-compatible inference
- `POST /v1/chat/completions`
- `POST /v1/responses`
- `POST /v1/completions`
- `GET /v1/models`
- `GET /v1/models/{model_id}`

2. Embeddings and reranking
- `POST /v1/embeddings`
- `POST /v1/rerank`

3. Anthropic compatibility
- `POST /v1/messages`

4. Realtime transport
- `WebSocket /ws/chat` (when `server.websocket_enabled=true`)

5. Admin/control plane
- `GET /admin/status`, `/admin/health`, `/admin/memory`
- `/admin/models/*`, `/admin/config/*`, `/admin/metrics*`, `/admin/helpers`, `/admin/stack`, etc.

6. Skills + MCP bridge
- `GET /v1/skills/mcp/tools`
- `POST /v1/skills/mcp/call`
- `/mcp/*` standard POST forms

## Outbound Pairing Surfaces (How LMX Connects to Other Systems)

1. Helper nodes (distributed embedding/reranking)
- Config: `helper_nodes.embedding`, `helper_nodes.reranking`
- Runtime client: `HelperNodeClient` (`httpx.AsyncClient`)
- Health checks: background `health_check_loop` + `/admin/helpers`

2. Remote MCP bridge
- Config: `skills.remote_mcp_enabled`, `skills.remote_mcp_url`
- Runtime bridge: `RemoteMCPBridge`

3. HuggingFace model source
- Download + management through `/admin/models/download` and model manager flows.

## Discovery and Pairing State (Before vs After)

Before:
- Discovery was implicit (known host/IP + static config).
- No dedicated self-describing discovery endpoint for clients.

After (this change):
- `GET /v1/discovery` returns:
  - preferred base URL
  - candidate base URLs
  - OpenAI/admin base URLs
  - WebSocket URL (if enabled)
  - auth requirements (admin/inference)
  - probe order for clients
- `GET /.well-known/opta-lmx` provides a well-known alias for auto-pairing clients.

## Configuration That Produces the Most Intuitive UX

Recommended production baseline:

```yaml
server:
  host: "0.0.0.0"
  port: 1234
  websocket_enabled: true

models:
  default_model: "mlx-community/..."
  auto_load:
    - "mlx-community/..."

security:
  profile: "lan"           # or cloud if internet-exposed
  admin_key: null          # set if you need admin auth on LAN
  inference_api_key: null  # set for shared/less-trusted environments
```

Operationally:
- Run as a daemon (`launchd`) so users do not manually start LMX.
- Let clients probe:
  1. `/.well-known/opta-lmx`
  2. `/v1/discovery`
  3. `/healthz` then `/v1/models`

## Remaining Gap Outside This Repo

The attached terminal screenshot appears to come from Opta CLI logic (client-side fallback/error messaging).  
LMX now exposes enough discovery metadata for zero-command pairing, but Opta CLI still needs to consume `/.well-known/opta-lmx` or `/v1/discovery` automatically during startup.
