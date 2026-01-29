---
phase: 04-chat-core
plan: 01
subsystem: chat-ui
tags: [swift, swiftui, observable, combine, chat-view, message-bubble]

# Dependency graph
requires:
  - phase: 03-04
    provides: ProtocolHandler with Combine publishers (incomingMessages, botStateUpdates)
provides:
  - ChatViewModel @Observable class wrapping ProtocolHandler
  - MessageBubble SwiftUI view for chat bubbles
  - ChatView with scrollable message list and auto-scroll
  - ClawdbotChat namespace module
affects: [04-02-chat-input, 05-streaming, 06-rich-text]

# Tech tracking
tech-stack:
  added: []
  patterns: [observable-wrapping-actor, optimistic-updates, scroll-position-api]

key-files:
  created:
    - apps/ios/ClawdbotKit/Sources/ClawdbotKit/Chat/ChatViewModel.swift
    - apps/ios/ClawdbotKit/Sources/ClawdbotKit/Chat/MessageBubble.swift
    - apps/ios/ClawdbotKit/Sources/ClawdbotKit/Chat/Chat.swift
    - apps/ios/ClawdbotMobile/ClawdbotMobile/Views/ChatView.swift
    - apps/ios/ClawdbotKit/Tests/ClawdbotKitTests/ChatViewModelTests.swift
  modified:
    - apps/ios/ClawdbotMobile/ClawdbotMobile.xcodeproj/project.pbxproj

key-decisions:
  - "@Observable @MainActor class wrapping ProtocolHandler actor for SwiftUI"
  - "Combine .receive(on: DispatchQueue.main) for UI thread safety"
  - "Optimistic update: append message before async send completes"
  - "Duplicate handling by MessageID prevents double entries"
  - "scrollPosition(id:anchor:) API for programmatic scroll control"
  - "User bubbles right-aligned with clawdbotPurple, bot bubbles left with clawdbotSurface"

patterns-established:
  - "Observable View Model Wrapping Actor pattern from 04-RESEARCH.md"
  - "Optimistic update with status tracking (.pending -> .delivered)"
  - "iOS 17+ scrollPosition for auto-scroll behavior"

issues-created: []

# Metrics
duration: 6min
completed: 2026-01-30
---

# Phase 4 Plan 01: Chat UI Foundation Summary

**ChatViewModel with @Observable, MessageBubble, and ChatView with auto-scroll message list**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-30T16:34:06Z
- **Completed:** 2026-01-30T16:40:08Z
- **Tasks:** 5
- **Files created:** 5
- **Files modified:** 1

## Accomplishments

- Created ChatViewModel as @MainActor @Observable class wrapping ProtocolHandler
- Implemented Combine subscriptions for incomingMessages and botStateUpdates
- Added optimistic update pattern: message appears immediately with .pending status
- Duplicate message handling by MessageID prevents double entries on server echo
- Created MessageBubble SwiftUI view with sender-based alignment and coloring
- User messages: right-aligned with clawdbotPurple background
- Bot messages: left-aligned with clawdbotSurface background
- Status indicators: clock (pending), checkmark (sent/delivered), error (failed)
- Created ChatView in ClawdbotMobile with NavigationStack and scrollable message list
- Implemented auto-scroll to bottom on new messages using scrollPosition(id:anchor:)
- Added connection status indicator dot in toolbar (green/amber/red)
- Created ClawdbotChat namespace following Protocol.swift pattern
- Added 11 new tests for ChatViewModel (91 total tests pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ChatViewModel** - `c2bcb2f` (feat)
2. **Task 2: Create MessageBubble** - `cff5873` (feat)
3. **Task 3: Create ChatView** - `2a23d84` (feat)
4. **Task 4: Create Chat module exports** - `51209b3` (feat)
5. **Task 5: Add ChatViewModel tests** - `08382b2` (test)

## Files Created/Modified

- `apps/ios/ClawdbotKit/Sources/ClawdbotKit/Chat/ChatViewModel.swift` - Observable view model with Combine subscriptions and optimistic updates
- `apps/ios/ClawdbotKit/Sources/ClawdbotKit/Chat/MessageBubble.swift` - Chat bubble view with sender-based styling
- `apps/ios/ClawdbotKit/Sources/ClawdbotKit/Chat/Chat.swift` - Module exports with ClawdbotChat namespace
- `apps/ios/ClawdbotMobile/ClawdbotMobile/Views/ChatView.swift` - Main chat screen with message list and auto-scroll
- `apps/ios/ClawdbotKitTests/ChatViewModelTests.swift` - 11 tests covering send, optimistic updates, duplicates
- `apps/ios/ClawdbotMobile/ClawdbotMobile.xcodeproj/project.pbxproj` - Added Views group and ChatView.swift

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| @Observable @MainActor for ChatViewModel | Simplest iOS 17+ pattern for SwiftUI binding with thread safety |
| Combine .receive(on: DispatchQueue.main) | UI updates must happen on main thread |
| Optimistic append before await send | Instant visual feedback per research recommendations |
| Duplicate handling by MessageID | Prevents double entries when server echoes message back |
| scrollPosition(id:anchor:) API | iOS 17+ declarative scroll control, better than ScrollViewReader |
| clawdbotPurple for user, clawdbotSurface for bot | Consistent with ClawdbotColors design system |

## Deviations from Plan

**Minor adaptation:** Plan referenced "Clawdbot iOS" directory but actual app is "ClawdbotMobile". Created ChatView in correct location at `apps/ios/ClawdbotMobile/ClawdbotMobile/Views/ChatView.swift`.

## Issues Encountered

None

## Next Phase Readiness

- Chat UI foundation complete with ChatViewModel, MessageBubble, ChatView
- Ready for Plan 04-02 (Chat Input Bar) - add safeAreaInset input with send button
- ProtocolHandler integration tested via Combine publishers
- 91 tests pass covering all protocol and chat functionality

---
*Phase: 04-chat-core*
*Completed: 2026-01-30*
