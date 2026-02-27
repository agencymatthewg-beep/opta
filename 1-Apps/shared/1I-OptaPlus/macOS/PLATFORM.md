---
parent: APP.md
scope: macOS
identity: Command Center
platforms: [macOS 14+]
version: 0.9.0
updated: 2026-02-15
---

# OptaPlus macOS — PLATFORM.md

> **Platform identity:** Command Center. Multi-window power tool with keyboard-first navigation, command palette, information-dense dashboard, and advanced session management. ~3-5x iOS features.

---

## 1. macOS Identity

| Aspect | Definition |
|--------|-----------|
| **Name** | OptaPlus Command Center |
| **Role** | Primary bot management tool for power users |
| **Input Model** | Keyboard-first + mouse secondary |
| **Layout** | Multi-window, side panels, keyboard shortcuts |
| **Feature Ratio** | ~3-5x iOS features |
| **Target Users** | Developers, power users, OpenClaw operators |

---

## 2. Feature Set (macOS-Exclusive + Shared)

### Shared Core (From SHARED.md)
- ✅ Real-time chat with streaming/thinking
- ✅ Markdown + code blocks + images/files
- ✅ Voice messages (send + TTS playback)
- ✅ Smart reactions (👍 proceed, ❓ explain, etc.)
- ✅ @mention cross-bot handoff
- ✅ Bot configuration editing
- ✅ Cron job CRUD (automation)
- ✅ Message search + pinning
- ✅ iCloud sync (history + settings)
- ✅ Push notifications (local + APNs)

### macOS Exclusive
1. **Multi-Window Management (⌘N)**
   - Open unlimited chat windows simultaneously
   - Each window = independent bot + session
   - Window restoration on relaunch (via AppKit)
   - Keyboard shortcut: ⌘1-6 to jump to specific bots
   - Arrange windows side-by-side for parallel bot work

2. **Command Palette (⌘K)**
   - Instant access to all bot actions
   - Fuzzy search: "restart opta", "cron list", "config edit"
   - Recent commands highlighted
   - Keyboard-only navigation

3. **Information-Dense Dashboard**
   - Status grid: all 7+ bots at a glance
   - Each bot shows: status dot, last message, CPU/memory (if available)
   - Upcoming cron jobs timeline
   - Quick actions: restart, config, logs
   - Filterable by status (online/offline/error)

4. **Side Panels (⌘[ / ⌘])**
   - **Context Panel (left):** Bot details, config summary, recent sessions
   - **Thinking Overlay (right):** Live streaming thinking content
   - Toggle via keyboard shortcut
   - Resizable, collapsible

5. **Advanced Session Management**
   - Pinned sessions (persist across restarts)
   - Isolated sessions (sandbox mode, no history sync)
   - Session groups (tag related sessions)
   - Session rename/export
   - Per-session notification filters

6. **Keyboard Shortcuts (100+)**
   - Navigation: ⌘1-6 (bot), ⌘[ / ⌘] (panels), ⌘~ (next window)
   - Chat: ⌘Enter (send), ⌘↑ (last message), ⌘L (clear)
   - Bot: ⌘R (restart), ⌘, (config), ⌘D (dashboard)
   - Reactions: ⌘1 (👍), ⌘2 (❓), ⌘3 (👎), ⌘4 (🔄)
   - Cron: ⌘⇧J (job list), ⌘⇧N (new cron)
   - See `docs/SHORTCUTS.md` for full list

7. **Menu Bar Integration**
   - Status indicator (green/red/amber dot)
   - Recent messages dropdown
   - Quick bot switcher
   - "New Window" menu item
   - Settings quick access

8. **Floating Windows**
   - Bot status ticker (minimalist, always-on-top option)
   - Floating console for cron/debug output
   - Notification center preview

9. **Debugging Enhancements**
   - Live WebSocket frame inspector
   - Protocol decoder (req/res/event)
   - Latency meter (request → response time)
   - Reconnection log
   - Memory/CPU per bot
   - Thread inspector (async task viewer)

10. **Code Editor for Config**
    - Syntax highlighting for bot config YAML
    - Inline documentation tooltips
    - Live validation feedback
    - Diff before/after on save

---

## 3. Code Paths (Reference Existing macOS Implementation)

### App Delegate & Entry Point
- **File:** `macOS/OptaPlusMacOS/OptaPlusMacOSApp.swift`
- **Responsibility:** App lifecycle, window management, menu bar setup

### Core Views
| Component | File | Purpose |
|-----------|------|---------|
| Dashboard | `macOS/OptaPlusMacOS/DashboardView.swift` | Grid of all bots, quick actions |
| Chat Window | `macOS/OptaPlusMacOS/ChatView.swift` | Per-bot conversation (main content) |
| Command Palette | `macOS/OptaPlusMacOS/CommandPalette.swift` | ⌘K fuzzy search, command execution |
| Context Panel | `macOS/OptaPlusMacOS/ContextPanel.swift` | Bot info, config summary, sessions |
| Thinking Overlay | `macOS/OptaPlusMacOS/ThinkingOverlay.swift` | Live streaming thinking display |
| Keyboard Shortcuts | `macOS/OptaPlusMacOS/KeyboardShortcuts.swift` | Global shortcut handler |
| Settings | `macOS/OptaPlusMacOS/SettingsViews.swift` | Preferences, connection, appearance |

### Supporting Components
| Component | File | Purpose |
|-----------|------|---------|
| Chat Input | `macOS/OptaPlusMacOS/ChatTextInput.swift` | Multiline text, send button, reactions |
| Bot Profile | `macOS/OptaPlusMacOS/BotProfileSheet.swift` | Bot config editor |
| Session Manager | `macOS/OptaPlusMacOS/SessionViews.swift` | Pin/isolate/export sessions |
| Debug Panel | `macOS/OptaPlusMacOS/DebugView.swift` | WebSocket frames, latency, memory |
| Menu Bar | `macOS/OptaPlusMacOS/MenuBarManager.swift` | Status indicator, quick actions |
| Notifications | `macOS/OptaPlusMacOS/NotificationManager.swift` | Local notifications via UserNotifications |

### Shared Code (OptaMolt Package)
- **Networking:** `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift` (WebSocket, protocol parsing)
- **Chat:** `Shared/Sources/OptaMolt/Chat/MessageModel.swift`, `MarkdownContent.swift`, etc.
- **Design:** `Shared/Sources/OptaMolt/DesignSystem/Colors.swift`, `Animations.swift`, `ViewModifiers.swift`
- **Storage:** `Shared/Sources/OptaMolt/Storage/MessageStore.swift`
- **Sync:** `Shared/Sources/OptaMolt/Sync/CloudKitCoordinator.swift`

---

## 4. Window Management (AppKit Bridge)

### NSWindowController Pattern
```swift
// Multi-window coordination
class OptaPlusWindowManager: NSObject {
    static let shared = OptaPlusWindowManager()
    var windows: [UUID: NSWindow] = [:]  // botId → window
    
    func openNewWindow(for bot: Bot) {
        let controller = NSWindowController(
            rootViewController: ChatWindowViewController(bot: bot)
        )
        windows[bot.id] = controller.window
        controller.window?.makeKeyAndOrderFront(nil)
    }
}
```

### Window Restoration
- **Saved state:** `~/Library/Application Support/OptaPlus/windows.json`
- **Restore on relaunch:** Read state, open windows in order
- **State includes:** bot ID, chat scroll position, panel visibility

---

## 5. Design Implementation (Cinematic Void)

### macOS-Specific Design Tokens
| Token | Value | Usage |
|-------|-------|-------|
| `contentWidth` | 900px max | Chat content (readable) |
| `panelWidth` | 300px (collapsible) | Side panels |
| `dashboardColumns` | 4 columns | Bot grid on display |
| `cornerRadius` | 12px | Cards, inputs |
| `backdropBlur` | `.thinMaterial` | Sheets, panels |
| `panelShadow` | `0 4px 12px rgba(0,0,0,0.3)` | Elevation |

### Motion (Spring Physics Only)
```swift
// All macOS motion uses spring
.spring(response: 0.55, damping: 0.78)  // optaSpring
.spring(response: 0.35, damping: 0.85)  // optaSnap (quick)
```

### Glass Morphism
- Floating panels with `.ultraThinMaterial`
- Sidebar with `.thinMaterial`
- Modal sheets with `.regularMaterial`

---

## 6. Keyboard Shortcut Map

### Navigation & Windows
| Shortcut | Action |
|----------|--------|
| ⌘N | New chat window |
| ⌘W | Close current window |
| ⌘~ | Next window (cycle) |
| ⌘1-6 | Jump to bot 1-6 |
| ⌘[ | Toggle left panel |
| ⌘] | Toggle right panel |
| ⌘D | Show dashboard |

### Chat
| Shortcut | Action |
|----------|--------|
| ⌘Enter | Send message |
| ⌘↑ | Edit last message |
| ⌘L | Clear chat |
| ⌘K | Command palette |
| ⌘F | Search messages |

### Bot Management
| Shortcut | Action |
|----------|--------|
| ⌘R | Restart bot |
| ⌘, | Edit bot config |
| ⌘⌥R | Reconnect bot |
| ⌘⌥B | Show bot status |

### Cron & Automation
| Shortcut | Action |
|----------|--------|
| ⌘⇧J | Show cron jobs |
| ⌘⇧N | New cron job |
| ⌘⇧D | Cron job details |
| ⌘⇧X | Execute cron now |

### Reactions (in chat)
| Shortcut | Reaction |
|----------|----------|
| ⌘1 | 👍 Proceed |
| ⌘2 | ❓ Explain |
| ⌘3 | 👎 Revert |
| ⌘4 | 🔄 Retry |
| ⌘5 | ⏸️ Pause |
| ⌘6 | ▶️ Resume |

---

## 7. Command Palette (⌘K)

### Example Commands
```
Bot Management:
  - restart opta → Restart primary bot
  - config edit → Edit bot settings
  - status check → Show all bot statuses
  - reconnect → Force reconnection
  - health check → Detailed health metrics

Automation:
  - cron list → Show all jobs
  - cron add → Create new job
  - cron run → Execute job now
  - cron remove → Delete job

Messaging:
  - search → Search messages
  - export chat → Export current chat
  - pin message → Pin current message
  - clear history → Archive this chat

Session:
  - new session → Start isolated session
  - pin session → Save session state
  - list sessions → Show all sessions
  - export session → Save session snapshot

Settings:
  - preferences → Open settings
  - appearance → Theme options
  - notifications → Configure alerts
  - about → App info
```

### Implementation
- Fuzzy search: `CommandPalette.swift` with `MatchRanking` algorithm
- Keyboard navigation: arrow keys, enter to execute, Esc to close
- Recent commands stored in `CommandHistory` (last 20)
- Custom commands can be added via settings

---

## 8. Dashboard (Information-Dense)

### Layout
```
┌────────────────────────────────────────────┐
│  ALL BOTS  [Status Filter]  [Refresh]      │
├────────────────────────────────────────────┤
│  Bot 1         │  Bot 2         │  Bot 3   │
│  🟢 online     │  🟢 online     │  🔴 error│
│  Last: 2m ago  │  Last: 5m ago  │  Offline │
│  [Restart]     │  [Restart]     │[Reconnect]
│  [Config]      │  [Config]      │[Config]  │
├────────────────────────────────────────────┤
│  Bot 4         │  Bot 5         │  Bot 6   │
│  🟡 idle       │  🟢 online     │  🟢 online
│  ...           │  ...           │  ...     │
├────────────────────────────────────────────┤
│  UPCOMING CRON JOBS                        │
│  ⏰ 10:30 daily-report (in 2h 15m)        │
│  ⏰ 14:00 backup-check (in 6h 45m)        │
├────────────────────────────────────────────┤
│  SYSTEM STATUS                             │
│  Memory: 2.3 GB / 16 GB (14%)              │
│  Active Connections: 6/7                   │
│  Last iCloud Sync: 2m ago                  │
└────────────────────────────────────────────┘
```

### Features
- **Live status:** Refreshes every 5 seconds (via WebSocket events)
- **Quick actions:** Right-click context menu for bot
- **Search/filter:** Status, bot name, tags
- **Drag to reorder:** Pin favorite bots to top

---

## 9. Side Panels (Context + Thinking)

### Left Panel (Context)
```
Bot: Opta Max
Status: 🟢 Online (312ms latency)

Config:
  Model: gpt-4-turbo
  Temp: 0.7
  Skills: [6] file, code, web, shell, ...

Sessions:
  🔹 [active] main (pinned)
  ⚪ temporary-1 (isolated)
  ⚪ debugging (saved)
  
Recent Messages:
  2m ago: "Build started..."
  5m ago: "Task completed"

Cron Next Run:
  🔔 daily-sync in 1h
```

### Right Panel (Thinking Overlay)
```
🧠 THINKING [streaming]

Analyzing request...
- Parsing user intent (3%)
- Loading context (15%)
- Building plan (42%)
  - Step 1: Validate inputs
  - Step 2: Run analysis
  - Step 3: Format response
- Executing plan (85%)
- Formatting response (98%)
```

---

## 10. Multi-Window Behavior

### Window Types
1. **Main Dashboard** — Always open on app launch
2. **Chat Windows** — One per active bot conversation
3. **Settings Window** — Singleton (⌘,)
4. **Debug Window** — Toggle-able, shows WebSocket frames

### Coordination
- All windows share `OpenClawClient` (single WebSocket)
- Messages received → broadcast to all chat windows
- Reconnection → all windows update status
- Settings change → apply to all windows

### Focus & Navigation
- ⌘1-6: Jump to bot window (create if not open)
- ⌘~ : Cycle through open windows
- ⌘D: Bring dashboard to front
- ⌘W: Close current window (closes chat, not app)

---

## 11. Debugging Tools

### Debug Panel (⌘⌥D)
```
WEBSOCKET FRAMES (live)
┌─────────────────────────────────────────┐
│ [Filter: all] [Pause] [Export]          │
├─────────────────────────────────────────┤
│ 10:45:23 [REQ] chat.send (2.3ms)       │
│   → {"session": "abc123", "text": ...} │
│                                         │
│ 10:45:23 [RES] chat.send ok (1.2ms)   │
│   → {"id": "msg-456", "role": ...}    │
│                                         │
│ 10:45:24 [EVENT] chat.delta (0.1ms)   │
│   → {"content": "Processing..."}       │
│                                         │
│ [scroll to bottom: streaming]           │
└─────────────────────────────────────────┘

METRICS
├─ Request latency: 2.3ms (avg), 8.1ms (max)
├─ Message throughput: 45/min
├─ Memory: 312MB (chat buffers)
├─ Reconnections: 0
└─ Last error: none
```

---

## 12. Performance Targets

| Metric | Target |
|--------|--------|
| Command palette open | <100ms |
| Window creation | <500ms |
| Dashboard refresh | <200ms |
| Message send → echo | <1s |
| Scroll smoothness | 60fps (constant) |
| Memory per window | <150MB |
| App startup | <2s (with cached state) |
| Reconnect time | <3s (average) |

---

## 13. Accessibility

- **Keyboard navigation:** Full tab/arrow support in all views
- **VoiceOver:** Label all interactive elements
- **High contrast mode:** Support system setting
- **Dyslexia font:** Option for Dyslexie font override
- **Reduce motion:** Respect system setting, disable spring animations

---

## 14. Testing Checklist

- [ ] Multi-window: open 3+ windows, send messages, verify sync
- [ ] Command palette: test fuzzy search with 20+ commands
- [ ] Keyboard shortcuts: all 50+ shortcuts work correctly
- [ ] Panel toggle: left/right panels open/close smoothly
- [ ] Reconnection: force disconnect, verify auto-reconnect + status update
- [ ] iCloud sync: edit bot on Mac, verify appears on iPhone within 30s
- [ ] Dashboard: refresh with 7 bots, all status dots update
- [ ] Memory: leave app running 1 hour, verify <800MB total

---

## 15. Read Next

- **CLAUDE.md** — macOS-specific coding rules for Claude Code
- **SHARED.md** — Cross-platform data models and design tokens
- **APP.md** — Overall product vision and business model
- **docs/GUARDRAILS.md** — Safety and dependency rules

