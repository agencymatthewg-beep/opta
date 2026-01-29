---
phase: 05-streaming-state
plan: 02
subsystem: chat-ui
tags: [swift, swiftui, animation, bot-state, thinking-indicator]

# Dependency graph
requires:
  - phase: 05-01
    provides: ChatViewModel streaming state management, streamingChunks publisher
  - phase: 03-01
    provides: BotState enum (idle, thinking, typing, toolUse), BotStateUpdate
  - phase: 03-04
    provides: ProtocolHandler botStateUpdates publisher
provides:
  - Bot thinking state visualization in chat
  - ThinkingIndicator SwiftUI component with animated dots
  - ChatViewModel botState and botStateDetail tracking
affects: [05-03-typing-indicator, 09-multi-bot]

# Tech tracking
tech-stack:
  added: []
  patterns: [state-driven-ui, animated-indicator, combine-observation]

key-files:
  created:
    - apps/ios/ClawdbotKit/Sources/ClawdbotKit/Chat/ThinkingIndicator.swift
  modified:
    - apps/ios/ClawdbotKit/Sources/ClawdbotKit/Chat/ChatViewModel.swift
    - apps/ios/ClawdbotKit/Sources/ClawdbotKit/Chat/Chat.swift
    - apps/ios/ClawdbotMobile/ClawdbotMobile/Views/ChatView.swift
    - apps/ios/ClawdbotKit/Tests/ClawdbotKitTests/ChatViewModelTests.swift

key-decisions:
  - "botState property exposes BotState enum directly for SwiftUI binding"
  - "botStateDetail for tool use descriptions (e.g., 'Searching web...')"
  - "ThinkingIndicator uses timer-based staggered dot animation"
  - "Indicator shows when thinking/toolUse AND no streaming messages"
  - "Auto-scroll triggers on botState changes"
  - "Typing cursor shows only when botState == .typing"

patterns-established:
  - "State-driven UI indicator pattern"
  - "Timer-based animation for staggered effects"
  - "Conditional indicator display based on multiple state variables"

issues-created: []

# Metrics
duration: 5min
completed: 2026-01-30
---

# Phase 5 Plan 02: Thinking State Visualization Summary

**ThinkingIndicator component and ChatViewModel bot state tracking for immediate user feedback during bot processing**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-30T06:47:00Z
- **Completed:** 2026-01-30T06:54:00Z
- **Tasks:** 4
- **Files created:** 1
- **Files modified:** 4

## Accomplishments

- Added `botState: BotState` property to ChatViewModel (default: .idle)
- Added `botStateDetail: String?` for tool use descriptions
- Implemented `handleBotStateUpdate()` to update state from ProtocolHandler
- Created ThinkingIndicator SwiftUI component with three bouncing dots
- Timer-based animation with 0.3s interval for staggered dot movement
- Optional detail text displayed below dots (e.g., "Searching the web...")
- Matches bot message styling (left-aligned, clawdbotSurface background)
- Documented ThinkingIndicator in Chat module exports (version 1.2.0)
- Integrated ThinkingIndicator into ChatView message list
- Shows when botState is .thinking or .toolUse (not when streaming)
- Auto-scroll triggers when bot state changes
- Typing cursor in MessageBubble shows only when botState == .typing
- 6 new tests for bot state tracking (transitions, detail handling)
- All 115 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add bot state tracking to ChatViewModel** - `71e0da0` (feat)
2. **Task 2: Create ThinkingIndicator component** - `ad3247d` (feat)
3. **Task 3: Export ThinkingIndicator from Chat module** - `b91d001` (docs)
4. **Task 4: Display ThinkingIndicator in ChatView** - `9076614` (feat, combined with 05-03)

## Files Created/Modified

- `apps/ios/ClawdbotKit/Sources/ClawdbotKit/Chat/ChatViewModel.swift` - Added botState, botStateDetail properties and handleBotStateUpdate()
- `apps/ios/ClawdbotKit/Sources/ClawdbotKit/Chat/ThinkingIndicator.swift` - SwiftUI view with animated dots and optional detail text
- `apps/ios/ClawdbotKit/Sources/ClawdbotKit/Chat/Chat.swift` - Added ThinkingIndicator to exports, bumped to 1.2.0
- `apps/ios/ClawdbotMobile/ClawdbotMobile/Views/ChatView.swift` - Integrated ThinkingIndicator with state-driven display
- `apps/ios/ClawdbotKit/Tests/ClawdbotKitTests/ChatViewModelTests.swift` - 6 new bot state tests

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| botState as BotState enum directly | Simple SwiftUI binding, type-safe state |
| botStateDetail String? | Only populated for toolUse, nil otherwise |
| Timer-based staggered animation | Smooth sequential dot bounce effect |
| Indicator hidden when streaming | Prevents overlap with typing cursor |
| showThinkingIndicator computed | Clean conditional logic in one place |
| Auto-scroll on botState change | Indicator always visible when it appears |

## Deviations from Plan

**Task 4 overlap with 05-03:** The ChatView changes for ThinkingIndicator display were partially implemented alongside the typing cursor feature (05-03). Both features interact with botState, so they were combined in commit `9076614`. This is a natural coupling - the typing cursor should show only when typing, and the thinking indicator should show when thinking/toolUse.

## Issues Encountered

None - plan executed smoothly with expected wave 1 dependencies in place.

## Next Phase Readiness

- Bot state visualization complete with ThinkingIndicator
- ChatViewModel exposes botState for UI binding
- Shows "thinking..." animation before streaming begins
- Shows tool detail text during toolUse (e.g., "Searching web...")
- Ready for Phase 5 Plan 03 (Typing Indicator) - typing state + cursor animation
- All 115 tests pass covering streaming, state, and persistence

---
*Phase: 05-streaming-state*
*Completed: 2026-01-30*
