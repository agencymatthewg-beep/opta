---
status: review
---

# Roadmap: Opta Local

## Overview

Build Opta Local from scaffold to shipped product across two platforms: Web first (Next.js 16 Command Center), then iOS (SwiftUI Quick Draw). Each platform follows a Foundation-Dashboard-WAN-Sessions arc. Web validates API patterns that iOS inherits. All UI built with `/frontend-design` skill for premium glass aesthetic.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Web Project Setup** - Scaffold Next.js 16 with Opta design system and LMX client
- [x] **Phase 2: Web Foundation** - Streaming chat with manual server connection
- [x] **Phase 3: Web Dashboard** - Real-time server monitoring via SSE
- [x] **Phase 4: Web Anywhere** - Cloudflare Tunnel WAN access
- [x] **Phase 5: Web Sessions** - Resume CLI sessions in browser
- [x] **Phase 6: iOS Foundation** - Bonjour discovery and SwiftUI streaming chat
- [x] **Phase 7: iOS Dashboard + WAN** - Native monitoring and QR tunnel pairing
- [x] **Phase 8: iOS Sessions + Polish** - Session management, haptics, final testing

## Phase Details

### Phase 1: Web Project Setup
**Goal**: Scaffold Next.js 16 project with @opta/ui integration, Tailwind design tokens, and working LMX client that connects to Mac Studio
**Depends on**: Nothing (first phase)
**Research**: Unlikely (established Next.js patterns, @opta/ui already exists)
**Plans**: 2 plans

Plans:
- [x] 01-01: Next.js 16 scaffold with Tailwind + @opta/ui + design tokens
- [x] 01-02: LMX client library and connection settings

### Phase 2: Web Foundation
**Goal**: Working streaming chat UI with model selection — the core "chat with your local AI" experience
**Depends on**: Phase 1
**Research**: Unlikely (OpenAI-compatible streaming is well-documented, LMX endpoints already defined in SHARED.md)
**Plans**: 2 plans

Plans:
- [x] 02-01: Streaming chat engine and message UI
- [x] 02-02: Model picker and chat history persistence

### Phase 3: Web Dashboard
**Goal**: Real-time server monitoring — VRAM gauge, loaded models list, throughput chart, model load/unload
**Depends on**: Phase 2
**Research**: Unlikely (SSE via EventSource is standard, LMX /admin/events endpoint documented)
**Plans**: 3 plans

Plans:
- [x] 03-01: SSE connection manager with auto-reconnect
- [x] 03-02: VRAM gauge and loaded models components
- [x] 03-03: Throughput chart and model load/unload flow

### Phase 4: Web Anywhere
**Goal**: Connect to LMX from outside LAN via Cloudflare Tunnel with connection type indicators
**Depends on**: Phase 2
**Research**: Likely (Cloudflare Tunnel client-side configuration patterns, CORS implications for tunneled connections)
**Research topics**: Cloudflare Tunnel URL format, client-side detection of LAN vs WAN, auto-failover strategies, CORS headers on tunneled requests
**Plans**: 2 plans

Plans:
- [x] 04-01: Tunnel URL configuration and connection type detection
- [x] 04-02: Auto-failover (LAN → WAN) and connection status indicators

### Phase 5: Web Sessions
**Goal**: Browse and resume CLI sessions in the browser — start on terminal, continue on web
**Depends on**: Phase 2
**Research**: Complete (confirmed LMX has ZERO session endpoints — must add them)
**Plans**: 3 plans (expanded from 2 — LMX session API prerequisite added)

Plans:
- [x] 05-01: LMX session API endpoints (Python — reads CLI session files from Mac Studio)
- [x] 05-02: Session list page with search and filtering
- [x] 05-03: Session resume — load history and continue chatting

### Phase 6: iOS Foundation
**Goal**: Zero-config LAN connection via Bonjour and native SwiftUI streaming chat
**Depends on**: Phase 2 (Web validates API patterns)
**Research**: Likely (NWBrowser API for Bonjour, Keychain Services integration)
**Research topics**: NWBrowser usage for custom Bonjour service types, Keychain Services modern async patterns, URLSession.bytes for SSE streaming
**Plans**: 3 plans

Plans:
- [x] 06-01: Xcode project setup with SwiftUI + Observation framework
- [x] 06-02: Bonjour discovery service and connection flow
- [x] 06-03: Streaming chat UI and model picker

### Phase 7: iOS Dashboard + WAN
**Goal**: Native dashboard with animated VRAM gauge, model management, and QR code tunnel pairing
**Depends on**: Phase 6
**Research**: Unlikely (SSE and dashboard patterns validated in Web phases, AVFoundation QR scanning is standard)
**Plans**: 2 plans

Plans:
- [x] 07-01: SSE async stream client and dashboard views (VRAM gauge, model list)
- [x] 07-02: QR scanner for tunnel pairing and connection type indicator

### Phase 8: iOS Sessions + Polish
**Goal**: Session management, haptic feedback, final testing and App Store preparation
**Depends on**: Phase 7
**Research**: Unlikely (session patterns proven in Web, TestFlight process is established)
**Plans**: 2 plans

Plans:
- [x] 08-01: Session list and resume views
- [x] 08-02: Haptic feedback, performance optimization, TestFlight prep

## Progress

**Execution Order:**
Phases 1 → 2 → 3 (parallel with 4, 5) → **USER VERIFICATION GATE** → 6 → 7 → 8

**Gate:** iOS phases (6-8) are BLOCKED until user explicitly verifies web works as intended.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Web Project Setup | 2/2 | Complete | 2026-02-18 |
| 2. Web Foundation | 2/2 | Complete | 2026-02-18 |
| 3. Web Dashboard | 3/3 | Complete | 2026-02-18 |
| 4. Web Anywhere | 2/2 | Complete | 2026-02-18 |
| 5. Web Sessions | 3/3 | Complete | 2026-02-18 |
| 6. iOS Foundation | 3/3 | Complete | 2026-02-19 |
| 7. iOS Dashboard + WAN | 2/2 | Complete | 2026-02-19 |
| 8. iOS Sessions + Polish | 2/2 | Complete | 2026-02-19 |
