# Opta Local — V2 Feature Set

> 7 features requested for implementation. Captured 2026-02-18 to ensure nothing is lost.

## Feature Tracking

| # | Feature | Priority | Backend | Status |
|---|---------|----------|---------|--------|
| F02 | Connection Health Heartbeat | High | No | **Implemented** |
| F03 | Token Cost Estimator | High | No | **Implemented** |
| F06 | Multi-Model Arena Mode | High | No | **Implemented** |
| F07 | Smart Context from Clipboard | Medium | No | **Implemented** |
| F09 | Session Branching (Fork Chat) | Medium | No | **Implemented** |
| F11 | RAG Over Local Files | High | Exists | **Implemented** |
| F10 | Opta Agent Workspace | Medium | Client-side | **Implemented** |

## F02: Connection Health Heartbeat

**Goal:** Lightweight 10s heartbeat ping during active SSE sessions. If 3 consecutive pings fail, show reconnection banner before SSE timeout fires.

**Why:** Catches silent connection drops faster than waiting for SSE error. Current system relies on 30s reprobe intervals.

**Builds on:** `useConnection.ts`, `useSSE.ts`, `ConnectionBadge.tsx`

**Implementation:**
- Add heartbeat ping to useSSE (fetch `/admin/status` every 10s while SSE open)
- Track consecutive failures (3 = show reconnection banner)
- New `HeartbeatIndicator` component with pulse animation
- Integrate into dashboard page

## F03: Token Cost Estimator

**Goal:** Display running token count and estimated "cloud equivalent cost" per chat session. Shows savings vs API pricing.

**Why:** Motivates self-hosted value proposition. No cloud service shows this.

**Builds on:** `useChatStream.ts`, `ChatContainer.tsx`, `types/lmx.ts`

**Implementation:**
- Token counting during streaming (estimate from content length: ~4 chars/token)
- Pricing reference data (GPT-4o, Claude 3.5 Sonnet rates)
- `TokenCostBar` component showing running count + cloud equivalent cost
- Session-level cost accumulator
- "You saved $X.XX this session" summary

## F06: Multi-Model Arena Mode

**Goal:** Send same prompt to 2-3 loaded models simultaneously, render side-by-side, rate which is better.

**Why:** Unique to multi-model local setups. No cloud service offers this with your own hardware.

**Builds on:** `useChatStream.ts`, `LMXClient`, `useModels.ts`

**Implementation:**
- New `/arena` page
- `useArenaStream` hook (parallel streamChat calls)
- Side-by-side response panels
- Rating system (A better / B better / tie)
- Preference history in IndexedDB
- Model selection (pick 2-3 from loaded models)

## F07: Smart Context from Clipboard

**Goal:** Detect clipboard content type and auto-suggest relevant system prompts.

**Why:** Removes the blank-canvas problem. Paste Python → "Want me to review, explain, or refactor?"

**Builds on:** `ChatInput.tsx`, `ChatContainer.tsx`

**Implementation:**
- `useClipboardDetector` hook (Clipboard API, paste event)
- Content type detection (code language, URL, image, plain text)
- Suggestion popover with context-specific prompt templates
- Auto-insert system message with detected content context

## F09: Session Branching (Fork Chat)

**Goal:** Click any message to "fork" the conversation from that point. Tree visualization.

**Why:** Explore alternative responses without losing original thread.

**Builds on:** `chat-store.ts`, `ChatContainer.tsx`, `Session` type

**Implementation:**
- Extended Session type with `parentId`, `branchPoint` fields
- `forkSession` function in chat-store
- Fork button on each message
- Branch indicator in session list
- Tree visualization component
- Navigation between branches

## F11: RAG Over Local Files

**Goal:** Index local directories on Mac Studio, embed with loaded model, query documents in chat.

**Why:** Killer feature for privacy — everything stays local. No cloud upload.

**Backend:** ALREADY EXISTS in LMX (`api/rag.py`, `rag/store.py`, `rag/chunker.py`, embedding engine)

**Implementation:**
- New `/rag` page with directory browser
- `useRAG` hook wrapping LMX RAG API endpoints
- Document ingestion UI (drag-drop, directory picker)
- Collection management (create, list, delete)
- Chat integration: "Search my codebase" queries route through RAG
- Source citation display in chat messages

## F10: Opta Agent Workspace

**Goal:** Define multi-step agent workflows: "Research → Summarize → Draft email". Visual pipeline editor.

**Why:** Web dashboard becomes mission control for AI agents. No API costs.

**Backend:** Needs LMX agent execution endpoints (does not exist yet)

**Implementation:**
- New `/agents` page
- Visual pipeline editor (drag-drop steps)
- Step types: prompt, transform, conditional, tool call
- Agent execution engine (chains prompts across models)
- Execution log viewer
- Template library for common workflows
- Real-time progress streaming via SSE

---

*Captured 2026-02-18. All 7 features implemented 2026-02-18 via 5 parallel agents + direct coding.*
*Commit: `70b7e74` — 37 files, 6,761 lines added. TypeScript strict + Next.js build verified.*
