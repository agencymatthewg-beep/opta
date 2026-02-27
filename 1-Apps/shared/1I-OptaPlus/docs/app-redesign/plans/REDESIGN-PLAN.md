# OptaPlus iOS 5-Page Redesign — Implementation Plan

*Created: 2026-02-14*

---

## Tab Bar Layout (5 tabs)

```
[ 📊 Dashboard ]  [ 💬 History ]  [ 🗨️ Chat ]  [ ⚡ Automations ]  [ 🔧 Debug ]
```

Settings is accessible via a gear icon in the nav bar (top-right) on any page, or as a NavigationLink from Debug/Dashboard. This keeps the tab bar to 5 essential pages.

---

## Step 0: Generic Gateway Method Calling (FOUNDATION)

**File:** `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift`

Add a generic method-calling mechanism. Currently the client only handles `connect`, `chat.send`, `chat.history`, `chat.abort`. We need arbitrary method calls for sessions, cron, health, etc.

```swift
/// Pending request callbacks
private var pendingRequests: [Int: (Result<[String: Any], Error>) -> Void] = [:]
private var nextId: Int = 100

/// Call any gateway method
public func call(method: String, params: [String: Any] = [:]) async throws -> [String: Any] {
    return try await withCheckedThrowingContinuation { continuation in
        let id = nextId
        nextId += 1
        pendingRequests[id] = { result in
            continuation.resume(with: result)
        }
        let request: [String: Any] = [
            "type": "req",
            "id": id,
            "method": method,
            "params": params
        ]
        sendJSON(request)
    }
}
```

Update `handleMessage()` to route `"res"` frames to pending callbacks:
```swift
case "res":
    if let id = json["id"] as? Int, let callback = pendingRequests.removeValue(forKey: id) {
        if let result = json["result"] as? [String: Any] {
            callback(.success(result))
        } else if let error = json["error"] as? [String: Any] {
            callback(.failure(GatewayError.methodError(error["message"] as? String ?? "Unknown error")))
        }
    }
```

---

## Step 1: Dashboard Enhancement

**File:** `iOS/OptaPlusIOS/Views/DashboardView.swift`

### Current State
- Grid of bot health cards with scores

### Changes
1. **Center bot emoji + name** in each card (larger emoji, name below)
2. **Activity state indicator** — visual representation of what bot is doing:
   - **Idle:** Subtle breathing glow on emoji
   - **Thinking:** Rotating violet ring around emoji + "Thinking..." label
   - **Streaming/Typing:** Animated dots + "Responding..." label  
   - **Research/Planning/Coding:** Could detect from streaming content keywords, but for v1 just use thinking/streaming states
3. **Connection status** — small dot (green=connected, gray=disconnected) + LAN/Remote badge
4. **Last message preview** — 1-line truncated last message under bot name
5. **Tap action** — navigate to chat with that bot

### Layout
```
┌──────────────────────────┐
│     🥷🏿                    │
│   Opta Max               │
│  ● Connected (LAN)       │
│  "Yes — Claude Code ma..." │
│  ◐ Thinking...           │
└──────────────────────────┘
```

---

## Step 2: Chat History Page (NEW)

**File:** `iOS/OptaPlusIOS/Views/ChatHistoryView.swift` (NEW)

### Data Flow
1. On appear: call `sessions.list` via each connected bot's client
2. Merge all sessions, sort by `lastActivity` descending
3. For sessions with no preview: call `sessions.preview` to get last message snippet

### UI Layout
```
┌─ Search bar ──────────────────────┐

  Today
  ┌──────────────────────────────┐
  │ 🥷🏿 Opta Max                  │
  │ Cloud relay setup + testing   │
  │ 2 min ago              →     │
  └──────────────────────────────┘
  ┌──────────────────────────────┐
  │ 🟢 Mono                      │
  │ Deep issues identified        │
  │ 15 min ago              →    │
  └──────────────────────────────┘

  Yesterday
  ┌──────────────────────────────┐
  │ 🥷🏿 Opta Max                  │
  │ OptaPlus design brief         │
  │ 11:30 PM               →    │
  └──────────────────────────────┘
```

### Features
- **Search:** Filter by bot name or content keyword
- **Group by date:** Today, Yesterday, This Week, Older
- **Tap:** Navigate to chat view with that session loaded
- **Swipe actions:** Delete session, mark as read
- **Pull to refresh**

### Model
```swift
struct ChatHistoryItem: Identifiable {
    let id: String           // session key
    let botName: String
    let botEmoji: String
    let summary: String      // from sessions.preview
    let lastActivity: Date
    let messageCount: Int?
    let channel: String?     // telegram, direct, etc.
    let sessionKey: String
}
```

---

## Step 3: Automations Page (NEW)

**File:** `iOS/OptaPlusIOS/Views/AutomationsView.swift` (NEW)

### Data Flow
1. On appear: call `cron.list` with `includeDisabled: true`
2. Also call `cron.status` for scheduler overview
3. Display jobs grouped by status (active/disabled)

### UI Layout
```
┌─ Automations ─────────── ⊕ ──┐
│                                │
│  Scheduler: Running (12 jobs)  │
│                                │
│  Active                        │
│  ┌────────────────────────────┐│
│  │ Morning X News Scan    🟢 ││
│  │ ⏰ 08:00 daily  · haiku   ││
│  │ Last: 4h ago   39k/200k   ││
│  │ [Run Now]              ▶  ││
│  └────────────────────────────┘│
│  ┌────────────────────────────┐│
│  │ Daily Research Digest  🟢 ││
│  │ ⏰ 09:00 daily  · haiku   ││
│  │ Last: 3h ago   38k/200k   ││
│  └────────────────────────────┘│
│                                │
│  Disabled                      │
│  ┌────────────────────────────┐│
│  │ DR Gemini Factory     🔴  ││
│  │ ⏰ Every 10m  · opus      ││
│  │ Disabled since Feb 3       ││
│  └────────────────────────────┘│
└────────────────────────────────┘
```

### Features
- **Toggle switch** per job (enabled/disabled) → calls `cron.update`
- **"Run Now" button** → calls `cron.run`
- **Tap for detail sheet:**
  - Job name, description
  - Schedule type (at/every/cron) with human-readable display
  - Session target (main/isolated)
  - Payload type (systemEvent/agentTurn)
  - Model used (from payload.model)
  - Last 5 runs (from `cron.runs`)
  - Edit schedule: Picker for frequency, date/time picker for exact times
  - Edit model: Picker with available models
- **Schedule display helpers:**
  - `cron` → parse expression to human readable ("Every day at 08:00")
  - `every` → "Every 10 minutes", "Every 1 hour"
  - `at` → "Feb 14, 2026 at 3:00 PM"

### Model
```swift
struct CronJob: Identifiable, Codable {
    let id: String           // jobId
    let name: String?
    let schedule: CronSchedule
    let payload: CronPayload
    let sessionTarget: String // "main" or "isolated"
    let enabled: Bool
    let lastRunAt: Date?
    let nextRunAt: Date?
}

enum CronSchedule: Codable {
    case at(Date)
    case every(intervalMs: Int)
    case cron(expr: String, tz: String?)
}

struct CronPayload: Codable {
    let kind: String         // "systemEvent" or "agentTurn"
    let text: String?        // for systemEvent
    let message: String?     // for agentTurn
    let model: String?
}
```

---

## Step 4: Debug Page (NEW)

**File:** `iOS/OptaPlusIOS/Views/DebugView.swift` (NEW)

### Inspired by OpenClaw.app Debug Page

### Sections

#### 4a: Gateway Health
```
┌─ Gateway ─────────────────────┐
│ ● Healthy    auth 20h         │
│ Port: 18793  PID: 71919       │
│ Uptime: 3d 14h                │
│ Protocol: v3                  │
│                               │
│ [🔄 Refresh]  [🔁 Restart]   │
└───────────────────────────────┘
```

#### 4b: Connectivity Tests
```
┌─ Connectivity ────────────────┐
│ WebSocket:    ✅ Connected     │
│ Route:        🌐 Remote       │
│ Latency:      12ms            │
│ Tunnel:       ✅ Cloudflare   │
│                               │
│ [Run Tests]                   │
└───────────────────────────────┘
```

#### 4c: Active Sessions
```
┌─ Sessions (11) ───────────────┐
│ agent:main:main          61k  │
│ ████████░░░░░░░░    2m ago   │
│                               │
│ telegram:direct:779..   137k  │
│ █████████████░░░    2m ago   │
│                               │
│ cron:update-check       33k  │
│ ███░░░░░░░░░░░░░    3m ago   │
└───────────────────────────────┘
```
Progress bars showing context usage (Xk/200k), colored green→amber→red.

#### 4d: Connected Nodes
```
┌─ Nodes ───────────────────────┐
│ 🖥 Gateway    Local          │
│   127.0.0.1:18793 · connected│
│                               │
│ 🖥 Mono512    Darwin         │
│   192.168.188.11 · connected │
│   core v2026.2.9              │
│                               │
│ 💻 Opta48     macOS 26.1     │
│   connected · ui v2026.2.2   │
└───────────────────────────────┘
```

#### 4e: Quick Actions
```
[Restart Gateway]  [Clear Logs]  [Run Doctor]
```

---

## Step 5: Settings Refactor

**File:** `iOS/OptaPlusIOS/Views/SettingsView.swift`

### Remove from Settings (moved to Debug)
- Gateway status/health info
- Session details
- Connection diagnostics
- Log viewing

### Keep/Enhance in Settings
1. **Bot Management**
   - List of bots with edit/delete swipe
   - Add bot button
   - Each bot: name (text), emoji (picker grid), host (text), port (stepper), token (secure field), remote URL (text), connection mode (segmented: Auto/LAN/Remote)

2. **Appearance** (all pickers/toggles, NO text fields)
   - Theme: Visual swatch picker (Cinematic Void / Midnight Blue / Carbon)
   - Font Scale: Slider (Small ← → XL)
   - Chat Density: Segmented (Compact / Comfortable / Spacious)
   - Background Animation: Toggle
   - Sounds: Toggle

3. **Notifications**
   - Master toggle
   - Per-bot toggles (inline, no navigation)
   - Sound picker (system sounds list)

4. **Privacy & Security**
   - Biometric Lock: Toggle
   - Lock Timeout: Picker (Immediately / 1m / 5m / 15m / 1h)
   - Privacy Mode: Toggle (blur previews)
   - Data Wipe: Button (destructive, double confirm)

5. **About**
   - App version
   - Build number
   - OpenClaw version (from gateway health)
   - Links: GitHub, Discord, docs

### Picker-First Philosophy
```swift
// ❌ Old: Text field for port
TextField("Port", text: $portString)

// ✅ New: Stepper for port
Stepper("Port: \(bot.port)", value: $bot.port, in: 1024...65535)

// ❌ Old: Text field for emoji
TextField("Emoji", text: $bot.emoji)

// ✅ New: Emoji grid picker
LazyVGrid(columns: [GridItem(.adaptive(minimum: 44))]) {
    ForEach(["🥷🏿","🟢","🟣","🧪","🔵","⚡","🤖","🦊"], id: \.self) { emoji in
        Button(emoji) { bot.emoji = emoji }
    }
}

// ❌ Old: Text field for connection mode
// ✅ New: Segmented picker
Picker("Connection", selection: $bot.connectionMode) {
    Text("Auto").tag(ConnectionMode.auto)
    Text("LAN").tag(ConnectionMode.lan)
    Text("Remote").tag(ConnectionMode.remote)
}.pickerStyle(.segmented)
```

---

## Step 6: Update Tab Bar & Navigation

**File:** `iOS/OptaPlusIOS/ContentView.swift`

```swift
enum Tab: String {
    case dashboard, history, chat, automations, debug
}

TabView(selection: $selectedTab) {
    DashboardView()
        .tabItem { Label("Dashboard", systemImage: "square.grid.2x2") }
        .tag(Tab.dashboard)
    
    ChatHistoryView()
        .tabItem { Label("History", systemImage: "clock.arrow.circlepath") }
        .tag(Tab.history)
    
    ChatTab()
        .tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right") }
        .tag(Tab.chat)
    
    AutomationsView()
        .tabItem { Label("Automations", systemImage: "bolt.circle") }
        .tag(Tab.automations)
    
    DebugView()
        .tabItem { Label("Debug", systemImage: "ant") }
        .tag(Tab.debug)
}
```

Settings accessible via gear icon in navigation bar (shown on Dashboard and Debug pages).

---

## Step 7: Build & Verify

```bash
# iOS build
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS \
  -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build

# macOS build (verify no breakage)
xcodebuild -project macOS/OptaPlusMacOS.xcodeproj -scheme OptaPlusMacOS \
  -configuration Debug build
```

---

## New Files

1. `iOS/OptaPlusIOS/Views/ChatHistoryView.swift`
2. `iOS/OptaPlusIOS/Views/AutomationsView.swift`
3. `iOS/OptaPlusIOS/Views/DebugView.swift`

All must be added to `iOS/OptaPlusIOS.xcodeproj` (pbxproj).

---

## Implementation Order

1. **Step 0** — Generic `call()` method on OpenClawClient (blocks everything)
2. **Step 6** — Tab bar structure (5 tabs, settings in nav)
3. **Step 1** — Dashboard enhancement (uses existing data, quickest win)
4. **Step 2** — Chat History (needs `call()` for `sessions.list`)
5. **Step 3** — Automations (needs `call()` for `cron.*`)
6. **Step 4** — Debug page (needs `call()` for `health`, `status`, etc.)
7. **Step 5** — Settings refactor (independent, can be last)
8. **Step 7** — Build verification
