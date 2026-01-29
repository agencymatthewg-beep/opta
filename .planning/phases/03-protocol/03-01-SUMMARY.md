---
phase: 03-protocol
plan: 01
subsystem: protocol
tags: [swift, codable, sendable, async, actor, streaming]

# Dependency graph
requires:
  - phase: 02-connection
    provides: WebSocket client infrastructure for message transport
provides:
  - MessageID for unique message identification
  - ChatMessage for protocol-level chat messages
  - ProtocolEnvelope for versioned message wrapping
  - MessageAck for delivery confirmation
  - BotState for thinking/typing indicators
  - StreamingChunk for partial response handling
  - StreamingMessageAssembler actor for chunk aggregation
affects: [03-02, 03-03, 03-04, 04-chat-core, 05-streaming]

# Tech tracking
tech-stack:
  added: []
  patterns: [actor-based-assembler, codable-enums-with-custom-coding, generic-envelope-pattern]

key-files:
  created:
    - apps/ios/ClawdbotKit/Sources/ClawdbotKit/Protocol/MessageTypes.swift
    - apps/ios/ClawdbotKit/Sources/ClawdbotKit/Protocol/StreamingTypes.swift
    - apps/ios/ClawdbotKit/Tests/ClawdbotKitTests/MessageTypesTests.swift
  modified: []

key-decisions:
  - "MessageID as struct (not raw String) for type safety and ExpressibleByStringLiteral convenience"
  - "MessageSender enum with custom Codable for user/bot identification supporting multi-bot"
  - "ProtocolEnvelope generic wrapper enabling different payload types with shared metadata"
  - "StreamingMessageAssembler as actor for thread-safe chunk aggregation"
  - "All types Codable + Sendable for async safety"

patterns-established:
  - "Actor pattern for thread-safe state aggregation"
  - "Generic envelope pattern for protocol messages"
  - "Custom Codable for enum with associated values"

issues-created: []

# Metrics
duration: 3min
completed: 2026-01-30
---

# Phase 3 Plan 01: Message Type Definitions Summary

**Codable Swift message types for Clawdbot protocol: MessageID, ChatMessage, ProtocolEnvelope, MessageAck, BotState, StreamingChunk, and thread-safe StreamingMessageAssembler actor**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-29T15:33:54Z
- **Completed:** 2026-01-29T15:36:15Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- Created MessageID struct with UUID generation and string literal support
- Implemented ChatMessage with thread/reply support and delivery status
- Built ProtocolEnvelope generic wrapper with versioning and sequence numbers
- Added MessageAck for delivery confirmation flow
- Created BotState enum for thinking/typing/toolUse indicators
- Implemented StreamingChunk for partial response handling
- Built StreamingMessageAssembler actor for thread-safe chunk aggregation with out-of-order support
- All types are Codable + Sendable for Swift concurrency safety
- 15 unit tests covering all types and assembler behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Create core message types** - `e88fcd4` (feat)
2. **Task 2: Create streaming response types** - `300659e` (feat)
3. **Task 3: Add unit tests for message types** - `e168c93` (test)

## Files Created/Modified

- `apps/ios/ClawdbotKit/Sources/ClawdbotKit/Protocol/MessageTypes.swift` - Core message types (MessageID, MessageStatus, MessageSender, ChatMessage, ProtocolEnvelope, MessageAck)
- `apps/ios/ClawdbotKit/Sources/ClawdbotKit/Protocol/StreamingTypes.swift` - Streaming types (BotState, BotStateUpdate, StreamingChunk, StreamingMessageAssembler)
- `apps/ios/ClawdbotKit/Tests/ClawdbotKitTests/MessageTypesTests.swift` - Unit tests for all message and streaming types

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| MessageID as struct | Type safety over raw String, with ExpressibleByStringLiteral for convenience |
| MessageSender custom Codable | Enum with associated value needs explicit coding for bot name |
| Generic ProtocolEnvelope<T> | Reusable envelope for any payload type with shared version/sequence metadata |
| Actor for StreamingMessageAssembler | Thread-safe chunk aggregation without manual locking |
| isFinal flag on StreamingChunk | Simple completion detection without separate completion message |
| Index-based chunk ordering | Handles out-of-order network delivery gracefully |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- Message types ready for Plan 03-02 (Protocol encoder/decoder)
- StreamingChunk and StreamingMessageAssembler ready for Plan 03-04 (Protocol integration)
- Foundation complete for chat UI development in Phase 4

---
*Phase: 03-protocol*
*Completed: 2026-01-30*
