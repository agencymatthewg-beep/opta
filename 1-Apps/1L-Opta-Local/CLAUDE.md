# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Opta Local is a multi-platform dashboard and chat client for the Opta LMX inference server (Mac Studio at `192.168.188.11:1234`). The browser talks directly to LMX — there is no intermediate backend. Two platforms share the same backend contracts defined in `SHARED.md`.

| Platform | Location | Stack |
|----------|----------|-------|
| Web | `web/` | Next.js 16, React 19, TypeScript, Tailwind v4 |
| iOS | `ios/` | SwiftUI (iOS 17+), Swift strict concurrency |

Read `SHARED.md` for backend API contracts, data models, and design tokens shared by both platforms. Each platform has its own `CLAUDE.md` with detailed rules.

---

## Web App

### Commands

```bash
cd web

npm run dev          # Dev server at http://localhost:3004
npm run build        # Production build (Next.js)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test:unit    # Vitest unit tests (tests/unit/**)
npm run test:integration  # Vitest integration tests (tests/integration/**)
npm run test:e2e     # Playwright e2e (requires running dev server + LMX)
npm run test:e2e:smoke    # Smoke test only (faster)
npm run check        # lint + typecheck + unit + integration + build (CI gate)
```

Run a single vitest test file:
```bash
npx vitest run tests/unit/connection.test.ts
```

### Environment Variables

Copy `.env.local.example` → `.env.local`. Key vars:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Shared Opta Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key |
| `NEXT_PUBLIC_SITE_URL` | OAuth redirect base — **must match deployment domain** |
| `E2E_SUPABASE_TEST_EMAIL/PASSWORD` | Only needed for authenticated e2e tests |

---

## Architecture

### Dual-Mode Design (Critical)

The app runs in two modes determined by protocol at runtime:

- **LAN mode** (`http://`) — direct connection to Mac Studio, no auth required, Supabase client returns null
- **Cloud mode** (`https://`) — requires Supabase sign-in, connects to LMX via Cloudflare Tunnel

`isLanAvailable()` in `lib/connection.ts` gates HTTP fetch calls — HTTPS pages cannot make mixed-content requests to HTTP LMX.

### Provider Stack

Components are wrapped in two providers (outermost first):

```
AuthProvider            → Supabase session, useAuth() / useAuthSafe()
  ConnectionProvider    → LAN/WAN/offline state, LMXClient instance, admin key
    App content
```

`useAuthSafe()` returns `null` when Supabase is unconfigured (LAN mode). All components that may render in both modes must use `useAuthSafe()`, not `useAuth()`.

### Connection Manager (`lib/connection.ts`)

- Admin key stored encrypted via Web Crypto API (AES-GCM, PBKDF2, origin-bound) — never plain localStorage
- URL probing: tries LAN (`http://host:port`) with 1.5s timeout first, then tunnel URL with 8s timeout
- Settings persisted under `opta-local:*` localStorage keys; changes broadcast via `CONNECTION_SETTINGS_UPDATED_EVENT`
- Default LAN target: `192.168.188.11:1234`

### LMX Client (`lib/lmx-client.ts`)

Single class, instantiated by `useConnection` and provided via context. Admin key sent as `X-Admin-Key` header. Chat uses `fetch` + `ReadableStream` (not `EventSource`) to support custom headers. Dashboard metrics use `EventSource` SSE at `/admin/events`.

### Supabase Auth (`lib/supabase/`)

Three files follow the Supabase SSR pattern:
- `client.ts` — browser client (graceful null if env vars absent)
- `server.ts` — server client using Next.js `cookies()` (Server Components, Server Actions)
- `middleware.ts` — session refresh on every request via `updateSession()`
- `auth-actions.ts` — Server Actions for OAuth (Google, Apple) and sign-out

OAuth redirect target is `NEXT_PUBLIC_SITE_URL + /auth/callback`. The callback route (`app/auth/callback/route.ts`) exchanges the code for a session and redirects to the `next` query param.

### Storage Pattern

- `lib/storage.ts` — `getSecure(key)` / `setSecure(key, value)` for AES-GCM encrypted localStorage
- `lib/chat-store.ts` — IndexedDB via `idb-keyval` for chat sessions
- `lib/arena-store.ts`, `lib/agent-store.ts`, `lib/branch-store.ts` — IndexedDB stores for their respective features

### Key Shared Utilities

- `lib/auth-utils.ts` — `POST_SIGN_IN_NEXT_KEY` constant + `sanitizeNextPath()` — used by AppShell and sign-in page; import from here, never duplicate
- `lib/format.ts` — number/duration formatting for dashboard metrics
- `lib/circular-buffer.ts` — `CircularBuffer<T>` for throughput history (capacity 300)

---

## Supabase Migrations

`supabase/migrations/` at the repo root contains DB schema for cloud sync features.
Apply via Supabase CLI (`supabase db push`) or the Supabase dashboard.

---

## Design System

All design tokens defined in `SHARED.md`. Rules (mandatory, enforced):
- **All UI work** → invoke `/frontend-design` skill first
- **Glass panels** → `GlassPanel` from `@opta/ui` or `.glass` / `.glass-subtle` / `.glass-strong` CSS classes
- **Colors** → CSS variables only, never hex literals in component code
- **Icons** → Lucide React only
- **Animation** → Framer Motion only (no CSS transitions for interactive elements)
- **Conditional classes** → `cn()` from `@opta/ui`
- **Dark mode only**, OLED-optimized, desktop-first responsive

---

## iOS App

See `ios/CLAUDE.md` for all rules.

**Build:** The Xcode project is generated from `ios/project.yml` via XcodeGen:
```bash
cd ios
xcodegen generate    # regenerate .xcodeproj after editing project.yml
open OptaLocal.xcodeproj
```
Regenerate whenever you add/remove Swift files or change build settings. Never edit `.xcodeproj` directly.

Key constraints:
- SwiftUI only (no UIKit), strict concurrency (`@Observable @MainActor`)
- Keychain for admin key (not UserDefaults)
- Bonjour (`_opta-lmx._tcp`) for LAN discovery — no manual IP entry needed
- No Combine, no Alamofire, no force unwraps
