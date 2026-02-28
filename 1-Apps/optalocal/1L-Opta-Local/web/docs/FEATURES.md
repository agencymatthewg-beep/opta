# Opta Local Web — Features

> Full feature list with per-feature status.

---

## Status Legend

- Planned — In roadmap, not started
- In Progress — Currently being built
- Shipped — Complete and functional
- Deferred — Moved to backlog

---

## Core Features

| # | Feature | Status | Phase | Description |
|---|---------|--------|-------|-------------|
| 1 | Manual server connection | Shipped | 1 | Enter LMX server IP, port, admin key |
| 2 | Streaming chat | Shipped | 1 | Real-time token streaming with markdown rendering |
| 3 | Model picker | Shipped | 1 | Select model from `/v1/models` for chat |
| 4 | Chat history | Shipped | 1 | Persistent message history in localStorage |
| 5 | VRAM gauge | Shipped | 2 | Animated real-time VRAM usage visualization |
| 6 | Model load/unload | Shipped | 2 | One-click model management with VRAM estimation |
| 7 | Throughput chart | Shipped | 2 | Tokens/sec over time |
| 8 | Server temperature | Shipped | 2 | System temperature display |
| 9 | Cloudflare Tunnel | Shipped | 3 | WAN access via tunnel URL configuration |
| 10 | Connection indicator | Shipped | 3 | LAN/WAN/offline visual status |
| 11 | Session list | Shipped | 4 | Browse sessions from LMX Session API |
| 12 | Session resume | Shipped | 4 | Load and continue CLI sessions |

## Extended Features

| # | Feature | Status | Phase | Description |
|---|---------|--------|-------|-------------|
| 13 | Arena (side-by-side) | Shipped | 5 | Dual-model comparison with parallel streaming |
| 14 | Agents workflow UI | Shipped | 5 | Agent task execution, step list, run history |
| 15 | Command Palette | Shipped | 5 | Keyboard-driven navigation (Cmd+K) |
| 16 | RAG Studio | In Progress | Later | Drag-drop document ingestion, chunk preview |
| 17 | Multi-model router | Planned | Later | Drag-to-assign models to task types |
| 18 | Image/Vision chat | Planned | Later | Drag-drop images for vision model analysis |
| 19 | Multi-server fleet | In Progress | Later | Manage multiple LMX servers |
| 20 | Shared conversations | Planned | Later | Real-time collaborative prompting |
| 21 | Automation scheduler | Planned | Later | Cron-like recurring AI tasks |
| 22 | Benchmark suite | In Progress | Later | Performance comparison charts |
| 23 | Tool approval | Planned | Later | Inline approval for CLI agent actions |

---

*Updated — 2026-02-28*

## Bootstrap Endpoint (optalocal.com/init)

- **Status:** Shipped
- **Route:** `GET /init`
- **Behavior:** Returns a shell bootstrap script (`text/x-shellscript`) that:
  - Enforces supported platform checks (macOS + arm64 only)
  - Prints clear unsupported-platform messaging with detected OS/arch
  - Installs Opta CLI from latest GitHub release tarball:
    `https://github.com/agencymatthewg-beep/opta/releases/latest/download/opta-cli-npm.tgz`
  - Uses a safe user-space install prefix (`~/.local`) and prints post-install validation

### Validation commands

```bash
# Endpoint health + content type
curl -i https://optalocal.com/init

# Script smoke-check (do not execute)
curl -fsSL https://optalocal.com/init | head -n 40

# Install + verify
curl -fsSL https://optalocal.com/init | bash
opta --version
opta doctor
```
