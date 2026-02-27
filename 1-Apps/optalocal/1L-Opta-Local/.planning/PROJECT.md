# Opta Local

## What This Is

Web and iOS thin-client apps that connect to Opta LMX inference servers on Mac Studio, providing real-time server monitoring (VRAM, models, throughput), streaming chat with local models from any network, model management, and session sync between CLI, Web, and iOS. A premium cockpit for your AI server — not a generic chat wrapper.

## Core Value

Chat with your local AI from anywhere — phone, laptop, LAN, or WAN — with zero terminal commands.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] LMX Dashboard — Live VRAM gauge, loaded models, throughput chart via SSE
- [ ] Streaming Chat — OpenAI-compatible `/v1/chat/completions` with real-time token display
- [ ] LAN Auto-Discovery — Bonjour/mDNS finds LMX servers within 2 seconds
- [ ] Anywhere Chat — Cloudflare Tunnel relay for WAN access
- [ ] Model Library — Load/unload models with VRAM estimation
- [ ] Smart Chat — CLI-grade agent loop exposed to Web/iOS (future)
- [ ] Session Sync — Resume CLI sessions in browser or phone
- [ ] Voice Chat — Whisper transcription + TTS playback (iOS)
- [ ] Image + Vision Chat — Camera/drag-drop analysis with vision models
- [ ] Tool Approval on Mobile — Push notifications for CLI agent permissions (iOS)
- [ ] RAG Studio — Visual document ingestion and querying
- [ ] Multi-Server Fleet View — Manage multiple LMX instances
- [ ] Automation Scheduler — Cron-like recurring AI tasks

### Out of Scope

- On-device model inference — that's LMX's job
- Full IDE in browser — that's Optamize MacOS's job
- Cloud API proxying — local models only
- Light theme — dark mode only (OLED-optimized)
- Multi-user accounts — single-user in v1
- Intermediate backend proxy — direct browser/app to LMX

## Context

- **Opta LMX** runs on Mac Studio M3 Ultra (192.168.188.11:1234) with 40+ API endpoints
- Web connects direct to LMX via HTTP (no BFF). Admin key stored encrypted in localStorage.
- iOS uses Bonjour for zero-config LAN discovery, Keychain for credentials
- Cloudflare Tunnel for WAN access (free tier, proven in OptaPlus)
- OPIS v2.0 scaffold created with 20 documentation files in `1-Apps/1L-Opta-Local/`
- Web platform is "Command Center" (dashboard-centric), iOS is "Quick Draw" (chat-centric)
- All UI work MUST use `/frontend-design` skill for premium design consistency

## Constraints

- **Stack (Web)**: Next.js 16 + React 19 + TypeScript strict + Tailwind CSS + @opta/ui
- **Stack (iOS)**: SwiftUI + Observation framework + async/await (iOS 17+)
- **Design**: Opta glass design system — violet palette, Sora font, spring physics
- **Architecture**: No intermediate backend — browser talks directly to LMX
- **Dependency**: iOS development starts after Web Phase 1 validates API patterns
- **Performance (Web)**: FCP <1.5s, streaming latency <100ms LAN
- **Performance (iOS)**: Launch <2s, Bonjour <1s, first token <200ms

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web first, iOS second | Faster iteration cycles, validates API patterns iOS inherits | -- Pending |
| Next.js 16 + React 19 | Ecosystem consistency with other Opta web apps, @opta/ui is React-based | -- Pending |
| SwiftUI + Observation for iOS | Native performance, Bonjour, design system compatibility | -- Pending |
| Direct browser-to-LMX (no backend) | Single-user app on private network, simpler architecture | -- Pending |
| Multi-platform Option D scaffold | Web and iOS have >2x feature divergence | -- Pending |
| All 13 ideas as Active requirements | Full vision captured, phased roadmap controls build order | -- Pending |
| Cloudflare Tunnel for WAN | Free tier, zero-config client, E2E encrypted, proven in OptaPlus | -- Pending |
| /frontend-design skill mandatory | Premium design consistency across both platforms | -- Pending |
| Location: 1-Apps/1L-Opta-Local/ | Follows monorepo convention, shares @opta packages | -- Pending |

---
*Last updated: 2026-02-18 after initialization (bridged from OPIS v2.0 APP.md)*
