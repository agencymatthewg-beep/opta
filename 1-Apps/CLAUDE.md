# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Directory Map

All Opta apps live here with numbered prefixes. **Each app with a `CLAUDE.md` has its own rules — always read it before working in that app.**

| Prefix | App | Platform | Has own CLAUDE.md |
|--------|-----|----------|-------------------|
| 1A | AI Components Web | Web (Next.js 16) | — |
| 1B | AICompare Web | Web (Next.js 16) | ✓ |
| 1D | Opta CLI TS | CLI/TUI/Daemon | ✓ (comprehensive) |
| 1E | Opta Life iOS | iOS (SwiftUI + Firebase) | ✓ |
| 1F | Opta Life Web | Web (Next.js 15) | ✓ |
| 1G | Opta Mini macOS | macOS (SwiftUI menubar) | ✓ |
| 1H | Opta Scan iOS | iOS (SwiftUI + Claude Vision) | ✓ |
| 1I | OptaPlus | iOS + macOS SwiftUI design system | ✓ |
| 1J | Optamize macOS | macOS (Tauri v2 + React 19 + Rust) | ✓ (design system enforced) |
| 1K | Optamize Web | Web (marketing landing page) | — |
| 1L | Opta Local | Web + iOS (LMX dashboard/chat) | ✓ |
| 1M | Opta LMX | Python (MLX inference server) | ✓ |
| 1N | Opta Cloud Accounts | Canonical auth spec (no buildable app) | — |
| 1P | Opta Accounts | Web (Next.js 16, SSO portal) | ✓ |
| 1P-Opta-Code-Desktop (alias) | Opta Code Desktop | Electron/Vite (TypeScript) | ✓ (source: 1P-Opta-Code-Desktop) |
| 1Q | Opta Other | Utility apps (kimi-proxy, pa-messenger, phone-bridge) | — |

---

## The Opta Local Stack (Critical)

Three apps form a layered local-inference pipeline. See `OPTA-LOCAL-STACK.md` for the full architecture diagram.

```
opta chat / opta tui / opta do         (1D-Opta-CLI-TS)
        │
opta daemon  127.0.0.1:9999            (1D-Opta-CLI-TS/src/daemon/)
        │   HTTP v3 REST + WS streaming
Opta LMX  192.168.188.11:1234          (1M-Opta-LMX)
        │   OpenAI-compatible /v1/chat/completions
Opta Local Web  localhost:3004         (1L-Opta-Local/web/)
```

**CLI Daemon** owns session orchestration, permission gating, and event persistence. It proxies requests to LMX.
**LMX** is Apple Silicon only (MLX), OpenAI API-compatible, and must never crash on OOM — unload and degrade instead.
**Opta Local Web** is a React dashboard that connects directly to LMX (no intermediate backend). It runs in two modes: LAN (no auth) and Cloud (Supabase auth via Cloudflare Tunnel).

Operational commands:
```bash
# CLI daemon
cd 1D-Opta-CLI-TS && npm run dev -- daemon start

# LMX inference server
cd 1M-Opta-LMX && python -m opta_lmx

# Web dashboard
cd 1L-Opta-Local/web && npm run dev        # http://localhost:3004
```

---

## Shared Auth Spec (1N-Opta-Cloud-Accounts)

`1N-Opta-Cloud-Accounts/` is **not a buildable app** — it is the canonical specification for Supabase auth across all Opta apps. Before adding or changing auth in any app, read:
- `1N-Opta-Cloud-Accounts/AUTH-METHODS.md` — four allowed Supabase-native auth methods
- `1N-Opta-Cloud-Accounts/contracts/` — session and data contracts each app must satisfy
- `1N-Opta-Cloud-Accounts/ENV-MATRIX.md` — which env vars apply per app

All apps share one Supabase project. The Supabase SSR pattern (client/server/middleware split) is used in all Next.js apps.

---

## Cross-App Design Rules

These rules apply to **all web and macOS frontend work** across 1-Apps:

| Concern | Rule |
|---------|------|
| Animations | Framer Motion only (`motion`, `AnimatePresence`) |
| Icons | Lucide React only — no inline SVGs |
| Glass panels | `.glass` / `.glass-subtle` / `.glass-strong` CSS classes |
| Colors | CSS variables only — never hex/rgb literals in component code |
| Conditional classes | `cn()` helper (clsx + tailwind-merge) |
| Mode | Dark only, OLED-optimized (`#09090b`) |

iOS apps use the Swift equivalents: SF Symbols, `@Observable @MainActor`, `.optaSpring` animations, Keychain for secrets.

---

## Package Managers by App

| App(s) | Package Manager |
|--------|----------------|
| 1D, 1L/web, 1F, 1A, 1B, 1J, 1K, 1P | npm |
| 1Q/opta-phone-bridge | Bun |
| 1Q/opta-pa-messenger | npm |
| 1M | pip / uv (Python venv at `.venv/`) |
| 1E, 1G, 1H, 1I | Xcode / Swift Package Manager |
| Root (pnpm workspace) | pnpm |

The root `pnpm-workspace.yaml` covers shared `6-Packages/*` only. Individual apps under `1-Apps/` manage their own `node_modules`.

---

## Key Inter-App Dependencies

- **`@opta/ui`** (`6-Packages/6D-UI`) — React component library used by 1F, 1L, 1A, 1B
- **`@opta/api`** (`6-Packages/6A-API`) — Auth middleware + rate limiting used by web apps
- **`@opta/logger`** (`6-Packages/6E-Logger`) — Structured logging used by web apps
- LMX client library is duplicated in 1D (`src/lmx/client.ts`) and 1L (`web/src/lib/lmx-client.ts`) — keep them in sync when changing LMX API contracts

---

## TypeScript ESM Convention (1D, 1L, 1F)

All TypeScript apps use `"type": "module"`. Import local files with `.js` extension even in `.ts` source:
```typescript
import { foo } from './foo.js';   // ✓ correct
import { foo } from './foo';       // ✗ breaks at runtime
```
