# Opta Ecosystem

> One platform. Every device. Built by Matthew Byrden @ Opta Operations.
*Last updated: 2026-02-28*

---

## Structure

```
~/Synced/Opta/
├── 1-Apps/
│   ├── optamize/    # optamize.biz products (1E 1F 1G 1H 1J)
│   ├── optalocal/   # optalocal.com products (1D 1L 1M 1O 1P)
│   └── shared/      # cross-domain elements, design, infra (1A 1I 1N)
├── 2-Docs/          # Shared documentation (auth, infra, design)
├── 3-Services/      # Deployed services (Vercel, launchd)
├── 6-Packages/      # Shared npm packages (@opta/*)
├── docs/            # Monorepo-level docs (APP-MD-SYSTEM, OPIS, etc.)
├── 4-Ideas/         # Brainstorms and concepts
└── updates/         # Automated update logs
```

---

## Apps (`1-Apps/`)

### optamize/ — optamize.biz
| ID | App | Platform | Status |
|----|-----|----------|--------|
| 1E | Opta Life iOS | iOS (SwiftUI + Firebase) | Active |
| 1F | Opta Life Web | Web (Next.js 15) | Deployed → lm.optamize.biz |
| 1G | Opta Mini macOS | macOS (SwiftUI menubar) | Active |
| 1H | Opta Scan iOS | iOS (SwiftUI + Claude Vision) | Active |
| 1J | Optamize macOS | macOS (Tauri v2 + React + Rust) | Active — flagship |

### optalocal/ — optalocal.com
| ID | App | Platform | Status |
|----|-----|----------|--------|
| 1D | Opta CLI | CLI/TUI (TypeScript) | Beta v0.5 |
| 1L | Opta Local | Web + iOS (Next.js 16) | In dev → optalocal.com |
| 1M | Opta LMX | macOS service (Python + MLX) | Live on Mono512:1234 |
| 1O | Opta Init | Web (Next.js 15) | Live → init.optalocal.com |
| 1P | Opta Code Desktop | Electron/Vite (TypeScript) | Emerging |

### shared/ — cross-domain
| ID | App | Platform | Status |
|----|-----|----------|--------|
| 1A | AI Components | Web (Next.js 16) | Scaffold (merged from 1A + 1B) |
| 1I | OptaPlus | iOS + macOS (SwiftUI) | 9/13 phases — design system |
| 1N | Opta Cloud Accounts | Auth spec + iOS/Web | 85% complete |

---

## Services (`3-Services/`)
| Service | Description | Deployed |
|---------|-------------|----------|
| 3A-Opta-Gateway | AI provider routing API | lm.optamize.biz (Vercel) |

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
| Full index | `INDEX.md` |
| Local stack overview | `1-Apps/OPTA-LOCAL-STACK.md` |
| OptaCloud auth spec | `1-Apps/shared/1N-Opta-Cloud-Accounts/` |
| APP.md system docs | `docs/APP-MD-SYSTEM.md` |
