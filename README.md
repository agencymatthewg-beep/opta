# Opta Ecosystem

> One platform. Every device. Built by Matthew Byrden @ Opta Operations.

---

## Structure

```
~/Synced/Opta/
├── 1-Apps/          # All applications (canonical — see below)
├── 2-Docs/          # Shared documentation (auth, infra, design)
├── 3-Services/      # Deployed services (Vercel, launchd)
├── docs/            # Monorepo-level docs (APP-MD-SYSTEM, etc.)
├── personal/        # Hardware, goals, calendar
├── research/        # Gemini Deep Research outputs
├── ideas/           # Brainstorms and concepts
└── scripts/         # Repo-level tooling
```

---

## Apps (`1-Apps/`)

| Prefix | App | Platform | Status |
|--------|-----|----------|--------|
| **1A** | AI Components Web | Web | Scaffold |
| **1B** | AICompare Web | Web | Active |
| **1C** | MonoUsage | macOS + Node | Active |
| **1D** | Opta CLI TS | CLI / TUI | Beta v0.5 |
| **1E** | Opta Life iOS | iOS | Active |
| **1F** | Opta Life Web | Web | Deployed → lm.optamize.biz |
| **1G** | Opta Mini macOS | macOS | Active |
| **1H** | Opta Scan iOS | iOS | Active |
| **1I** | OptaPlus | iOS + macOS + Web | 9/13 phases |
| **1J** | Optamize macOS | macOS (Tauri + Rust) | Active |
| **1K** | Optamize Web | Web | Marketing |
| **1L** | Opta Local | Web + iOS | In Dev → optalocal.com |
| **1M** | Opta LMX | macOS service (Python + MLX) | ~80% · Live on Mono512 |
| **—** | kimi-proxy | Local service (Python) | Running · port 4999 |

---

## Services (`3-Services/`)

| Service | Description | Deployed |
|---------|-------------|----------|
| 3A-Opta-Gateway | AI provider routing API | ✅ Vercel |

---

## Docs (`2-Docs/`)

| Folder | Contents |
|--------|----------|
| `OptaCloud/` | Shared auth, Supabase schema, Swift/TS libs |
| `design/` | Opta+ design system tokens |

---

## Rules

- **All work lives in `~/Synced/`** — never `~/Documents/`, never `~/Desktop/`
- `~/Synced/` syncs via Syncthing to Opta48 (MacBook), Mono512 (Mac Studio), Windows PC
- Canonical project root: `~/Synced/Opta/1-Apps/`

---

## Tech Stack

| Layer | Tech |
|-------|------|
| macOS native | Swift, SwiftUI, Tauri v2, Rust |
| iOS native | SwiftUI, Firebase, Supabase |
| Web | Next.js 15/16, React 19, TypeScript |
| CLI/TUI | TypeScript, Commander, Ink |
| AI inference | Python, MLX, FastAPI (Opta LMX) |
| Design system | Opta+ — Obsidian Glassmorphism, Electric Violet |

---

## Key Paths

| Resource | Path |
|----------|------|
| Apps index | `APPS-INDEX.md` |
| Migration history | `MIGRATION-FROM-DOCUMENTS.md` |
| APP.md system docs | `docs/APP-MD-SYSTEM.md` |
| Local stack overview | `1-Apps/OPTA-LOCAL-STACK.md` |
| OptaCloud docs | `2-Docs/OptaCloud/` |

---

*Last updated: 2026-02-19*
