---
phase: 02-web-foundation
plan: 01
subsystem: chat-ui
tags: [react, streaming, streamdown, shiki, intersection-observer, hooks, chat]

# Dependency graph
requires:
  - 01-02
provides:
  - Streaming chat hook (useChatStream) with React 19 startTransition
  - Auto-scroll hook (useScrollAnchor) with IntersectionObserver
  - ChatMessage component with Streamdown markdown + Shiki syntax highlighting
  - ChatInput with multiline textarea, Enter/Shift+Enter, send/stop
  - ChatContainer integrating hooks + components + connection setup
  - /chat route page
affects: [02-02, 02-03, 02-04, 05-web-sessions]

# Tech tracking
tech-stack:
  added: []
  patterns: [useChatStream with startTransition, Streamdown + @streamdown/code, IntersectionObserver scroll anchor, async generator streaming consumption]

key-files:
  created:
    - 1-Apps/1L-Opta-Local/web/src/hooks/useChatStream.ts
    - 1-Apps/1L-Opta-Local/web/src/hooks/useScrollAnchor.ts
    - 1-Apps/1L-Opta-Local/web/src/components/chat/ChatMessage.tsx
    - 1-Apps/1L-Opta-Local/web/src/components/chat/ChatInput.tsx
    - 1-Apps/1L-Opta-Local/web/src/components/chat/ChatContainer.tsx
    - 1-Apps/1L-Opta-Local/web/src/app/chat/page.tsx
  modified:
    - 1-Apps/1L-Opta-Local/web/src/app/globals.css

key-decisions:
  - "useChatStream wraps token appends in startTransition for non-blocking streaming at 20-100 tok/s"
  - "AbortController ref in useChatStream allows mid-stream stop without closing the connection improperly"
  - "ChatMessage uses memo() to prevent re-rendering user messages when only assistant content changes"
  - "Streamdown with @streamdown/code (createCodePlugin) for markdown rendering with Shiki syntax highlighting"
  - "Both light/dark themes set to github-dark-default for OLED-only design"
  - "streamdown/styles.css imported in globals.css for animation keyframes"
  - "Default model hardcoded as 'default' — will be replaced by model picker in 02-02"

patterns-established:
  - "useChatStream: client + model passed per-call (not bound to hook), messages state managed internally"
  - "useScrollAnchor: IntersectionObserver on invisible anchor div, autoScroll only when isAtBottom"
  - "ChatMessage: memo'd component, user=glass-subtle right-aligned, assistant=Streamdown left-aligned"
  - "ChatInput: textarea with auto-resize, Enter=send, Shift+Enter=newline, stop button during streaming"
  - "ChatContainer: initializes LMXClient from getConnectionSettings(), shows empty state with prompt suggestions"

issues-created: []

# Metrics
duration: 5min
completed: 2026-02-18
status: review
---

# Phase 2 Plan 1: Streaming Chat Engine and Message UI Summary

**Streaming chat hooks (useChatStream + useScrollAnchor), message components with Streamdown markdown rendering, and /chat page with full-height layout**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-18
- **Completed:** 2026-02-18
- **Tasks:** 2
- **Files created:** 6
- **Files modified:** 1

## Accomplishments
- Created `useChatStream` hook wrapping LMXClient.streamChat() async generator with React 19 startTransition for non-blocking token appends during fast streaming
- Created `useScrollAnchor` hook using IntersectionObserver on an anchor element to auto-scroll during streaming while respecting user scroll-up position
- Built `ChatMessage` component (memo'd) rendering user messages as glass-subtle panels and assistant messages via Streamdown with Shiki syntax highlighting (github-dark-default theme)
- Built `ChatInput` with auto-resizing multiline textarea, Enter to send, Shift+Enter for newline, stop button (Square icon) during streaming, send button (SendHorizontal icon) otherwise
- Built `ChatContainer` integrating all hooks and components: initializes LMXClient from saved ConnectionSettings, manages scroll anchor, displays empty state with prompt suggestions, shows error banner
- Created `/chat` page route with full-height flex layout (glass header + chat area + input)
- Added `streamdown/styles.css` import to globals.css for animation keyframes

## Task Commits

Each task was committed atomically:

1. **Task 1: Streaming chat hooks** - `1c8a938` (feat)
2. **Task 2: Chat message components and /chat page** - `85f6e7b` (feat)

## Files Created/Modified
- `web/src/hooks/useChatStream.ts` — Streaming chat hook with startTransition, AbortController, optimistic message append
- `web/src/hooks/useScrollAnchor.ts` — IntersectionObserver-based auto-scroll with showScrollButton state
- `web/src/components/chat/ChatMessage.tsx` — Memo'd message component with Streamdown + @streamdown/code for markdown
- `web/src/components/chat/ChatInput.tsx` — Multiline textarea with auto-resize, Enter/Shift+Enter, send/stop
- `web/src/components/chat/ChatContainer.tsx` — Integration container: LMXClient init, hooks, empty state, error banner
- `web/src/app/chat/page.tsx` — /chat route page with glass header and full-height layout
- `web/src/app/globals.css` — Added streamdown/styles.css import

## Decisions Made
- Token append state updates wrapped in `startTransition()` to keep UI responsive during fast streaming (Pattern 1 from research)
- `useChatStream` takes client+model per-call rather than binding at hook creation, enabling model switching mid-session (02-02)
- ChatMessage uses `React.memo()` to avoid re-rendering all user messages on each streaming token
- Streamdown configured with `createCodePlugin({ themes: ['github-dark-default', 'github-dark-default'] })` for OLED-only dark mode
- AbortController in useChatStream allows clean stream cancellation via stop() — sets isStreaming to false immediately
- Empty state shows 4 prompt suggestions in a 2-column grid with Sparkles icons
- Default model is hardcoded as `'default'` — model picker will be added in plan 02-02

## Deviations from Plan

- **Minor: streamdown/styles.css import added** — Not explicitly in the plan, but required for Streamdown's animation keyframes (caret, fade-in). Added to globals.css.
- **Minor: Loading indicator for empty assistant messages** — Added a pulsing dot indicator when assistant content is empty but streaming has started, providing immediate visual feedback.

## Issues Encountered
None — all files compiled cleanly on first build attempt.

## Next Phase Readiness
- Chat UI foundation complete: streaming hooks + message components + /chat page all working
- Ready for Plan 02-02: Model picker with Radix Select can plug into ChatContainer's model prop
- Ready for Plan 02-03/02-04: Session persistence can wrap useChatStream's messages state

---
*Phase: 02-web-foundation*
*Completed: 2026-02-18*
