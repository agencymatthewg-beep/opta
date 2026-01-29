# Roadmap: Clawdbot Native Apps

## Overview

Build native macOS and iOS apps that replace Telegram for Clawdbot communication. Starting with shared infrastructure and protocol layer, then building chat interfaces with progressive rich output capabilities, culminating in multi-bot management and platform-specific polish.

## Domain Expertise

None (expertise files not available)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation** - Project structure, shared packages, design system
- [x] **Phase 2: Connection Layer** - WebSocket client, state management, reconnection
- [x] **Phase 3: Message Protocol** - Clawdbot JSON protocol implementation
- [x] **Phase 4: Chat Core** - Basic chat UI, message list, input field
- [x] **Phase 5: Streaming & State** - Real-time streaming, thinking/typing indicators
- [ ] **Phase 6: Rich Output: Text** - Bullet points, code blocks, formatted text
- [ ] **Phase 7: Rich Output: Visual** - Dynamic tables, graphs, inline images
- [ ] **Phase 8: GenUI Rendering** - Interactive component loading in chat
- [ ] **Phase 9: Multi-Bot Management** - Bot switcher, discovery, device indicators
- [ ] **Phase 10: macOS Desktop** - Desktop layouts, note integration, multi-pane
- [ ] **Phase 11: Push Notifications** - APNS for iOS, system notifications for macOS
- [ ] **Phase 12: Polish & Launch** - Performance, edge cases, final touches

## Phase Details

### Phase 1: Foundation
**Goal**: Establish project structure with shared Swift package, design system tokens, and app scaffolding for both iOS and macOS
**Depends on**: Nothing (first phase)
**Research**: Unlikely (project setup, established SwiftUI patterns)
**Plans**: TBD

Plans:
- [x] 01-01: Create shared Swift package structure
- [x] 01-02: Port design system (OptaColors, OptaAnimations) to shared package
- [x] 01-03: Scaffold iOS and macOS app targets

### Phase 2: Connection Layer
**Goal**: Implement WebSocket client with connection state management, automatic reconnection, and Tailscale network support
**Depends on**: Phase 1
**Research**: Complete
**Research decision**: URLSessionWebSocketTask (native, no dependencies, mature on iOS 17+)

Plans:
- [x] 02-01: WebSocket client implementation (Wave 1)
- [x] 02-02: Connection state machine and reconnection logic (Wave 2)
- [x] 02-03: Network reachability and Tailscale detection (Wave 2)

### Phase 3: Message Protocol
**Goal**: Implement Clawdbot JSON message protocol parsing and serialization
**Depends on**: Phase 2
**Research**: Level 0 (pure internal work, no external dependencies)

Plans:
- [x] 03-01: Message type definitions (Wave 1) - ChatMessage, ProtocolEnvelope, StreamingChunk
- [x] 03-02: Protocol encoder/decoder with streaming support (Wave 2)
- [x] 03-03: Message queue and delivery confirmation (Wave 2)
- [x] 03-04: Protocol integration with connection layer (Wave 3)

### Phase 4: Chat Core
**Goal**: Build basic chat interface with message list, input field, and send functionality
**Depends on**: Phase 3
**Research**: Unlikely (standard SwiftUI patterns)
**Plans**: TBD

Plans:
- [x] 04-01: Chat view layout and message bubbles
- [x] 04-02: Message input with keyboard handling
- [x] 04-03: Message persistence and history loading

### Phase 5: Streaming & State
**Goal**: Implement real-time streaming responses with thinking state and typing indicators
**Depends on**: Phase 4
**Research**: Likely (architectural decision)
**Research topics**: AsyncSequence for streaming text, SwiftUI state management for real-time UI updates, animation coordination
**Plans**: TBD

Plans:
- [x] 05-01: Streaming message rendering
- [x] 05-02: Thinking state visualization
- [x] 05-03: Typing indicator animation

### Phase 6: Rich Output: Text
**Goal**: Support bullet points, code blocks, and formatted text rendering
**Depends on**: Phase 5
**Research**: Unlikely (text formatting, Markdown patterns)
**Plans**: TBD

Plans:
- [ ] 06-01: Markdown parsing and rendering
- [ ] 06-02: Code block syntax highlighting
- [ ] 06-03: Expandable/collapsible sections

### Phase 7: Rich Output: Visual
**Goal**: Render dynamic tables, interactive graphs, and inline images
**Depends on**: Phase 6
**Research**: Likely (library evaluation)
**Research topics**: Swift Charts API, third-party alternatives, dynamic table sizing strategies, image caching
**Plans**: TBD

Plans:
- [ ] 07-01: Dynamic table component
- [ ] 07-02: Interactive graph rendering (Swift Charts)
- [ ] 07-03: Inline image loading and caching

### Phase 8: GenUI Rendering
**Goal**: Load and render interactive GenUI components within chat messages
**Depends on**: Phase 7
**Research**: Likely (new pattern)
**Research topics**: Dynamic SwiftUI view loading, codable view hierarchies, component sandboxing
**Plans**: TBD

Plans:
- [ ] 08-01: GenUI component protocol definition
- [ ] 08-02: Dynamic component instantiation
- [ ] 08-03: Component state management and events

### Phase 9: Multi-Bot Management
**Goal**: Implement bot switcher, discovery, and management for Opta, Mono, and future bots
**Depends on**: Phase 8
**Research**: Unlikely (internal UI patterns)
**Plans**: TBD

Plans:
- [ ] 09-01: Bot registry and discovery
- [ ] 09-02: Bot switcher UI
- [ ] 09-03: Per-bot conversation history

### Phase 10: macOS Desktop
**Goal**: Add desktop-specific features including optimized layouts, note integration, and multi-pane views
**Depends on**: Phase 9
**Research**: Unlikely (existing opta-mini patterns in codebase)
**Plans**: TBD

Plans:
- [ ] 10-01: Desktop-optimized layouts (wider tables, multi-column)
- [ ] 10-02: Note management integration
- [ ] 10-03: Multi-pane conversation view

### Phase 11: Push Notifications
**Goal**: Implement APNS for iOS backgrounded notifications and system notifications for macOS
**Depends on**: Phase 10
**Research**: Likely (external service)
**Research topics**: APNS certificate setup, device token registration, payload formats, notification service extension
**Plans**: TBD

Plans:
- [ ] 11-01: APNS server integration (Clawdbot gateway)
- [ ] 11-02: iOS notification handling and rich previews
- [ ] 11-03: macOS system notifications

### Phase 12: Polish & Launch
**Goal**: Performance optimization, edge case handling, and App Store preparation
**Depends on**: Phase 11
**Research**: Unlikely (refinement work)
**Plans**: TBD

Plans:
- [ ] 12-01: Performance profiling and optimization
- [ ] 12-02: Edge case handling and error states
- [ ] 12-03: App Store metadata and submission

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → ... → 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2025-01-30 |
| 2. Connection Layer | 3/3 | Complete | 2025-01-30 |
| 3. Message Protocol | 4/4 | Complete | 2026-01-30 |
| 4. Chat Core | 3/3 | Complete | 2026-01-30 |
| 5. Streaming & State | 3/3 | Complete | 2026-01-30 |
| 6. Rich Output: Text | 0/3 | Not started | - |
| 7. Rich Output: Visual | 0/3 | Not started | - |
| 8. GenUI Rendering | 0/3 | Not started | - |
| 9. Multi-Bot Management | 0/3 | Not started | - |
| 10. macOS Desktop | 0/3 | Not started | - |
| 11. Push Notifications | 0/3 | Not started | - |
| 12. Polish & Launch | 0/3 | Not started | - |
