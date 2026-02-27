# Architecture

## Project Structure

```
OptaPlus/
├── Package.swift                          # Swift Package manifest (iOS 17+, macOS 14+)
│
├── Shared/
│   ├── Sources/
│   │   ├── OptaPlus/                      # Design tokens library
│   │   │   └── OptaPlus.swift             # Shared constants and utilities
│   │   │
│   │   └── OptaMolt/                      # Chat UI + networking library
│   │       ├── Chat/
│   │       │   ├── Models.swift           # ChatMessage, ChatAttachment, ContentBlock
│   │       │   ├── MessageBubble.swift    # Message bubble component
│   │       │   ├── MarkdownContent.swift  # Markdown parser → ContentBlock views
│   │       │   ├── CodeBlockView.swift    # Syntax-highlighted code with copy
│   │       │   ├── SyntaxHighlighter.swift# Multi-language syntax coloring
│   │       │   ├── TableView.swift        # Dynamic markdown table rendering
│   │       │   ├── CollapsibleSection.swift# Expandable content sections
│   │       │   ├── ChartView.swift        # SwiftUI Charts integration
│   │       │   ├── LinkPreview.swift      # URL preview cards
│   │       │   ├── ReactionBar.swift      # Emoji reaction strip
│   │       │   ├── AttachmentPicker.swift  # File attachment UI
│   │       │   ├── AttachmentPreview.swift # Attachment thumbnail display
│   │       │   └── AsyncImageView.swift   # Async image loading
│   │       │
│   │       ├── DesignSystem/
│   │       │   ├── Colors.swift           # Cinematic Void color tokens
│   │       │   ├── Typography.swift       # Sora typeface + type scale
│   │       │   ├── ViewModifiers.swift    # Glass effects, ignition animations
│   │       │   ├── Animations.swift       # Spring/timing animation tokens
│   │       │   └── MotionModifiers.swift  # Ambient float, breathe, gradient fade
│   │       │
│   │       └── Networking/
│   │           ├── OpenClawProtocol.swift  # Protocol v3 types (frames, params, models)
│   │           ├── OpenClawClient.swift    # WebSocket client (NWConnection)
│   │           ├── ChatViewModel.swift     # Chat state management + streaming
│   │           ├── SyncCoordinator.swift   # Cross-session sync logic
│   │           └── TelegramSyncManager.swift# Telegram channel integration
│   │
│   └── Tests/
│       ├── OptaPlusTests/                 # Design token tests
│       └── OptaMoltTests/                 # Chat component + networking tests
│
├── macOS/OptaPlusMacOS/
│   ├── OptaPlusMacOSApp.swift             # App entry point + WindowGroup
│   ├── ContentView.swift                  # Main layout (sidebar + chat)
│   ├── ChatTextInput.swift                # Message input with attachments
│   ├── CommandPalette.swift               # ⌘P command palette overlay
│   ├── KeyboardShortcuts.swift            # ⌘/ shortcut cheat sheet
│   ├── BotProfileSheet.swift              # Bot configuration sheet
│   ├── ContextPanel.swift                 # Right-panel context view
│   ├── ThinkingOverlay.swift              # Draggable thinking indicator
│   ├── AmbientBackground.swift            # Animated void background
│   ├── AnimationSystem.swift              # macOS animation coordination
│   ├── LoadingSplash.swift                # App loading screen
│   ├── SoundManager.swift                 # Audio feedback
│   ├── NotificationManager.swift          # Native notifications
│   └── TelegramAuthView.swift             # Telegram auth flow
│
└── iOS/OptaPlusIOS/
    ├── OptaPlusIOSApp.swift               # App entry point
    ├── ContentView.swift                  # Root navigation
    └── Views/
        ├── BotListView.swift              # Bot grid/list
        ├── BotAvatarView.swift            # Bot avatar component
        ├── ChatView.swift                 # Chat conversation view
        ├── ChatInputBar.swift             # iOS message input
        ├── MessageBubble.swift            # iOS message bubble wrapper
        ├── ThinkingOverlay.swift          # iOS thinking indicator
        ├── SettingsView.swift             # Gateway + app settings
        ├── AboutView.swift                # About screen
        └── OnboardingView.swift           # First-launch onboarding
```

## Data Flow

```
┌─────────────────┐
│  OpenClaw        │
│  Gateway         │
│  (WebSocket)     │
└────────┬────────┘
         │ Protocol v3 (JSON frames)
         ▼
┌─────────────────┐
│ OpenClawClient   │  NWConnection WebSocket
│                  │  Handles: connect, req/res, events
│                  │  Reconnects with exponential backoff
└────────┬────────┘
         │ Parsed events + responses
         ▼
┌─────────────────┐
│ ChatViewModel    │  @MainActor, ObservableObject
│                  │  Manages: messages, streaming state,
│                  │  history pagination, send queue
└────────┬────────┘
         │ @Published properties
         ▼
┌─────────────────┐
│ SwiftUI Views    │  Platform-specific (macOS / iOS)
│                  │  ContentView → MessageBubble →
│                  │  MarkdownContent → CodeBlock/Table/etc.
└─────────────────┘
```

## Design System Hierarchy

```
OptaPlus (Design Tokens)
  │  Colors, spacing constants, shared utilities
  │
  ▼
OptaMolt (Component Library)
  │  DesignSystem/     → Color tokens, typography, glass, animations
  │  Chat/             → MessageBubble, MarkdownContent, CodeBlock, etc.
  │  Networking/       → OpenClawClient, ChatViewModel
  │
  ├──▶ macOS/OptaPlusMacOS   → Platform app using OptaMolt
  └──▶ iOS/OptaPlusIOS       → Platform app using OptaMolt
```

## State Management

### OpenClawClient
- `@Published state: ConnectionState` — disconnected / connecting / connected / reconnecting
- `@Published lastError: String?` — current error message
- `@Published reconnectAttempts: Int` — reconnection counter
- `@Published latencyMs: Double?` — ping/pong round-trip latency
- Callbacks: `onEvent`, `onStateChange`, `onHello`

### ChatViewModel
- `@Published messages: [ChatMessage]` — ordered message list
- `@Published isStreaming: Bool` — whether a response is being streamed
- `@Published streamingContent: String` — partial streaming buffer
- Handles: send, abort, history loading, pagination

### Platform App State
- **macOS:** Window-level state in `ContentView` — selected bot, sidebar visibility, overlay states
- **iOS:** Navigation state via `NavigationStack` — bot selection, settings, onboarding

## Networking: Protocol v3

### Frame Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `req` | Client → Gateway | Request with method + params |
| `res` | Gateway → Client | Response (ok/error + payload) |
| `event` | Gateway → Client | Streaming events (chat.delta, etc.) |

### Handshake Flow

```
Client                          Gateway
  │                                │
  │──── WebSocket Connect ────────▶│
  │                                │
  │◀─── event: connect.challenge ──│
  │                                │
  │──── req: connect ─────────────▶│
  │     { minProtocol: 3,         │
  │       maxProtocol: 3,         │
  │       client: { id, version },│
  │       role: "operator",       │
  │       auth: { token } }       │
  │                                │
  │◀─── res: ok + hello payload ──│
  │                                │
  │     Connected ✓                │
```

### Reconnection Strategy

- **Trigger:** Connection failure, ping timeout (5s), WebSocket close
- **Backoff:** Exponential starting at 800ms, multiplier 1.7×, capped at 15s
- **Jitter:** ±20% random jitter on each delay
- **Ping:** Every 30s via WebSocket ping frame; pong expected within 5s
- **Recovery:** Pending requests are flushed with error on disconnect

### Key Methods

| Method | Purpose |
|--------|---------|
| `connect` | Handshake with auth and client info |
| `chat.send` | Send a message (with optional `deliver: true` for Telegram sync) |
| `chat.history` | Fetch paginated message history |
| `chat.abort` | Cancel in-progress generation |
| `sessions.list` | List active sessions |

### Session Modes

| Mode | Behavior |
|------|----------|
| **Synced** | Messages mirror to/from Telegram (`deliver: true`) |
| **Direct** | Same session context, no channel delivery |
| **Isolated** | Independent conversation with separate context |
