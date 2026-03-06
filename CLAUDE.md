# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is This

Opta is a multi-platform optimization suite organized as a pnpm monorepo with numbered directories. Two product families: **optamize.biz** (desktop/iOS/web productivity apps) and **optalocal.com** (local-first AI coding assistant ecosystem). Owner: Matthew Byrden / Opta Operations.

## Monorepo Commands (from root)

```bash
pnpm install                    # Install all workspace deps
pnpm build                      # Build all packages
pnpm lint                       # Lint all packages
pnpm test                       # Run all tests (vitest via pnpm -r test:run)
pnpm type-check                 # TypeScript type checking
pnpm format                     # Prettier format all
pnpm clean                      # Remove node_modules/dist/.next from all packages
```

Per-app dev servers from root:
```bash
pnpm dev:opta-life              # Opta Life Web (Next.js 15)
pnpm dev:ai-compare             # AICompare Web
pnpm dev:ai-components          # AI Components Web
```

## Architecture: Two Product Families

### optamize/ — Desktop, iOS, and Web productivity apps

| ID | App | Stack | Dev Command |
|----|-----|-------|-------------|
| 1E | Opta Life iOS | SwiftUI + Firebase | `open OptaLMiOS.xcodeproj` |
| 1F | Opta Life Web | Next.js 15 + React 18 + NextAuth | `npm run dev` |
| 1G | Opta Mini macOS | SwiftUI menubar | Xcode |
| 1H | Opta Scan iOS | SwiftUI + Claude Vision | Xcode |
| 1J | Optamize macOS (flagship) | Tauri v2 + React 19 + Rust + Vite 7 | `npm run tauri dev` |

### optalocal/ — Local AI coding assistant stack (most active development)

**3 Core Local Apps** form a layered pipeline:

```
opta chat / opta tui / opta do         (1D — CLI commands)
        |
opta daemon  127.0.0.1:9999            (1D — HTTP v3 REST + WS streaming)
        |
Opta LMX  192.168.188.11:1234          (1M — OpenAI-compatible inference API)
        |
Opta Code Desktop                      (1P — connects to daemon over HTTP/WS)
```

- **CLI Daemon (1D)** owns session orchestration, permission gating, tool dispatch, event persistence. Proxies inference to LMX.
- **LMX (1M)** is the Apple Silicon (MLX) inference server. OpenAI API-compatible. Must never crash on OOM.
- **Code Desktop (1P)** is the native GUI client. Connects to daemon for all AI operations.

**8 Management Websites** at `*.optalocal.com`:

| ID | App | Domain | Port | Static Export |
|----|-----|--------|------|--------------|
| 1T | Home | optalocal.com | 3000 | No |
| 1O | Init | init.optalocal.com | 3001 | Yes |
| 1R | Accounts | accounts.optalocal.com | 3002 | No (SSR) |
| 1L | LMX Dashboard | lmx.optalocal.com | 3003 | No |
| 1S | Status | status.optalocal.com | 3005 | No |
| 1U | Help | help.optalocal.com | 3006 | Yes |
| 1V | Learn | learn.optalocal.com | 3007 | No |
| 1X | Admin | admin.optalocal.com | 3008 | No |

All management sites are Next.js 16 + TypeScript + Tailwind. Dev: `cd <app> && npm install && npm run dev`.

### shared/ — Cross-domain packages

| ID | App | Purpose |
|----|-----|---------|
| 1A | AI Components + AICompare | Next.js 16 web apps |
| 1I | OptaPlus | Cross-platform SwiftUI design system (iOS + macOS) |
| 1N | Opta Cloud Accounts | Canonical auth spec (not a buildable app) |

## App-Specific Development

### Opta CLI (1D-Opta-CLI-TS) — TypeScript + Commander + Ink + vitest

```bash
cd 1-Apps/optalocal/1D-Opta-CLI-TS
npm install
npm run dev                              # Watch mode (tsx)
npm run build                            # ESM build via tsup
npm test                                 # Vitest (~2,300+ tests, ~14s)
npm test -- tests/core/config.test.ts    # Single test file
npm run test:core                        # Core + utils + UI only (fast)
npm run typecheck                        # tsc --noEmit
```

ESM-only (`"type": "module"`). Imports use `.js` extension in `.ts` source. Has comprehensive CLAUDE.md.

### Opta LMX (1M-Opta-LMX) — Python 3.12 + FastAPI + MLX

```bash
cd 1-Apps/optalocal/1M-Opta-LMX
pip install -e ".[dev]"                  # or: uv pip install -e ".[dev]"
opta-lmx                                # Starts on localhost:1234
pytest tests/ -v                         # All tests
pytest tests/test_api.py -v              # Single test module
pytest tests/ --cov=src -v               # With coverage
```

Python venv at `.venv/`. Pydantic v2 + async/await everywhere. Has own CLAUDE.md.

### Opta Code Desktop (1P-Opta-Code-Universal) — Tauri v2 + React + Vite

```bash
cd 1-Apps/optalocal/1P-Opta-Code-Universal
npm install
npm run dev                              # Vite dev at localhost:5173
npm run dev:native                       # Tauri desktop app
npm run build                            # Vite production build
npm run tauri build                      # Full native bundle (.app/.dmg/.msi)
npm run test
```

Uses `@opta/daemon-client` and `@opta/protocol-shared` via tsconfig path aliases (not npm deps).

### Optamize macOS (1J-Optamize-MacOS) — Tauri v2 + React 19 + Rust

```bash
cd 1-Apps/optamize/1J-Optamize-MacOS
npm install
npm run dev                              # Vite dev server (frontend only)
npm run tauri dev                        # Full Tauri app (frontend + Rust)
npm run build:dmg                        # Build macOS DMG
```

Has its own CLAUDE.md with mandatory design system rules — read it before any UI work.

## Shared Packages (`6-Packages/`)

| Package | Import | Purpose |
|---------|--------|---------|
| `6A-API` (`@opta/api`) | `@opta/api`, `@opta/api/middleware` | Auth middleware, rate limiting (jose) |
| `6B-ESLint-Config` (`@opta/eslint-config`) | `@opta/eslint-config` | Shared ESLint 9 flat configs |
| `6C-TSConfig` (`@opta/tsconfig`) | `@opta/tsconfig/base.json` | TS config presets |
| `6D-UI` (`@opta/ui`) | `@opta/ui` | React 19 components (CVA + clsx + tailwind-merge) |
| `6E-Logger` (`@opta/logger`) | `@opta/logger` | Structured logging |

## Cross-App Design System

These rules apply to **all web and macOS frontend work**:

| Concern | Rule |
|---------|------|
| Background | `#09090b` (OLED void black, never `#000`) |
| Primary accent | `#8b5cf6` (Electric Violet) |
| Fonts | Sora (UI) + JetBrains Mono (code/stats) |
| Animations | Framer Motion spring physics only (never CSS ease/linear) |
| Icons | Lucide React only — no inline SVGs |
| Glass panels | `.glass` / `.glass-subtle` / `.glass-strong` CSS classes |
| Colors | CSS variables only — never hex/rgb literals in components |
| Conditional classes | `cn()` helper (clsx + tailwind-merge) |
| Mode | Dark only |

iOS apps use Swift equivalents: SF Symbols, `.optaSpring` animations, Keychain for secrets.

## Package Managers by App

| App(s) | Manager |
|--------|---------|
| 1D, 1L, 1O, 1P, 1R, 1S, 1T, 1U, 1V, 1X, 1J | npm |
| 1M | pip / uv (Python venv at `.venv/`) |
| 1E, 1G, 1H, 1I | Xcode / Swift Package Manager |
| Root monorepo | pnpm 9+ |

The root `pnpm-workspace.yaml` covers `6-Packages/*` and select web apps. Individual apps under `1-Apps/` manage their own `node_modules`.

## TypeScript ESM Convention (1D, 1F, all optalocal web apps)

All TypeScript apps use `"type": "module"`. Import local files with `.js` extension even in `.ts` source:
```typescript
import { foo } from './foo.js';   // correct
import { foo } from './foo';       // breaks at runtime
```

## Infrastructure

- **Mono512**: Mac Studio M3 Ultra @ 192.168.188.11 (512GB RAM) — LMX inference host. LAN only, never use Tailscale.
- **Opta48 (MacBook)**: Client-only. Never run `opta-lmx` locally.
- **Syncthing**: This repo syncs between devices. `.stignore` excludes build artifacts. MacBook is MASTER for conflict resolution.
- **Deployment**: Next.js sites deploy to Vercel at `*.optalocal.com`. CLI to npm. Desktop to GitHub Releases. LMX to PyPI (future).

## Auth Architecture

All apps share one Supabase project. Cookie domain `.optalocal.com` enables cross-subdomain SSO. Auth spec at `1-Apps/shared/1N-Opta-Cloud-Accounts/`. Supabase SSR pattern (client/server/middleware split) used in all Next.js apps.

## CI/CD (GitHub Actions)

33 workflows in `.github/workflows/`. Key patterns:
- **Per-app CI**: `opta-cli-release.yml`, `opta-lmx-ci.yml`, `opta-code-*-build.yml`, `opta-init-ci.yml`
- **Cross-platform gates**: `opta-code-release-cross-platform-gate.yml`, `opta-daemon-release-cross-platform-gate.yml`
- **Manifest sync**: `opta-init-component-manifest-sync.yml`, `opta-code-release-manifest-sync.yml`
- **Health monitoring**: `opta-local-vercel-health-watch.yml`, `opta-local-synthetic-monitor.yml`, `supabase-health.yml`
- **Gemini AI workflows**: `gemini-dispatch.yml`, `gemini-triage.yml`, `gemini-review.yml`

## Per-App CLAUDE.md Files

Many apps have their own CLAUDE.md with app-specific rules. **Always read the app's CLAUDE.md before working in it.** Key ones:
- `1-Apps/CLAUDE.md` — Directory map, stack diagram, design rules
- `1-Apps/optalocal/CLAUDE.md` — Product taxonomy, local stack architecture, design preservation rules
- `1-Apps/optalocal/1D-Opta-CLI-TS/CLAUDE.md` — Comprehensive architecture guide (agent loop, daemon, browser, TUI)
- `1-Apps/optalocal/1M-Opta-LMX/CLAUDE.md` — Python coding rules, OpenAI API compatibility contract
- `1-Apps/optamize/1J-Optamize-MacOS/CLAUDE.md` — Mandatory design system rules

## Design Preservation Rules

- **Opta Init (1O)**: Do NOT redesign or alter the aesthetic. Only targeted feature additions.
- **Opta Home (1T)**: Precision over decoration, real data as texture, terminal DNA. Never add `output: 'export'` to next.config.

## Live Production Update Logging

Any time you complete a task involving a **live production release** or update to a **live-facing website**, document it in the `updates/` directory. Check the latest `NNN_date_slug.md` file for the naming convention and create the next sequential entry.

## Directory Map

| Path | Purpose |
|------|---------|
| `1-Apps/` | All applications — grouped by domain (`optamize/`, `optalocal/`, `shared/`) |
| `1-Apps/PATH-CONTRACT.md` | Canonical paths; top-level `1X-*` are backward-compat symlinks only |
| `6-Packages/` | Shared npm packages (`@opta/*`) |
| `7-Personal/` | Personal context (calendar, hardware, goals) |
| `8-Project/` | Cross-project planning, vision, roadmap |
| `.claude/commands/` | ~40 slash commands (start, end, build, commit, etc.) |
| `updates/` | Production release logs (sequential numbering) |

## Autonomous Git Management

### Commit Rules
- Use Conventional Commits: `type(scope): description`
- Scope = app name lowercase (lmx, cli, ios, optaplus, web, optamize)
- Commit per logical unit — not per file, not per session
- Always run tests before committing (if tests exist)
- If work spans multiple apps, create one commit per app

### Push Rules
- Push to GitHub after every commit to origin/main
- Never force-push. Never create branches/PRs unless explicitly asked.
- If push fails, `pull --rebase` first

### What NOT to Do
- Never ask "which option?" for git — just commit and push
- Never amend commits or use interactive rebase
