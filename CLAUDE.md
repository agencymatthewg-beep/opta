# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is This

Opta is a multi-platform optimization suite (macOS desktop, iOS, web) organized as a pnpm monorepo with numbered directories. Owner: Matthew Byrden / Opta Operations (optamize.biz).

## Monorepo Commands (from root)

```bash
pnpm install                    # Install all workspace deps
pnpm build                      # Build all packages
pnpm lint                       # Lint all packages
pnpm lint:fix                   # Auto-fix lint issues
pnpm test                       # Run all tests (vitest)
pnpm type-check                 # TypeScript type checking
pnpm format                     # Prettier format all
pnpm format:check               # Check formatting
pnpm clean                      # Remove node_modules/dist/.next from all packages
```

### Per-app dev servers (from root)

```bash
pnpm dev:opta-life              # Opta Life Web (Next.js 15)
pnpm dev:ai-compare             # AICompare Web (Next.js 16)
pnpm dev:ai-components          # AI Components Web (Next.js 16)
```

## App-Specific Development

### Optamize MacOS (flagship desktop app)

**Location:** `1-Apps/1J-Optamize-MacOS/`
**Stack:** Tauri v2 + React 19 + Vite 7 + TypeScript + Rust + Tailwind CSS 3

```bash
cd 1-Apps/1J-Optamize-MacOS
npm install
npm run dev                     # Vite dev server (frontend only)
npm run tauri dev               # Full Tauri app (frontend + Rust backend)
npm run build                   # tsc + vite build
npm run build:dmg               # Build macOS DMG (aarch64)
npm run build:app               # Build .app bundle (aarch64)
```

**Frontend:** `src/` — React SPA with page-based routing (`src/pages/`: Dashboard, Optimize, Games, Chess, Score, Settings). Components in `src/components/`, hooks in `src/hooks/`, contexts in `src/contexts/`.

**Rust backend:** `src-tauri/src/` — Tauri commands for telemetry, processes, games, conflicts, scoring, LLM, benchmarks. Platform-specific code in `src-tauri/src/platform/` (macos, windows, linux, mobile). IPC broadcasting via `src-tauri/src/ipc/` (socket server + metrics serializer).

**MCP server:** `mcp-server/` — Python MCP server (uses `pyproject.toml` + `uv`).

**Has its own CLAUDE.md** with mandatory design system rules — read it before any UI work.

### Opta Scan iOS

**Location:** `1-Apps/1H-Opta-Scan-IOS/`
**Stack:** SwiftUI + Claude Vision API + Turborepo (for shared packages)

```bash
cd 1-Apps/1H-Opta-Scan-IOS
open "Opta Scan.xcodeproj"     # Open in Xcode
pnpm install                    # For shared TS packages
pnpm dev                        # Turborepo dev (shared packages)
```

**Has its own CLAUDE.md** with iOS aesthetic guide rules.

### Opta Life iOS

**Location:** `1-Apps/1E-Opta-Life-IOS/`
**Stack:** SwiftUI + Firebase

```bash
cd 1-Apps/1E-Opta-Life-IOS
open OptaLMiOS.xcodeproj
```

### Opta Life Web

**Location:** `1-Apps/1F-Opta-Life-Web/`
**Stack:** Next.js 15 + React 18 + NextAuth + Google APIs + Tailwind CSS 4

```bash
cd 1-Apps/1F-Opta-Life-Web
npm run dev                     # Next.js dev server
npm run build                   # Production build
```

### Opta CLI (TypeScript)

**Location:** `1-Apps/1D-Opta-CLI-TS/`
**Stack:** TypeScript + Commander + Ink + tsup + vitest

```bash
cd 1-Apps/1D-Opta-CLI-TS
npm run dev                     # tsx watch mode
npm run build                   # tsup build
npm run test                    # vitest
npm run typecheck               # tsc --noEmit
```

### MonoUsage (Mac Studio monitor)

**Location:** `1-Apps/1C-MonoUsage/`
**Stack:** Swift (Package.swift) + Node.js backend

## Shared Packages (`6-Packages/`)

Referenced as `workspace:*` dependencies. pnpm workspace config maps `packages/*` to these:

| Package | Import | Purpose |
|---------|--------|---------|
| `6A-API` (`@opta/api`) | `@opta/api`, `@opta/api/middleware` | Auth middleware, rate limiting (jose) |
| `6B-ESLint-Config` (`@opta/eslint-config`) | `@opta/eslint-config`, `@opta/eslint-config/next` | Shared ESLint 9 flat configs |
| `6C-TSConfig` (`@opta/tsconfig`) | `@opta/tsconfig/base.json`, `nextjs.json`, `library.json` | TS config presets |
| `6D-UI` (`@opta/ui`) | `@opta/ui`, `@opta/ui/components/*` | React 19 components (CVA + clsx + tailwind-merge) |
| `6E-Logger` (`@opta/logger`) | `@opta/logger` | Structured logging with levels, component prefixes, configurable sink |

## Architecture

### Cross-Platform Strategy

- **Desktop (Optamize):** Tauri v2 wraps a React 19 + Vite frontend with a Rust backend. Rust handles system telemetry, process management, game detection, and IPC. Frontend communicates via Tauri commands and a socket-based IPC broadcaster.
- **iOS:** Native SwiftUI apps. Opta Scan uses Claude Vision API for photo analysis. Opta Life iOS uses Firebase.
- **Web:** Next.js apps deployed to Vercel. Opta Life Web uses NextAuth for Google OAuth + Google Calendar/Gemini APIs.

### AI Integration

- **Desktop:** Hybrid semantic router — local Llama 3 8B on Mac Studio for simple queries, cloud Claude for complex analysis. MCP (Model Context Protocol) for all external integrations.
- **iOS Scan:** Cloud Claude API with vision capabilities.
- **Web:** Google Gemini AI SDK (`@google/generative-ai`).

### Design System Rules (Optamize MacOS)

When working in the desktop app, these are **mandatory** (enforced via `1-Apps/1J-Optamize-MacOS/DESIGN_SYSTEM.md`):
- Animations: Framer Motion only
- Icons: Lucide React only
- Glass effects: `.glass`, `.glass-subtle`, `.glass-strong` classes
- Colors: CSS variables only (never hex/rgb literals)
- Typography: Sora font
- Conditional classes: `cn()` helper (clsx + tailwind-merge)

### Design System Rules (iOS)

- Animations: SwiftUI spring physics only (`.optaSpring`)
- Icons: SF Symbols only
- Colors: Opta semantic colors from asset catalog (OLED-optimized `#09090b` background)
- Haptics: `OptaHaptics.shared`

## Directory Map

| Path | Purpose |
|------|---------|
| `1-Apps/` | All applications (flat A–K list) |
| `1-Apps/1I-OptaPlus/` | Cross-platform SwiftUI design system package (iOS + macOS) |
| `6-Packages/` | Shared npm packages (`@opta/*`) |
| `7-Personal/` | Personal context (calendar, hardware, goals) |
| `8-Project/` | Cross-project planning, vision, roadmap |
| `8-Project/8B-Shared-Assets/` | Cross-app design assets, logos, aesthetic vision specs |
| `4-Ideas/` | Ideas and brainstorms |
| `2-Docs/` | Documentation |
| `.claude/commands/` | ~40 slash commands (start, end, build, commit, etc.) |

## Important Notes

- **Numbered directories**: The codebase uses numbered prefixes (1-Apps, 6-Packages, etc.) for organization. Always use actual directory names, not the friendly names from README.
- **Flat app structure**: All apps live directly in `1-Apps/` with prefixes 1A through 1K. No platform subfolders.
- **pnpm workspace**: Root `pnpm-workspace.yaml` lists web apps individually. Use `pnpm --filter <package-name>` to target specific packages.
- **Syncthing-synced**: This repo syncs between devices via Syncthing. `.stignore` excludes build artifacts.
- **Per-app CLAUDE.md files**: Optamize MacOS and Opta Scan iOS have their own CLAUDE.md with app-specific rules. Always read them before working in those apps.
- **MCP servers**: Configured in `.mcp.json` — Google Drive, Gmail, Google Calendar, YouTube, Gemini.
- **Session protocol**: At session start, check `7-Personal/calendar.md` for today's events.

## Autonomous Git Management

### Commit Rules
- After completing a feature, phase, or significant unit of work: commit all related changes automatically
- Use Conventional Commits format: `type(scope): description`
- Scope = app name lowercase (lmx, cli, ios, optaplus, web, optamize)
- Commit per logical unit — not per file, not per session
- Never commit .env files, API keys, or secrets
- Never commit node_modules, .next, DerivedData, __pycache__, .venv
- Always run tests before committing (if tests exist)

### Push Rules
- Push to GitHub after every commit
- Always push to origin/main (no feature branches unless requested)
- Never force-push
- If push fails (remote has new commits), pull --rebase first

### What NOT to Do
- Never ask "which option?" for git — just commit and push
- Never create branches unless explicitly asked
- Never create Pull Requests unless explicitly asked
- Never amend commits — always create new ones
- Never use interactive rebase

### Multi-App Commits
- If work spans multiple apps, create one commit per app
- Example: `feat(lmx): add WebSocket streaming` then `feat(optaplus): connect to WebSocket endpoint`
- Shared config changes (root CLAUDE.md, pnpm-lock) go with the app that triggered them
