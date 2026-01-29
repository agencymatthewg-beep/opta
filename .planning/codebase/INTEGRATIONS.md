# External Integrations

*Last updated: 2025-01-29*

## AI/LLM Providers

### Google Gemini
- **SDK**: `@google/generative-ai@0.24.1`
- **MCP**: `mcp-gemini-cli@0.3.1`
- **Auth**: `GEMINI_API_KEY` environment variable
- **Location**: `apps/desktop/opta-native/package.json`
- **Use cases**: Chat, vision analysis, reasoning

### Anthropic Claude
- **Integration**: Python subprocess with 30-second timeout
- **Auth**: `ANTHROPIC_API_KEY` environment variable
- **Location**: `apps/desktop/opta-native/src-tauri/src/claude.rs`
- **Use cases**: Complex reasoning, optimization queries

### OpenAI
- **Auth**: `OPENAI_API_KEY` environment variable
- **Scope**: Vision capabilities
- **Location**: `apps/ios/opta/.env.example`

## Google Workspace APIs

### Google Calendar API v3
- **MCP Package**: `@cocal/google-calendar-mcp@2.4.1`
- **Features**: Event CRUD, date range queries, fuzzy matching
- **Auth**: OAuth 2.0 (Google Client ID in `.env.local`)
- **Scopes**: `calendar.readonly`, `calendar.events`

### Gmail API v1
- **MCP Package**: `@gongrzhe/server-gmail-autoauth-mcp@1.1.11`
- **Features**: Unread emails, draft creation, thread metadata
- **Auth**: OAuth with `gmail.modify` scope
- **Token Refresh**: Automatic with 5-minute buffer

### Google Drive API
- **MCP Package**: `@isaacphi/mcp-gdrive@0.2.0`
- **Features**: File search, document access

### YouTube API
- **MCP Package**: `@kirbah/mcp-youtube@0.3.2`
- **Features**: Video search, transcripts, statistics

## Productivity APIs

### Todoist API v2/v9
- **Endpoints**: `https://api.todoist.com/rest/v2`, `https://api.todoist.com/sync/v9`
- **Auth**: Bearer token (`TODOIST_API_TOKEN`)
- **Features**: Task/project CRUD, labels, recurring tasks
- **Location**: `apps/web/opta-life-manager/lib/todoist.ts`

## Public APIs (No Auth Required)

### Hacker News
- **Endpoint**: `https://hacker-news.firebaseio.com/v0/`
- **Features**: AI/Tech filtered stories
- **Caching**: 15-minute ISR revalidation
- **Location**: `apps/web/opta-life-manager/lib/news.ts`

### Open-Meteo Weather
- **Endpoint**: `https://api.open-meteo.com/v1/forecast`
- **Features**: Current + 5-day forecast, WMO codes
- **Caching**: 30-minute ISR revalidation
- **Location**: `apps/web/opta-life-manager/lib/weather.ts`

### Chess APIs
- **Lichess**: Public REST API - game imports, puzzles
- **Chess.com**: Public REST API - game history, stats
- **Location**: `apps/desktop/opta-native/src/lib/lichess.ts`, `apps/desktop/opta-native/src/lib/chesscom.ts`

## Authentication

### NextAuth (next-auth@5.0.0-beta.30)
- **Provider**: Google OAuth 2.0
- **Token Storage**: httpOnly cookies (secure, XSS-proof)
- **Session**: JWT with refresh token rotation
- **Location**: `apps/web/opta-life-manager/auth.ts`
- **Credentials**: Google Client ID/Secret in `.env.local`

### Vercel OIDC
- **Token**: `VERCEL_OIDC_TOKEN` (JWT)
- **Purpose**: Deployment authentication
- **Scopes**: Owner/project/environment access

## Database & Storage

### Supabase
- **Location**: `apps/ios/opta/.env.example`
- **Variables**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Features**: Postgres, Auth, real-time subscriptions
- **Purpose**: iOS app backend

### SQLite (Local)
- **Crate**: `rusqlite@0.31` (bundled bindings)
- **Location**: `apps/desktop/opta-native/src-tauri/Cargo.toml`
- **Purpose**: Offline-first local persistence (desktop only)

### Local Storage
- **macOS**: Application Support directory
- **Web**: localStorage, sessionStorage
- **iOS**: UserDefaults (Keychain migration planned)

## Deployment

### Vercel (Web Apps)
- **Hosting**: `apps/web/opta-life-manager/`, `apps/web/AICompare/`
- **Features**: Edge runtime, automatic deployments
- **Environment**: Development/Production configured

### Direct Distribution (Desktop)
- **Build**: Tauri CLI
- **Format**: DMG/App bundle
- **Signing**: Apple Developer account

### App Store (Mobile)
- **Build**: Expo EAS / Xcode
- **Distribution**: TestFlight, App Store

## System Integration (macOS)

### Tauri Plugins
- `@tauri-apps/plugin-global-shortcut@2.3.1` - Keyboard shortcuts
- `@tauri-apps/plugin-os@2.3.2` - OS detection
- `@tauri-apps/plugin-opener@2` - File/URL opening
- `@tauri-apps/plugin-shell@2` - Shell commands

### macOS Frameworks (Rust)
- **Crates**: `core-foundation`, `io-kit-sys`, `mach2`
- **Purpose**: Hardware telemetry, SMC access
- **Features**: CPU/GPU temperature, fan speed, memory pressure
- **Location**: `apps/desktop/opta-native/src-tauri/src/platform/macos.rs`

## MCP Server Architecture

### Transport
- **Protocol**: stdio (standard I/O)
- **Location**: `apps/desktop/opta-native/mcp-server/src/opta_mcp/server.py`

### System Telemetry Tools
| Tool | Purpose |
|------|---------|
| `get_cpu` | CPU usage, cores, frequency |
| `get_memory` | RAM telemetry |
| `get_disk` | Disk space info |
| `get_gpu` | GPU telemetry (graceful fallback) |
| `get_system_snapshot` | Complete system state |
| `get_processes` | Running processes with categorization |
| `terminate_process` | Process termination |

### MCP Dependencies
```
mcp>=1.0.0              # MCP framework
psutil>=5.9.0           # System monitoring
ollama>=0.3.0           # Optional local LLM
anthropic>=0.39.0       # Claude API
GPUtil>=1.4.0           # GPU utilities (optional)
```

## Environment Configuration

### Required Variables
| Variable | Purpose | Location |
|----------|---------|----------|
| `AUTH_SECRET` | NextAuth session key | `.env.local` |
| `GOOGLE_CLIENT_ID` | OAuth authentication | `.env.local` |
| `GOOGLE_CLIENT_SECRET` | OAuth authentication | `.env.local` |
| `GEMINI_API_KEY` | Gemini API access | `.env.local` |
| `TODOIST_API_TOKEN` | Todoist integration | `.env.local` |
| `ANTHROPIC_API_KEY` | Claude API | `.env.example` |
| `OPENAI_API_KEY` | OpenAI API | `.env.example` |

### Production
- **Vercel**: Environment variables in dashboard
- **Secrets**: Managed per environment (development/production)
