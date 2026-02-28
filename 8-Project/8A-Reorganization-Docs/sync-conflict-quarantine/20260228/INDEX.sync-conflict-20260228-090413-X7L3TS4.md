# Opta/ — Opta Operations Monorepo

Matthew's business. All Opta apps and services.

**Git Remote:** `git@github.com:agencymatthewg-beep/opta.git`
**Business:** Opta Operations (Sole Trader)
**Domain:** optamize.biz / optalocal.com
*Last updated: 2026-02-28*

---

## Apps (`1-Apps/`)

Apps are divided into three domain folders:

### optamize/ — optamize.biz products
| ID | App | Platform | Path |
|----|-----|----------|------|
| 1E | Opta Life iOS | iOS (SwiftUI) | `1-Apps/optamize/1E-Opta-Life-IOS/` |
| 1F | Opta Life Web | Web (Next.js 15) | `1-Apps/optamize/1F-Opta-Life-Web/` |
| 1G | Opta Mini macOS | macOS (SwiftUI) | `1-Apps/optamize/1G-Opta-Mini-MacOS/` |
| 1H | Opta Scan iOS | iOS (SwiftUI) | `1-Apps/optamize/1H-Opta-Scan-IOS/` |
| 1J | Optamize macOS | macOS (Tauri v2 + Rust) | `1-Apps/optamize/1J-Optamize-MacOS/` |

### optalocal/ — optalocal.com products
| ID | App | Platform | Path |
|----|-----|----------|------|
| 1D | Opta CLI | CLI/TUI (TypeScript) | `1-Apps/optalocal/1D-Opta-CLI-TS/` |
| 1L | Opta Local | Web + iOS (Next.js 16) | `1-Apps/optalocal/1L-Opta-Local/` |
| 1M | Opta LMX | macOS service (Python + MLX) | `1-Apps/optalocal/1M-Opta-LMX/` |
| 1O | Opta Init | Web (Next.js 15) | `1-Apps/optalocal/1O-Opta-Init/` |
| 1P | Opta Codex Desktop | Electron/Vite (TypeScript) | `1-Apps/optalocal/1P-Opta-Codex-App/` → `1D/apps/opta-codex-desktop` |

### shared/ — cross-domain elements, design, infra
| ID | App | Platform | Path |
|----|-----|----------|------|
| 1A | AI Components | Web (Next.js 16) | `1-Apps/shared/1A-AI-Components/` |
| 1I | OptaPlus | iOS + macOS (SwiftUI) | `1-Apps/shared/1I-OptaPlus/` |
| 1N | Opta Cloud Accounts | Auth spec + iOS/Web | `1-Apps/shared/1N-Opta-Cloud-Accounts/` |

---

## Services (`3-Services/`)
| Service | Description | Deployed |
|---------|-------------|----------|
| 3A-Opta-Gateway | AI provider routing API | lm.optamize.biz (Vercel) |

## Packages (`6-Packages/`)
| Package | Description |
|---------|-------------|
| 6A-API | Auth middleware + rate limiting |
| 6B-ESLint-Config | Shared ESLint config |
| 6C-TSConfig | Shared TypeScript config |
| 6D-UI | React component library (`@opta/ui`) |
| 6E-Logger | Structured logging |

## Other Folders
| Folder | Description |
|--------|-------------|
| `2-Docs/` | Shared documentation (auth, infra, design) |
| `4-Ideas/` | Brainstorms and concepts |
| `7-Personal/` | Personal notes (hardware, goals, calendar) |
| `8-Project/` | Project management docs |
| `docs/` | Monorepo-level docs (APP-MD-SYSTEM, OPIS, etc.) |
| `updates/` | Automated update logs |

## Dev Setup
```bash
pnpm install    # Install all workspace dependencies
```
