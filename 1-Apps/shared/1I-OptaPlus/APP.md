---
project: OptaPlus
version: 0.9.0
opis_mode: brownfield
opis_version: "2.0"
platforms: [macOS, iOS]
scaffold: option-d
status: active
created: 2025-01-28
opis_date: 2026-02-15
owner: Matthew Byrden
org: Opta Operations
repo: ~/Synced/Opta/1-Apps/1I-OptaPlus
---

# OptaPlus — APP.md

> **AI SUMMARY:** OptaPlus is a native macOS + iOS chat client that replaces Telegram for all OpenClaw bot communication. It connects directly via WebSocket, supports multi-bot management, automation CRUD, live debugging, and cross-device iCloud sync. macOS is the power tool (~3-5x iOS features, multi-window). iOS is the mobile-first Telegram killer. Design: "Cinematic Void" — void black, electric violet, spring physics, HD micro-animations. v1.0 = complete Telegram replacement. App Store distribution.

---

## 1. Identity

| Field | Value |
|-------|-------|
| **Name** | OptaPlus |
| **Tagline** | Your bots. One app. Zero compromise. |
| **Category** | Developer Tools / Productivity |
| **Audience** | OpenClaw users (power users first, broader adoption second) |
| **Distribution** | App Store (iOS + macOS) |
| **License** | Proprietary (Opta Operations) |

---

## 2. Problem Statement

OpenClaw bot operators currently rely on Telegram, WhatsApp, Discord, or other messaging apps as their primary interface. These are **general-purpose chat apps** forced into a **bot management role**:

- No native bot debugging (restart, config edit, status check)
- No automation management (cron CRUD buried in CLI)
- No live thinking/streaming visibility
- No cross-bot coordination (@mention handoff)
- No per-bot notification control
- Telegram rate limits, formatting quirks, API restrictions
- No multi-window simultaneous bot conversations
- Chat history tied to the messaging platform, not the bot

OptaPlus eliminates the middleman. Direct WebSocket. Purpose-built UI. Every feature designed for bots, not humans texting humans.

---

## 3. Solution

A native Swift app (macOS + iOS) that connects directly to OpenClaw gateways via WebSocket and provides:

### Core (Both Platforms)
- **Chat** — Real-time messaging with streaming, markdown, code blocks, media
- **Bot Management** — Config editing, model switching, status monitoring, restart
- **Automation** — Full CRUD for cron jobs and scheduled tasks
- **Debugging** — Live thinking view, context inspection, connection diagnostics
- **Smart Reactions** — 👍 proceed, ❓ explain, custom reaction→action mappings
- **@mention Handoff** — Tag a bot in another bot's chat to transfer context/work
- **Cross-Device Sync** — iCloud-synced chat history, settings, preferences
- **Multi-Connection** — LAN discovery, manual config, Cloudflare tunnel relay
- **Push Notifications** — Configurable per bot per notification type
- **Voice Messages** — Send voice, receive TTS playback
- **Siri Integration** — "Hey Siri, ask Opta to check my calendar"

### macOS Exclusive
- Multi-window simultaneous bot conversations (⌘N)
- Command palette (⌘K)
- Keyboard-first navigation (⌘1-6 bot switching)
- Information-dense dashboard
- Side-by-side context panels
- Advanced session management (pinned, isolated, synced)

### iOS Exclusive
- Siri Shortcuts / App Intents
- Widgets (bot status, quick actions)
- Live Activities (active task progress)
- Haptic feedback
- Thumb-zone optimized layout
- Quick bot switching (swipe, not multi-window)

---

## 4. Platform Strategy (Option D)

macOS and iOS share a Swift Package (`OptaMolt`) for networking, models, and design tokens. Platform UI is fully independent.

| Dimension | macOS | iOS |
|-----------|-------|-----|
| **Identity** | Command Center | Quick Draw |
| **Feature ratio** | ~3-5x iOS | Baseline |
| **Input** | Keyboard-first | Touch-first |
| **Layout** | Multi-window, panels | Single-focus, swipe |
| **Priority** | Primary development | High priority (Telegram replacement) |
| **v1.0 bar** | Full bot management + multi-window | Complete Telegram replacement |

**Development order:** iOS to usable Telegram replacement → macOS heavy feature development → iterative parity for shared features.

---

## 5. Technical Foundation

| Aspect | Choice |
|--------|--------|
| **Language** | Swift 5.9+ |
| **UI** | SwiftUI (pure, no UIKit/AppKit wrappers) |
| **Platforms** | iOS 17+, macOS 14+ |
| **Dependencies** | Zero external (pure SwiftUI + Foundation + NWConnection) |
| **Package Manager** | SPM (Swift Package Manager) |
| **Networking** | NWConnection WebSocket (not URLSession) |
| **Protocol** | OpenClaw Gateway Protocol v3 (JSON frames) |
| **Persistence** | SwiftData / UserDefaults |
| **Sync** | CloudKit (iCloud) for chat history + settings |
| **Auth** | Gateway token-based (operator role) |
| **Connection** | Manual IP, Bonjour/mDNS LAN discovery, Cloudflare tunnel |
| **Push** | APNs via OpenClaw gateway webhook |

---

## 6. Design Language

**Theme:** Cinematic Void
**Reference:** Resend.com (#1), Raycast (#2), Lusion (#3)
**Anti-reference:** Texts.com (everything to avoid)

| Token | Value | Usage |
|-------|-------|-------|
| `optaVoid` | `#050505` | Background — deepest black |
| `optaPrimary` | `#8B5CF6` | Electric Violet — brand accent |
| `optaPrimaryGlow` | `#A78BFA` | Glow effects, emphasis |
| `optaTextPrimary` | `#EDEDED` | High-contrast body text |
| Font | Sora → SF Rounded | Geometric, modern |
| Motion | Spring physics only | `.optaSpring`, `.optaSnap`, `.optaGentle` |
| Glass | `.ultraThinMaterial` | Graduated opacity, blur |
| Particles | Ambient background | 3 modes: on / subtle / off |

**Core principles:** Content emerges from void. Everything breathes. Nothing is static. Premium developer luxury. 3D elements and constant motion are requirements, not nice-to-haves.

---

## 7. Chat Feature Model

### Standard Features (Full Implementation)
- Markdown rendering (headings, bold, italic, lists, blockquotes)
- Syntax-highlighted code blocks with copy button
- Image/file sending and receiving
- Voice messages (send + TTS playback)
- Message search with match navigation
- Chat export (Markdown, JSON, plain text)
- Message pinning and bookmarks
- Link previews with metadata
- Collapsible sections for long content
- Tables and chart visualization

### Adapted Human Features → Bot Utility
| Human Feature | Bot Adaptation |
|---------------|----------------|
| 👍 Reaction | "Proceed with next steps" |
| ❓ Reaction | "Explain what you just said" |
| 👎 Reaction | "Undo / revert last action" |
| 🔄 Reaction | "Retry / regenerate response" |
| @mention in other chat | Tagged bot analyzes context, updates knowledge, or takes over |
| Reply-to | Reference specific message for context |
| Forward | Share message with another bot for analysis |

### Removed (No Bot Utility)
- GIF search/sending
- Stickers
- User presence/typing for other humans
- Read receipts (human-style)

---

## 8. Business Model

| Phase | Model |
|-------|-------|
| v1.0 | Free — App Store, friends can download and test |
| v1.x | Free — build user base, gather feedback |
| v2.0+ | TBD — evaluate freemium, pro tier, or stay free |

**Revenue is not the goal for v1.** Building the best OpenClaw client is.

---

## 9. Success Metrics

| Metric | v1.0 Target |
|--------|-------------|
| Daily active use | Matthew uses OptaPlus instead of Telegram for all bots |
| Bot coverage | All 7+ bots manageable from both platforms |
| Stability | Zero crashes per week, <1s message latency |
| Feature parity | Every Telegram bot feature replicated or improved |
| App Store | Published, downloadable by friends |
| Siri | "Ask [bot] to [action]" works reliably |
| Multi-window (macOS) | 3+ simultaneous conversations without lag |
| iCloud sync | History appears on both devices within 30s |

---

## 10. Ecosystem Position

```
┌─────────────────────────────────────────────┐
│                 Opta Ecosystem               │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ OptaPlus │  │ Opta CLI │  │ Opta Life│  │
│  │ (Client) │  │ (Coding) │  │ (Tasks)  │  │
│  └────┬─────┘  └────┬─────┘  └──────────┘  │
│       │              │                       │
│       ▼              ▼                       │
│  ┌──────────────────────┐                    │
│  │  OpenClaw Gateways   │                    │
│  │  (7+ bots)           │                    │
│  └──────────┬───────────┘                    │
│             │                                │
│             ▼                                │
│  ┌──────────────────────┐                    │
│  │  Opta-LMX            │                    │
│  │  (Local inference)   │                    │
│  └──────────────────────┘                    │
└─────────────────────────────────────────────┘
```

OptaPlus is the **primary user-facing interface** for the entire Opta bot infrastructure. It replaces Telegram as the default channel and becomes the single pane of glass for bot communication, management, and automation.

---

## 11. Read Order

See `docs/INDEX.md` for the full document read order for AI agents.

**Quick start:** APP.md → SHARED.md → `<platform>/PLATFORM.md` → `<platform>/CLAUDE.md`
