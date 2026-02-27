---
parent: APP.md
scope: cross-platform
updated: 2026-02-15
---

# OptaPlus — SHARED.md

> Cross-platform architecture, data models, sync strategy, and design language shared between macOS and iOS.

---

## 1. Shared Swift Package: OptaMolt

All cross-platform code lives in `Shared/Sources/OptaMolt/`. Both platform targets depend on this package.

### Module Map

```
OptaMolt/
├── Chat/              # Message models, bubble components, markdown rendering
├── DesignSystem/      # Cinematic Void tokens, typography, glass, motion
├── Networking/        # OpenClawClient, protocol types, ChatViewModel
├── Storage/           # MessageStore, ChatExporter, MessageStats
├── BotManagement/     # Bot config models, health monitoring
├── Automation/        # Cron job models, CRUD operations
└── Sync/              # iCloud sync coordinator, conflict resolution
```

**Rule:** If code is used by both platforms → it lives in OptaMolt. Platform-specific UI is NEVER in OptaMolt.

---

## 2. Data Models (Shared)

### Bot
```swift
struct Bot: Identifiable, Codable {
    let id: UUID
    var name: String
    var host: String          // IP, hostname, or tunnel domain
    var port: Int
    var token: String
    var accentColor: String   // Hex color for bot identity
    var connectionMethod: ConnectionMethod  // .lan, .manual, .tunnel
    var isEnabled: Bool
    var notificationSettings: NotificationConfig
}
```

### ChatMessage
```swift
struct ChatMessage: Identifiable, Codable {
    let id: String
    let botId: UUID
    let role: MessageRole     // .user, .assistant, .system
    var content: String
    let timestamp: Date
    var attachments: [ChatAttachment]
    var reactions: [Reaction]
    var thinkingContent: String?
    var isStreaming: Bool
    var sessionKey: String?
    var replyToId: String?
}
```

### CronJob
```swift
struct CronJob: Identifiable, Codable {
    let id: String
    var name: String?
    var schedule: CronSchedule   // .at, .every, .cron
    var payload: CronPayload     // .systemEvent, .agentTurn
    var sessionTarget: SessionTarget
    var enabled: Bool
    var lastRun: Date?
    var nextRun: Date?
}
```

### BotConfig
```swift
struct BotConfig: Codable {
    var model: String?
    var systemPrompt: String?
    var skills: [String]
    var channels: [ChannelConfig]
    var heartbeat: HeartbeatConfig?
    var thinking: String?        // off, low, high, stream
}
```

---

## 3. Connection Architecture

### Three Connection Methods

| Method | Discovery | Use Case | Latency |
|--------|-----------|----------|---------|
| **LAN** | Bonjour/mDNS auto-discovery | Home network, lowest latency | <5ms |
| **Manual** | User enters IP:port | Known remote hosts | Varies |
| **Tunnel** | Cloudflare subdomain | Anywhere, through NAT | 20-100ms |

### Connection Flow
```
1. App Launch
   ├─ Bonjour scan for _openclaw._tcp services
   ├─ Load saved manual connections
   └─ Load saved tunnel endpoints
2. Per-Bot Connection
   ├─ NWConnection WebSocket
   ├─ Protocol v3 handshake (connect frame)
   ├─ Auth: token + clientId "openclaw-control-ui"
   └─ Hello payload → session key, bot info
3. Reconnection
   ├─ Exponential backoff (800ms base, 1.7x, 15s cap)
   ├─ ±20% jitter
   └─ Ping every 30s, pong timeout 5s
```

### Gateway Protocol v3 (Shared Implementation)

| Frame | Direction | Purpose |
|-------|-----------|---------|
| `req` | Client→Gateway | Method call with params |
| `res` | Gateway→Client | Response (ok/error + data) |
| `event` | Gateway→Client | Push events (chat.delta, status, etc.) |

**Key methods:** `connect`, `chat.send`, `chat.history`, `chat.abort`, `sessions.list`, `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `config.get`, `config.patch`, `gateway.restart`

---

## 4. Sync Strategy (iCloud)

### What Syncs
| Data | Storage | Sync |
|------|---------|------|
| Chat messages | CloudKit private DB | ✅ Both devices see full history |
| Bot configurations | CloudKit key-value | ✅ Add bot on Mac, appears on iPhone |
| User preferences | NSUbiquitousKeyValueStore | ✅ Theme, density, font size |
| Notification settings | CloudKit key-value | ✅ Per-bot per-type config |
| Cron job cache | CloudKit private DB | ✅ View automations on both devices |
| Session keys | NOT synced | ❌ Per-device (security) |

### Conflict Resolution
- **Messages:** Server timestamp wins (gateway is source of truth)
- **Bot config:** Last-write-wins with 5s debounce
- **Preferences:** Last-write-wins (low-stakes)

### Sync Latency Target
- iCloud propagation: <30 seconds between devices
- Gateway is always source of truth for live data (messages, sessions, cron)
- iCloud is the persistence/offline layer

---

## 5. Design Language (Cinematic Void)

### Color Tokens (from Colors.swift)
| Token | Hex | Usage |
|-------|-----|-------|
| `optaVoid` | `#050505` | Deepest background |
| `optaSurface` | `#0A0A0A` | Slightly elevated |
| `optaElevated` | `#121212` | Cards, panels |
| `optaPrimary` | `#8B5CF6` | Electric Violet accent |
| `optaPrimaryGlow` | `#A78BFA` | Glow/emphasis |
| `optaTextPrimary` | `#EDEDED` | Body text |
| `optaTextSecondary` | `#A1A1AA` | Labels |
| `optaTextMuted` | `#52525B` | Timestamps |
| `optaBorder` | `white @ 6%` | Subtle borders |

### Typography
- **Primary:** Sora (geometric, modern)
- **Fallback:** SF Rounded
- **Code:** SF Mono / Menlo
- **Scaling:** 4 levels (compact → large)

### Motion System
| Token | Config | Usage |
|-------|--------|-------|
| `.optaSpring` | response: 0.55, damping: 0.78 | Default transitions |
| `.optaSnap` | response: 0.35, damping: 0.85 | Quick interactions |
| `.optaGentle` | response: 0.8, damping: 0.72 | Ambient, background |
| `.optaFloat` | Continuous sine | Floating elements |
| `.optaBreathe` | Pulse opacity | Living indicators |

**Rule:** Spring physics ONLY. Never use `.easeInOut` or duration-based timing. Everything must feel physical.

### Glass Effects
```swift
.ultraThinMaterial  // Lightest blur — overlays, tooltips
.thinMaterial       // Medium — sidebars, panels
.regularMaterial    // Heaviest — modals, sheets
```

### Particle System
- **On:** Full ambient particles (performance mode for capable hardware)
- **Subtle:** Reduced particle count, slower motion
- **Off:** No particles (accessibility / battery)

---

## 6. Feature Parity Matrix

| Feature | macOS | iOS | Shared Code |
|---------|-------|-----|-------------|
| Bot chat (text) | ✅ | ✅ | OptaMolt |
| Streaming + thinking | ✅ | ✅ | OptaMolt |
| Markdown rendering | ✅ | ✅ | OptaMolt |
| Code blocks | ✅ | ✅ | OptaMolt |
| Image/file sending | ✅ | ✅ | OptaMolt |
| Voice messages | ✅ | ✅ | OptaMolt |
| Smart reactions | ✅ | ✅ | OptaMolt |
| @mention handoff | ✅ | ✅ | OptaMolt |
| Message search | ✅ | ✅ | OptaMolt |
| Message pinning | ✅ | ✅ | OptaMolt |
| Chat export | ✅ | ✅ | OptaMolt |
| Bot config editing | ✅ | ✅ | OptaMolt |
| Cron CRUD | ✅ | ✅ | OptaMolt |
| Bot restart/status | ✅ | ✅ | OptaMolt |
| Push notifications | ✅ | ✅ | Platform |
| iCloud sync | ✅ | ✅ | OptaMolt+CK |
| Multi-window | ✅ | ❌ | Platform |
| Command palette | ✅ | ❌ | Platform |
| Keyboard shortcuts | ✅ | ❌ | Platform |
| Side panels | ✅ | ❌ | Platform |
| Advanced sessions | ✅ | ❌ | Platform |
| Dashboard (dense) | ✅ | ✅ (simple) | Platform |
| Siri Shortcuts | ❌ | ✅ | Platform |
| Widgets | ❌ | ✅ | Platform |
| Live Activities | ❌ | ✅ | Platform |
| Haptic feedback | ❌ | ✅ | Platform |

---

## 7. Smart Reaction Protocol

Reactions are NOT decorative. They are **bot commands**.

### Default Mappings (User-Configurable)
| Reaction | Action Sent to Bot |
|----------|--------------------|
| 👍 | `[USER_REACTION: proceed] Continue with the next steps.` |
| ❓ | `[USER_REACTION: explain] Explain your last message in simpler terms.` |
| 👎 | `[USER_REACTION: revert] Undo or revert your last action.` |
| 🔄 | `[USER_REACTION: retry] Regenerate your last response.` |
| ⏸️ | `[USER_REACTION: pause] Pause current work and save state.` |
| ▶️ | `[USER_REACTION: resume] Resume paused work.` |
| 📋 | `[USER_REACTION: summarize] Summarize this conversation.` |
| 🔍 | `[USER_REACTION: detail] Give me more detail on this.` |

### @mention Cross-Bot Handoff
When user types `@BotName` in a chat with a different bot:
1. OptaPlus collects recent N messages from current chat
2. Sends to tagged bot: `[CROSS_BOT_HANDOFF from: {currentBot}] {context} \n\n {user message}`
3. Tagged bot receives context, analyzes, and responds
4. User can continue in either chat

---

## 8. Notification Architecture

### Notification Types (Per-Bot Configurable)
| Type | Default | Description |
|------|---------|-------------|
| `message` | On | Bot sends a message |
| `taskComplete` | On | Cron job or spawned task finishes |
| `error` | On | Bot error or crash |
| `statusChange` | Off | Bot connects/disconnects |
| `mention` | On | Bot mentions you by name |
| `heartbeat` | Off | Heartbeat summary |

### Delivery
- **iOS:** APNs push notifications (requires gateway webhook)
- **macOS:** UserNotifications framework (local, from live WebSocket)
- **Both:** In-app notification banner with bot accent color

---

## 9. Error Handling (Shared)

| Error | User Experience | Recovery |
|-------|-----------------|----------|
| WebSocket disconnect | Banner: "Reconnecting..." + bot dot turns amber | Auto-reconnect with backoff |
| Auth failure | Alert: "Token invalid" + settings link | Re-enter token |
| Bot unreachable | Banner: "Bot offline" + bot dot turns red | Retry button + auto-retry |
| iCloud sync fail | Silent retry | Exponential backoff, surface after 3 fails |
| Message send fail | Message turns red + retry icon | Tap to retry |
| Streaming abort | "Generation stopped" label | User can re-send |

---

## 10. Testing Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| Models | XCTest | Codable round-trip, model logic |
| Networking | XCTest + mock WebSocket | Protocol parsing, reconnection |
| UI Components | SwiftUI Previews | Visual regression |
| Integration | Xcode UI Tests | End-to-end chat flow |
| Performance | Instruments | Memory, CPU, scroll smoothness |
