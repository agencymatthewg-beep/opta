# OptaPlus — Feature List

> Native OpenClaw chat client for macOS & iOS
> 71 Swift files · 21,374 lines of code

## Architecture
- **Shared library (OptaMolt)** — Cross-platform chat, networking, design system, storage
- **macOS app** — Full-featured desktop client
- **iOS app** — Mobile companion with adaptive UI
- **Swift Package Manager** for shared code dependency

## Core Features

### Chat Engine
- Real-time WebSocket connection to OpenClaw gateway
- Multi-bot support with per-bot configuration
- Session management (Direct, Synced, Isolated modes)
- Streaming message display with typing cursor
- Message history with local persistence (MessageStore)
- Reply threading with preview
- Message reactions (ReactionBar)
- Message pinning (PinManager)
- Message bookmarks (BookmarkManager)
- Smart message actions (copy, reply, pin, bookmark)
- Chat export (Markdown, JSON, plain text)
- Message statistics dashboard
- Message search with match navigation

### Rich Content Rendering
- Full Markdown rendering (MarkdownContent)
- Syntax-highlighted code blocks with copy button
- Collapsible sections for long content
- Table rendering (TableView)
- Chart visualization (ChartView)
- Link previews with metadata
- Async image loading
- Attachment picker & preview

### Design System (Cinematic Void)
- Custom color palette (deep black, glass, electric violet)
- Multiple themes with live preview
- Custom accent color per bot
- Font scaling (4 levels)
- Chat density settings (compact/normal/comfortable)
- Sora typography integration
- Motion/animation system with accessibility controls
- Ambient particle background (3 modes: on/subtle/off)

### macOS-Specific
- Sidebar navigation with bot list
- Command palette (⌘K)
- Keyboard shortcuts throughout
- Bot profile sheet with connection testing
- Session drawer with pin/unpin
- Notification manager (native macOS notifications)
- Sound effects (send/receive messages)
- Loading splash screen
- Context panel for conversation metadata
- Thinking overlay animation
- Window drag handle
- Dashboard view with bot health stats
- Telegram auth integration view
- Settings: General, Bots, Telegram tabs

### iOS-Specific
- Onboarding flow
- Adaptive chat view
- Bot list with avatars
- Settings with about screen
- Dashboard view
- Haptic feedback integration

### Networking
- OpenClaw WebSocket protocol (OpenClawClient)
- Auto-reconnection with exponential backoff
- Connection state management (connected/connecting/disconnected/reconnecting)
- Bot health monitoring (BotHealth)
- Sync coordinator for multi-device
- Telegram sync manager (planned TDLibKit integration)

### Storage
- Local message persistence (MessageStore)
- Chat export in multiple formats (ChatExporter)
- Message statistics tracking (MessageStats)

## Build Status
- ✅ macOS — 0 errors, 0 warnings
- ✅ iOS — 0 errors, 0 warnings
