# OptaPlus

**Native macOS & iOS chat client for OpenClaw bots.**

OptaPlus is a premium, cross-platform chat application built with SwiftUI that connects to [OpenClaw](https://github.com/openclaw) gateway instances. It features the **Cinematic Void** design system — deep black backgrounds, glassmorphism surfaces, and electric violet accents — delivering a cinematic, OLED-optimized experience.

![macOS Screenshot](docs/screenshots/macos-chat.png)
![iOS Screenshot](docs/screenshots/ios-chat.png)

---

## Features

### Chat
- Real-time streaming responses with thinking overlay
- Rich markdown rendering (headings, bold, italic, code, links)
- Syntax-highlighted code blocks with one-click copy
- Collapsible sections for structured output
- Dynamic table rendering with streaming resilience
- Image display and chart visualization
- Emoji-only messages with large font rendering
- Message search (`⌘F`)
- Grouped timestamps and "new messages" pill
- Message reactions bar
- File attachments with preview
- Pull-to-refresh and infinite scroll history

### Design
- **Cinematic Void** dark theme — OLED-black (#050505)
- Three-tier glassmorphism (subtle, standard, strong)
- Sora typeface with full typographic scale
- Ambient float, breathe, and hover glow motion effects
- Staggered ignition entrance animations
- Gradient-to-void edge dissolves
- Reduce Motion accessibility compliance
- Bot accent color glow per-conversation

### Networking
- OpenClaw Gateway Protocol v3 (WebSocket)
- Exponential backoff reconnection with jitter
- Ping/pong health monitoring (30s interval, 5s deadline)
- Offline message queue with retry
- Session persistence across restarts
- Chat history pagination
- Multiple session modes: Synced, Direct, Isolated

### System Integration (macOS)
- Command palette (`⌘P`)
- Keyboard shortcuts overlay (`⌘/`)
- Native notifications
- Sound effects (send, receive, connect)
- Multi-window support
- Session drawer (`⌘]`)

### iOS
- Onboarding flow
- Haptic feedback
- Bot card grid with status indicators
- iPad-optimized layouts
- Settings with gateway configuration

---

## Requirements

| Component | Minimum Version |
|-----------|----------------|
| macOS     | 14.0 (Sonoma)  |
| iOS       | 17.0            |
| Xcode     | 15.0            |
| Swift     | 5.9             |

No external dependencies — pure SwiftUI + system frameworks (Network, Charts).

---

## Build Instructions

### macOS

```bash
# Clone the repository
git clone <repo-url> OptaPlus
cd OptaPlus

# Open the macOS project
open macOS/OptaPlusMacOS.xcodeproj

# Or build from command line
xcodebuild -project macOS/OptaPlusMacOS.xcodeproj \
  -scheme OptaPlusMacOS \
  -destination 'platform=macOS' \
  build
```

### iOS

```bash
# Open the iOS project
open iOS/OptaPlusIOS.xcodeproj

# Or build from command line
xcodebuild -project iOS/OptaPlusIOS.xcodeproj \
  -scheme OptaPlusIOS \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro' \
  build
```

### Shared Package (OptaMolt)

The shared Swift Package can be built and tested independently:

```bash
swift build
swift test
```

---

## Architecture

OptaPlus is a **mono-repo** with three components:

```
OptaPlus/
├── Package.swift              # Shared Swift Package (OptaPlus + OptaMolt)
├── Shared/
│   ├── Sources/
│   │   ├── OptaPlus/          # Design tokens library
│   │   └── OptaMolt/          # Chat UI + networking library
│   │       ├── Chat/          # Message bubble, markdown, code blocks, tables
│   │       ├── DesignSystem/  # Colors, typography, animations, glass effects
│   │       └── Networking/    # OpenClawClient, ChatViewModel, protocol types
│   └── Tests/
├── macOS/OptaPlusMacOS/       # macOS app target
└── iOS/OptaPlusIOS/           # iOS app target
```

**Data flow:** Gateway → WebSocket → `OpenClawClient` → `ChatViewModel` → SwiftUI Views

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture document.

---

## Design System

OptaPlus uses the **Cinematic Void** design language:

- **Void:** `#050505` — OLED-black background
- **Primary:** `#8B5CF6` — Electric violet
- **Glass:** Three tiers of glassmorphism (ultraThin → thin → regular material)
- **Type:** Sora typeface, 10pt–34pt scale
- **Motion:** Spring animations (0.2–0.5s response), ambient float, breathe effects
- **Corners:** 24px (panels), 16px (cards), 12px (small elements)

See [docs/DESIGN.md](docs/DESIGN.md) for the complete design system specification.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘1`–`⌘6` | Switch to bot 1–6 |
| `⌘P` | Command palette |
| `⌘F` | Search messages |
| `⌘K` | Clear chat |
| `⌘N` | New window |
| `⌘,` | Settings |
| `⌘W` | Close window |
| `⌘/` | Keyboard shortcuts cheat sheet |
| `⌘]` | Toggle session drawer |
| `⏎` | Send message |
| `⇧⏎` | New line |
| `Esc` | Close panel / abort generation |

See [docs/SHORTCUTS.md](docs/SHORTCUTS.md) for the complete shortcuts reference.

---

## Configuration

### Adding Bots

Bots are configured in the app's settings. Each bot requires:

1. **Name** — Display name for the sidebar
2. **Gateway URL** — WebSocket endpoint (e.g., `ws://localhost:18793`)
3. **Token** — Authentication token for the gateway (optional, depends on gateway config)
4. **Session Key** — Default session key (usually `main`)

### Gateway Connection

OptaPlus connects to OpenClaw gateways using the **Protocol v3** WebSocket protocol:

1. Client opens WebSocket connection to the gateway
2. Gateway sends `connect.challenge` event
3. Client responds with `connect` request (client info, auth token, scopes)
4. Gateway responds with `hello` payload (available agents, sessions)
5. Client is now connected and can send/receive chat messages

The client uses `openclaw-control-ui` as its client ID to operate with operator-level permissions.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Follow the existing code style — SwiftUI, Cinematic Void design tokens
4. Add tests for new components in `Shared/Tests/`
5. Commit with conventional commit messages (`feat:`, `fix:`, `docs:`)
6. Open a pull request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Credits

Built by **Opta Operations**.
