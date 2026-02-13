# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

MonoUsage is a macOS **menubar app** that displays AI API spend and status at a glance. It consists of two parts: a SwiftUI menubar app (reads data) and a Node.js backend (fetches data from provider APIs).

The menubar shows a running total like `$1.23 ¥50` and expands to a dashboard listing each provider with status, spend, and usage bars.

## Commands

```bash
# Swift menubar app
swift build                              # Build the executable
swift run MonoUsage                      # Run the menubar app

# Backend (from backend/)
cd backend && npm install                # Install deps (just dotenv)
npm run refresh                          # Full refresh: sync keys → fetch APIs → write latest.json
npm run fetch                            # Fetch API data only (skip key sync)
npm run sync-keys                        # Sync keys from API-KEYS.md → .env
```

## Architecture

### Data Flow

```
API-KEYS.md (markdown) ──sync-keys.js──▶ backend/.env
                                              │
provider APIs (Anthropic, OpenRouter, etc.) ◀─┘
         │
    fetch-apis.js
         │
         ▼
backend/data/latest.json ──(file read)──▶ Swift UsageManager ──▶ MenuBar UI
                                              │
                                         60s timer auto-reload
```

### Swift App (`Sources/MonoUsage/MonoUsageApp.swift`)

Single-file SwiftUI app. Key components:
- **`FlexValue`** — Codable enum handling backend JSON where usage/limit can be Double or String
- **`ProviderData`** — Model for one API provider (name, status, usage, limit, currency, percent, color)
- **`UsageManager`** (ObservableObject) — Loads `latest.json`, runs 60s auto-refresh timer, can trigger backend refresh via `Process()`, manages LaunchAgent for login launch
- **`MonoUsageApp`** — `MenuBarExtra` with `.window` style, shows spend total in menubar label
- **`DashboardView`** / **`ProviderRow`** / **`TotalSpendRow`** — UI views

The app hides from Dock via `NSApp.setActivationPolicy(.accessory)`.

### Backend (`backend/`)

Node.js scripts (CommonJS, no server process). Only dependency: `dotenv`.

- **`scripts/fetch-apis.js`** — Fetches status from Anthropic, MiniMax (×2), OpenRouter, Perplexity. Also adds static subscription entries (Claude Code accounts). Writes `data/latest.json`.
- **`scripts/sync-keys.js`** — Parses API keys from a markdown file (`AI26/openclaw-shared/research/API-KEYS.md`) into `.env`. Gracefully skips if file not found.
- **`scripts/refresh-all.js`** — Orchestrates sync-keys then fetch-apis.

### Tracked Providers

| Key | Provider | Has Usage Data | Currency |
|-----|----------|---------------|----------|
| `anthropic` | Anthropic | Key validation only | USD |
| `openrouter` | OpenRouter | Yes (usage/limit via `/api/v1/auth/key`) | USD |
| `minimax_shared` | MiniMax Shared | Key validation only | CNY |
| `minimax_coding` | MiniMax Coding | Key validation only | CNY |
| `perplexity` | Perplexity | Key validation only | USD |
| `claude_code_matt` | Claude Code (Matt) | Static subscription | — |
| `claude_code_yjs` | Claude Code (YJS) | Static subscription | — |

## Environment

Backend API keys go in `backend/.env` (gitignored):
```
ANTHROPIC_API_KEY=...
MINIMAX_SHARED_KEY=...
MINIMAX_CODING_KEY=...
OPENROUTER_API_KEY=...
PERPLEXITY_API_KEY=...
```
