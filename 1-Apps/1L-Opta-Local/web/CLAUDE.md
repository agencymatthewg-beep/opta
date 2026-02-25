# Opta Local Web — CLAUDE.md

> Coding rules for the Next.js 16 web client. Read `../CLAUDE.md` and `../SHARED.md` first.

---

## Commands

```bash
npm run dev          # Dev server at http://localhost:3004
npm run build        # Production build
npm run typecheck    # tsc --noEmit
npm run test:unit    # Vitest unit (tests/unit/**)
npm run check        # lint + typecheck + unit + integration + build (CI gate)
```

Single test file: `npx vitest run tests/unit/connection.test.ts`

`@` path alias resolves to `./src` (configured in `vitest.config.ts` and `tsconfig.json`).

### Turbopack Root

`next.config.ts` sets `turbopack.root` to `../../..` (monorepo root). This allows the dev server to resolve `@opta/ui` (workspace package at `6-Packages/6D-UI/`). Don't remove this setting — `npm run dev` will fail to resolve workspace deps without it.

---

## Stack

- **Framework:** Next.js 16 (App Router, not static export — middleware requires server)
- **UI:** React 19 + `@opta/ui` + Tailwind CSS v4
- **Animation:** Framer Motion only (no CSS transitions for interactive elements)
- **Icons:** Lucide React only
- **HTTP:** Native `fetch` with streaming; `@microsoft/fetch-event-source` for SSE with custom headers
- **Auth:** Supabase SSR (`@supabase/ssr`) — dual-mode LAN/cloud

## Mandatory Rules

### UI/UX

- **ALL UI work MUST invoke the `/frontend-design` skill** before any component creation
- **Glass panels:** `GlassPanel` from `@opta/ui` or `.glass` / `.glass-subtle` / `.glass-strong`
- **Colors:** CSS variables only — never hex/rgb literals in component code
- **Typography:** Sora font. Headings: 600–700 weight.
- **Conditional classes:** `cn()` from `@opta/ui`
- **Dark mode only** — OLED-optimized `#09090b` background, no light theme

### Code

- TypeScript strict mode (`strict: true`, `noUncheckedIndexedAccess: true`)
- Server Components by default; `'use client'` only when needed (state, effects, browser APIs)
- No `any` types — use `unknown` + type narrowing
- API calls wrapped in custom hooks (`useChatStream`, `useConnection`, `useModels`, etc.)
- Auth: use `useAuthSafe()` for components that may render in LAN mode; `useAuth()` only when cloud-only

### Streaming & SSE

- Chat streaming: `fetch` + `ReadableStream` (not EventSource — needed for `X-Admin-Key` header)
- Dashboard metrics: `EventSource` SSE at `/admin/events`
- Always handle connection drops with auto-reconnect

## File Structure

```
src/
├── app/
│   ├── layout.tsx                  # Root layout — mounts AppShell (AuthProvider + ConnectionProvider)
│   ├── page.tsx                    # Dashboard (SSE metrics, VRAM gauge, heartbeat)
│   ├── auth/callback/route.ts      # OAuth code exchange → session → redirect
│   ├── sign-in/page.tsx            # Google/Apple OAuth + email/phone sign-in
│   ├── chat/
│   │   ├── page.tsx                # New chat
│   │   └── [id]/page.tsx           # Resume session
│   ├── arena/page.tsx              # Side-by-side model comparison
│   ├── agents/page.tsx             # Agent workflow UI
│   ├── models/page.tsx             # Model library
│   ├── sessions/page.tsx           # Session history
│   ├── pair/page.tsx               # Device pairing
│   ├── rag/page.tsx                # RAG Studio
│   ├── devices/page.tsx            # Device registry
│   └── settings/
│       ├── layout.tsx              # Settings sidebar nav
│       ├── page.tsx                # General (host, port, admin key)
│       ├── tunnel/page.tsx         # Cloudflare Tunnel URL config
│       └── account/page.tsx        # Supabase auth state, sign-out
├── components/
│   ├── dashboard/                  # VRAMGauge, ThroughputChart, ModelList
│   ├── chat/                       # ChatContainer, ChatInput, ChatMessage, ModelPicker
│   ├── rag/                        # QueryPanel
│   └── shared/
│       ├── AppShell.tsx            # Nav + AuthProvider + ConnectionProvider wrapper
│       ├── AuthProvider.tsx        # Supabase session context
│       ├── ConnectionProvider.tsx  # LAN/WAN/offline state context
│       └── OptaPrimitives.tsx      # OptaSurface component
├── hooks/
│   ├── useConnection.ts            # Primary: returns { connectionType, baseUrl, client, ... }
│   ├── useChatStream.ts            # Streaming chat completions
│   ├── useSessions.ts              # Session CRUD
│   ├── useModels.ts                # Model listing + load/unload
│   ├── useHeartbeat.ts             # Periodic /admin/status polling + latency
│   ├── useSSE.ts                   # SSE subscription with reconnect
│   ├── useArenaStream.ts           # Dual-model arena streaming
│   ├── useAgentWorkflow.ts         # Agent task execution
│   ├── useRAG.ts                   # RAG ingest + query
│   ├── useCloudSync.ts             # Supabase session sync
│   ├── useDevices.ts               # Device registry queries
│   ├── useSessionResume.ts         # Cross-device session resume
│   ├── useSessionPersist.ts        # IndexedDB session persistence
│   ├── useScrollAnchor.ts          # Chat scroll-to-bottom anchor
│   ├── useBufferedState.ts         # Debounced state for streaming
│   ├── useTokenCost.ts             # Token count / cost estimation
│   └── useClipboardDetector.ts     # Clipboard paste detection
├── lib/
│   ├── lmx-client.ts               # LMXClient class (chat, admin, RAG endpoints)
│   ├── connection.ts               # Settings I/O, URL probing, client factory
│   ├── storage.ts                  # AES-GCM encrypted localStorage (getSecure/setSecure)
│   ├── auth-utils.ts               # POST_SIGN_IN_NEXT_KEY + sanitizeNextPath()
│   ├── chat-store.ts               # IndexedDB chat session persistence (idb-keyval)
│   ├── arena-store.ts              # IndexedDB arena sessions
│   ├── agent-store.ts              # IndexedDB agent state
│   ├── branch-store.ts             # IndexedDB conversation branching
│   ├── cloud-sync.ts               # Supabase real-time sync helpers
│   ├── session-mapper.ts           # LMX session ↔ local format mapping
│   ├── format.ts                   # Number/duration formatters for metrics
│   ├── circular-buffer.ts          # CircularBuffer<T> for throughput history
│   ├── opta-daemon-client.ts       # Opta daemon IPC client
│   └── supabase/
│       ├── client.ts               # Browser Supabase client (null if env absent)
│       ├── server.ts               # Server Supabase client (cookies() API)
│       ├── middleware.ts           # Session refresh via updateSession()
│       └── auth-actions.ts         # Server Actions: signInWithGoogle, signOut, etc.
└── types/
    ├── lmx.ts                      # ServerStatus, LoadedModel, ChatMessage, Session
    ├── cloud.ts                    # Supabase DB schema types (Device, CloudSession)
    ├── agent.ts                    # Agent workflow types
    └── rag.ts                      # RAG collection/chunk types
```

## Patterns

### Connection Context

```typescript
// Get the active LMX client and connection state
const { client, connectionType, baseUrl, latencyMs } = useConnectionContext();
// connectionType: 'probing' | 'lan' | 'wan' | 'offline'
```

### Auth (safe — works in both LAN and cloud modes)

```typescript
const auth = useAuthSafe(); // null in LAN mode
if (auth?.user) {
  // cloud mode, user signed in
}
```

### Chat Streaming

```typescript
// ReadableStream — NOT EventSource (custom headers required)
async function* streamChat(model, messages) {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'X-Admin-Key': adminKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
  });
  // parse SSE data: lines, yield deltas
}
```

### Admin Key Storage

```typescript
// Always encrypted — never plain localStorage
import { getSecure, setSecure } from '@/lib/storage';
await setSecure('opta-local:adminKey', key);
const key = await getSecure('opta-local:adminKey');
```

## Don'ts

- Don't use `axios` — native `fetch` only
- Don't use CSS-in-JS — Tailwind + CSS variables only
- Don't import from `@opta/ui` without checking the component exists first (it's a local workspace package)
- Don't store admin keys in plain localStorage — `lib/storage.ts` encrypted helpers only
- Don't poll when SSE is available
- Don't use `useAuth()` in components that render in LAN mode — use `useAuthSafe()`
- Don't duplicate `POST_SIGN_IN_NEXT_KEY` or `sanitizeNextPath` — import from `lib/auth-utils.ts`
- Don't add logic between `createServerClient` and `getUser()` in server auth code (breaks session refresh)
