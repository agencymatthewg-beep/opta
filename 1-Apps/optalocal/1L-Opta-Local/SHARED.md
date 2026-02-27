# Opta Local — Shared Foundation

> What both platforms share: backend contracts, data models, design language.

---

## Backend / API Contracts

### Connection

Both platforms connect to the same Opta LMX server via HTTP/HTTPS:

| Transport | Protocol | Used For |
|-----------|----------|----------|
| REST (HTTPS) | OpenAI-compatible | Chat completions, model management |
| SSE (HTTPS) | Server-Sent Events | Live dashboard metrics, server events |
| Bonjour/mDNS | UDP multicast | LAN server discovery (iOS native, Web manual) |
| Cloudflare Tunnel | HTTPS | WAN access through `*.trycloudflare.com` |

### Authentication

- **Admin Key:** `X-Admin-Key` header for admin endpoints
- **Chat API:** Bearer token or no auth (configurable in LMX)
- **Key Storage:** iOS Keychain, Web localStorage (encrypted)
- **WAN Auth:** Admin key + optional TOTP (TBD)

### Data Models

#### Server Status

```typescript
interface ServerStatus {
  vram_used_gb: number;
  vram_total_gb: number;
  loaded_models: LoadedModel[];
  active_requests: number;
  tokens_per_second: number;
  temperature_celsius: number;
  uptime_seconds: number;
}

interface LoadedModel {
  id: string;
  name: string;
  vram_gb: number;
  quantization: string;
  context_length: number;
  loaded_at: string; // ISO 8601
}
```

#### Chat Message

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  tokens_used?: number;
  created_at: string;
}

interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  created_at: string;
  updated_at: string;
}
```

### API Endpoints Used

| Endpoint | Method | Purpose | Platform |
|----------|--------|---------|----------|
| `/v1/chat/completions` | POST | Streaming chat | Both |
| `/v1/models` | GET | List available models | Both |
| `/admin/status` | GET | Server health snapshot | Both |
| `/admin/events` | GET (SSE) | Live metrics stream | Both |
| `/admin/models/load` | POST | Load a model | Both |
| `/admin/models/unload` | POST | Unload a model | Both |
| `/admin/models/{id}/info` | GET | Model details + VRAM estimate | Both |
| `/admin/sessions` | GET | List sessions (future) | Both |
| `/admin/sessions/{id}` | GET | Get session (future) | Both |

---

## Design Language

### Brand Identity

| Token | Value | Usage |
|-------|-------|-------|
| `--void` | `#09090b` | OLED-optimized background |
| `--surface` | `#18181b` | Card backgrounds |
| `--elevated` | `#27272a` | Raised elements |
| `--border` | `#3f3f46` | Subtle borders |
| `--text-primary` | `#fafafa` | Primary text |
| `--text-secondary` | `#a1a1aa` | Secondary text |
| `--text-muted` | `#52525b` | Muted/disabled text |
| `--primary` | `#8b5cf6` | Violet accent (brand) |
| `--primary-glow` | `#a855f7` | Hover/active state |
| `--neon-blue` | `#3b82f6` | Info, web indicators |
| `--neon-green` | `#22c55e` | Success, online status |
| `--neon-amber` | `#f59e0b` | Warning, WAN mode |
| `--neon-red` | `#ef4444` | Error, offline status |

### Typography

- **Font:** Sora (Web), SF Pro (iOS fallback)
- **Headings:** 600-700 weight, gradient text for hero elements
- **Body:** 400 weight, 0.85-0.95rem
- **Monospace:** SF Mono / Fira Code for code, metrics, server output

### Iconography

- **Web:** Lucide React
- **iOS:** SF Symbols
- **Style:** Outline, 1.5px stroke, rounded joins

### Motion Principles

- **Web:** Framer Motion — `ease-out` for entrances, `spring` for interactions
- **iOS:** SwiftUI `.spring(response: 0.35, dampingFraction: 0.8)` — `.optaSpring`
- **Glass panels:** `backdrop-filter: blur(20px)` (Web), `.ultraThinMaterial` (iOS)
- **Entrance animations:** Fade up with stagger (50ms between siblings)
- **Data updates:** Animate number changes, smooth gauge transitions

---

## Feature Parity Matrix

| Feature | Web | iOS | Notes |
|---------|-----|-----|-------|
| Server discovery (LAN) | Manual IP entry | Bonjour auto-discover | mDNS not available in browsers |
| Server discovery (WAN) | Manual tunnel URL | QR code scan | iOS camera-native |
| Streaming chat | Full | Full | Identical API |
| Dashboard metrics | Full (SSE) | Full (SSE) | Same data, different layout |
| Model load/unload | Full | Full | Identical API |
| Model library browse | Full + benchmark | Simplified | Web has more screen space |
| Session management | Full CRUD | Browse + resume | Web has full editing |
| RAG Studio | Full (drag-drop) | Simplified | Desktop-grade feature |
| Multi-model router | Full (drag UI) | Simplified (picker) | Web has richer interaction |
| Voice chat | N/A | Full (Whisper+TTS) | iOS microphone-native |
| Image/Vision chat | Drag-and-drop | Camera capture | Platform-native input |
| Push notifications | N/A | Full | iOS-exclusive |
| Widgets | N/A | Home screen + Lock | iOS-exclusive |
| Siri Shortcuts | N/A | Full | iOS-exclusive |
| Tool approval | Full | Push notification | iOS push + Web inline |
| Multi-server fleet | Full | Simplified | Admin feature |
| Shared conversations | Full (WebSocket) | Observer only | Web = host, iOS = join |
| Automation scheduler | Full (calendar UI) | N/A | Desktop-grade feature |

**Legend:**
- Full — Feature exists with complete functionality
- Simplified — Feature exists with reduced scope
- N/A — Not applicable to this platform
- Different UX — Same function, platform-native presentation

---

## Shared Code / Modules

| Module | Purpose | Used By |
|--------|---------|---------|
| `@opta/ui` | React component library (glass, buttons, inputs) | Web |
| API types (TypeScript) | Shared request/response types | Web |
| LMX API client | HTTP client for Opta LMX | Web (npm), iOS (reimplemented) |
| Session format | JSON session schema | Both (same format as Opta CLI) |

---

## Authentication / Identity

Single-user app — no user accounts in v1.

- **Server auth:** Admin API key set during LMX configuration
- **Key storage:** iOS Keychain / Web encrypted localStorage
- **WAN auth:** Admin key transported via QR code (contains URL + key)
- **Future:** Optional TOTP for WAN access

---

## Data Sync

- **Sessions:** Stored on Mac Studio filesystem, accessed via LMX Session API
- **Settings:** Per-device (no cross-device settings sync in v1)
- **Models:** Server-side only (Mac Studio manages model storage)
- **Connections:** Per-device (each device stores its own server connections)

---

*This file is the bridge between platforms. If it affects both, it goes here.*

*Generated by OPIS v2.0 — 2026-02-18*
