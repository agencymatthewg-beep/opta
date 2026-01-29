# Clawdbot Native Apps

## What This Is

Native macOS and iOS apps that replace Telegram for communicating with Clawdbot instances (Opta, Mono, future bots). Built as Clawdbot channel plugins with WebSocket primary connection and APNS push fallback, delivering real-time observability and rich output rendering that Telegram cannot provide.

## Core Value

**Always know what your bot is doing.** Real-time thinking state, typing indicators, and streaming responses with rich output formats (tables, graphs, GenUI) that make AI communication as natural as human messaging.

## Requirements

### Validated

*Existing ecosystem capabilities this project builds upon:*

- ✓ SwiftUI design system — `apps/ios/opta/Opta Scan/Design/` (OptaColors, OptaAnimations, OptaHaptics)
- ✓ iOS MVVM architecture — `apps/ios/opta/` with service layer pattern
- ✓ macOS SwiftUI experience — `apps/desktop/opta-mini/` menubar app
- ✓ Clawdbot JSON message protocol — existing Telegram channel implementation
- ✓ Tailscale network — Mac Studio accessible at 100.75.167.36
- ✓ Apple Developer enrollment — enables APNS, App Store distribution

### Active

*iOS App (Clawdbot Mobile):*

- [ ] Chat interface with real-time message streaming
- [ ] Thinking state visualization (bot is processing)
- [ ] Typing indicators (bot is generating response)
- [ ] Rich output: dynamically sized tables
- [ ] Rich output: interactive graphs
- [ ] Rich output: bullet point formatting
- [ ] Rich output: inline images
- [ ] Rich output: explanatory/expandable sections
- [ ] GenUI rendering in chat (load interactive components)
- [ ] Multi-bot switcher (Opta, Mono, future bots)
- [ ] Bot discovery and management
- [ ] WebSocket connection to Clawdbot gateway
- [ ] APNS push notifications for backgrounded app

*macOS App (Clawdbot Desktop):*

- [ ] Full chat interface with all iOS rich output capabilities
- [ ] Note management integration
- [ ] Multi-bot management with device indicators
- [ ] Desktop-optimized layouts (wider tables, multi-pane)
- [ ] WebSocket connection (localhost or Tailscale)
- [ ] System notifications

*Shared (Clawdbot Channel Plugin):*

- [ ] Channel plugin architecture for Clawdbot gateway
- [ ] Reuse existing JSON message protocol
- [ ] Real-time streaming support
- [ ] Connection state management
- [ ] Reconnection logic

### Out of Scope

- Voice/audio messages — text-first for v1
- watchOS complications — focus on phone and desktop
- Bot-to-bot coordination UI — Opta/Mono coordinate, but UI doesn't visualize their communication
- Replacing Claude Code — these apps complement, not replace, the CLI workflow
- Android — Apple platforms only

## Context

**Current Communication Stack:**
- Clawdbot gateway runs on MacBook Pro (Opta) and Mac Studio (Mono)
- Telegram bot API used for all communication
- Telegram limitations: no rich tables, no graphs, no GenUI, basic typing indicators

**Device Ecosystem:**
- MacBook Pro M4 Max (primary work device, runs Opta)
- Mac Studio M3 Ultra (infrastructure, runs Mono + GLM-4.7)
- iPhone (mobile communication)
- All connected via Tailscale mesh network

**Why Native vs Web:**
- Real-time WebSocket performance
- APNS for reliable backgrounded notifications
- Native text input, keyboard shortcuts
- System integration (notifications, share sheets)
- Offline message queuing

## Constraints

- **Platform**: SwiftUI exclusively (iOS 17+, macOS 14+)
- **Protocol**: Must use existing Clawdbot JSON message format
- **Network**: WebSocket primary, APNS fallback (no cloud relay in v1)
- **Design**: Follow existing Opta design system (OptaColors, glass effects, Sora font principles)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Channel plugin architecture | Clawdbot already has plugin system for Telegram; native apps become another channel | — Pending |
| WebSocket + APNS hybrid | Real-time when active, push when backgrounded | — Pending |
| Two separate apps vs one universal | Platform-specific UX matters; macOS needs desktop features, iOS needs mobile optimization | — Pending |
| Reuse JSON protocol | Zero changes to Clawdbot backend; apps are pure clients | — Pending |
| SwiftUI over cross-platform | Best native experience, existing iOS expertise in codebase | — Pending |

---
*Last updated: 2025-01-29 after initialization*
