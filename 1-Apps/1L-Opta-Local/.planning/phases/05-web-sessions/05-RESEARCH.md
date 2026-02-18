# Phase 5: Web Sessions - Research

**Researched:** 2026-02-18
**Domain:** Session list, search, resume architecture for CLI-to-Web continuity
**Confidence:** HIGH

<research_summary>
## Summary

Researched session management for Opta Local Web: browsing CLI sessions, searching/filtering, and resuming conversations in the browser. The critical finding is that **LMX has no session endpoints** -- sessions are stored entirely client-side. Opta CLI stores sessions as JSON files in `~/.config/opta/sessions/<id>.json` with a well-defined Zod-validated schema. This means Web cannot read CLI sessions through LMX; a new session API must be added to LMX (server-side approach) or sessions must be exposed via the CLI's HTTP server (already exists at `src/commands/server.ts`).

**Key findings:**
1. **LMX has zero session endpoints.** The entire `/admin/*` API is model management, metrics, presets, and benchmarks. No `/admin/sessions` routes exist.
2. **CLI sessions are local JSON files** at `~/.config/opta/sessions/<id>.json` with an index file for fast listing. Schema: `{ id, created, updated, model, cwd, title, tags, messages: AgentMessage[], toolCallCount, compacted }`.
3. **CLI already has a full session API** -- list, search, delete, export, tag, rename, resume -- all in `src/memory/store.ts`. Search is fuzzy with weighted scoring across ID, title, tags, model, and message content.
4. **Schema mismatch exists** between CLI's `AgentMessage` (OpenAI format with `tool_calls`, `tool_call_id`, `content: string | ContentPart[] | null`) and Web's `ChatMessage` (simplified with `id`, `role`, `content: string`, `model?`, `tokens_used?`, `created_at`). Web's type needs expansion or a mapping layer.
5. **Fuse.js (v7.1) is already in the Opta ecosystem** (AICompare Web uses it) -- proven for client-side fuzzy search.
6. **@tanstack/react-virtual (v3.13)** is the standard for virtualizing long session lists in React.

**Primary recommendation:** Add session CRUD endpoints to LMX (`/admin/sessions`, `/admin/sessions/:id`). LMX runs on Mac Studio where CLI sessions are stored -- it can read them directly from `~/.config/opta/sessions/`. This is the simplest cross-platform path: CLI writes files, LMX reads and serves them, Web fetches via API. No extra server needed.
</research_summary>

<standard_stack>
## Standard Stack

### Session List & Search
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| swr | ^2.3 | Session list fetching + cache | Already in package.json, proven for read-heavy patterns |
| fuse.js | ^7.1 | Client-side fuzzy search | Already in ecosystem (AICompare), lightweight (2KB gzipped) |
| @tanstack/react-virtual | ^3.13 | Virtual scrolling for large session lists | Headless, 60fps, framework-agnostic virtualizer |

### Session Resume UI
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| framer-motion | ^12 | List animations, glass panel transitions | Already required per CLAUDE.md |
| lucide-react | ^0.563 | Session icons (MessageSquare, Search, Clock, Tag) | Already required per CLAUDE.md |
| date-fns | ^4.1 | Relative date formatting ("2 hours ago", "Yesterday") | Tree-shakeable, no moment.js bloat |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fuse.js | Server-side search via LMX | Fuse.js gives instant results; server search adds latency but scales better with 1000+ sessions |
| @tanstack/react-virtual | react-window | TanStack Virtual is newer, headless (no opinionated components), better DX |
| date-fns | Intl.RelativeTimeFormat | date-fns more ergonomic; Intl API has limited "ago" formatting |
| SWR | TanStack Query | SWR already installed; Query adds mutations but sessions are mostly read-only |

**Installation:**
```bash
cd 1-Apps/1L-Opta-Local/web
npm install fuse.js @tanstack/react-virtual date-fns
# swr, framer-motion, lucide-react already installed
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: LMX Session API (Server Must Be Added)
**What:** LMX needs new `/admin/sessions` endpoints to serve CLI session data to web clients
**Why:** CLI stores sessions in `~/.config/opta/sessions/*.json` on Mac Studio. LMX runs on the same machine. Web browser cannot access filesystem directly.
**What exists now:** Zero session endpoints in LMX. The admin API (`api/admin.py`) covers models, memory, metrics, presets, benchmarks, config, and SSE events only.

**Required new endpoints (to be added to LMX):**
```python
# GET /admin/sessions — List session summaries (paginated)
# GET /admin/sessions/:id — Get full session with messages
# GET /admin/sessions/search?q=... — Server-side search
# DELETE /admin/sessions/:id — Delete a session
```

**Implementation path:** LMX already has a `Memory` dependency injection in `api/deps.py`. A new `SessionStore` class can read from `~/.config/opta/sessions/` (or a configurable path) and the index file for fast listing.

### Pattern 2: CLI Session Schema (Source of Truth)
**What:** The canonical session format lives in CLI's `src/memory/store.ts`
**When to use:** Any code that reads/writes sessions must match this schema

```typescript
// CLI Session schema (Zod-validated)
interface Session {
  id: string;          // nanoid(12) — e.g., "V1StGXR8_Z5j"
  created: string;     // ISO 8601
  updated: string;     // ISO 8601
  model: string;       // e.g., "mlx-community/Qwen2.5-Coder-32B-Instruct-4bit"
  cwd: string;         // Working directory when session was created
  title: string;       // Auto-generated from first message (60 char max)
  tags: string[];      // User-added tags via /tag command
  messages: AgentMessage[];  // Full OpenAI-format messages
  toolCallCount: number;
  compacted: boolean;  // Whether context was compacted
}

interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[] | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };
```

**Storage:** Files at `~/.config/opta/sessions/<id>.json` plus `index.json` for fast listing.
**Index schema:**
```typescript
interface SessionIndex {
  entries: Record<string, {
    title: string;
    model: string;
    tags: string[];
    created: string;
    messageCount: number;
  }>;
  updatedAt: string;
}
```

### Pattern 3: Session List with SWR + Virtual Scroll
**What:** Fetch session list from LMX, cache with SWR, render with virtual scroll
**When to use:** Sessions page (`/sessions`)

```typescript
// hooks/useSessions.ts
import useSWR from 'swr';

interface SessionSummary {
  id: string;
  title: string;
  model: string;
  tags: string[];
  created: string;
  updated: string;
  messageCount: number;
}

export function useSessions() {
  const { data, error, isLoading, mutate } = useSWR<SessionSummary[]>(
    '/admin/sessions',
    fetcher,
    {
      refreshInterval: 30_000,  // Refresh every 30s (new sessions from CLI)
      revalidateOnFocus: true,
    },
  );
  return { sessions: data ?? [], error, isLoading, refresh: mutate };
}
```

### Pattern 4: Client-Side Fuzzy Search with Fuse.js
**What:** Instant search across session titles, models, and tags without server roundtrip
**When to use:** Search bar on sessions page
**Why not server-side:** Session list is small enough (<1000 entries) for client search. Eliminates latency.

```typescript
import Fuse from 'fuse.js';

const fuse = new Fuse(sessions, {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'model', weight: 0.2 },
    { name: 'tags', weight: 0.3 },
    { name: 'id', weight: 0.1 },
  ],
  threshold: 0.4,     // Fuzzy tolerance
  includeScore: true,
});

const results = fuse.search(query);
```

### Pattern 5: Session Resume Flow
**What:** Load a session's full message history and continue chatting
**When to use:** User clicks "Resume" on a session or navigates to `/chat/[id]`

**Flow:**
1. Fetch full session: `GET /admin/sessions/:id` (includes all messages)
2. Map `AgentMessage[]` to Web's display format (filter system messages, extract text from ContentPart arrays)
3. Hydrate chat UI with message history
4. Scroll to bottom of message list
5. User types new message -> append to existing messages -> stream via `/v1/chat/completions`
6. Save updated session back to LMX: `PUT /admin/sessions/:id`

**Key consideration:** Tool call messages (`role: 'tool'`) and tool_calls on assistant messages should be displayed as collapsible "tool use" blocks, not as regular chat messages.

### Pattern 6: Web Session Type Mapping
**What:** Web's `ChatMessage` is simpler than CLI's `AgentMessage`. Need mapping layer.
**Current Web type:** `{ id, role, content: string, model?, tokens_used?, created_at }`
**CLI type:** `{ role, content: string | ContentPart[] | null, tool_calls?, tool_call_id? }`

**Recommendation:** Extend Web's `ChatMessage` to handle the full CLI schema:
```typescript
// Extended ChatMessage for session resume
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentPart[] | null;
  model?: string;
  tokens_used?: number;
  created_at: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
```

Or create a separate `SessionMessage` type for resumed sessions and keep `ChatMessage` simple for new chats.

### Anti-Patterns to Avoid
- **Don't store sessions in browser localStorage.** They belong on the server (LMX/Mac Studio). Browser is a thin client.
- **Don't build a session sync protocol.** LMX is the single source of truth. CLI writes, LMX serves, Web reads.
- **Don't fetch full session data for the list view.** Use summary endpoint (index.json data) for the list, full session only on resume.
- **Don't search server-side for <500 sessions.** Client-side Fuse.js is faster and eliminates network latency.
- **Don't render 500+ DOM nodes.** Use @tanstack/react-virtual when session count exceeds ~50.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy text search | Custom string matching | Fuse.js (already in ecosystem) | Handles typos, weighted fields, scoring |
| Virtual scrolling | Custom IntersectionObserver | @tanstack/react-virtual | 60fps, handles dynamic heights, tiny bundle |
| Relative dates | Custom "X ago" math | date-fns `formatDistanceToNow()` | Handles edge cases (leap years, DST, locales) |
| Session list sorting | Custom sort functions | Array.sort with ISO string comparison | ISO dates sort lexicographically |
| Session search scoring | Custom relevance scoring | Fuse.js includeScore | Battle-tested relevance ranking |
| Tag filtering UI | Custom checkbox filter | Simple state array with `.filter()` | Tags are string arrays, native JS suffices |
| Session list caching | Manual cache + revalidation | SWR (already installed) | Stale-while-revalidate, focus revalidation, dedup |
| Glass card animations | CSS keyframes | Framer Motion `<AnimatePresence>` + `layout` prop | Required by CLAUDE.md, spring physics |

**Key insight:** The session management challenge is 80% backend (getting CLI sessions to Web) and 20% frontend. Don't over-engineer the UI -- the hard part is adding LMX endpoints.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Assuming LMX Has Session Endpoints
**What goes wrong:** Planning to `fetch('/admin/sessions')` fails with 404 because the endpoint doesn't exist
**Why it happens:** The roadmap mentions "LMX /admin/sessions endpoints" as a research topic because their existence was uncertain
**What we found:** LMX has ZERO session endpoints. The entire admin API is model/memory/metrics/preset management.
**How to avoid:** Session API must be built as a prerequisite (either in LMX Phase 5 prep, or via CLI's existing HTTP server). This is Phase 5's primary blocker.
**Severity:** BLOCKER -- cannot proceed without session data source

### Pitfall 2: Schema Mismatch Between CLI and Web Sessions
**What goes wrong:** Resumed sessions show `[object Object]` for message content or crash on `tool_calls` access
**Why it happens:** CLI's `AgentMessage.content` can be `string | ContentPart[] | null` (OpenAI format). Web's `ChatMessage.content` is `string` only. Tool messages have no display mapping.
**How to avoid:** Create a `normalizeMessage()` function that extracts text from ContentPart arrays, converts null to empty string, and categorizes tool_call messages into a displayable format.
**Warning signs:** TypeScript errors on content access, `undefined` renders in message list

### Pitfall 3: Loading Full Sessions for List View
**What goes wrong:** Sessions page takes 5+ seconds to load because it fetches all message data for every session
**Why it happens:** Each session JSON file can be 100KB+ (long conversations). Loading 50 full sessions = 5MB+ transfer.
**How to avoid:** Use session index/summary endpoint that returns only `{ id, title, model, tags, created, messageCount }`. Full session loaded only on resume.
**Warning signs:** Slow initial page load, high network transfer in DevTools

### Pitfall 4: Session State Drift During Resume
**What goes wrong:** User resumes session on Web, types messages, but CLI still has the old version. Next CLI resume overwrites Web changes.
**Why it happens:** CLI saves sessions on exit. Web saves sessions via LMX API. No conflict resolution.
**How to avoid:** Use `updated` timestamp for optimistic concurrency. On resume, check if session was modified since load. On save, include `expected_updated` for compare-and-swap. V1: warn user if session was modified elsewhere. V2: merge strategy.
**Warning signs:** Lost messages after switching between CLI and Web

### Pitfall 5: Tool Call Messages Breaking Chat Display
**What goes wrong:** Resumed sessions show mysterious "function" messages or system messages interspersed with chat
**Why it happens:** CLI sessions include `role: 'tool'` messages (tool execution results), `role: 'system'` (system prompt), and assistant messages with `tool_calls` arrays. Web chat UI only handles user/assistant.
**How to avoid:** Filter system messages from display. Collapse tool call sequences (assistant with tool_calls + tool responses) into expandable "Tool Use" blocks. Only show user and assistant text in the main thread.
**Warning signs:** Gibberish text, JSON in message bubbles, unexplained gaps in conversation

### Pitfall 6: Virtual Scroll Jump on New Message
**What goes wrong:** User is reading old messages, a new message arrives, scroll jumps to bottom
**Why it happens:** @tanstack/react-virtual auto-scrolls on item count change if not handled
**How to avoid:** Track whether user has scrolled up (`isAtBottom` state). Only auto-scroll if user is at or near bottom. Show "New message" indicator when scrolled up.
**Warning signs:** Reading context lost during streaming, jumpiness on new token append
</common_pitfalls>

<code_examples>
## Code Examples

### Session List Page with Search and Virtual Scroll
```typescript
// Source: Pattern combining SWR + Fuse.js + @tanstack/react-virtual
// app/sessions/page.tsx

'use client';

import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Fuse from 'fuse.js';
import { Search, MessageSquare, Clock, Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useSessions } from '@/hooks/useSessions';
import type { SessionSummary } from '@/types/lmx';

export default function SessionsPage() {
  const { sessions, isLoading } = useSessions();
  const [query, setQuery] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);

  // Build Fuse index once, re-index when sessions change
  const fuse = useMemo(
    () =>
      new Fuse(sessions, {
        keys: [
          { name: 'title', weight: 0.4 },
          { name: 'model', weight: 0.2 },
          { name: 'tags', weight: 0.3 },
          { name: 'id', weight: 0.1 },
        ],
        threshold: 0.4,
      }),
    [sessions],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return sessions;
    return fuse.search(query).map((r) => r.item);
  }, [sessions, query, fuse]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated row height in px
    overscan: 5,
  });

  return (
    <div className="flex flex-col h-full gap-4 p-6">
      {/* Search bar */}
      <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
        <Search className="w-4 h-4 text-white/40" />
        <input
          type="text"
          placeholder="Search sessions..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-transparent text-white placeholder:text-white/30 outline-none flex-1"
        />
        <span className="text-xs text-white/30">{filtered.length} sessions</span>
      </div>

      {/* Virtual session list */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const session = filtered[virtualRow.index]!;
            return (
              <SessionRow
                key={session.id}
                session={session}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

### Message Normalization for Resumed Sessions
```typescript
// Source: Pattern to convert CLI AgentMessage to displayable format
// lib/session-utils.ts

import type { ChatMessage } from '@/types/lmx';

interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: string; text?: string }> | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolUse?: {
    name: string;
    args: string;
    result?: string;
  }[];
  created_at: string;
}

/**
 * Convert CLI session messages to displayable chat messages.
 * Filters system messages, collapses tool call sequences,
 * and extracts text from ContentPart arrays.
 */
export function normalizeSessionMessages(
  messages: AgentMessage[],
  sessionCreated: string,
): DisplayMessage[] {
  const display: DisplayMessage[] = [];
  const toolResults = new Map<string, string>();

  // First pass: collect tool results by tool_call_id
  for (const msg of messages) {
    if (msg.role === 'tool' && msg.tool_call_id) {
      toolResults.set(
        msg.tool_call_id,
        typeof msg.content === 'string' ? msg.content : '[result]',
      );
    }
  }

  // Second pass: build display messages
  for (const msg of messages) {
    if (msg.role === 'system' || msg.role === 'tool') continue;

    const content = extractText(msg.content);

    const toolUse = msg.tool_calls?.map((tc) => ({
      name: tc.function.name,
      args: tc.function.arguments,
      result: toolResults.get(tc.id),
    }));

    display.push({
      id: crypto.randomUUID(),
      role: msg.role as 'user' | 'assistant',
      content,
      toolUse: toolUse?.length ? toolUse : undefined,
      created_at: sessionCreated, // Individual message timestamps not stored by CLI
    });
  }

  return display;
}

function extractText(
  content: string | Array<{ type: string; text?: string }> | null,
): string {
  if (content === null) return '';
  if (typeof content === 'string') return content;
  return content
    .filter((part) => part.type === 'text' && part.text)
    .map((part) => part.text!)
    .join('');
}
```

### Session Resume Hook
```typescript
// Source: Pattern for loading and resuming a session
// hooks/useSessionResume.ts

'use client';

import { useState, useCallback, useRef } from 'react';
import type { LMXClient } from '@/lib/lmx-client';
import { normalizeSessionMessages } from '@/lib/session-utils';
import type { DisplayMessage } from '@/lib/session-utils';

interface UseSessionResumeOptions {
  client: LMXClient;
  sessionId: string;
}

export function useSessionResume({ client, sessionId }: UseSessionResumeOptions) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [model, setModel] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const sessionRef = useRef<{ id: string; messages: unknown[] } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      // Future: client.getSession(sessionId) once LMX endpoint exists
      const session = await client.request(`/admin/sessions/${sessionId}`);
      sessionRef.current = session;
      setModel(session.model);
      setTitle(session.title || 'Untitled');
      setMessages(normalizeSessionMessages(session.messages, session.created));
    } finally {
      setIsLoading(false);
    }
  }, [client, sessionId]);

  const sendMessage = useCallback(
    async (content: string) => {
      // Append user message to display
      const userMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Stream response from LMX
      const assistantMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Build full message history for API (including original CLI messages)
      const apiMessages = [
        ...(sessionRef.current?.messages ?? []),
        { role: 'user', content },
      ];

      let fullContent = '';
      for await (const token of client.streamChat(model, apiMessages)) {
        fullContent += token;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: fullContent } : m,
          ),
        );
      }

      // TODO: Save updated session back to LMX
    },
    [client, model],
  );

  return { messages, model, title, isLoading, load, sendMessage };
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-window / react-virtualized | @tanstack/react-virtual v3 | 2024-2025 | Headless, smaller bundle, better DX, framework-agnostic |
| moment.js for dates | date-fns v4 (tree-shakeable) | 2024 | 95% smaller bundle via tree-shaking |
| Custom search scoring | Fuse.js v7 with configurable keys/weights | 2024 | Handles fuzzy matching, scoring, field weighting |
| Manual SWR revalidation | SWR v2 with `revalidateOnFocus` + intervals | 2023 | Automatic freshness for session lists |
| Full page re-render on search | useDeferredValue + virtual scroll | React 19 | Non-blocking search rendering |

**New patterns available:**
- **React 19 `use()` hook:** Could load session data in Server Components, though sessions page needs client-side search (so `'use client'` likely needed anyway)
- **React ViewTransitions API:** Could animate navigation from session list to chat resume view
- **Optimistic updates with `useOptimistic`:** Could instantly show session deletion in list before server confirms

**Not yet stable:**
- React Activity component (keep SSE alive while session list is in background) -- experimental in React 19
</sota_updates>

<open_questions>
## Open Questions

1. **LMX Session API: Build vs. Use CLI Server?**
   - What we know: LMX has no session endpoints. CLI has an HTTP server (`src/commands/server.ts`) that could serve session data.
   - What's unclear: Should we add session endpoints to LMX (Python, closer to data), or have Web talk to CLI's HTTP server (TypeScript, already has full session API)?
   - **Recommendation:** Add to LMX. It runs as a daemon on Mac Studio where sessions live. CLI server is ephemeral (only runs when user starts it). LMX is always available.
   - Impact: Requires Python work in `1-Apps/1J-Opta-LMX/src/opta_lmx/api/` before this phase can ship.

2. **Session Ownership and Concurrency**
   - What we know: CLI saves sessions on exit. Web would save sessions via LMX. Both write to the same JSON files.
   - What's unclear: What happens when CLI and Web both have the same session open? What about CLI sessions with tool calls that Web cannot execute?
   - **Recommendation:** V1: Read-only resume for CLI sessions that had tool calls (show history, allow new chat but don't replay tools). Use `updated` timestamp for last-writer-wins conflict resolution. V2: Optimistic locking with `If-Match` headers.

3. **Session Save Behavior for Web-Originated Sessions**
   - What we know: CLI sessions have `cwd` (working directory) and `compacted` fields. Web sessions have neither concept.
   - What's unclear: Should Web create new sessions in CLI-compatible format? Or should Web sessions be a separate category?
   - **Recommendation:** Web sessions should use the same format with `cwd: "web"` and `compacted: false`. This way CLI can list and resume Web sessions too.

4. **Session Message Timestamps**
   - What we know: CLI does not store per-message timestamps. Only session-level `created` and `updated` exist.
   - What's unclear: Should Web add per-message timestamps to resumed sessions? Would this break CLI's Zod validation?
   - **Recommendation:** Do not add extra fields to CLI session format. Use session `created` for display, and track display-only timestamps in Web state (not persisted).

5. **Virtual Scroll Threshold**
   - What we know: @tanstack/react-virtual adds complexity. For <50 sessions, native rendering is fine.
   - What's unclear: How many sessions will typical users accumulate?
   - **Recommendation:** Start without virtual scroll. Add it when session count exceeds 100 (lazy optimization). Check performance with 50-session dataset first.

6. **Full-Text Search Across Message Content**
   - What we know: CLI search looks at first 6 messages only (for performance). Fuse.js on summary data covers title/model/tags.
   - What's unclear: Do users need to search inside message content from the Web sessions page?
   - **Recommendation:** V1: Fuse.js on summaries only (title, model, tags). V2: Server-side content search via LMX if users request it. This mirrors CLI's approach.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence -- direct codebase analysis)
- **Opta-LMX admin API** (`1-Apps/1J-Opta-LMX/src/opta_lmx/api/admin.py`) -- Complete admin endpoint inventory. Zero session endpoints confirmed.
- **Opta CLI session store** (`1-Apps/1D-Opta-CLI-TS/src/memory/store.ts`) -- Full session CRUD, Zod schema, search algorithm, index file format.
- **Opta CLI AgentMessage type** (`1-Apps/1D-Opta-CLI-TS/src/core/agent.ts`) -- Canonical message schema with ContentPart, tool_calls.
- **Opta CLI sessions command** (`1-Apps/1D-Opta-CLI-TS/src/commands/sessions.ts`) -- List, search, resume, delete, export actions.
- **Opta CLI chat resume** (`1-Apps/1D-Opta-CLI-TS/src/commands/chat.ts`) -- Resume flow: load session, restore messages, continue chatting.
- **Opta Local Web types** (`1-Apps/1L-Opta-Local/web/src/types/lmx.ts`) -- Current Session and ChatMessage type definitions.
- **Opta Local LMXClient** (`1-Apps/1L-Opta-Local/web/src/lib/lmx-client.ts`) -- Existing streaming chat implementation.
- **AICompare Web** (`1-Apps/1B-AICompare-Web/package.json`) -- Fuse.js v7.1 usage confirmation.

### Secondary (MEDIUM confidence -- library documentation)
- [@tanstack/react-virtual](https://tanstack.com/virtual/latest) -- v3.13.18, headless virtual scroll for React
- [Fuse.js documentation](https://www.fusejs.io/) -- v7.x fuzzy search API
- [date-fns](https://date-fns.org/) -- v4.x date formatting utilities
- [SWR documentation](https://swr.vercel.app/) -- v2.x data fetching hooks

### Tertiary (LOW confidence -- needs runtime validation)
- Session file sizes for 50+ conversations (estimated 100KB+ per session with tool calls)
- Virtual scroll performance threshold (estimated ~100 sessions before needed)
- LMX session endpoint implementation complexity (estimated 1-2 hours of Python)
</sources>

<metadata>
## Metadata

**Research scope:**
- LMX session API status: NO endpoints exist (BLOCKER identified)
- CLI session format: Fully documented (Zod schema, storage path, index file, search algorithm)
- Cross-platform compatibility: Schema mismatch identified, mapping layer designed
- Session list UX: Fuse.js + SWR + virtual scroll (when needed)
- Session resume architecture: Load from LMX, normalize messages, continue streaming

**Confidence breakdown:**
- LMX API status: HIGH -- read every line of admin.py (1045 lines)
- CLI session schema: HIGH -- read store.ts (334 lines) with Zod validation
- Schema compatibility: HIGH -- compared both type definitions side-by-side
- Architecture patterns: MEDIUM -- patterns derived from codebase analysis, not tested
- Virtual scroll threshold: LOW -- needs real-world data

**Blocker identified:** LMX needs session endpoints before Web Sessions can ship. This is a **cross-app dependency** requiring Python work in `1-Apps/1J-Opta-LMX/`.

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days -- session schema unlikely to change)
</metadata>

---

*Phase: 05-web-sessions*
*Research completed: 2026-02-18*
*Ready for planning: YES (after LMX session endpoint prerequisite is addressed)*
