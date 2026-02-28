# CLAUDE.md — 1-Apps/

Guidance for Claude Code when working in any Opta app.
*Last updated: 2026-02-28*

## Directory Map

Apps are divided by domain. **Each app with a `CLAUDE.md` has its own rules — always read it first.**

### optamize/ — optamize.biz products
| ID | App | Platform | Has CLAUDE.md |
|----|-----|----------|---------------|
| 1E | Opta Life iOS | iOS (SwiftUI + Firebase) | ✓ |
| 1F | Opta Life Web | Web (Next.js 15) | ✓ |
| 1G | Opta Mini macOS | macOS (SwiftUI menubar) | ✓ |
| 1H | Opta Scan iOS | iOS (SwiftUI + Claude Vision) | ✓ |
| 1J | Optamize macOS | macOS (Tauri v2 + React + Rust) | ✓ (design system enforced) |

### optalocal/ — optalocal.com products
| ID | App | Platform | Has CLAUDE.md |
|----|-----|----------|---------------|
| 1D | Opta CLI | CLI/TUI/Daemon (TypeScript) | ✓ (comprehensive) |
| 1L | Opta Local | Web + iOS (Next.js 16) | ✓ |
| 1M | Opta LMX | Python (MLX inference server) | ✓ |
| 1O | Opta Init | Web (Next.js 15) | ✓ |
| 1P | Opta Codex Desktop | Electron/Vite (TypeScript) | — (symlink → 1D/apps/opta-codex-desktop) |

### shared/ — cross-domain
| ID | App | Platform | Has CLAUDE.md |
|----|-----|----------|---------------|
| 1A | AI Components | Web (Next.js 16) | — |
| 1I | OptaPlus | iOS + macOS (SwiftUI) | ✓ |
| 1N | Opta Cloud Accounts | Auth spec | — (read AUTH-METHODS.md first) |

### Unregistered Services (pending move to 3-Services/)
| Dir | Platform | Has CLAUDE.md |
|-----|----------|---------------|
| opta-pa-messenger | Web (Next.js 15 + Claude API) | — |
| opta-phone-bridge | Node (Bun + ElevenLabs) | — |

---

## The Opta Local Stack (Critical)

Three apps form a layered local-inference pipeline. See `OPTA-LOCAL-STACK.md` for the full architecture diagram.

```
opta chat / opta tui / opta do              (optalocal/1D-Opta-CLI-TS)
        │
opta daemon  127.0.0.1:9999                 (1D-Opta-CLI-TS/src/daemon/)
        │   HTTP v3 REST + WS streaming
Opta LMX  192.168.188.11:1234               (optalocal/1M-Opta-LMX)
        │   OpenAI-compatible /v1/chat/completions
Opta Local Web  localhost:3004              (optalocal/1L-Opta-Local/web/)
```

**CLI Daemon** owns session orchestration, permission gating, and event persistence.
**LMX** is Apple Silicon only (MLX), OpenAI API-compatible, must never crash on OOM.
**Opta Local Web** connects directly to LMX — LAN mode (no auth) or Cloud mode (Supabase + Cloudflare Tunnel).

Operational commands:
```bash
# CLI daemon
cd optalocal/1D-Opta-CLI-TS && npm run dev -- daemon start

# LMX inference server (runs as LaunchDaemon on Mono512)
# Admin API: POST /admin/models/load  Header: X-Admin-Key: <key>

# Web dashboard
cd optalocal/1L-Opta-Local/web && npm run dev   # http://localhost:3004
```

---

## Shared Auth Spec (1N-Opta-Cloud-Accounts)

`shared/1N-Opta-Cloud-Accounts/` is **not a buildable app** — it is the canonical Supabase auth spec. Before adding or changing auth in any app, read:
- `AUTH-METHODS.md` — four allowed Supabase-native auth methods
- `contracts/` — session and data contracts each app must satisfy
- `ENV-MATRIX.md` — which env vars apply per app

---

## Cross-App Design Rules

| Concern | Rule |
|---------|------|
| Animations | Framer Motion only (`motion`, `AnimatePresence`) |
| Icons | Lucide React only — no inline SVGs |
| Glass panels | `.glass` / `.glass-subtle` / `.glass-strong` CSS classes |
| Colors | CSS variables only — never hex/rgb literals in component code |
| Conditional classes | `cn()` helper (clsx + tailwind-merge) |
| Mode | Dark only, OLED-optimized (`#09090b`) |

iOS: SF Symbols, `@Observable @MainActor`, `.optaSpring` animations, Keychain for secrets.

---

## Package Managers by App

| App(s) | Package Manager |
|--------|----------------|
| 1D, 1L/web, 1F, 1A, 1J, 1O | npm (managed via pnpm workspace from root) |
| opta-phone-bridge | Bun |
| opta-pa-messenger | npm |
| 1M | pip (Python venv at `/Users/opta/venvs/mlx/`) |
| 1E, 1G, 1H, 1I | Xcode / Swift Package Manager |
| Root workspace | pnpm |

---

## Key Inter-App Dependencies

- **`@opta/ui`** (`6-Packages/6D-UI`) — React component library used by 1F, 1L, 1A
- **`@opta/api`** (`6-Packages/6A-API`) — Auth middleware + rate limiting
- **`@opta/logger`** (`6-Packages/6E-Logger`) — Structured logging
- LMX client is duplicated in `1D/src/lmx/client.ts` and `1L/web/src/lib/lmx-client.ts` — keep in sync when changing LMX API contracts

---

## TypeScript ESM Convention (1D, 1L, 1F)

```typescript
import { foo } from './foo.js';   // ✓ correct — .js extension required
import { foo } from './foo';       // ✗ breaks at runtime
```
