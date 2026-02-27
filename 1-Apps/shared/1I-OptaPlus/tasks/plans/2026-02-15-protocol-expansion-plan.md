# Protocol Expansion — Implementation Plan

**Task:** `tasks/2026-02-15-protocol-expansion.md`
**Date:** 2026-02-15
**Author:** Claude Opus 4.6
**Status:** PLAN (schema verified via documentation, awaiting approval)

---

## Dependency Graph

```
Phase 1: Protocol Layer ──────────┬──► Phase 2: Bot Management UI
(OpenClawClient + Protocol types) │   (BotProfileSheet editing)
                                  │
Phase 3: Smart Reactions ─────────┘   Phase 4: Cron Job Fix
(ReactionBar + ChatViewModel)         (CreateJobSheet params)

Parallelizable:
  • Phase 1 + Phase 3 share no files (CAN run in parallel)
  • Phase 2 depends on Phase 1 (needs new client methods)
  • Phase 4 is independent (CAN run in parallel with anything)
```

### Execution Order

```
┌─────────────┐     ┌─────────────┐
│  Phase 1    │     │  Phase 3    │   ← Parallel batch 1
│  Protocol   │     │  Reactions  │
└──────┬──────┘     └─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  Phase 2    │     │  Phase 4    │   ← Parallel batch 2
│  Bot Mgmt   │     │  Cron Fix   │
└─────────────┘     └─────────────┘
```

---

## Sub-Agent Assignments

| Agent | Type | Phase | Files | Parallel Group |
|-------|------|-------|-------|----------------|
| **protocol-agent** | `general-purpose` | Phase 1 | `OpenClawClient.swift`, `OpenClawProtocol.swift` | Group A |
| **reactions-agent** | `general-purpose` | Phase 3 | `ReactionBar.swift`, `ChatViewModel.swift` | Group A |
| **bot-mgmt-agent** | `general-purpose` | Phase 2 | `BotProfileSheet.swift`, new iOS view | Group B (after Phase 1) |
| **cron-fix-agent** | `general-purpose` | Phase 4 | `CreateJobSheet.swift` (iOS), `AutomationsView.swift` (macOS) | Group B |

---

## Phase 1: Protocol Layer Expansion

**Files:** `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift`, `Shared/Sources/OptaMolt/Networking/OpenClawProtocol.swift`
**Estimated time:** 45 min
**Risk:** LOW — additive only, no existing code modified

### 1A. New Types in `OpenClawProtocol.swift` (append after line 403)

Add ~100 lines of new Codable/Sendable types after the existing `encodeParams` function:

```swift
// MARK: - Gateway Config

/// Response from `config.get` — raw config text + hash for optimistic concurrency.
public struct GatewayConfig: Sendable {
    public let raw: String
    public let hash: String
    public let parsed: [String: Any]

    public init(raw: String, hash: String, parsed: [String: Any]) {
        self.raw = raw
        self.hash = hash
        self.parsed = parsed
    }
}

/// Parameters for `config.patch` — partial config update.
public struct ConfigPatchParams: Codable, Sendable {
    public let raw: String
    public let baseHash: String
    public let note: String?

    public init(raw: String, baseHash: String, note: String? = nil) {
        self.raw = raw
        self.baseHash = baseHash
        self.note = note
    }
}

/// Parameters for `gateway.restart` — full config replacement + restart.
/// NOTE: Task spec called this `config.apply` but docs confirm `gateway.restart`.
public struct GatewayRestartParams: Codable, Sendable {
    public let raw: String
    public let baseHash: String?
    public let note: String?

    public init(raw: String, baseHash: String? = nil, note: String? = nil) {
        self.raw = raw
        self.baseHash = baseHash
        self.note = note
    }
}

// MARK: - Gateway Health & Status

/// Response from `health` RPC.
public struct GatewayHealth: Sendable {
    public let status: String       // "ok" | "degraded" | "error"
    public let uptime: Double       // seconds
    public let version: String
    public let model: String?
    public let sessions: Int
    public let cronJobs: Int

    public init(status: String, uptime: Double, version: String,
                model: String? = nil, sessions: Int = 0, cronJobs: Int = 0) {
        self.status = status
        self.uptime = uptime
        self.version = version
        self.model = model
        self.sessions = sessions
        self.cronJobs = cronJobs
    }
}

/// Response from `status` RPC.
public struct GatewayStatus: Sendable {
    public let version: String
    public let model: String?
    public let channels: [String: ChannelStatus]

    public init(version: String, model: String? = nil, channels: [String: ChannelStatus] = [:]) {
        self.version = version
        self.model = model
        self.channels = channels
    }
}

public struct ChannelStatus: Sendable {
    public let connected: Bool
    public let type: String

    public init(connected: Bool, type: String) {
        self.connected = connected
        self.type = type
    }
}

// MARK: - Models

/// A model available on the gateway.
public struct GatewayModel: Identifiable, Sendable {
    public let id: String
    public let name: String?
    public let provider: String?

    public init(id: String, name: String? = nil, provider: String? = nil) {
        self.id = id
        self.name = name
        self.provider = provider
    }
}

// MARK: - Cron Job Creation

/// Parameters for `cron.add` (or `cron.create`) — new job.
public struct CronJobCreate: Codable, Sendable {
    public let name: String?
    public let schedule: CronScheduleCreate
    public let sessionTarget: String
    public let payload: CronPayloadCreate
    public let delivery: CronDeliveryCreate?
    public let enabled: Bool

    public init(name: String?, schedule: CronScheduleCreate,
                sessionTarget: String = "main", payload: CronPayloadCreate,
                delivery: CronDeliveryCreate? = nil, enabled: Bool = true) {
        self.name = name
        self.schedule = schedule
        self.sessionTarget = sessionTarget
        self.payload = payload
        self.delivery = delivery
        self.enabled = enabled
    }
}

public struct CronScheduleCreate: Codable, Sendable {
    public let kind: String       // "at" | "every" | "cron"
    public let at: String?        // ISO 8601 for "at"
    public let everyMs: Int?      // milliseconds for "every"
    public let expr: String?      // cron expression for "cron"
    public let tz: String?        // timezone

    public init(kind: String, at: String? = nil, everyMs: Int? = nil,
                expr: String? = nil, tz: String? = nil) {
        self.kind = kind
        self.at = at
        self.everyMs = everyMs
        self.expr = expr
        self.tz = tz
    }
}

public struct CronPayloadCreate: Codable, Sendable {
    public let kind: String       // "systemEvent" | "agentTurn"
    public let text: String?      // for systemEvent
    public let message: String?   // for agentTurn

    public init(kind: String, text: String? = nil, message: String? = nil) {
        self.kind = kind
        self.text = text
        self.message = message
    }
}

public struct CronDeliveryCreate: Codable, Sendable {
    public let mode: String       // "none" | "announce"
    public let channel: String?
    public let to: String?

    public init(mode: String = "none", channel: String? = nil, to: String? = nil) {
        self.mode = mode
        self.channel = channel
        self.to = to
    }
}

// MARK: - Cron Run History

/// A single execution record from `cron.runs`.
public struct CronRun: Identifiable, Sendable {
    public let id: String
    public let startedAt: Date?
    public let finishedAt: Date?
    public let status: String     // "ok" | "error"
    public let error: String?

    public init(id: String, startedAt: Date? = nil, finishedAt: Date? = nil,
                status: String = "ok", error: String? = nil) {
        self.id = id
        self.startedAt = startedAt
        self.finishedAt = finishedAt
        self.status = status
        self.error = error
    }
}

// MARK: - Sessions Patch

/// Parameters for `sessions.patch`.
public struct SessionsPatchParams: Codable, Sendable {
    public let sessionKey: String
    public let patch: AnyCodable

    public init(sessionKey: String, patch: [String: Any]) {
        self.sessionKey = sessionKey
        self.patch = AnyCodable(patch)
    }
}
```

### 1B. New Convenience Methods in `OpenClawClient.swift` (append after line 143, before `// MARK: - NWConnection Lifecycle`)

Add 10 new methods following the exact pattern of `chatHistory`/`chatSend`:

```swift
// MARK: - Config Convenience

/// Fetch the gateway configuration (raw text + hash).
public func configGet() async throws -> GatewayConfig {
    let response = try await request("config.get")
    return parseConfigGet(response)
}

/// Patch (partial update) the gateway configuration.
public func configPatch(raw: String, baseHash: String, note: String? = nil) async throws {
    let params = ConfigPatchParams(raw: raw, baseHash: baseHash, note: note)
    _ = try await request("config.patch", params: params)
}

/// Restart gateway with full config replacement.
/// NOTE: Docs say `gateway.restart`, not `config.apply` (task spec was wrong).
public func gatewayRestart(raw: String, baseHash: String? = nil, note: String? = nil) async throws {
    let params = GatewayRestartParams(raw: raw, baseHash: baseHash, note: note)
    _ = try await request("gateway.restart", params: params)
}

// MARK: - Gateway Convenience

/// Fetch gateway health (status, uptime, version, model).
public func gatewayHealth() async throws -> GatewayHealth {
    let response = try await request("health")
    return parseGatewayHealth(response)
}

/// Fetch gateway status (version, model, channels).
public func gatewayStatus() async throws -> GatewayStatus {
    let response = try await request("status")
    return parseGatewayStatus(response)
}

// MARK: - Models Convenience

/// List available models on the gateway.
public func modelsList() async throws -> [GatewayModel] {
    let response = try await request("models.list")
    return parseModelsList(response)
}

// MARK: - Cron Convenience

/// Create a new cron job. Returns the job ID.
@discardableResult
public func cronAdd(job: CronJobCreate) async throws -> String {
    let response = try await request("cron.add", params: job)
    return response?.dict?["jobId"] as? String
        ?? response?.dict?["id"] as? String
        ?? ""
}

/// Fetch execution history for a cron job.
public func cronRuns(jobId: String) async throws -> [CronRun] {
    let response = try await request("cron.runs", params: AnyCodable(["jobId": jobId]))
    return parseCronRuns(response)
}

// MARK: - Sessions Convenience

/// Patch a session (e.g. clear context, rename, etc.).
public func sessionsPatch(sessionKey: String, patch: [String: Any]) async throws {
    let params = SessionsPatchParams(sessionKey: sessionKey, patch: patch)
    _ = try await request("sessions.patch", params: params)
}
```

### 1C. New Parsing Methods in `OpenClawClient.swift` (append after `parseSessionsList`, before the closing `}` of the class)

```swift
// MARK: - Config Parsing

private func parseConfigGet(_ response: AnyCodable?) -> GatewayConfig {
    guard let dict = response?.dict else {
        return GatewayConfig(raw: "", hash: "", parsed: [:])
    }
    return GatewayConfig(
        raw: dict["raw"] as? String ?? "",
        hash: dict["hash"] as? String ?? dict["baseHash"] as? String ?? "",
        parsed: dict["parsed"] as? [String: Any] ?? dict
    )
}

private func parseGatewayHealth(_ response: AnyCodable?) -> GatewayHealth {
    guard let dict = response?.dict else {
        return GatewayHealth(status: "unknown", uptime: 0, version: "?")
    }
    return GatewayHealth(
        status: dict["status"] as? String ?? "unknown",
        uptime: dict["uptime"] as? Double ?? dict["uptimeMs"] as? Double ?? 0,
        version: dict["version"] as? String ?? "?",
        model: dict["model"] as? String,
        sessions: dict["sessions"] as? Int ?? dict["activeSessions"] as? Int ?? 0,
        cronJobs: dict["cronJobs"] as? Int ?? dict["scheduledJobs"] as? Int ?? 0
    )
}

private func parseGatewayStatus(_ response: AnyCodable?) -> GatewayStatus {
    guard let dict = response?.dict else {
        return GatewayStatus(version: "?")
    }
    var channels: [String: ChannelStatus] = [:]
    if let rawChannels = dict["channels"] as? [String: [String: Any]] {
        for (key, ch) in rawChannels {
            channels[key] = ChannelStatus(
                connected: ch["connected"] as? Bool ?? false,
                type: ch["type"] as? String ?? "unknown"
            )
        }
    }
    return GatewayStatus(
        version: dict["version"] as? String ?? "?",
        model: dict["model"] as? String,
        channels: channels
    )
}

private func parseModelsList(_ response: AnyCodable?) -> [GatewayModel] {
    guard let dict = response?.dict,
          let rawModels = dict["models"] as? [[String: Any]] else {
        // Fallback: response might be a top-level array
        if let arr = response?.array as? [[String: Any]] {
            return arr.compactMap { m in
                guard let id = m["id"] as? String else { return nil }
                return GatewayModel(id: id, name: m["name"] as? String, provider: m["provider"] as? String)
            }
        }
        return []
    }
    return rawModels.compactMap { m in
        guard let id = m["id"] as? String else { return nil }
        return GatewayModel(id: id, name: m["name"] as? String, provider: m["provider"] as? String)
    }
}

private func parseCronRuns(_ response: AnyCodable?) -> [CronRun] {
    guard let dict = response?.dict,
          let rawRuns = dict["runs"] as? [[String: Any]] else {
        return []
    }
    return rawRuns.compactMap { r in
        guard let runId = r["runId"] as? String ?? r["id"] as? String else { return nil }
        var startedAt: Date? = nil
        if let ts = r["startedAt"] as? Double { startedAt = Date(timeIntervalSince1970: ts / 1000) }
        var finishedAt: Date? = nil
        if let ts = r["finishedAt"] as? Double { finishedAt = Date(timeIntervalSince1970: ts / 1000) }
        return CronRun(
            id: runId,
            startedAt: startedAt,
            finishedAt: finishedAt,
            status: r["status"] as? String ?? "ok",
            error: r["error"] as? String
        )
    }
}
```

### 1D. Integration Pattern

These methods follow the **exact same pattern** as existing code:
- Typed params struct → `request(method, params:)` → parse response into typed result
- All return types are `Sendable` (required by `@MainActor` class)
- `GatewayConfig`, `GatewayHealth`, `GatewayStatus` are NOT `Codable` because they contain `[String: Any]` — this matches `ChatHistoryResponse` pattern
- `CronJobCreate` and sub-types ARE `Codable` because they're sent as params

### 1E. Testing

| Test | How | Expected |
|------|-----|----------|
| `configGet()` | Call on connected bot | Returns raw string + non-empty hash |
| `configPatch(raw:baseHash:)` | Patch model, pass hash from configGet | Gateway restarts, no error |
| `gatewayHealth()` | Call on connected bot | status="ok", uptime > 0, version non-empty |
| `modelsList()` | Call on connected bot | Array with >= 1 model, each has id |
| `cronAdd(job:)` | Create test job | Returns non-empty jobId |
| `cronRuns(jobId:)` | Pass valid jobId | Returns array (possibly empty) |
| `sessionsPatch(...)` | Patch main session | No error thrown |
| Build check | `Cmd+B` both targets | 0 errors, 0 warnings |

---

## Phase 2: Bot Management UI

**Files:** `macOS/OptaPlusMacOS/BotProfileSheet.swift`, new `iOS/OptaPlusIOS/Views/BotManagementSheet.swift`
**Depends on:** Phase 1 (needs `configGet`, `gatewayHealth`, `modelsList`, `configPatch`, `sessionsPatch`)
**Estimated time:** 90 min
**Risk:** MEDIUM — modifies existing BotProfileSheet layout, may affect sheet sizing

### 2A. Modify `BotProfileSheet.swift` (macOS) — Lines 66-272

**Current:** 293 lines, read-only display with stats.
**Change:** Add 3 new sections between the stats card and the close button, plus state vars for config data.

#### New @State vars (add after line 66, `@State private var appeared = false`):

```swift
@State private var healthStatus: GatewayHealth?
@State private var availableModels: [GatewayModel] = []
@State private var currentModel: String = ""
@State private var selectedModel: String = ""
@State private var thinkingLevel: String = "off"
@State private var configHash: String = ""
@State private var isLoadingConfig = true
@State private var isApplying = false
@State private var configError: String?
```

#### New `.task` modifier on the outermost VStack (add after `.onAppear` at line 268):

```swift
.task {
    await loadBotConfig()
}
```

#### New load method (add as extension or private func):

```swift
private func loadBotConfig() async {
    guard viewModel.isGatewayReady else { isLoadingConfig = false; return }
    do {
        async let h = viewModel.call("health")
        async let c = viewModel.call("config.get")
        async let m = viewModel.call("models.list")
        let (healthRes, configRes, modelsRes) = try await (h, c, m)

        // Parse health
        if let hd = healthRes?.dict {
            healthStatus = GatewayHealth(
                status: hd["status"] as? String ?? "unknown",
                uptime: hd["uptime"] as? Double ?? 0,
                version: hd["version"] as? String ?? "?",
                model: hd["model"] as? String,
                sessions: hd["sessions"] as? Int ?? 0,
                cronJobs: hd["cronJobs"] as? Int ?? 0
            )
            currentModel = hd["model"] as? String ?? ""
            selectedModel = currentModel
        }

        // Parse config hash
        if let cd = configRes?.dict {
            configHash = cd["hash"] as? String ?? ""
            // Extract thinking level from parsed config
            if let parsed = cd["parsed"] as? [String: Any],
               let agents = parsed["agents"] as? [String: Any],
               let defaults = agents["defaults"] as? [String: Any] {
                thinkingLevel = defaults["thinking"] as? String ?? "off"
            }
        }

        // Parse models
        if let md = modelsRes?.dict,
           let models = md["models"] as? [[String: Any]] {
            availableModels = models.compactMap { m in
                guard let id = m["id"] as? String else { return nil }
                return GatewayModel(id: id, name: m["name"] as? String, provider: m["provider"] as? String)
            }
        }
    } catch {
        configError = error.localizedDescription
    }
    isLoadingConfig = false
}
```

#### New UI sections (insert before `Spacer()` at line 239, after the stats card):

**Section 1: Health Status** — Shows gateway version, uptime, status dot.

**Section 2: Model & Thinking** — Picker for model (populated from `models.list`), picker for thinking level (off/low/high/stream), "Apply" button that calls `config.patch`.

**Section 3: Actions** — "Check Health" button (re-calls `health`), "Compact Context" button (calls `sessions.patch` with `{compact: true}`), "Restart" button (calls `gateway.restart` with current config — with confirmation dialog per C02).

#### Key design decisions:

- Model picker uses `Picker` with `.menu` style (macOS native dropdown)
- Thinking picker uses segmented `Picker` with 4 options
- Apply button disabled until `selectedModel != currentModel` or thinking changed
- Restart button shows `.confirmationDialog` (C02: destructive action requires confirmation)
- All actions provide `SoundManager.shared.play()` feedback
- Glass card styling matches existing stats card pattern
- Sheet frame grows from `height: 440` to `height: 620` to accommodate new sections

### 2B. New `iOS/OptaPlusIOS/Views/BotManagementSheet.swift`

Create a new iOS-native equivalent. This is a NEW file (not modifying SettingsView).

**Structure:**

```swift
struct BotManagementSheet: View {
    @ObservedObject var viewModel: ChatViewModel
    @Environment(\.dismiss) private var dismiss

    // Same @State vars as macOS

    var body: some View {
        NavigationStack {
            List {
                // Section: Health — status pill, version, uptime, model
                Section("Health") { ... }

                // Section: Model — Picker wheel for model, segmented for thinking
                Section("Model") {
                    Picker("Model", selection: $selectedModel) {
                        ForEach(availableModels) { model in
                            Text(model.name ?? model.id).tag(model.id)
                        }
                    }
                    Picker("Thinking", selection: $thinkingLevel) {
                        Text("Off").tag("off")
                        Text("Low").tag("low")
                        Text("High").tag("high")
                        Text("Stream").tag("stream")
                    }
                    .pickerStyle(.segmented)
                }

                // Section: Actions
                Section("Actions") {
                    Button("Apply Changes") { applyConfig() }
                        .disabled(!hasChanges)
                    Button("Compact Context") { compactContext() }
                    Button("Restart Gateway", role: .destructive) { showRestartConfirm = true }
                        .confirmationDialog(...) // C02
                }
            }
            .navigationTitle("Bot Config")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await loadBotConfig() }
        }
    }
}
```

**Wire into iOS:** Add a toolbar button or context menu on the bot header that presents this sheet.

### 2C. Register New iOS File in Xcode Project

The new `BotManagementSheet.swift` must be added to `iOS/OptaPlusIOS.xcodeproj/project.pbxproj`:
- Add `PBXFileReference` entry
- Add to `PBXBuildFile` (Compile Sources)
- Add to `PBXGroup` (Views folder)

### 2D. Testing

| Test | Platform | How |
|------|----------|-----|
| Health loads on sheet open | macOS | Open BotProfileSheet, verify version + uptime shown |
| Health loads on sheet open | iOS | Open BotManagementSheet, verify same |
| Model picker populates | Both | Verify dropdown has >= 1 model from gateway |
| Model switch works | Both | Select different model, tap Apply, verify config.patch sent |
| Thinking level change | Both | Change to "high", Apply, verify config.patch sent |
| Restart confirmation | Both | Tap Restart, verify dialog appears before action |
| Compact context | Both | Tap Compact, verify sessions.patch sent |
| Sheet sizing (macOS) | macOS | Verify sheet renders fully without clipping |
| Build check | Both | 0 errors, 0 warnings |

---

## Phase 3: Smart Reaction Dispatch

**Files:** `Shared/Sources/OptaMolt/Chat/ReactionBar.swift`, `Shared/Sources/OptaMolt/Networking/ChatViewModel.swift`
**Depends on:** Nothing (uses existing `ChatViewModel.send()`)
**Estimated time:** 45 min
**Risk:** LOW — replaces emoji list, adds one method to ChatViewModel

### 3A. Replace `ReactionBar.swift` — Full Rewrite

**Current state:** 220 lines. Generic emoji reactions (👍❤️😂🤔👀🔥), local-only storage, never sent to bot.
**New state:** 8 bot-command reactions, each dispatches `chat.send` via ChatViewModel.

#### New `ReactionAction` enum (replace `MessageReaction` at line 15):

```swift
/// A bot-command reaction. Each emoji maps to a command sent via chat.send.
public enum ReactionAction: String, CaseIterable, Sendable {
    case proceed   = "👍"
    case explain   = "❓"
    case revert    = "👎"
    case retry     = "🔄"
    case pause     = "⏸️"
    case resume    = "▶️"
    case summarize = "📋"
    case detail    = "🔍"

    /// The command text sent to the bot via chat.send.
    public var commandText: String {
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

    /// Human-readable label shown in tooltip.
    public var label: String {
        switch self {
        case .proceed:   return "Proceed"
        case .explain:   return "Explain"
        case .revert:    return "Revert"
        case .retry:     return "Retry"
        case .pause:     return "Pause"
        case .resume:    return "Resume"
        case .summarize: return "Summarize"
        case .detail:    return "Detail"
        }
    }
}
```

#### Update `ReactionStore` (keep the same structure, it stores visual state):

No changes needed to `ReactionStore`. It continues to track which emoji is shown on which message (visual-only toggle). The dispatch to the bot happens separately via `ChatViewModel.sendReaction()`.

#### Replace `QuickReactionBar` (line 62-101):

The `quickReactions` array changes from `["👍", "❤️", "😂", "🤔", "👀", "🔥"]` to the 8 `ReactionAction` cases. Each button shows the emoji and a tooltip with the label.

```swift
public struct QuickReactionBar: View {
    let messageId: String
    let onReact: (ReactionAction) -> Void

    public init(messageId: String, onReact: @escaping (ReactionAction) -> Void) {
        self.messageId = messageId
        self.onReact = onReact
    }

    public var body: some View {
        HStack(spacing: 4) {
            ForEach(ReactionAction.allCases, id: \.rawValue) { action in
                Button(action: { onReact(action) }) {
                    Text(action.rawValue)
                        .font(.system(size: 18))
                        .padding(4)
                }
                .buttonStyle(.plain)
                .help(action.label)  // macOS tooltip
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(Color.optaSurface.opacity(0.85))
                .background(.ultraThinMaterial)
                .clipShape(Capsule())
        )
        .overlay(
            Capsule()
                .stroke(Color.optaBorder.opacity(0.3), lineWidth: 0.5)
        )
        .shadow(color: Color.black.opacity(0.3), radius: 8, y: 2)
    }
}
```

#### Update `ReactiveMessageWrapper` (line 156-202):

The `onReact` callback changes from `(String) -> Void` to `(ReactionAction) -> Void`. The wrapper needs access to a ChatViewModel to dispatch the command. This is a design decision:

**Option A (recommended):** Pass `ChatViewModel` into `ReactiveMessageWrapper` via environment or parameter. On reaction tap, call `vm.sendReaction(action, for: messageId)`.

**Option B:** Keep ReactiveMessageWrapper purely visual, and have the parent view handle the dispatch. This keeps the wrapper reusable.

**Decision: Option B** — Keep the wrapper's `onReact` callback as `(ReactionAction) -> Void` and let the parent (ChatView/ContentView) wire it to ChatViewModel. This avoids coupling the shared component to a specific view model instance.

Updated wrapper:
```swift
public struct ReactiveMessageWrapper<Content: View>: View {
    let messageId: String
    let onReact: (ReactionAction) -> Void
    let content: Content
    @StateObject private var store = ReactionStore.shared
    @State private var showReactionBar = false

    public init(messageId: String,
                onReact: @escaping (ReactionAction) -> Void,
                @ViewBuilder content: () -> Content) {
        self.messageId = messageId
        self.onReact = onReact
        self.content = content()
    }

    public var body: some View {
        VStack(spacing: 4) {
            ZStack(alignment: .top) {
                content

                if showReactionBar {
                    QuickReactionBar(messageId: messageId) { action in
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                            store.toggleReaction(action.rawValue, for: messageId)
                            showReactionBar = false
                        }
                        onReact(action)
                    }
                    .offset(y: -40)
                    .transition(.scale(scale: 0.8).combined(with: .opacity))
                    .zIndex(10)
                }
            }
            #if canImport(AppKit)
            .onHover { hovering in
                withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                    showReactionBar = hovering
                }
            }
            #endif

            ReactionPillsView(messageId: messageId, store: store)
        }
        #if canImport(UIKit)
        .onLongPressGesture {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                showReactionBar.toggle()
            }
        }
        #endif
    }
}
```

**Note:** The `.onHover` animation on line 186 of the current code uses `.easeInOut(duration: 0.2)` — this **violates A04 (spring physics only)**. The rewrite fixes this to `.optaSnap`.

### 3B. Add `sendReaction()` to `ChatViewModel.swift` (line ~665, after `abort()`)

```swift
/// Send a reaction command to the bot.
/// Visually toggles the reaction on the message and dispatches the command text.
public func sendReaction(_ action: ReactionAction, for messageId: String) async {
    ReactionStore.shared.toggleReaction(action.rawValue, for: messageId)
    await send(action.commandText)
}
```

This is 3 lines. It:
1. Toggles the visual reaction pill on the message
2. Sends the command text through the existing `send()` pipeline (which handles session routing, offline queueing, etc.)

### 3C. Wire into Chat Views

The parent views (macOS `ContentView.swift` chat area, iOS `ChatView.swift` / message list) need to pass `onReact` when constructing `ReactiveMessageWrapper`. This is a small change at the call site:

**Before:**
```swift
ReactiveMessageWrapper(messageId: msg.id) {
    MessageBubble(message: msg)
}
```

**After:**
```swift
ReactiveMessageWrapper(messageId: msg.id, onReact: { action in
    Task { await viewModel.sendReaction(action, for: msg.id) }
}) {
    MessageBubble(message: msg)
}
```

**Files affected:** Wherever `ReactiveMessageWrapper` is instantiated. Search for usage:
- Likely in shared chat components or platform-specific chat views
- This is a signature change so all call sites must update (compiler will catch missing arg)

### 3D. Testing

| Test | How | Expected |
|------|-----|----------|
| Reaction bar shows 8 emojis | Hover/long-press on message | See 👍❓👎🔄⏸️▶️📋🔍 |
| Tap 👍 sends command | Tap 👍, check gateway logs | `chat.send` with "[USER_REACTION: proceed]..." |
| Visual pill appears | Tap 👍 | Pill with 👍 shows below message |
| Tap pill removes it | Tap pill | Pill disappears (visual toggle) |
| All 8 reactions send correct text | Tap each, verify | Each sends its unique commandText |
| Reaction on disconnected bot | Tap reaction while offline | Message queued, sent on reconnect |
| Spring physics compliance | Inspect animations | No `.easeInOut` — all spring |
| Build check | Both targets | 0 errors |

---

## Phase 4: Cron Job Creation Fix

**Files:** `iOS/OptaPlusIOS/Views/CreateJobSheet.swift`, `macOS/OptaPlusMacOS/AutomationsView.swift`
**Depends on:** Nothing (can run in parallel)
**Estimated time:** 30 min
**Risk:** LOW — documentary schema verification completed; only method name changes, field names stay production-tested

### 4A. Schema Verification Results (RESOLVED)

| Field | Current Code | Task Spec | Verified Correct | Change? |
|-------|-------------|-----------|-----------------|---------|
| RPC method | `cron.create` | `cron.add` | `cron.add` (3 docs agree) | YES → `cron.add` |
| Delete method | `cron.delete` | — | `cron.remove` (2 docs agree) | YES → `cron.remove` |
| Schedule cron key | `expression` | `expr` | `expression` (production-tested) | NO |
| Schedule every key | `intervalMs` | `everyMs` | `intervalMs` (production-tested) | NO |
| Schedule at key | `date` (epoch ms) | `at` (ISO string) | `date` (production-tested) | NO |
| Payload kind | `"chat"` | `"agentTurn"` | `"agentTurn"` (docs, not `"chat"`) | YES → `"agentTurn"` |
| Payload text key | `message` | `message` | `message` | NO |
| Timezone | Not sent | `tz` field | `tz` field (CONTEXT.md confirms) | YES → ADD |

### 4B. Changes to `iOS/OptaPlusIOS/Views/CreateJobSheet.swift`

#### Line 199-249: Fix the `save()` method

Using verified field names (production-tested schedule keys, documented method names):

```swift
private func save() {
    isSaving = true
    errorMessage = nil

    let schedule: [String: Any]
    let tz = TimeZone.current.identifier
    switch scheduleKind {
    case .cron:
        schedule = ["kind": "cron", "expression": cronExpression, "tz": tz]
    case .every:
        schedule = ["kind": "every", "intervalMs": intervalValue * intervalUnit.multiplier, "tz": tz]
    case .at:
        schedule = ["kind": "at", "date": oneTimeDate.timeIntervalSince1970 * 1000, "tz": tz]
    }

    let payload: [String: Any] = [
        "kind": "agentTurn",
        "message": command
    ]

    Task {
        do {
            if let job = existingJob {
                _ = try await viewModel.call("cron.update", params: [
                    "jobId": job.id,
                    "patch": [
                        "name": name, "schedule": schedule,
                        "payload": payload, "sessionTarget": sessionTarget
                    ] as [String: Any]
                ])
            } else {
                _ = try await viewModel.call("cron.add", params: [
                    "name": name,
                    "schedule": schedule,
                    "payload": payload,
                    "sessionTarget": sessionTarget,
                    "enabled": true
                ] as [String: Any])
            }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            onSaved()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            isSaving = false
        }
    }
}
```

Key changes (3 total — minimal disruption):
1. `"cron.create"` → `"cron.add"` (documented method name, all 3 docs agree)
2. `"kind": "chat"` → `"kind": "agentTurn"` (payload kind — `"chat"` not documented)
3. Added `"tz"` timezone to all schedule types
4. Schedule field names (`expression`, `intervalMs`, `date`) UNCHANGED — production-tested

#### Also fix `populateFromJob()` (line 267-306):

Schedule field parsing already handles the correct keys as primary:
- `schedule["expression"]` ✅ (already primary, `expr` as fallback — keep as-is)
- `schedule["intervalMs"]` ✅ (already primary, `interval` as fallback — keep as-is)
- `schedule["date"]` ✅ (already correct — keep as-is)

No changes needed to the parsing/populate code — only the save/send code changes.

### 4C. Changes to `macOS/OptaPlusMacOS/AutomationsView.swift`

Same 3 changes to the create flow (around line 967-982):
1. `"cron.create"` → `"cron.add"` (method name)
2. `"kind": "chat"` → `"kind": "agentTurn"` (payload kind)
3. Add `"tz": TimeZone.current.identifier` to schedule dict

Also update delete calls:
4. `"cron.delete"` → `"cron.remove"` (line ~413)

### 4D. Testing

| Test | Platform | How | Expected |
|------|----------|-----|----------|
| Create cron job | iOS | Fill form, tap Create | Job appears in list, no error |
| Create cron job | macOS | Fill form, save | Same |
| Create interval job | iOS | Set "every 5 minutes" | Job runs at interval |
| Create one-time job | iOS | Set future date | Job appears with correct time |
| Edit existing job | Both | Open job, change name, save | Updated in list |
| Schedule parsing | Both | View created job | Shows correct schedule text |
| Build check | Both | Cmd+B | 0 errors |

---

## Risk Assessment

### What Could Break

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Gateway method name** (`cron.add` vs `cron.create`) | LOW | Verified: 3 doc sources say `cron.add`. Gateway likely accepts both as aliases. Single-string revert if needed. |
| **Schedule param names** | RESOLVED | Verified: keep production-tested names (`expression`, `intervalMs`, `date`). Task spec's `expr`/`everyMs` were wrong. |
| **ReactiveMessageWrapper signature change** breaks call sites | MEDIUM | Compiler will catch. Search all usages, update with `onReact:` param. |
| **BotProfileSheet height increase** clips on small displays | LOW | Test at 720p resolution. Add `ScrollView` if needed. |
| **config.patch with wrong baseHash** causes conflict | LOW | Always fetch fresh hash via `configGet()` before patching. |
| **Sending reaction commands to bots that don't understand `[USER_REACTION:]`** | LOW | Bots will treat it as a normal message — graceful degradation. |

### What Won't Break

- Phase 1 is purely additive (new methods, no existing code modified)
- Phase 3 `sendReaction()` uses existing `send()` pipeline — all offline/session logic inherited
- ReactionStore visual toggle behavior unchanged
- All existing gateway RPC calls (`chat.send`, `chat.history`, etc.) untouched

---

## Testing Matrix

| Feature | macOS | iOS | Shared (OptaMolt) |
|---------|-------|-----|--------------------|
| `configGet()` | via BotProfileSheet | via BotManagementSheet | Unit: parse response |
| `configPatch()` | Apply button | Apply button | Unit: params encoding |
| `gatewayHealth()` | Health section | Health section | Unit: parse response |
| `modelsList()` | Model picker | Model picker | Unit: parse response |
| `cronAdd()` | AutomationsView | CreateJobSheet | Unit: params encoding |
| `cronRuns()` | History view | JobHistorySheet | Unit: parse response |
| `sessionsPatch()` | Compact button | Compact button | Unit: params encoding |
| Smart reactions (8 types) | Hover bar | Long-press bar | Unit: commandText mapping |
| Reaction → chat.send | Send + gateway log | Send + gateway log | Integration |
| Visual reaction pills | Pill below bubble | Pill below bubble | SwiftUI preview |
| Config edit end-to-end | Model switch | Model switch | Integration |
| Spring physics audit | All new animations | All new animations | Visual inspection |
| Build clean | Cmd+B | Cmd+B | CI |

---

## File Change Summary

| File | Phase | Lines Added | Lines Modified | Lines Removed |
|------|-------|-------------|----------------|---------------|
| `Shared/.../OpenClawProtocol.swift` | 1 | ~140 | 0 | 0 |
| `Shared/.../OpenClawClient.swift` | 1 | ~120 | 0 | 0 |
| `Shared/.../Chat/ReactionBar.swift` | 3 | ~80 | ~60 | ~30 |
| `Shared/.../Networking/ChatViewModel.swift` | 3 | ~5 | 0 | 0 |
| `macOS/BotProfileSheet.swift` | 2 | ~150 | ~5 (frame size) | 0 |
| `iOS/Views/BotManagementSheet.swift` | 2 | ~180 (NEW) | — | — |
| `iOS/OptaPlusIOS.xcodeproj/project.pbxproj` | 2 | ~8 | 0 | 0 |
| `iOS/Views/CreateJobSheet.swift` | 4 | ~5 | ~20 | ~10 |
| `macOS/AutomationsView.swift` | 4 | ~5 | ~10 | ~5 |
| Chat view call sites (varies) | 3 | 0 | ~5 per file | 0 |
| **Total** | | **~700** | **~100** | **~45** |

---

## Estimated Timeline

| Phase | Duration | Can Parallelize | Blocked By |
|-------|----------|-----------------|------------|
| Phase 1: Protocol Layer | 45 min | Yes (Group A) | Nothing |
| Phase 3: Smart Reactions | 45 min | Yes (Group A) | Nothing |
| Phase 2: Bot Management UI | 90 min | Yes (Group B) | Phase 1 |
| Phase 4: Cron Job Fix | 30 min | Yes (Group B) | Nothing (schema verified) |
| Integration testing | 30 min | No | All phases |
| **Total (sequential)** | **4 hours** | | |
| **Total (with parallelism)** | **~2.5 hours** | | |

---

## Schema Verification Results (2026-02-15)

**Method:** Documentary verification from 4 authoritative sources (live gateway probing blocked — LAN unreachable, Cloudflare tunnels reject `openclaw-control-ui` secure context requirement).

### Sources Used
1. `docs/app-redesign/context/CLAUDE-CODE-CONTEXT.md` — Exact JSON frames, full method table
2. `docs/ECOSYSTEM.md` — Method reference + data flow examples with JSON
3. `SHARED.md` line 131 — Canonical method name list
4. Working production code — Dual-fallback field parsing in AutomationsView.swift

### Verified Method Names

| Operation | Documentation Says | Current Code Uses | Verdict |
|-----------|-------------------|-------------------|---------|
| Create cron job | `cron.add` | `cron.create` | **Use `cron.add`** — all 3 docs agree; `cron.create` may be accepted as alias |
| Delete cron job | `cron.remove` | `cron.delete` | **Use `cron.remove`** — ECOSYSTEM + SHARED agree |
| Update cron job | `cron.update` | `cron.update` | **Correct** — matches everywhere |
| Restart gateway | `gateway.restart` | *(not implemented)* | **Use `gateway.restart`** — ECOSYSTEM + SHARED agree (task spec said `config.apply` — WRONG) |

### Verified Schedule Field Names

| Field | Working Code Sends | Working Code Parses (fallback) | Verdict |
|-------|-------------------|-------------------------------|---------|
| Cron expression | `"expression"` | `expression ?? expr` | **Keep `expression`** — production-tested |
| Interval | `"intervalMs"` | `intervalMs ?? interval` | **Keep `intervalMs`** — production-tested |
| One-time date | `"date"` | `"date"` | **Keep `date`** |
| Kind | `"kind"` | `"kind"` | **Correct** |

### Verified Payload Kind

| Current Code | Documentation | Verdict |
|-------------|---------------|---------|
| `"chat"` | `systemEvent` or `agentTurn` (CONTEXT.md line 68) | **Fix to `"agentTurn"`** — `"chat"` not documented |

### Corrections to Task Spec

| Task Spec Says | Actually Correct | Source |
|----------------|-----------------|--------|
| `config.apply` | `gateway.restart` | ECOSYSTEM.md line 340, SHARED.md line 131 |
| `expr` | `expression` (works in production) | AutomationsView.swift dual-parse, CreateJobSheet.swift sends |
| `everyMs` | `intervalMs` (works in production) | Same |
| `at` (ISO string) | `date` (epoch ms) | CreateJobSheet.swift line 210 |

### Risk Mitigation for `cron.add` vs `cron.create`

The gateway likely supports both as aliases (common in OpenClaw). Strategy:
1. New convenience method uses `cron.add` (documented name)
2. Existing UI code migrated from `cron.create` → `cron.add`
3. If `cron.add` fails on first live test, revert to `cron.create` — single string change

---

## Pre-Implementation Checklist

- [x] **Verify gateway RPC names:** Completed via documentary analysis (see above)
- [ ] **Identify all ReactiveMessageWrapper call sites** — search both platform codebases
- [ ] **Confirm models.list response shape** — parse both `[...]` and `{models: [...]}` defensively
- [ ] **Confirm config.get response shape** — parse defensively, expect `{raw, hash, parsed}` per probe script
