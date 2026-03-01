# 1-Apps/

All Opta applications, divided by domain.
*Last updated: 2026-02-28*

```
1-Apps/
├── optamize/    ← optamize.biz products
├── optalocal/   ← optalocal.com products
└── shared/      ← cross-domain: elements, design, infra
```

---

## optamize/

| ID | App | Platform | Description |
|----|-----|----------|-------------|
| 1E | Opta Life iOS | iOS (SwiftUI + Firebase) | Life management companion |
| 1F | Opta Life Web | Web (Next.js 15) | Life management dashboard |
| 1G | Opta Mini macOS | macOS (SwiftUI NSMenu) | Menubar quick-access |
| 1H | Opta Scan iOS | iOS (SwiftUI + Claude Vision) | Universal scanner |
| 1J | Optamize macOS | macOS (Tauri v2 + React + Rust) | AI PC Optimizer — flagship |

## optalocal/

| ID | App | Platform | Description |
|----|-----|----------|-------------|
| 1D | Opta CLI | CLI/TUI (TypeScript) | Agentic coding CLI + daemon |
| 1L | Opta Local | Retired | Deprecated duplicate client removed from `1-Apps` (backup retained in `/tmp`) |
| 1M | Opta LMX | macOS service (Python + MLX) | MLX inference server — live Mono512:1234 |
| 1O | Opta Init | Web (Next.js 15) | Download/setup landing — init.optalocal.com |
| 1P | Opta Code Desktop (Universal) | Tauri v2 + React/Vite (TypeScript) | Unified 1-app client (web + native shell) built on Opta CLI daemon |

## shared/

| ID | App | Platform | Description |
|----|-----|----------|-------------|
| 1A | AI Components | Web (Next.js 16) | AI component library + AICompare (merged 1A+1B) |
| 1I | OptaPlus | iOS + macOS (SwiftUI) | Design system — 9/13 phases |
| 1N | Opta Cloud Accounts | Auth spec | Canonical Supabase auth — not a buildable app |

---

Each app has its own README and/or CLAUDE.md with build/dev instructions.
