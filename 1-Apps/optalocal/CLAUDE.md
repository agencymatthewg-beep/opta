# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is This

The `optalocal/` directory is the Opta Local product family — a local-first AI coding assistant ecosystem. It contains 4 core apps and 6 management websites, all under the `optalocal.com` domain.

## Product Taxonomy (Non-Negotiable)

**4 Core Local Apps** (the product users install and run):

| App | Dir | Stack | Purpose |
|-----|-----|-------|---------|
| Opta CLI | `1D-Opta-CLI-TS/` | TypeScript, Commander, Ink, Vitest | Terminal-first control surface + daemon |
| Opta LMX | `1M-Opta-LMX/` | Python 3.12, FastAPI, MLX | Local inference engine (Apple Silicon) |
| Opta Code Desktop | `1P-Opta-Code-Universal/` | Tauri v2, React 18, Vite 7 | Native desktop client (macOS + Windows) |
| Opta Local | (web dashboard for LMX — separate repo location) | — | LMX management dashboard |

**6 Management Websites** (support infrastructure, NOT core apps):

| App | Dir | Domain | Stack |
|-----|-----|--------|-------|
| Opta Home | `1T-Opta-Home/` | optalocal.com | Next.js 16 |
| Opta Init | `1O-Opta-Init/` | init.optalocal.com | Next.js 16, SSR |
| Opta Help | `1U-Opta-Help/` | help.optalocal.com | Next.js 16, static export |
| Opta Learn | `1V-Opta-Learn/` | learn.optalocal.com | Next.js 16 |
| Opta Accounts | `1R-Opta-Accounts/` | accounts.optalocal.com | Next.js 16 + Supabase |
| Opta Status | `1S-Opta-Status/` | status.optalocal.com | Next.js 16, SWR polling |

Do not label management websites as core apps. "Your Opta Apps" sections list only the 4 core apps.

## Architecture: The Local Stack

```
opta chat / opta tui / opta do         (1D — CLI commands)
        │
opta daemon  127.0.0.1:<port>          (1D — HTTP v3 REST + WS streaming)
        │
Opta LMX  192.168.188.11:1234          (1M — OpenAI-compatible API)
        │
Opta Code Desktop                      (1P — connects to daemon over HTTP/WS)
```

- **CLI Daemon** owns session orchestration, permission gating, tool dispatch, and event persistence. Proxies inference to LMX.
- **LMX** is the OpenAI-compatible inference server. Apple Silicon only (MLX). Must never crash on OOM — unload and degrade instead.
- **Opta Code Desktop** connects to the daemon for all AI operations. Runs as web (localhost:5173) or native (Tauri shell).

**Host policy:** MacBook (Opta48) is client-only. Never run `opta-lmx` locally. Inference host = Mono512 Mac Studio (192.168.188.11).

## Per-App Development

Each app manages its own dependencies independently. **6 of the 9 apps have their own CLAUDE.md — always read it before working in that app.**

### Opta CLI (1D-Opta-CLI-TS)

```bash
cd 1D-Opta-CLI-TS
npm install
npm run dev              # Watch mode (tsx)
npm run build            # ESM build → dist/
npm run test             # Vitest (~2,300+ tests)
npm run test:core        # Core + utils + UI only (fast)
npm run typecheck
```

ESM-only (`"type": "module"`). Imports use `.js` extension in `.ts` source. Permission gates on `edit_file`, `write_file`, `run_command`. Context compaction at 70% limit. Has comprehensive CLAUDE.md.

### Opta LMX (1M-Opta-LMX)

```bash
cd 1M-Opta-LMX
pip install -e ".[dev]"    # or: uv pip install -e ".[dev]"
opta-lmx                  # Starts on localhost:1234
pytest tests/ -v
pytest tests/ --cov=src -v
```

Python 3.12 venv. Pydantic v2 + async/await everywhere. API: `/v1/chat/completions` (OpenAI-compatible), `/admin/models/load`, `/admin/models/unload`, `/healthz`. Has comprehensive CLAUDE.md.

### Opta Code Desktop (1P-Opta-Code-Universal)

```bash
cd 1P-Opta-Code-Universal
npm install
npm run dev              # Vite dev at localhost:5173
npm run dev:native       # Tauri desktop app
npm run build            # Vite production build
npm run tauri build      # Full native bundle (.app/.dmg/.msi)
npm run test
npm run typecheck
```

Uses `@opta/daemon-client` and `@opta/protocol-shared` via tsconfig path aliases (not npm deps). Token auth: bearer header for HTTP, `?token=T` query param for WebSocket. Event routing by `envelope.event`.

### Next.js Management Sites (1O, 1R, 1S, 1T, 1U, 1V)

All share the same pattern:

```bash
cd 1X-<app>
npm install
npm run dev       # Next.js dev server
npm run build     # Production build
npm run lint
```

| App | Port | Static Export | Special Commands |
|-----|------|--------------|------------------|
| 1O-Opta-Init | 3001 | Yes (`output: 'export'`) | `npm run sync:desktop-manifests`, `npm run validate:release-contract` |
| 1R-Opta-Accounts | 3002 | No (SSR) | `npm run test` (Node test runner) |
| 1S-Opta-Status | 3005 | No (needs API routes) | `npm run release-notes:generate` |
| 1T-Opta-Home | 3000 | No (native Vercel) | — |
| 1U-Opta-Help | 3006 | Yes (`output: 'export'`) | — |
| 1V-Opta-Learn | 3007 | No (SSR/native) | `npm run guides:validate`, `npm run guide:new` |

## Shared Design System (All Apps)

| Concern | Rule |
|---------|------|
| Background | `#09090b` (OLED void black, never `#000`) |
| Primary | `#8b5cf6` (Electric Violet) |
| Fonts | Sora (UI) + JetBrains Mono (code/stats) |
| Icons | Lucide React only — no inline SVGs |
| Glass panels | `.glass` / `.glass-subtle` / `.glass-strong` |
| Animations | Framer Motion spring physics only (never CSS ease/linear) |
| Colors | CSS variables only — never hex/rgb literals in components |
| Conditional classes | `cn()` (clsx + tailwind-merge) |
| Mode | Dark only |

## Package Managers

| App | Manager |
|-----|---------|
| 1D, 1O, 1P, 1R, 1S, 1T, 1U, 1V | npm |
| 1M | pip / uv (Python venv at `.venv/`) |

The root `optalocal/` now includes a lightweight command hub (`apps.registry.json`, `scripts/opta-local-workspace.mjs`) for cross-app orchestration. App dependency graphs remain independent.

## Support Directories

| Dir | Purpose |
|-----|---------|
| `design/` | Logos (SVG/PNG), aesthetic specs per app category, architecture diagrams |
| `docs/` | Cross-app standards, audit reports, Gemini workflow docs |
| `scripts/` | Python utilities for logo generation via Gemini |

## Opta Learn Guide Generation (1V)

Guides are TypeScript objects implementing the `Guide` interface (not markdown files). Four template levels: `holistic-whole-app` (L4), `feature-deep-dive` (L3), `process-workflow` (L2), `setting-configuration` (L1). Use Gemini 3.1 with frontend design skill to generate. Always validate with `npm run guides:validate` before merge. App-link cross-references use `<a class="app-link link-cli">` pattern.

## Deployment

All Next.js sites deploy to Vercel at `*.optalocal.com`. CLI publishes to npm. Desktop publishes to GitHub Releases. LMX publishes to PyPI (future).

## Accounts & Auth

All apps share one Supabase project. Cookie domain `.optalocal.com` enables cross-subdomain SSO. Auth spec lives at `../shared/1N-Opta-Cloud-Accounts/`. Supported methods: Google OAuth, Apple OAuth, email/password, CLI browser auth flow. All `redirect_to` params validated against a whitelist.

## Design Preservation Rule

**Opta Init (1O):** Matthew explicitly wants the current design preserved. Do NOT redesign or alter the aesthetic. Only targeted feature additions.

**Opta Home (1T):** Non-negotiable design philosophy — precision over decoration, real data as texture, terminal DNA (JetBrains Mono for stats), no generic AI aesthetics. Never add `output: 'export'` to next.config.
