---
app: opta-local
type: web-app
platforms: [web]
language: typescript
status: active-development
version: 0.2
depends_on: [opta-lmx, opta-cli-ts]
depended_on_by: []
port: 3004
opis_version: 2.0
opis_mode: greenfield
---

<!-- AI-SUMMARY (50 words max)
Opta Local: Web thin-client app for remote access to Opta LMX inference servers. WAN access via Cloudflare Tunnel, live dashboard (VRAM, models, throughput), streaming chat with local models, and session continuity from CLI to browser. Premium glass UI. -->

# Opta Local — APP.md

> Text your local AI from anywhere.

## 1. Identity

| Field | Value |
|-------|-------|
| Name | Opta Local |
| Type | Web App |
| Platforms | Web (Next.js 16) |
| Languages | TypeScript |
| Status | Active Development |
| Owner | Matthew Byrden / Opta Operations |
| Domain | optamize.biz |

## 2. Purpose

### What It Does

Web thin-client app that connects to Opta LMX inference servers, providing:
- Real-time server monitoring (VRAM, models, throughput, temperature)
- Streaming chat with local models from any network
- Model management (load/unload/benchmark)
- Session sync between CLI and Web

### Problem It Solves

Managing local LLM inference requires SSH terminals, curl commands, and fragmented tooling. Users with powerful Mac Studios running Opta LMX want to chat with their local models from their phone or laptop browser — from anywhere, not just LAN — without the overhead of terminal commands.

### How It's Different

- **Not a generic chat wrapper** — deeply integrated with Opta LMX's 40+ API endpoints
- **Premium native experience** — Opta glass UI, spring physics, design system compliance
- **Agent-capable** — not just chat, future CLI agent loop exposed to mobile
- **Fast setup** — manual LAN target + Cloudflare WAN endpoint
- **Session continuity** — start on CLI, continue on phone, finish on web

### Does NOT Do

- Does NOT run models locally on-device (that's Opta LMX's job)
- Does NOT replace Opta CLI for power users — complements it
- Does NOT manage the Mac Studio OS or other services
- Does NOT proxy cloud APIs — local models only
- Does NOT become a full IDE on mobile

## 3. Target Audience

### Who

Matthew Byrden (primary) — owner of Mac Studio M3 Ultra running Opta LMX. Power user who wants mobile/web access to local AI without SSH.

### Scenarios

1. **Morning coffee check** — iPhone, see server status, continue yesterday's session
2. **On the train** — Chat with local AI over Cloudflare Tunnel, zero cloud costs
3. **Model hot-swap** — Switch DeepSeek to Qwen via web dashboard in 15 seconds
4. **First-time setup** — connect to your Mac Studio LAN target or tunnel URL
5. **CLI handoff** — Exit terminal session, resume on phone while walking

### Experience

Premium, glass-panel aesthetic. Feels like a cockpit for your AI server — not a generic chat app. Information-dense but never cluttered. Streaming responses feel instant. Server status is always visible.

## 4. Non-Negotiable Capabilities

| # | Capability | Acceptance Criteria |
|---|-----------|-------------------|
| 1 | **LAN Connection** | Manual LAN endpoint setup with encrypted local persistence |
| 2 | **Streaming Chat** | OpenAI-compatible `/v1/chat/completions` with streaming token display |
| 3 | **Live Dashboard** | Real-time VRAM usage, loaded models, throughput via SSE |
| 4 | **Model Management** | Load/unload models with one tap, VRAM estimation before load |
| 5 | **WAN Access** | Cloudflare Tunnel with QR code pairing for remote access |

## 5. Key Characteristics

### Philosophy

- **Thin client** — all intelligence lives on the Mac Studio (LMX), clients just render
- **Web-only** — this project is now web-only (iOS removed 2026-02-28)
- **Premium UX** — Opta glass design system, never generic
- **Zero-config** — LAN should just work, WAN should be wizard-guided

### Performance

- Web: First Contentful Paint <1.5s, streaming latency <100ms on LAN
- Web: Dashboard interactive load <2s on broadband
- SSE connection established within 500ms of app open

### Quality

- TypeScript strict mode, ESLint, Prettier
- Next.js 16 + React 19 + TypeScript strict mode
- All UI built using `/frontend-design` skill for consistency

## 6. Architecture Overview

### Components

```
iPhone / Browser (Anywhere)
┌─────────────────────────────┐
│  Opta Local App             │
│  ┌───────────┐ ┌──────────┐ │
│  │ Dashboard │ │ Chat     │ │
│  │ (SSE)     │ │ (Stream) │ │
│  └─────┬─────┘ └────┬─────┘ │
│        │             │       │
│  ┌─────┴─────────────┴─────┐ │
│  │  Connection Manager      │ │
│  │  LAN: Manual endpoint     │ │
│  │  WAN: Cloudflare Tunnel  │ │
│  └─────────────┬───────────┘ │
└────────────────┼─────────────┘
                 │ HTTPS / WSS
┌────────────────┼─────────────┐
│  Mac Studio    │             │
│  ┌─────────────┴───────────┐ │
│  │  Opta LMX (FastAPI)     │ │
│  │  /v1/chat/completions   │ │
│  │  /admin/*               │ │
│  │  /admin/events (SSE)    │ │
│  └─────────────────────────┘ │
└──────────────────────────────┘
```

### Data Flow

1. Client connects to server (LAN endpoint or Cloudflare Tunnel WAN)
2. Client authenticates with admin key (stored in Keychain / localStorage)
3. Dashboard subscribes to `/admin/events` SSE stream
4. Chat sends to `/v1/chat/completions` with `stream: true`
5. Sessions stored on Mac Studio at `~/.config/opta/sessions/`

### Dependencies

- **Opta LMX** — the inference server (all APIs)
- **Opta CLI** — session format, agent loop (future)
- **@opta/ui** — shared React components (Web)
- **Cloudflare Tunnel** — WAN access (optional)

## 7. Ecosystem Context

| Relationship | App | How |
|-------------|-----|-----|
| **Depends on** | Opta LMX | All API endpoints, SSE events, model management |
| **Depends on** | Opta CLI | Session format, future agent-as-a-service |
| **Uses** | @opta/ui | Shared React components for Web platform |
| **Complements** | Optamize MacOS | Desktop dashboard + mobile companion |
| **Shares** | Design System | Glass aesthetic, violet palette, spring physics |

## 8. Development Rules

### Coding

- Web: Next.js 16 + React 19 + TypeScript strict + Tailwind CSS
- Web: Next.js 16 + React 19 + TypeScript
- All UI work MUST use `/frontend-design` skill
- Follow Opta design system: glass panels, violet accents, Sora font

### AI Integration

- Direct HTTP to Opta LMX — no intermediate proxy
- OpenAI-compatible API format for chat completions
- Admin API for server management and monitoring

### Testing

- Web: Vitest for unit, Playwright for E2E
- Web: Vitest + Playwright for validation
- Integration tests against LMX API (mock server for CI)

### Deployment

- Web: Vercel (same as other Opta web apps)
- Web: Vercel deployment with preview + production channels

## 9. Current Phase

**Web Stabilization (Active)** — Web app is being hardened for daily use and deployment (lint/typecheck/build, connection reliability, docs sync).

## 10. Open Questions

- [ ] Should the web app ship as installable PWA for mobile users?
- [ ] Should session storage move from filesystem to LMX SQLite for API access?
- [ ] What authentication model for WAN access beyond admin key? (JWT, TOTP, etc.)
- [ ] Should Opta Local support multiple user accounts or remain single-user?

---

*Generated by OPIS v2.0 — 2026-02-18*
