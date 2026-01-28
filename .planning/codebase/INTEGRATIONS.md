# External Integrations

**Analysis Date:** 2026-01-28

## APIs & External Services

**AI/LLM Providers:**
- Google Gemini - AI assistance and analysis
  - SDK/Client: `@google/generative-ai@0.24.1`, `mcp-gemini-cli@0.3.1`
  - Auth: API key (environment-based)
  - Used for: Chat, vision, reasoning

- Anthropic Claude - Alternative AI provider
  - Auth: ANTHROPIC_API_KEY env var
  - Used for: Primary reasoning in Claude Code context

- OpenAI - Vision and embeddings
  - Auth: OPENAI_API_KEY env var
  - Used for: Opta iOS vision scanning feature

**Chess Services:**
- Lichess API - Game imports and puzzles
  - Integration: REST API via fetch (`Opta MacOS/src/lib/lichess.ts`)
  - Auth: Public API, no key required
  - Endpoints: Game exports, user profiles, puzzles

- Chess.com API - Game history
  - Integration: REST API (`Opta MacOS/src/lib/chesscom.ts`)
  - Auth: Public API

- Stockfish WASM - Chess engine
  - Package: `stockfish@17.1.0`
  - Integration: Web Worker (`Opta MacOS/src/hooks/useStockfish.ts`)

## Data Storage

**Databases:**
- Supabase - Backend for Opta iOS
  - Connection: SUPABASE_URL, SUPABASE_ANON_KEY env vars
  - Features: Auth, Postgres, real-time subscriptions
  - SDK: @supabase/supabase-js (planned)

- SQLite - Local storage for opta-native
  - Crate: rusqlite 0.31 with bundled bindings
  - Purpose: Offline-first data persistence

**File Storage:**
- Local filesystem - All apps use local storage
  - macOS: Application Support directory
  - Web: localStorage, sessionStorage
  - iOS: UserDefaults (with Keychain migration planned)

**Caching:**
- Next.js ISR - Server-side caching for web
  - Revalidation: 900s for news, 1800s for weather
- In-memory - React state for desktop
- UserDefaults - Swift settings persistence

## Authentication & Identity

**Auth Provider (Web):**
- next-auth 5.0.0-beta.30 - Session management
  - Location: `opta-life-manager/auth.ts`
  - Token storage: httpOnly cookies
  - Session management: JWT with refresh tokens

**OAuth Integrations:**
- Google OAuth - Primary social sign-in
  - Credentials: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
  - Scopes: calendar, gmail.modify, userinfo.email, userinfo.profile
  - Token refresh: 5-minute buffer automatic refresh

## Google Workspace Integration

**Google Calendar API v3:**
- Location: `opta-life-manager/lib/actions.ts`
- MCP: `@cocal/google-calendar-mcp@2.4.1`
- Features: Event CRUD, date range queries, fuzzy matching
- Auth: OAuth tokens from next-auth session

**Gmail API v1:**
- Location: `opta-life-manager/lib/actions.ts`
- MCP: `@gongrzhe/server-gmail-autoauth-mcp@1.1.11`
- Features: Unread emails, draft creation, thread metadata
- Auth: OAuth tokens with gmail.modify scope

**Google Drive:**
- MCP: `@isaacphi/mcp-gdrive@0.2.0`
- Features: File search, document access

**YouTube:**
- MCP: `@kirbah/mcp-youtube@0.3.2`
- Features: Video search, transcripts, statistics

## Productivity APIs

**Todoist API v2/v9:**
- Location: `opta-life-manager/lib/todoist.ts`
- REST endpoint: `https://api.todoist.com/rest/v2`
- Sync endpoint: `https://api.todoist.com/sync/v9`
- Auth: Bearer token (TODOIST_API_TOKEN)
- Features: Task/project CRUD, labels, recurring tasks

## Content & News

**Hacker News API:**
- Location: `opta-life-manager/lib/news.ts`
- Endpoint: `https://hacker-news.firebaseio.com/v0/`
- Auth: None (public API)
- Features: AI/Tech filtered stories
- Caching: 15-minute revalidation

**Open-Meteo API:**
- Location: `opta-life-manager/lib/weather.ts`
- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Auth: None (free API)
- Features: Current + 5-day forecast, WMO codes
- Caching: 30-minute revalidation

## Monitoring & Observability

**Error Tracking:**
- None configured (console.error only)

**Analytics:**
- None configured

**Logs:**
- Vercel logs for web (7-day retention)
- Console output for desktop
- OSLog for iOS

## CI/CD & Deployment

**Hosting (Web):**
- Vercel - Next.js hosting
  - Deployment: Automatic on main push
  - Environment vars: Vercel dashboard
  - Edge runtime: Configured for auth routes

**Hosting (Desktop):**
- Direct distribution - DMG/App bundle
  - Build: Tauri CLI
  - Signing: Apple Developer account
  - Distribution: Direct download, App Store planned

**Hosting (Mobile):**
- Expo/App Store - iOS distribution
  - Build: Expo EAS
  - Distribution: TestFlight, App Store

## Environment Configuration

**Development:**
- Required env vars: See `.env.example` files
- Secrets location: `.env.local` (gitignored)
- Mock services: Stripe test mode (if used)

**Production:**
- Secrets management: Vercel environment variables
- API keys: Securely stored per environment

## Webhooks & Callbacks

**Incoming:**
- None currently configured

**Outgoing:**
- None currently configured

## System Integration (Desktop)

**macOS IOKit:**
- Crates: core-foundation, io-kit-sys, mach2
- Purpose: Hardware telemetry, SMC access
- Features: CPU/GPU temps, fan speed, memory pressure

**Tauri Plugins:**
- Global shortcuts: `@tauri-apps/plugin-global-shortcut@2.3.1`
- OS integration: `@tauri-apps/plugin-os@2.3.2`
- File opener: `@tauri-apps/plugin-opener@2`
- macOSPrivateApi: Enabled for system access

---

*Integration audit: 2026-01-28*
*Update when adding/removing external services*
