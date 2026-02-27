# Task: Protocol Expansion + Bot Management + Smart Reactions

**Date:** 2026-02-15
**Estimated effort:** ~18 hours
**Impact:** Unlocks bot config editing, gateway management, and reaction-based commands on both platforms

---

## Objective

Expand OptaPlus from a chat-only client into a full bot management tool by:
1. Adding missing gateway RPC methods to `OpenClawClient`
2. Wiring bot config viewing + editing UI
3. Making reactions dispatch bot commands via `chat.send`
4. Adding `cron.add` to complete the automation CRUD

---

## Phase 1: Protocol Layer Expansion (Shared/OptaMolt)

### 1A. New methods on `OpenClawClient` (OpenClawClient.swift)

Add convenience methods matching the existing pattern (e.g. `chatHistory`, `chatSend`):

```swift
// Config
func configGet() async throws -> GatewayConfig
func configPatch(raw: String, baseHash: String, note: String?) async throws
func configApply(raw: String, baseHash: String?, note: String?) async throws

// Gateway
func gatewayRestart(note: String?) async throws
func gatewayHealth() async throws -> GatewayHealth
func gatewayStatus() async throws -> GatewayStatus

// Models
func modelsList() async throws -> [GatewayModel]

// Cron (add is missing — list/update/run/delete already work via vm.call)
func cronAdd(job: CronJobCreate) async throws -> String  // returns jobId
func cronRuns(jobId: String) async throws -> [CronRun]

// Sessions
func sessionsPatch(sessionKey: String, patch: [String: Any]) async throws
```

### 1B. New protocol types (OpenClawProtocol.swift)

```swift
// Gateway config response
struct GatewayConfig {
    let raw: String        // JSON5 string
    let hash: String       // For baseHash on updates
    let parsed: [String: Any]  // Decoded config
}

// Gateway health
struct GatewayHealth {
    let status: String     // "ok" | "degraded" | "error"
    let uptime: Double     // seconds
    let version: String
    let model: String?
    let sessions: Int
    let cronJobs: Int
}

// Gateway status (from "status" method)
struct GatewayStatus {
    let version: String
    let model: String?
    let channels: [String: ChannelStatus]
}

struct ChannelStatus {
    let connected: Bool
    let type: String
}

// Model info
struct GatewayModel {
    let id: String
    let name: String?
    let provider: String?
}

// Cron job creation
struct CronJobCreate: Codable {
    let name: String?
    let schedule: CronScheduleCreate
    let sessionTarget: String  // "main" | "isolated"
    let payload: CronPayloadCreate
    let delivery: CronDeliveryCreate?
    let enabled: Bool
    let wakeMode: String?  // "now" | "next-heartbeat"
}

struct CronScheduleCreate: Codable {
    let kind: String  // "at" | "every" | "cron"
    let at: String?
    let everyMs: Int?
    let expr: String?
    let tz: String?
}

struct CronPayloadCreate: Codable {
    let kind: String  // "systemEvent" | "agentTurn"
    let text: String?
    let message: String?
}

struct CronDeliveryCreate: Codable {
    let mode: String  // "none" | "announce"
    let channel: String?
    let to: String?
}

// Cron run history entry
struct CronRun {
    let runId: String
    let startedAt: Date?
    let finishedAt: Date?
    let status: String  // "ok" | "error"
    let error: String?
}
```

### 1C. Gateway RPC method names (reference)

| Swift method | Gateway RPC | Params |
|-------------|-------------|--------|
| `configGet()` | `config.get` | `{}` |
| `configPatch(raw:baseHash:note:)` | `config.patch` | `{raw, baseHash, note?}` |
| `configApply(raw:baseHash:note:)` | `config.apply` | `{raw, baseHash?, note?}` |
| `gatewayRestart(note:)` | `gateway.restart` | `{note?}` — use config.apply/patch instead (they restart) |
| `gatewayHealth()` | `health` | `{}` |
| `gatewayStatus()` | `status` | `{}` |
| `modelsList()` | `models.list` | `{}` |
| `cronAdd(job:)` | `cron.add` | Full job object (see cron docs) |
| `cronRuns(jobId:)` | `cron.runs` | `{jobId}` |
| `sessionsPatch(...)` | `sessions.patch` | `{sessionKey, patch}` |

---

## Phase 2: Bot Management UI

### 2A. BotProfileSheet.swift (macOS) — Currently read-only, needs editing

Add to the existing BotProfileSheet (293 lines):

**Config section:**
- "Model" dropdown (populated from `models.list` response)
- "Thinking" picker (off / low / high / stream)
- Current model display with live status

**Actions section:**
- "Restart Gateway" button → `config.apply` or dedicated restart
- "Compact Context" button → `sessions.patch` to clear
- "Check Health" button → `health` RPC, show result inline

**Implementation pattern:**
```swift
// Load config on appear
.task {
    let health = try? await vm.call("health")
    let config = try? await vm.call("config.get")
    let models = try? await vm.call("models.list")
    // Parse and populate @State vars
}

// Model switch
Button("Apply") {
    let hash = currentConfigHash
    try await vm.call("config.patch", params: [
        "raw": "{ agents: { defaults: { model: \"\(selectedModel)\" } } }",
        "baseHash": hash,
        "note": "Model changed from OptaPlus"
    ])
}
```

### 2B. iOS equivalent — SettingsView.swift or new BotManagementView.swift

Same features, adapted for iOS navigation (sheets, picker wheels, swipe actions).

---

## Phase 3: Smart Reaction Dispatch

### 3A. Update ReactionBar.swift + ReactionStore

Currently reactions are LOCAL-ONLY (stored in memory, never sent to bot). Change:

1. Add a `ReactionAction` enum:
```swift
enum ReactionAction: String, CaseIterable {
    case proceed = "👍"
    case explain = "❓" 
    case revert = "👎"
    case retry = "🔄"
    case pause = "⏸️"
    case resume = "▶️"
    case summarize = "📋"
    case detail = "🔍"
    
    var commandText: String {
        switch self {
        case .proceed:   return "[USER_REACTION: proceed] Continue with the next steps."
        case .explain:   return "[USER_REACTION: explain] Explain your last message in simpler terms."
        case .revert:    return "[USER_REACTION: revert] Undo or revert your last action."
        case .retry:     return "[USER_REACTION: retry] Regenerate your last response."
        case .pause:     return "[USER_REACTION: pause] Pause current work and save state."
        case .resume:    return "[USER_REACTION: resume] Resume paused work."
        case .summarize: return "[USER_REACTION: summarize] Summarize this conversation."
        case .detail:    return "[USER_REACTION: detail] Give me more detail on this."
        }
    }
}
```

2. On reaction tap → call `ChatViewModel.sendMessage()` with the reaction's `commandText`
3. Keep the visual reaction on the message bubble (show which reaction was used)
4. Optionally: reacting again removes it (toggle behavior for visual, but command already sent)

### 3B. Wire into ChatViewModel

```swift
func sendReaction(_ reaction: ReactionAction, for message: ChatMessage) async {
    // Show reaction visually
    ReactionStore.shared.toggleReaction(reaction.rawValue, for: message.id)
    // Send command to bot
    await sendMessage(reaction.commandText)
}
```

### 3C. Update ReactionBar UI

Change the emoji picker to show ONLY the 8 bot-action emojis (not a full emoji keyboard). Each emoji shows a tooltip/label of what it does:
- 👍 Proceed
- ❓ Explain
- 👎 Revert
- 🔄 Retry
- ⏸️ Pause
- ▶️ Resume
- 📋 Summarize
- 🔍 Detail

---

## Phase 4: Cron Job Creation (iOS)

### 4A. Fix CreateJobSheet.swift

The iOS `CreateJobSheet` already exists but needs to wire `cron.add` correctly.

Required params (from OpenClaw docs):
```json
{
    "name": "...",
    "schedule": { "kind": "cron", "expr": "0 9 * * *", "tz": "Australia/Melbourne" },
    "sessionTarget": "isolated",
    "payload": { "kind": "agentTurn", "message": "..." },
    "enabled": true
}
```

Verify the sheet sends params matching this schema exactly.

### 4B. macOS AutomationsView already has create — verify it works

Check the macOS `AutomationsView.swift` create flow sends correct `cron.add` params.

---

## Files to Modify

| File | Changes |
|------|---------|
| `Shared/.../OpenClawClient.swift` | Add 10 new convenience methods |
| `Shared/.../OpenClawProtocol.swift` | Add ~100 lines of new types |
| `Shared/.../Chat/ReactionBar.swift` | Add ReactionAction enum, wire dispatch |
| `Shared/.../Networking/ChatViewModel.swift` | Add `sendReaction()` method |
| `macOS/BotProfileSheet.swift` | Add config editing, health check, restart |
| `iOS/Views/SettingsView.swift` OR new `BotManagementView.swift` | iOS config editing |
| `iOS/Views/CreateJobSheet.swift` | Verify cron.add params match schema |
| `macOS/AutomationsView.swift` | Verify cron.add params match schema |

## Files to Read (Context)

| File | Why |
|------|-----|
| `APP.md` | Product vision, feature model |
| `SHARED.md` | Smart Reaction Protocol spec (Section 7), data models |
| `CLAUDE.md` | Existing coding rules |
| `docs/GUARDRAILS.md` | Constraints (zero deps, spring physics, no AppKit) |
| `docs/ARCHITECTURE.md` | Data flow diagram |
| `DESIGN-BRIEF.md` | Color tokens, glass effects for new UI |

---

## Testing Checklist

- [ ] `config.get` returns valid config with hash
- [ ] `config.patch` updates model and gateway restarts
- [ ] `health` returns status/uptime/version
- [ ] `models.list` returns available models
- [ ] Reaction tap on message sends command text via chat.send
- [ ] Reaction emoji appears visually on the message bubble
- [ ] All 8 reaction types send correct command text
- [ ] BotProfileSheet shows current model and health status
- [ ] Model switch via BotProfileSheet works end-to-end
- [ ] `cron.add` creates a new job successfully
- [ ] Both platforms build with 0 errors, 0 warnings
