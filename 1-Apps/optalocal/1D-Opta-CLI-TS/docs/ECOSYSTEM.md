---
title: Opta Ecosystem
purpose: How Opta CLI relates to other Opta components
updated: 2026-02-28
---

# Opta Ecosystem — Component Relationships

Opta CLI doesn't exist in isolation. This document maps how it connects to the broader Opta system.

---

## The Opta Local Stack

Three components form the primary inference pipeline. See `../OPTA-LOCAL-STACK.md` for the full topology.

```
opta chat / opta tui / opta do    (1D-Opta-CLI-TS)
        │
opta daemon   127.0.0.1:9999      (1D-Opta-CLI-TS/src/daemon/)
        │   HTTP v3 REST + WebSocket streaming
Opta LMX  lmx-host.local:1234     (1M-Opta-LMX)
        │   OpenAI-compatible /v1/chat/completions + WebSocket /v1/chat/stream
Opta Local Web  localhost:3004    (1L-Opta-LMX-Dashboard/)
```

The daemon owns session orchestration, permission gating, and event persistence.
LMX runs on dedicated Apple Silicon host (Primary LMX Host, 512GB RAM) and is never hosted on the MacBook.

---

## Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│ User's MacBook (Opta48)                                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐  ┌───────────────────┐  ┌───────────────┐  │
│  │  opta CLI       │  │  Opta Local Web   │  │  Opta Code    │  │
│  │  opta daemon    │  │  localhost:3004   │  │  Desktop      │  │
│  │  127.0.0.1:9999 │  │  (React/Next.js)  │  │  (Tauri/Vite) │  │
│  └────────┬────────┘  └────────┬──────────┘  └──────┬────────┘  │
│           │                    │                     │           │
└───────────┼────────────────────┼─────────────────────┼───────────┘
            │                    │                     │
            └──────────LAN (lmx-host.local)────────────┘
            │
┌───────────┼──────────────────────────────────────────────────────┐
│ dedicated Apple Silicon host (Primary LMX Host — lmx-host.local)                             │
├───────────┼──────────────────────────────────────────────────────┤
│           ▼                                                       │
│  ┌──────────────────────────────────┐                            │
│  │  Opta LMX  (port 1234)           │                            │
│  │  ├─ Qwen2.5-72B (primary)        │  OpenAI-compatible         │
│  │  ├─ MiniMax-M2.5-4bit            │  /v1/chat/completions      │
│  │  ├─ GLM-4.7-Flash-MLX            │  /v1/chat/stream (WS)      │
│  │  └─ + on-disk model library      │  /admin/* (LMX mgmt API)   │
│  └──────────────────────────────────┘                            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component Descriptions

### Opta CLI (This Repository)

**What it is:** A command-line agentic coding assistant with a full-screen TUI and persistent daemon.

**Key capabilities:**
- Connects to Opta LMX (LAN) or Anthropic Claude (cloud fallback)
- Streaming agent loop with 12 built-in tools + MCP tool surface
- Full-screen Ink/React TUI (`opta chat --tui`)
- Daemon server (`opta daemon start`) exposes HTTP v3 REST + WebSocket for multi-client access
- Playwright-backed browser automation with policy engine and visual diff
- LSP integration for language intelligence
- MCP registry for extending tool surface

**File location:** `1-Apps/optalocal/1D-Opta-CLI-TS/`

**Provider routing:**
1. LMX (primary) — direct WebSocket stream to dedicated Apple Silicon host; falls back to SSE
2. Anthropic (cloud fallback) — used when LMX is unreachable; requires `ANTHROPIC_API_KEY`

---

### Opta LMX (1M-Opta-LMX)

**What it is:** MLX-native inference server running on dedicated Apple Silicon host.

**What it does:**
- Loads and serves open-source LLMs via Apple MLX framework
- Exposes OpenAI-compatible `/v1/chat/completions` (SSE) and `/v1/chat/stream` (WebSocket)
- Manages unified memory, model switching, concurrent sessions, and backpressure
- Exposes `/admin/*` management API (model load/unload, metrics, health)
- Never crashes on OOM — degrades gracefully by refusing or unloading

**Connection:** `lmx-host.local:1234` (LAN only, no Tailscale)

**API contracts used by CLI:**
```bash
# Inference
POST /v1/chat/completions          # SSE streaming
WS   /v1/chat/stream               # WebSocket streaming (preferred)

# LMX management
GET  /healthz                      # Liveness probe
GET  /readyz                       # Readiness probe
GET  /admin/models                 # Loaded + on-disk model list
POST /admin/models/load            # Load model
POST /admin/models/unload          # Unload model
```

---

### Opta Local Web (1L-Opta-LMX-Dashboard/)

**What it is:** React/Next.js dashboard for local LMX management and chat.

**What it does:**
- Connects directly to LMX `/v1/chat/completions` and `/admin/*`
- Real-time throughput monitoring via SSE admin event stream
- Model management UI (load, unload, browse)
- Session-aware chat (via opta daemon in WS mode)

**Connection modes:**
- LAN: No auth, direct LMX connection at `lmx-host.local:1234`
- Cloud: Supabase auth via Cloudflare Tunnel

---

### Opta Code Desktop (1P-Opta-Code-Universal)

**What it is:** Browser-served web app (Vite + React) for daemon session monitoring.

**What it does:**
- Connects to opta daemon at `127.0.0.1:9999` via HTTP v3 REST + WebSocket
- Displays session timelines, active turns, permission events
- Token stored in `localStorage` under `opta:daemon-connection`

---

### Opta Accounts / Auth (1R-Opta-Accounts)

**What it is:** Supabase-backed SSO portal at `accounts.optalocal.com`.

**Connection from CLI:**
- Settings overlay Account page → Enter opens `https://accounts.optalocal.com` in default browser
- JWT tokens stored in OS keychain after sign-in
- Token status visible via `/whoami` slash command

---

## Data Flow: Single `opta do` Invocation

```
1. User runs: opta do "refactor the auth module"

2. CLI loads config (host, port, provider, permissions)

3. CLI resolves LMX endpoint:
   GET http://lmx-host.local:1234/healthz  → OK

4. CLI opens LMX WebSocket stream:
   WS  ws://lmx-host.local:1234/v1/chat/stream
   POST body: { model, messages, tools, stream: true }

5. LMX streams back chunk-by-chunk:
   chunk: { delta: { content: "I'll read the auth module..." } }
   chunk: { delta: { tool_calls: [{ name: "read_file", args: ... }] } }

6. CLI executes tool locally:
   read_file("src/middleware/auth.ts") → file contents

7. CLI pushes tool result back to LMX (next turn)

8. Loop continues until model returns finish_reason: "stop"

9. CLI saves session to ~/.config/opta/sessions/<id>.json
```

---

## Data Flow: Daemon + Multi-Client

```
1. opta daemon start
   └─ HTTP: 127.0.0.1:9999
   └─ WebSocket: ws://127.0.0.1:9999/v3/ws

2. opta chat --tui
   └─ Attaches to daemon via HTTP (create session + turn)
   └─ Subscribes to events via WebSocket

3. Opta Code Desktop (browser)
   └─ Reads session list via GET /v3/sessions
   └─ Subscribes to event stream via WebSocket

4. Both clients receive the same ordered event stream
   (turn.token, tool.start, tool.result, permission.request, turn.done)
```

---

## Security Model

### Local-first data residency

| Path | What flows there | Stays local? |
|------|-----------------|--------------|
| CLI → LMX (LAN) | All prompts, code context, tool results | ✅ LAN only |
| CLI → Anthropic (cloud fallback) | Prompts + tool schemas | ❌ Cloud; requires explicit opt-in |
| CLI → Browser (localhost) | Screenshot data, DOM snapshots | ✅ Loopback only |
| CLI → Daemon (loopback) | Session events, permission requests | ✅ Loopback only |

### Authentication

- **Daemon**: Bearer token at `~/.config/opta/daemon/state.json` (rotates on restart)
- **LMX admin API**: `adminKey` at `connection.adminKey` in config (stored in keychain)
- **Anthropic**: API key in `ANTHROPIC_API_KEY` env or OS keychain
- **Accounts**: JWT stored in OS keychain after sign-in at `accounts.optalocal.com`

---

## Session Storage

Sessions are stored at `~/.config/opta/sessions/<id>.json`.

| Field | Content |
|-------|---------|
| `id` | Unique session ID |
| `title` | Human-readable title (auto-generated or set) |
| `messages` | Full turn history (user + assistant + tool) |
| `metadata` | Workspace, model, timestamps |

Sessions written by the CLI, daemon, and Opta Local Web share this format and are interoperable.

---

## Dependency Graph (Current)

```
Opta CLI
  ├─ Opta LMX (HTTP/WS — primary inference)
  │   └─ MLX models on dedicated Apple Silicon host
  │
  ├─ Anthropic Claude (HTTPS — cloud fallback, optional)
  │
  ├─ Opta Daemon (loopback — session/permission coordination)
  │
  ├─ Playwright MCP (loopback — browser automation, optional)
  │
  ├─ MCP servers (stdio — external tool extensions, optional)
  │
  ├─ LSP servers (stdio — language intelligence, optional)
  │
  └─ OS Keychain (local — credential storage)
```
