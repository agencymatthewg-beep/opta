# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2025-01-29)

**Core value:** Always know what your bot is doing. Real-time thinking state, typing indicators, and streaming responses with rich output formats.
**Current focus:** Phase 6.1 — Opta Aesthetic Alignment (Plan 01 Complete)

## Current Position

Phase: 6.1 of 12 (Opta Aesthetic Alignment)
Plan: 2 of 3 complete in current phase
Status: In Progress — Plan 01 Complete (Typography System)
Last activity: 2026-01-30 — Executed Plan 06.1-01 (Typography System)

Progress: ████████░░ 51%

## Performance Metrics

**Velocity:**
- Total plans completed: 18
- Average duration: 5.0 min
- Total execution time: 1.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 3/3 | 21 min | 7 min |
| 2. Connection | 3/3 | 22 min | 7.3 min |
| 3. Protocol | 4/4 | 10 min | 2.5 min |
| 4. Chat Core | 3/3 | 11 min | 3.7 min |
| 5. Streaming | 3/3 | 15 min | 5 min |
| 6.1. Aesthetic | 2/3 | 14 min | 7 min |

**Recent Trend:**
- Last 5 plans: 05-02 (5 min), 05-03 (5 min), 06.1-02 (8 min), 06.1-01 (6 min)
- Trend: Design system plans average ~7 min with typography and glass components

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 01-01 | Namespace enums for module organization | Clear namespacing without allowing instantiation |
| 01-01 | Swift tools 5.9 | Latest stable SPM with required features |
| 01-02 | #09090b not #000000 for OLED background | Prevents OLED smear on scroll |
| 01-02 | #if os(iOS) for haptics | Cross-platform support with no-op macOS stub |
| 01-02 | @_exported import SwiftUI in colors | Automatic re-export for cleaner imports |
| 01-03 | iOS 17 / macOS 14 minimum | Required for modern SwiftUI features |
| 01-03 | Local package dependency for ClawdbotKit | Enables shared code without publishing |
| 01-03 | App Sandbox with network entitlement | Security + WebSocket support for Phase 2 |
| 02-01 | URLSessionWebSocketTask (Apple native) | No third-party deps, iOS 17+ mature API |
| 02-01 | Actor for ClawdbotWebSocket | Swift concurrency safety for shared state |
| 02-01 | Delegate pattern for async events | Established iOS pattern, works well with actors |
| 02-02 | nonisolated(unsafe) for Combine subject | Thread-safe subject allows SwiftUI binding |
| 02-02 | setDelegate method for actor access | Proper actor isolation pattern |
| 02-02 | State machine with 4 states | disconnected/connecting/connected/reconnecting |
| 02-02 | Exponential backoff with jitter | base * 2^attempt with random jitter for spread |
| 02-03 | NWPathMonitor on utility QoS queue | Non-blocking background monitoring |
| 02-03 | CurrentValueSubject for state caching | Combine publishers for reactive UI |
| 02-03 | Tailscale CGNAT range 100.x.x.x | Standard Tailscale IP detection |
| 02-03 | 3-second Tailscale reachability timeout | Fast VPN should respond quickly |
| 03-01 | MessageID as struct (not raw String) | Type safety with ExpressibleByStringLiteral convenience |
| 03-01 | MessageSender custom Codable | Enum with associated value needs explicit coding for bot name |
| 03-01 | Generic ProtocolEnvelope<T> | Reusable envelope for any payload type with shared metadata |
| 03-01 | Actor for StreamingMessageAssembler | Thread-safe chunk aggregation without manual locking |
| 03-01 | All types Codable + Sendable | Swift concurrency safety for async message handling |
| 03-02 | Type peeking before full decode | Efficient routing without deserializing full payload |
| 03-02 | sortedKeys JSON output | Deterministic output for debugging and logging |
| 03-02 | Unknown message returns .unknown | Forward compatibility for future message types |
| 03-02 | Streaming chunk fast-path decoder | Real-time performance critical for streaming responses |
| 03-03 | Actor for OutgoingMessageQueue | Thread-safe queue management matching ConnectionManager pattern |
| 03-03 | Delegate pattern for send triggering | Decouples queue from transport layer |
| 03-03 | Exponential backoff retries | Same pattern as reconnection (base * 2^attempt, capped at max) |
| 03-03 | Combine publisher for queue state | SwiftUI binding for queue status display |
| 03-04 | ProtocolHandler actor as coordinator | Single entry point combines codec, queue, and assembler |
| 03-04 | Dual delegate + Combine pattern | SwiftUI uses Combine, UIKit uses delegate - supports both |
| 03-04 | Auto-pong for ping messages | Maintains heartbeat without manual intervention |
| 03-04 | Unknown messages logged not errored | Forward compatibility for future message types |
| 04-01 | @Observable @MainActor for ChatViewModel | Simplest iOS 17+ pattern for SwiftUI binding with thread safety |
| 04-01 | Combine .receive(on: DispatchQueue.main) | UI updates must happen on main thread |
| 04-01 | Optimistic append before await send | Instant visual feedback per research recommendations |
| 04-01 | Duplicate handling by MessageID | Prevents double entries when server echoes message back |
| 04-01 | scrollPosition(id:anchor:) API | iOS 17+ declarative scroll control |
| 04-01 | clawdbotPurple for user, clawdbotSurface for bot | Consistent with ClawdbotColors design system |
| 04-03 | Actor for MessageStore | Swift concurrency safety for file I/O without manual locking |
| 04-03 | Application Support/Clawdbot/Messages/ directory | Standard iOS/macOS location for app data |
| 04-03 | One file per conversationId | Prepared for Phase 9 multi-bot conversations |
| 04-03 | Write-through cache | Memory performance with disk durability |
| 04-03 | ISO8601 date encoding | Matches ProtocolCodec, consistent JSON format |
| 04-03 | 1000 message history limit | Prevents memory pressure on long conversations |
| 04-03 | knownMessageIDs Set for deduplication | O(1) lookup prevents double entries on reconnect |
| 05-01 | streamingMessages dictionary for partial content | Maps messageID -> accumulated text for real-time display |
| 05-01 | handleStreamingChunk removes on isFinal | Cleanup streaming state when full message arrives |
| 05-02 | botState as BotState enum | Type-safe state for SwiftUI binding |
| 05-02 | botStateDetail for tool descriptions | Shows "Searching web..." during toolUse |
| 05-02 | Timer-based staggered animation | Smooth sequential dot bounce in ThinkingIndicator |
| 05-02 | Indicator hidden when streaming | Prevents overlap with typing cursor |
| 05-03 | TypingCursor as blinking vertical bar | Familiar pattern from text editors, clear visual feedback |
| 05-03 | showTypingCursor only when botState == .typing | Distinguishes thinking (processing) from typing (generating) |
| 06.1-02 | SwiftUI Material API for glass blur | Native iOS materials for appropriate blur depths |
| 06.1-02 | ObsidianState enum for state machine | Clear semantic states with animation support |
| 06.1-02 | GlowIntensity enum with sm/md/lg/intense | Consistent glow presets across codebase |
| 06.1-02 | System font fallback for status badge | Sora font deferred to plan 01 |
| 06.1-01 | CTFontManagerRegisterGraphicsFont for font registration | Runtime registration for Swift Package (no plist support) |
| 06.1-01 | iOS pt sizes: Hero 34, SectionHeader 28, Subsection 20, etc. | Mapped from web rem/px with mobile adjustments |
| 06.1-01 | tracking = fontSize * emRatio | CSS letter-spacing em to SwiftUI pt conversion |
| 06.1-01 | Moonlight gradient: top-to-bottom (180deg) | Mimics overhead lighting per specification |

### Deferred Issues

None yet.

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-30
Stopped at: Completed Plan 06.1-01 (Typography System)
Resume file: None
Next action: Execute Plan 06.1-03 (Animation Enhancements)

## Phase 6.1 Progress (Opta Aesthetic Alignment)

**06.1-01: Typography System** (Complete)
- Sora font bundle (5 weights: Light, Regular, Medium, SemiBold, Bold)
- ClawdbotTypography.swift with Font.sora() extensions
- MoonlightText gradient view (#fafafa -> #a855f7 -> #6366f1)
- Tracking modifiers (trackingHero, trackingSubtitle, etc.)
- Typography style modifiers (optaHeroStyle, optaBodyStyle, etc.)
- MessageBubble updated with Sora typography
- 16 new typography tests, 141 total tests pass

**06.1-02: Enhanced Glass Components** (Complete)
- 3-level glass depth system (.glassSubtle, .glassContent, .glassOverlay)
- Obsidian glass variants (.obsidian, .obsidianInteractive, .obsidianActive)
- OptaStatusBadge component with pulsing glow animation
- ClawdbotGlowEffects with intensity presets (sm/md/lg/intense)
- Extended colors: cyan, indigo, pink, coral tokens
- Applied glass to MessageBubble bot messages
- Applied obsidian to ThinkingIndicator
- 10 new glass tests, 125 total tests pass

**Remaining:**
- 06.1-03: Animation Enhancements (Ignition, glow pulse, Reduce Motion)

## Phase 5 Complete

All 3 plans complete. Streaming & State provides:

**05-01: Streaming Message Rendering**
- streamingChunks Combine publisher on ProtocolHandler
- ChatViewModel streamingMessages dictionary for partial content
- handleStreamingChunk accumulates content, removes on isFinal
- MessageBubble streaming initializer with animated cursor
- ChatView displays streaming messages in real-time
- Auto-scroll triggers on streaming content changes
- 8 new streaming tests

**05-02: Thinking State Visualization**
- ChatViewModel botState and botStateDetail properties
- handleBotStateUpdate() processes state from ProtocolHandler
- ThinkingIndicator SwiftUI component with animated dots
- Timer-based staggered animation for bounce effect
- Optional detail text for tool use (e.g., "Searching web...")
- ChatView shows indicator when thinking/toolUse (not streaming)
- Auto-scroll on botState changes
- 6 new bot state tests
- 115 total tests pass

**05-03: Typing Indicator Animation**
- TypingCursor component with blinking vertical bar animation
- showTypingCursor parameter on MessageBubble streaming initializer
- Cursor shows when botState == .typing (active generation)
- State transitions: thinking → typing → idle
- 115 total tests pass

## Phase 4 Complete

All 3 plans complete. Chat Core provides:

**04-01: Chat UI Foundation**
- ChatViewModel as @MainActor @Observable wrapping ProtocolHandler
- Combine subscriptions for incomingMessages and botStateUpdates
- Optimistic update pattern with .pending status
- Duplicate message handling by MessageID
- MessageBubble SwiftUI view with sender-based styling
- ChatView with NavigationStack and auto-scroll

**04-02: Chat Input Bar**
- ChatInputBar component with @FocusState keyboard management
- safeAreaInset integration in ChatView
- Send button with enable/disable based on text
- Platform conditionals for iOS-only modifiers

**04-03: Message Persistence**
- MessageStore actor with file-based JSON persistence
- Application Support/Clawdbot/Messages/ storage
- One file per conversationId (multi-bot ready)
- Write-through cache with in-memory + disk
- ChatViewModel loads history on init
- All sent/received messages persisted automatically
- knownMessageIDs Set for O(1) deduplication
- 102 tests pass (11 new MessageStore tests)
