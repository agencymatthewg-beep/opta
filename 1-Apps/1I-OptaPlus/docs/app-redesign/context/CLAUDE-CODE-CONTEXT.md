# Claude Code Context — OptaPlus iOS 5-Page Redesign

*Read this first. It tells you everything you need to know.*

---

## What You're Building

Redesigning the OptaPlus iOS app from 3 tabs (Dashboard, Chat, Settings) to 5 tabs with significantly enhanced functionality. Each page pulls real data from the OpenClaw Gateway via WebSocket Protocol v3.

## Project Location

```
~/Synced/Opta/1-Apps/1I-OptaPlus/
```

## Plans & Research (READ THESE)

| Priority | File | What It Contains |
|----------|------|-----------------|
| 🔴 1st | `docs/app-redesign/context/CLAUDE-CODE-CONTEXT.md` | THIS FILE |
| 🔴 2nd | `docs/app-redesign/plans/REDESIGN-PLAN.md` | Full 5-page spec with all details |
| 🟡 3rd | `docs/cloud-relay/research/OPTAPLUS-NETWORKING-CURRENT.md` | Networking layer analysis |

## The 5 Pages

### Page 1: Dashboard (Enhanced)
- **Current:** Bot health cards in a grid
- **Add:** Centered bot name + emoji in each card, visual activity indicators (thinking spinner, research pulse, coding brackets, planning dots), real-time state from `botState` on ChatViewModel
- **Bot states to visualize:** `.idle`, `.thinking`, `.typing`, `.streaming` — map to animations

### Page 2: Chat History (NEW)
- **Purpose:** Chronological list of ALL conversations across all bots
- **Data source:** Gateway method `sessions.list` → returns all sessions with metadata
- **Each row:** Bot emoji + name, 3-5 word summary (from last message), timestamp, session key
- **Features:** Search bar (filter by bot name, content), tap to open chat, grouped by date
- **Gateway API:**
  ```json
  // Request
  {"type":"req","id":2,"method":"sessions.list","params":{}}
  
  // For previews/summaries
  {"type":"req","id":3,"method":"sessions.preview","params":{"keys":["key1","key2"],"limit":1,"maxChars":100}}
  ```

### Page 3: Automations (NEW)
- **Purpose:** View/manage OpenClaw cron jobs
- **Data source:** Gateway method `cron.list` → returns all jobs with schedules
- **Each row:** Job name, schedule (human-readable), last run time, status (enabled/disabled), model used
- **Features:** Toggle enabled/disabled, tap for details, edit schedule/model, run now button
- **Gateway API:**
  ```json
  // List all jobs
  {"type":"req","id":4,"method":"cron.list","params":{"includeDisabled":true}}
  
  // Toggle job
  {"type":"req","id":5,"method":"cron.update","params":{"jobId":"xxx","patch":{"enabled":false}}}
  
  // Run immediately
  {"type":"req","id":6,"method":"cron.run","params":{"jobId":"xxx"}}
  
  // Get run history
  {"type":"req","id":7,"method":"cron.runs","params":{"jobId":"xxx"}}
  
  // Get scheduler status
  {"type":"req","id":8,"method":"cron.status","params":{}}
  ```
- **Cron job fields:** `name`, `schedule` (kind: at/every/cron), `payload` (kind: systemEvent/agentTurn), `sessionTarget` (main/isolated), `enabled`, `delivery`

### Page 4: Debug (NEW — inspired by OpenClaw.app)
- **Purpose:** Gateway diagnostics, connectivity, session inspector
- **Data sources:** `health` (probe:true), `status`, `sessions.list`, `sessions.usage`
- **Sections:**
  1. **Gateway Health** — green/red dot, auth age, PID, port, uptime
  2. **Connectivity Tests** — ping gateway, check WebSocket, measure latency
  3. **Active Sessions** — list all sessions with size (Xk/200k), age, device/channel
  4. **Node Status** — connected nodes (Mono512, Opta48) with OS, version
  5. **Logs** — recent gateway log lines (scrollable, monospaced)
- **Gateway API:**
  ```json
  {"type":"req","id":9,"method":"health","params":{"probe":true}}
  {"type":"req","id":10,"method":"status","params":{}}
  {"type":"req","id":11,"method":"sessions.list","params":{}}
  {"type":"req","id":12,"method":"sessions.usage","params":{"key":"..."}}
  {"type":"req","id":13,"method":"node.list","params":{}}
  ```
- **Visual reference:** See OpenClaw.app debug page screenshots in `~/.openclaw/media/inbound/file_190*.jpg`

### Page 5: Settings (Refined)
- **Current:** Bot config editing with text fields
- **Change:** Move debug-like items to Debug page. Focus on:
  1. **Bot Management** — add/edit/remove bots with pickers (not text fields where possible)
  2. **Appearance** — theme picker (visual swatches), font scale slider, chat density segmented control
  3. **Connection** — connection mode picker (Auto/LAN/Remote), remote URL field
  4. **Notifications** — toggle per bot
  5. **Security** — biometric lock toggle, privacy mode toggle
  6. **About** — version, links
- **Key principle:** Pickers, toggles, segmented controls, sliders > text fields. Minimize typing.

## Gateway Protocol v3 — How to Call Methods

The app already has `OpenClawClient.swift` with WebSocket connection. To call gateway methods:

```swift
// Send a request
let request: [String: Any] = [
    "type": "req",
    "id": nextRequestId(),
    "method": "cron.list",
    "params": ["includeDisabled": true]
]
// Send as JSON text frame via NWConnection

// Receive response
// {"type":"res","id":4,"result":{"jobs":[...]}}
```

**IMPORTANT:** The client currently only handles `chat.*` methods and lifecycle events. You need to add a generic method-calling mechanism to `OpenClawClient.swift`:

```swift
/// Call any gateway method and get the result
func call(method: String, params: [String: Any] = [:]) async throws -> [String: Any]
```

This is the foundation for Pages 2-4. Build it first, then the pages use it.

## Available Gateway Methods (Full List)

| Method | Params | Returns | Use For |
|--------|--------|---------|---------|
| `health` | `{probe: true}` | Gateway health snapshot | Debug page health |
| `status` | `{}` | System status summary | Debug page status |
| `sessions.list` | `{}` | All sessions with metadata | History + Debug |
| `sessions.preview` | `{keys:[], limit, maxChars}` | Message previews | History summaries |
| `sessions.usage` | `{key}` | Token usage for session | Debug details |
| `cron.list` | `{includeDisabled: true}` | All cron jobs | Automations page |
| `cron.status` | `{}` | Scheduler status | Automations header |
| `cron.update` | `{jobId, patch}` | Updated job | Toggle/edit automation |
| `cron.run` | `{jobId}` | Run result | "Run Now" button |
| `cron.runs` | `{jobId}` | Run history | Automation detail view |
| `node.list` | `{}` | Connected nodes | Debug page nodes |
| `node.describe` | `{node}` | Node details | Debug node info |

## Current File Map

| File | Purpose | Change |
|------|---------|--------|
| `iOS/OptaPlusIOS/ContentView.swift` | Tab structure | Add 2 new tabs (5 total) |
| `iOS/OptaPlusIOS/Views/DashboardView.swift` | Bot grid | Enhance with activity states |
| `iOS/OptaPlusIOS/Views/SettingsView.swift` | Settings | Refactor, remove debug items |
| `iOS/OptaPlusIOS/Views/ChatView.swift` | Chat screen | No major changes |
| `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift` | WS client | Add generic `call()` method |
| **NEW** `iOS/OptaPlusIOS/Views/ChatHistoryView.swift` | History page | Sessions list + search |
| **NEW** `iOS/OptaPlusIOS/Views/AutomationsView.swift` | Cron page | Job list + toggles |
| **NEW** `iOS/OptaPlusIOS/Views/DebugView.swift` | Debug page | Health + sessions + nodes |

## Design System (Cinematic Void)

- Background: `#050505` (OLED black)
- Primary accent: `#8B5CF6` (Electric Violet) — `Color.optaPrimary`
- Glass surfaces: `.ultraThinMaterial` with opacity
- Typography: System font (Sora not available on iOS)
- Animations: Spring physics (`.spring(response:0.4, dampingFraction:0.8)`)
- Status colors: Green=healthy, Amber=warning, Red=error, Violet=active

## Build Commands

```bash
# iOS (Simulator)
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build

# iOS (Device — Matthew's iPhone 16 Pro Max)
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -configuration Debug -destination 'id=FF8A0B5A-5124-55AA-928E-B6D8C96DA329' build
```

## Constraints

1. **Pure SwiftUI** — no external dependencies
2. **iOS 17+** — use latest APIs (Observable, etc.)
3. **Shared package (OptaMolt)** — networking changes go in shared package
4. **Cinematic Void design** — dark, glass, violet accents, spring animations
5. **Gateway methods need operator scope** — the client already connects with `scopes: ["operator", "operator.admin"]`
6. **Settings = minimal typing** — pickers, toggles, segmented controls, sliders preferred over text fields
7. **All new files must be added to pbxproj** — Xcode project file

## What "Done" Looks Like

1. ✅ 5-tab layout: Dashboard, History, Chat, Automations, Debug (+ Settings accessible from nav/profile)
2. ✅ Dashboard: centered bot names/emojis, visual activity states
3. ✅ History: chronological session list with search, bot labels, timestamps
4. ✅ Automations: cron job list with toggles, run buttons, schedule display
5. ✅ Debug: gateway health, connectivity test, sessions list, node status
6. ✅ Settings: refactored with pickers/toggles, no overlap with Debug
7. ✅ Generic `call()` method on OpenClawClient for arbitrary gateway methods
8. ✅ Both iOS and macOS build clean
9. ✅ Git committed
