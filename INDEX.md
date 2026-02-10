# Opta/ — Opta Operations Monorepo

Matthew's business. All Opta apps and services.

**Git Remote:** `git@github.com:agencymatthewg-beep/opta.git`
**Business:** Opta Operations (Sole Trader)
**Domain:** optamize.biz

## Apps

| App | Location | Tech Stack | Description |
|-----|----------|------------|-------------|
| **Opta Native** | `1-Apps/1C-MacOS/` | Tauri v2, React, Rust | AI PC Optimizer |
| **Opta Life** | `1-Apps/1I-Web/` | Next.js 15, React 18 | Life management dashboard |
| **Opta+** | `1-Apps/1E-OptaPlus/` | SwiftUI | Shared design system (iOS + macOS) |
| **Opta CLI** | `1-Apps/1A-CLI/` | TBD | Command-line interface |
| **Opta Command Center** | `1-Apps/1A-CLI/` | TBD | Central control |
| **Opta Scan** | `1-Apps/1B-IOS/` | SwiftUI, Claude Vision | Universal scanner |
| **Opta Life iOS** | `1-Apps/1B-IOS/` | SwiftUI | iOS companion |
| **Clawdbot Server** | `1-Apps/1I-Web/` | Bun, TypeScript | AI integration layer |
| **MonoUsage** | `1-Apps/1D-MonoUsage/` | Swift | Mac Studio usage monitor |
| **Shared** | `1-Apps/1G-Shared/` | Multi | Shared code and assets |

## Other

| Folder | Description |
|--------|-------------|
| `6-Packages/` | Shared npm/Swift packages |
| `8-Project/` | Project management docs |
| `9-Research/` | Opta-specific research |
| `2-Docs/` | Documentation |
| `7-Personal/` | Personal notes |

## Dev Setup
```bash
pnpm install    # Install all dependencies
```
