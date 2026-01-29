# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2025-01-29)

**Core value:** Always know what your bot is doing. Real-time thinking state, typing indicators, and streaming responses with rich output formats.
**Current focus:** Phase 4 — Chat Core (Plan 1 of 3 Complete)

## Current Position

Phase: 4 of 12 (Chat Core)
Plan: 1 of 3 complete in current phase
Status: In Progress
Last activity: 2026-01-30 — Completed Plan 04-01 (Chat UI Foundation)

Progress: ██████░░░░ 31%

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: 5.4 min
- Total execution time: 0.98 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 3/3 | 21 min | 7 min |
| 2. Connection | 3/3 | 22 min | 7.3 min |
| 3. Protocol | 4/4 | 10 min | 2.5 min |
| 4. Chat Core | 1/3 | 6 min | 6 min |

**Recent Trend:**
- Last 5 plans: 03-02 (1 min), 03-03 (3 min), 03-04 (3 min), 04-01 (6 min)
- Trend: UI work taking slightly longer than protocol layer

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

### Deferred Issues

None yet.

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-30
Stopped at: Completed Plan 04-01 (Chat UI Foundation)
Resume file: None
Next action: Plan 04-02 (Chat Input Bar)

## Phase 4 Progress

Plan 04-01 complete. Chat UI foundation provides:
- ChatViewModel as @MainActor @Observable wrapping ProtocolHandler
- Combine subscriptions for incomingMessages and botStateUpdates
- Optimistic update pattern with .pending status
- Duplicate message handling by MessageID
- MessageBubble SwiftUI view with sender-based styling
- User messages right-aligned with clawdbotPurple
- Bot messages left-aligned with clawdbotSurface
- Status indicators for pending/sent/delivered/failed
- ChatView with NavigationStack and scrollable message list
- Auto-scroll to bottom using scrollPosition(id:anchor:)
- Connection status indicator in toolbar
- ClawdbotChat namespace module
- 11 new tests for ChatViewModel (91 total tests pass)

Remaining in Phase 4:
- 04-02: Chat Input Bar (safeAreaInset, send button, @FocusState)
- 04-03: Message Persistence (in-memory store with future SQLite/SwiftData)
