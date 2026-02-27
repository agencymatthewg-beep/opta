# Plan 02-02 Summary: Model Picker and Chat History Persistence

**Phase:** 02-web-foundation
**Plan:** 02-02
**Status:** COMPLETE
**Date:** 2026-02-18

---

## What Was Done

### Task 1: Model List Hook and Model Picker Component

**Files created:**
- `web/src/hooks/useModels.ts` -- SWR hook fetching loaded models from LMXClient.getModels()
- `web/src/components/chat/ModelPicker.tsx` -- Radix Select dropdown with model metadata

**Details:**
- `useModels` uses SWR with 10-second refresh interval, revalidation on focus, and 2 error retries
- Returns `{ models, isLoading, isError, refresh }` with graceful empty-array fallback
- `ModelPicker` renders Radix Select with glass-subtle trigger showing selected model name
- Each dropdown item shows: model name, quantization badge (via @opta/ui Badge), context length, VRAM usage
- Radix Tooltip on each option shows full model ID/path and relative load time
- Loading state: spinner with "Loading models..." text
- Empty state: amber alert icon with "No models loaded" message
- Helper functions: `formatContextLength` (32768 -> "32K") and `formatRelativeTime` (ISO -> "5m ago")

### Task 2: Chat History Persistence and Integration

**Files created:**
- `web/src/lib/chat-store.ts` -- idb-keyval session persistence layer
- `web/src/hooks/useSessionPersist.ts` -- Auto-save hook with beforeunload safety net

**Files modified:**
- `web/src/components/chat/ChatContainer.tsx` -- Integrated session persistence and session ID management
- `web/src/app/chat/page.tsx` -- Integrated ModelPicker, useModels, and navigation

**Details:**

**chat-store.ts:**
- Uses idb-keyval for IndexedDB key-value storage (< 600 bytes, async, gigabyte capacity)
- Prefixed keys: `opta-session:{id}` to avoid collisions
- Functions: `saveChatSession`, `getChatSession`, `deleteChatSession`, `listChatSessions`
- `listChatSessions` returns `ChatSessionSummary[]` (excludes full messages for performance)
- `generateSessionTitle` truncates first user message to 60 chars

**useSessionPersist.ts:**
- Auto-saves after each completed assistant response (not during streaming -- avoids excessive writes)
- Deduplicates saves by comparing JSON-serialized messages with last saved state
- `beforeunload` event handler as best-effort safety net for mid-stream exits
- `restore()` callback for loading existing sessions by ID

**ChatContainer.tsx changes:**
- Added `sessionId` prop for loading existing sessions
- Generates `crypto.randomUUID()` session ID on first message if not provided
- Restores messages from IndexedDB if `sessionId` is provided
- Uses `useSessionPersist` for automatic persistence

**chat/page.tsx changes:**
- Replaced hardcoded "default" model with dynamic model selection
- Integrated `useModels` hook with auto-select of first loaded model
- Added `ModelPicker` in header (right-aligned, `ml-auto`)
- Added navigation back link (ArrowLeft icon) to dashboard

---

## Bug Fix (Pre-existing)

Fixed `size="default"` TypeScript errors in:
- `web/src/app/settings/page.tsx`
- `web/src/app/settings/tunnel/page.tsx`

The `@opta/ui` Button component only accepts `"sm" | "md" | "lg"`, not `"default"`. Changed to `size="md"`.

---

## Verification

- [x] `pnpm run build` passes without errors
- [x] Model picker renders with Radix Select (glass styling, metadata badges)
- [x] `useModels` hook polls LMX every 10s via SWR
- [x] Chat sessions persist to IndexedDB via `saveChatSession`
- [x] Auto-save triggers after streaming completes (not during)
- [x] Session restore supported via `sessionId` prop
- [x] First loaded model auto-selected when none chosen
- [x] Navigation back to dashboard via ArrowLeft link

---

## Commits

1. `6799998` -- `feat(02-02): model picker and useModels hook`
2. `aeabdd3` -- `feat(02-02): chat history persistence with idb-keyval`

---

## Architecture Decisions

1. **SWR over manual polling:** SWR handles caching, deduplication, and error retry automatically. Manual `setInterval` + `fetch` would need all of this hand-rolled.

2. **idb-keyval over localStorage:** Chat sessions with code blocks grow fast. localStorage caps at 5-10MB and blocks the UI thread. idb-keyval provides async IndexedDB access in < 600 bytes.

3. **Save after streaming completes, not on every token:** Saving on every token at 50-100 tok/s would create excessive IndexedDB writes. Save once when streaming finishes, with `beforeunload` as safety net.

4. **ChatSessionSummary for list operations:** Avoid loading full message arrays when listing sessions. The summary type includes only metadata fields needed for the list view.

5. **Session ID generated on first message, not on mount:** Prevents empty sessions from being created when users visit the chat page without sending anything.

6. **Dual client initialization:** Both `ChatPage` (for useModels) and `ChatContainer` (for sending) initialize LMXClient independently. This keeps them decoupled -- ChatContainer works standalone without the model picker.

---

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `web/src/hooks/useModels.ts` | Created | SWR hook for model list polling |
| `web/src/components/chat/ModelPicker.tsx` | Created | Radix Select model dropdown |
| `web/src/lib/chat-store.ts` | Created | idb-keyval session persistence |
| `web/src/hooks/useSessionPersist.ts` | Created | Auto-save hook |
| `web/src/components/chat/ChatContainer.tsx` | Modified | Session persistence integration |
| `web/src/app/chat/page.tsx` | Modified | Model picker + navigation integration |
| `web/src/app/settings/page.tsx` | Modified | Bug fix: Button size prop |
| `web/src/app/settings/tunnel/page.tsx` | Modified | Bug fix: Button size prop |
