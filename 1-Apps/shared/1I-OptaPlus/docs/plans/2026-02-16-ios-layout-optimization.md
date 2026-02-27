# iOS Layout Optimization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate the iOS app from 6 overlapping tabs to 4 focused tabs, unify the dual data model (BotConfig/BotNode), and delete ~800 lines of dead/duplicated code.

**Architecture:** Make `AppState` bridge `BotNode` → `BotConfig` transparently so existing views keep working while the UI layer consolidates. Bot Map absorbs Bot Web and Dashboard features. Debug moves into Settings. The result is 4 tabs: Map, Chat, Automations, Settings.

**Tech Stack:** Swift 5.9+, SwiftUI, iOS 17+, zero external dependencies. Spring physics animations only (`.optaSpring`, `.optaSnap`, `.optaGentle`). Sora typography. Obsidian Glassmorphism aesthetic.

---

## Context: What Went Wrong

The bot pairing sprint added a new pairing system (`BotNode` + `BotPairingStore`) alongside the existing system (`BotConfig` + `AppState`). This created:

1. **Bot Map** (new pairing data) and **Bot Web** (old config data) — two radial visualization tabs doing the same thing
2. **Dashboard** — bot cards that overlap with both visualization tabs
3. **6 tabs** — exceeds Apple HIG recommendation of ≤5
4. **Debug** as a primary tab — not user-facing

### Current Tab Structure (BEFORE)
```
Tab 1: Dashboard  — bot cards + activity feed + connect all
Tab 2: Bot Map    — constellation (BotNode data)
Tab 3: Bot Web    — radial topology (BotConfig data)
Tab 4: Chat       — per-bot chat pager
Tab 5: Automations — per-bot cron jobs
Tab 6: Debug      — gateway diagnostics
```

### Target Tab Structure (AFTER)
```
Tab 1: Map         — unified constellation + activity state + activity feed
Tab 2: Chat        — per-bot chat pager (unchanged)
Tab 3: Automations — per-bot cron jobs (unchanged)
Tab 4: Settings    — settings + diagnostics subsection
```

---

## Design Rules (Non-Negotiable)

- **A04**: Spring physics ONLY — `.optaSpring`, `.optaSnap`, `.optaGentle`, `.optaPulse`, `.optaSpin`. Never `.easeInOut`, `.linear(duration:)`, or duration-based animations.
- **Background**: `Color.optaVoid` (#050505)
- **Primary**: `Color.optaPrimary` (#8B5CF6)
- **Typography**: `.sora()`, `.soraBody`, `.soraHeadline`, `.soraCaption`, `.soraTitle2`, `.soraTitle3`
- **Zero external dependencies**
- **No UIKit** (except `UIImpactFeedbackGenerator` for haptics)

---

## Task 1: Unify AppState Data Layer

**Goal:** Make `AppState` use `BotPairingStore` as its internal storage while keeping the `bots: [BotConfig]` interface so existing views don't break.

**Files:**
- Modify: `iOS/OptaPlusIOS/OptaPlusIOSApp.swift` (AppState class, lines 15-116)
- Modify: `Shared/Sources/OptaMolt/Networking/BotPairing/BotNode.swift` (add connectionMode)
- Modify: `Shared/Sources/OptaMolt/Networking/ChatViewModel.swift` (update BotConfig bridge, ~line 113)
- Test: `Shared/Tests/OptaMoltTests/BotPairingStoreTests.swift` (add migration round-trip test)

**Step 1: Add `connectionMode` to BotNode**

Read `Shared/Sources/OptaMolt/Networking/BotPairing/BotNode.swift`. Add a `connectionMode` property to `BotNode`:

```swift
public struct BotNode: Identifiable, Codable, Hashable, Sendable {
    public let botId: String
    public let gatewayFingerprint: String
    public var name: String
    public var emoji: String
    public var gatewayHost: String?
    public var gatewayPort: Int?
    public var remoteURL: String?
    public var connectionMode: ConnectionMode  // ADD THIS
    public var state: BotConnectionState
    public var lastSeen: Date
    public var lastLatency: TimeInterval?

    public var id: String { "\(gatewayFingerprint):\(botId)" }

    public init(
        botId: String,
        gatewayFingerprint: String,
        name: String,
        emoji: String,
        gatewayHost: String? = nil,
        gatewayPort: Int? = nil,
        remoteURL: String? = nil,
        connectionMode: ConnectionMode = .auto,  // ADD THIS
        state: BotConnectionState = .discovered,
        lastSeen: Date = Date()
    ) {
        // ... existing assignments ...
        self.connectionMode = connectionMode  // ADD THIS
    }
}

// ConnectionMode — move from BotConfig or re-declare if needed
public enum ConnectionMode: String, Codable, Sendable, Hashable {
    case auto, lan, remote
}
```

> **Note:** `ConnectionMode` is currently defined inside `BotConfig` in `ChatViewModel.swift`. Check if it's already top-level or needs to be moved/re-exported. If it's nested as `BotConfig.ConnectionMode`, extract it to top-level so both `BotNode` and `BotConfig` can use it.

**Step 2: Update BotConfig bridge constructor**

Read `Shared/Sources/OptaMolt/Networking/ChatViewModel.swift` around line 113. Update the bridge constructor to pass `connectionMode`:

```swift
public init(botNode: BotNode, token: String) {
    self.init(
        id: botNode.botId,
        name: botNode.name,
        host: botNode.gatewayHost ?? "127.0.0.1",
        port: botNode.gatewayPort ?? 3000,
        token: token,
        emoji: botNode.emoji,
        remoteURL: botNode.remoteURL,
        connectionMode: botNode.connectionMode
    )
}
```

**Step 3: Rewrite AppState to use BotPairingStore**

Read `iOS/OptaPlusIOS/OptaPlusIOSApp.swift`. Replace the `AppState` class (lines 15-116) with:

```swift
@MainActor
final class AppState: ObservableObject {
    // MARK: - Published State
    @Published private(set) var botNodes: [BotNode] = []
    @Published var selectedBotId: String?
    private var chatViewModels: [String: ChatViewModel] = [:]

    // MARK: - Storage
    let pairingStore = BotPairingStore()
    private var tokenCache: [String: String] = [:]  // nodeId → token

    // MARK: - Keys
    private let selectedBotKey = "optaplus.selectedBot"
    private let legacyBotsKey = "optaplus.bots"

    init() {
        migrateIfNeeded()
        reloadFromStore()
        if botNodes.isEmpty { addDefaultBots() }
        if let saved = UserDefaults.standard.string(forKey: selectedBotKey),
           botNodes.contains(where: { $0.botId == saved }) {
            selectedBotId = saved
        } else {
            selectedBotId = botNodes.first?.botId
        }
    }

    // MARK: - Backward-Compatible Interface

    /// Computed BotConfig array — existing views read this without changes.
    var bots: [BotConfig] {
        botNodes.map { node in
            BotConfig(botNode: node, token: tokenCache[node.id] ?? "")
        }
    }

    func viewModel(for bot: BotConfig) -> ChatViewModel {
        if let existing = chatViewModels[bot.id] { return existing }
        let vm = ChatViewModel(botConfig: bot)
        chatViewModels[bot.id] = vm
        return vm
    }

    /// New: get view model from BotNode directly
    func viewModel(forNode node: BotNode) -> ChatViewModel {
        if let existing = chatViewModels[node.botId] { return existing }
        let token = tokenCache[node.id] ?? ""
        let config = BotConfig(botNode: node, token: token)
        let vm = ChatViewModel(botConfig: config)
        chatViewModels[node.botId] = vm
        return vm
    }

    var selectedBot: BotConfig? {
        bots.first { $0.id == selectedBotId }
    }

    var selectedNode: BotNode? {
        botNodes.first { $0.botId == selectedBotId }
    }

    var selectedViewModel: ChatViewModel? {
        guard let bot = selectedBot else { return nil }
        return viewModel(for: bot)
    }

    func selectBot(_ bot: BotConfig) {
        selectedBotId = bot.id
        UserDefaults.standard.set(bot.id, forKey: selectedBotKey)
        let vm = viewModel(for: bot)
        if vm.connectionState == .disconnected { vm.connect() }
    }

    func selectNode(_ node: BotNode) {
        selectedBotId = node.botId
        UserDefaults.standard.set(node.botId, forKey: selectedBotKey)
        let vm = viewModel(forNode: node)
        if vm.connectionState == .disconnected { vm.connect() }
    }

    func addBot(_ bot: BotConfig) {
        let node = BotNode(
            botId: bot.id,
            gatewayFingerprint: "manual",
            name: bot.name,
            emoji: bot.emoji,
            gatewayHost: bot.host,
            gatewayPort: bot.port,
            remoteURL: bot.remoteURL,
            connectionMode: bot.connectionMode,
            state: .paired
        )
        pairingStore.saveBotNode(node)
        if !bot.token.isEmpty {
            let token = PairingToken(
                botId: bot.id,
                gatewayFingerprint: "manual",
                token: bot.token,
                deviceId: DeviceIdentity.current.deviceId
            )
            pairingStore.saveToken(token)
        }
        reloadFromStore()
    }

    func addNode(_ node: BotNode, token: String? = nil) {
        pairingStore.saveBotNode(node)
        if let token = token, !token.isEmpty {
            let pt = PairingToken(
                botId: node.botId,
                gatewayFingerprint: node.gatewayFingerprint,
                token: token,
                deviceId: DeviceIdentity.current.deviceId
            )
            pairingStore.saveToken(pt)
        }
        reloadFromStore()
    }

    func removeBot(id: String) {
        chatViewModels[id]?.disconnect()
        chatViewModels.removeValue(forKey: id)
        // Find the node to get the full ID for removal
        if let node = botNodes.first(where: { $0.botId == id }) {
            pairingStore.removeBotNode(id: node.id)
            pairingStore.deleteToken(botId: node.botId, gatewayFingerprint: node.gatewayFingerprint)
        }
        if selectedBotId == id { selectedBotId = botNodes.first?.botId }
        reloadFromStore()
    }

    func updateBot(_ bot: BotConfig) {
        guard let node = botNodes.first(where: { $0.botId == bot.id }) else { return }
        let old = viewModel(for: BotConfig(botNode: node, token: tokenCache[node.id] ?? ""))
        if node.gatewayHost != bot.host || node.gatewayPort != bot.port
            || (tokenCache[node.id] ?? "") != bot.token
            || node.remoteURL != bot.remoteURL || node.connectionMode != bot.connectionMode {
            old.disconnect()
            chatViewModels.removeValue(forKey: bot.id)
        }
        var updated = node
        updated.name = bot.name
        updated.emoji = bot.emoji
        updated.gatewayHost = bot.host
        updated.gatewayPort = bot.port
        updated.remoteURL = bot.remoteURL
        updated.connectionMode = bot.connectionMode
        pairingStore.saveBotNode(updated)
        if !bot.token.isEmpty {
            let pt = PairingToken(
                botId: bot.id,
                gatewayFingerprint: node.gatewayFingerprint,
                token: bot.token,
                deviceId: DeviceIdentity.current.deviceId
            )
            pairingStore.saveToken(pt)
        }
        reloadFromStore()
    }

    // MARK: - Internal

    private func reloadFromStore() {
        botNodes = pairingStore.loadBotNodes()
        let allTokens = pairingStore.allTokens()
        tokenCache = [:]
        for t in allTokens {
            let nodeId = "\(t.gatewayFingerprint):\(t.botId)"
            tokenCache[nodeId] = t.token
        }
    }

    private func migrateIfNeeded() {
        guard !UserDefaults.standard.bool(forKey: "optaplus.v2.migrated") else { return }
        guard let data = UserDefaults.standard.data(forKey: legacyBotsKey),
              let legacy = try? JSONDecoder().decode([BotConfig].self, from: data) else {
            UserDefaults.standard.set(true, forKey: "optaplus.v2.migrated")
            return
        }
        _ = pairingStore.migrateFromBotConfigs(legacy, gatewayFingerprint: "legacy")
        UserDefaults.standard.set(true, forKey: "optaplus.v2.migrated")
    }

    private func addDefaultBots() {
        let defaults: [(String, String, Int, String, String, String)] = [
            ("Opta Max", "192.168.188.9", 18793, "8c081eb5c0769f34ec0fedde6e6ddd5f5299fb946b91b1ed", "🥷🏿", "wss://gateway.optamize.biz"),
            ("Mono", "192.168.188.11", 19001, "e5acead966cc3922795eaea658612d9c47e4b7fa87563729", "🟢", "wss://mono.optamize.biz"),
            ("Opta512", "192.168.188.11", 19000, "", "🟣", "wss://opta512.optamize.biz"),
            ("Floda", "192.168.188.11", 19002, "", "🧪", "wss://floda.optamize.biz"),
            ("Saturday", "192.168.188.11", 19003, "", "🔵", "wss://saturday.optamize.biz"),
            ("YJ", "192.168.188.11", 19005, "", "⚡", "wss://yj.optamize.biz"),
        ]
        for (name, host, port, token, emoji, remote) in defaults {
            let id = UUID().uuidString
            let node = BotNode(
                botId: id, gatewayFingerprint: "default",
                name: name, emoji: emoji,
                gatewayHost: host, gatewayPort: port,
                remoteURL: remote, state: .paired
            )
            pairingStore.saveBotNode(node)
            if !token.isEmpty {
                pairingStore.saveToken(PairingToken(
                    botId: id, gatewayFingerprint: "default",
                    token: token, deviceId: DeviceIdentity.current.deviceId
                ))
            }
        }
        reloadFromStore()
    }
}
```

**Step 4: Remove duplicate migration from app entry point**

In the same file, find the `OptaPlusIOSApp` struct. Remove the `.onAppear` migration block (lines ~137-142) since migration now happens in `AppState.init()`:

```swift
// REMOVE this block from .onAppear:
// if !UserDefaults.standard.bool(forKey: "optaplus.v2.migrated") {
//     let store = BotPairingStore()
//     _ = store.migrateFromBotConfigs(appState.bots, gatewayFingerprint: "legacy")
//     UserDefaults.standard.set(true, forKey: "optaplus.v2.migrated")
// }
```

Keep the `selectBot` call and `.onOpenURL` handler.

**Step 5: Build verification**

```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus
swift build --target OptaMolt 2>&1 | tail -5
```

Expected: `Build complete!`

Then build iOS:
```bash
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -5
```

Expected: `BUILD SUCCEEDED`

**Step 6: Run tests**

```bash
swift test --filter OptaMoltTests 2>&1 | tail -20
```

Expected: All pairing tests pass (Keychain tests may fail in test runner — that's expected).

**Step 7: Commit**

```bash
git add Shared/Sources/OptaMolt/Networking/BotPairing/BotNode.swift \
       Shared/Sources/OptaMolt/Networking/ChatViewModel.swift \
       iOS/OptaPlusIOS/OptaPlusIOSApp.swift
git commit -m "refactor(ios): unify AppState data layer — BotPairingStore as single source of truth"
```

---

## Task 2: Enhance BotConstellationNode with Live Activity State

**Goal:** Port the live activity indicators (thinking arc, typing pulse, idle glow) from `BotWebView`'s `BotBubbleView` into the Bot Map's `BotConstellationNode`, so the unified Map can show real-time bot activity.

**Files:**
- Modify: `iOS/OptaPlusIOS/Views/BotMapView.swift` (BotConstellationNode struct, ~line 380)

**Step 1: Read existing code**

Read `iOS/OptaPlusIOS/Views/BotMapView.swift` — find `BotConstellationNode` struct.
Read `iOS/OptaPlusIOS/Views/BotWebView.swift` — find `BotBubbleView` and `ThinkingArc`.

**Step 2: Add optional ChatViewModel to BotConstellationNode**

Update `BotConstellationNode` to accept an optional `ChatViewModel` for live state:

```swift
struct BotConstellationNode: View {
    let node: BotNode
    let isSelected: Bool
    let index: Int
    let appeared: Bool
    var viewModel: ChatViewModel? = nil  // ADD: optional live state

    private var isConnected: Bool {
        viewModel?.connectionState == .connected
    }

    private var glowColor: Color {
        // If we have a live viewModel, use its state for connected nodes
        if let vm = viewModel {
            switch vm.connectionState {
            case .connected: return .optaGreen
            case .connecting, .reconnecting: return .optaAmber
            case .disconnected: return node.state == .paired ? .optaPrimary : .optaRed
            }
        }
        // Fallback to BotNode state
        switch node.state {
        case .connected: return .optaGreen
        case .connecting, .pairing: return .optaAmber
        case .disconnected, .error: return .optaRed
        case .discovered, .paired: return .optaPrimary
        }
    }

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                // Outer glow
                Circle()
                    .fill(glowColor.opacity(isSelected ? 0.2 : 0.1))
                    .frame(width: 66, height: 66)

                // Glow ring
                Circle()
                    .stroke(glowColor.opacity(isSelected ? 0.6 : 0.3), lineWidth: isSelected ? 2 : 1)
                    .frame(width: 58, height: 58)

                // Thinking arc (replaces old connected breathing)
                if viewModel?.botState == .thinking {
                    ConstellationThinkingArc(color: glowColor)
                        .frame(width: 62, height: 62)
                }

                // Connected idle breathing
                if isConnected && viewModel?.botState == .idle {
                    Circle()
                        .fill(glowColor.opacity(0.15))
                        .frame(width: 58, height: 58)
                        .optaBreathing(minOpacity: 0.05, maxOpacity: 0.15)
                }

                // Typing pulse ring
                if viewModel?.botState == .typing {
                    Circle()
                        .stroke(glowColor.opacity(0.4), lineWidth: 1.5)
                        .frame(width: 66, height: 66)
                        .optaBreathing(minOpacity: 0.2, maxOpacity: 0.8, minScale: 0.95, maxScale: 1.1)
                }

                // Connecting amber pulse (from original)
                if node.state == .connecting && viewModel == nil {
                    Circle()
                        .fill(glowColor.opacity(0.15))
                        .frame(width: 58, height: 58)
                        .optaBreathing(minOpacity: 0.1, maxOpacity: 0.3, minScale: 0.95, maxScale: 1.1)
                }

                // Emoji
                Text(node.emoji)
                    .font(.system(size: 28))

                // Selection indicator
                if isSelected {
                    Circle()
                        .stroke(Color.optaPrimary, lineWidth: 2)
                        .frame(width: 66, height: 66)
                }
            }

            Text(node.name)
                .font(.sora(12, weight: .semibold))
                .foregroundColor(.optaTextPrimary)
                .lineLimit(1)

            // Status badge — use live state if available
            HStack(spacing: 3) {
                Circle()
                    .fill(glowColor)
                    .frame(width: 5, height: 5)

                Text(liveStatusLabel)
                    .font(.soraCaption)
                    .foregroundColor(.optaTextMuted)
            }
        }
        .scaleEffect(appeared ? 1.0 : 0.1)
        .opacity(appeared ? 1.0 : 0)
        .animation(.optaSpring.delay(0.15 + Double(index) * 0.08), value: appeared)
        .scaleEffect(isSelected ? 1.1 : 1.0)
        .animation(.optaSpring, value: isSelected)
    }

    private var liveStatusLabel: String {
        if let vm = viewModel {
            switch vm.botState {
            case .thinking: return "Thinking..."
            case .typing: return "Responding..."
            case .idle:
                return vm.connectionState == .connected ? "Connected" :
                       vm.connectionState == .connecting ? "Connecting..." : "Offline"
            }
        }
        return statusLabel
    }

    private var statusLabel: String {
        switch node.state {
        case .connected: return "Connected"
        case .connecting: return "Connecting"
        case .disconnected: return "Offline"
        case .discovered: return "Discovered"
        case .pairing: return "Pairing"
        case .paired: return "Paired"
        case .error: return "Error"
        }
    }
}
```

**Step 3: Add thinking arc component**

Add this struct after `BotConstellationNode` in the same file:

```swift
// MARK: - Constellation Thinking Arc

struct ConstellationThinkingArc: View {
    let color: Color
    @State private var rotation: Double = 0

    var body: some View {
        Circle()
            .trim(from: 0, to: 0.28)
            .stroke(
                AngularGradient(
                    gradient: Gradient(colors: [color.opacity(0), color]),
                    center: .center
                ),
                style: StrokeStyle(lineWidth: 2, lineCap: .round)
            )
            .rotationEffect(.degrees(rotation))
            .onAppear {
                withAnimation(.optaSpin) {
                    rotation = 360
                }
            }
    }
}
```

> **Critical:** Use `.optaSpin` (which is a repeating spring), NOT `.linear(duration:).repeatForever()`. If `.optaSpin` doesn't exist in the design system, use `.optaPulse` or create a repeating animation using spring physics. Check `Shared/Sources/OptaMolt/DesignSystem/Animations.swift` for available tokens.

**Step 4: Update constellation view to pass viewModels**

In the same file, find the `constellationView` property in `BotMapView`. Update the `BotConstellationNode` instantiation to pass the viewModel:

```swift
// In BotMapView.constellationView:
BotConstellationNode(
    node: node,
    isSelected: selectedBot?.id == node.id,
    index: index,
    appeared: appeared,
    viewModel: viewModelForNode(node)  // ADD THIS
)
```

Add this helper method to `BotMapView`:

```swift
@EnvironmentObject var appState: AppState  // ADD if not already present

private func viewModelForNode(_ node: BotNode) -> ChatViewModel? {
    // Only provide viewModel if we have this bot in AppState
    guard let bot = appState.bots.first(where: { $0.id == node.botId }) else { return nil }
    return appState.viewModel(for: bot)
}
```

**Step 5: Build and verify**

```bash
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -5
```

**Step 6: Commit**

```bash
git add iOS/OptaPlusIOS/Views/BotMapView.swift
git commit -m "feat(ios): add live activity state to Bot Map constellation nodes"
```

---

## Task 3: Merge Bot Web Features into Bot Map

**Goal:** Port the three unique features from `BotWebView` into `BotMapView`: (1) context menus on nodes, (2) "Open Chat" navigation, (3) connect/disconnect actions. After this task, Bot Map is a strict superset of Bot Web.

**Files:**
- Modify: `iOS/OptaPlusIOS/Views/BotMapView.swift`

**Step 1: Read existing code**

Read `iOS/OptaPlusIOS/Views/BotWebView.swift` — understand context menus in `BotBubbleView` (line 420-440).
Read `iOS/OptaPlusIOS/Views/BotMapView.swift` — find where constellation nodes are tapped (`.onTapGesture`).

**Step 2: Add navigation state and context menus**

In `BotMapView`, add a state variable for chat navigation:

```swift
@State private var navigateToBotId: String?
```

Update the bot node in `constellationView` to add a context menu:

```swift
BotConstellationNode(
    node: node,
    isSelected: selectedBot?.id == node.id,
    index: index,
    appeared: appeared,
    viewModel: viewModelForNode(node)
)
.position(position)
.onTapGesture {
    withAnimation(.optaSpring) {
        selectedBot = node
    }
}
.contextMenu {
    // Open Chat
    Button {
        if let bot = appState.bots.first(where: { $0.id == node.botId }) {
            appState.selectBot(bot)
            navigateToBotId = node.botId
        }
    } label: {
        Label("Open Chat", systemImage: "bubble.left.fill")
    }

    Divider()

    // Connect / Disconnect
    if let vm = viewModelForNode(node) {
        if vm.connectionState == .connected {
            Button {
                vm.disconnect()
            } label: {
                Label("Disconnect", systemImage: "bolt.slash")
            }
        } else {
            Button {
                vm.connect()
            } label: {
                Label("Connect", systemImage: "bolt.fill")
            }
        }
    }

    Divider()

    // Forget
    Button(role: .destructive) {
        store.removeBotNode(id: node.id)
        loadBots()
    } label: {
        Label("Forget Bot", systemImage: "trash")
    }
}
.accessibilityLabel("\(node.name), \(node.state.rawValue)")
.accessibilityHint("Tap to select, long press for options")
```

**Step 3: Add NavigationDestination for chat**

In the `NavigationStack` body (around line 30), add a `.navigationDestination`:

```swift
.navigationDestination(item: $navigateToBotId) { botId in
    if let bot = appState.bots.first(where: { $0.id == botId }) {
        let vm = appState.viewModel(for: bot)
        ChatView(viewModel: vm, botConfig: bot)
            .navigationTitle(bot.name)
    }
}
```

> **Note:** If `navigateToBotId` is a `String?`, you may need to make it `Identifiable`. Use a wrapper or use `$navigateToBotId` with `Binding<String?>` depending on what works. Alternatively, use `NavigationLink(value:)` pattern.

**Step 4: Add connect all / disconnect all to toolbar**

Update the toolbar in `BotMapView` to add a menu:

```swift
.toolbar {
    ToolbarItem(placement: .navigationBarLeading) {
        Menu {
            Button("Connect All") {
                for node in botNodes {
                    if let vm = viewModelForNode(node), vm.connectionState == .disconnected {
                        vm.connect()
                    }
                }
            }
            Button("Disconnect All") {
                for node in botNodes {
                    viewModelForNode(node)?.disconnect()
                }
            }
        } label: {
            Image(systemName: "ellipsis.circle")
                .foregroundColor(.optaTextSecondary)
        }
        .accessibilityLabel("Connection options")
    }

    ToolbarItem(placement: .navigationBarTrailing) {
        HStack(spacing: 16) {
            // QR code scanner button (existing)
            // Bonjour scan button (existing)
        }
    }
}
```

**Step 5: Build and verify**

```bash
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -5
```

**Step 6: Commit**

```bash
git add iOS/OptaPlusIOS/Views/BotMapView.swift
git commit -m "feat(ios): add context menus, chat navigation, and connect all to Bot Map"
```

---

## Task 4: Port Dashboard Activity Feed into Bot Map

**Goal:** Move the activity feed from `DashboardView` into `BotMapView` as a collapsible bottom section, so Dashboard can be removed.

**Files:**
- Modify: `iOS/OptaPlusIOS/Views/BotMapView.swift`

**Step 1: Read existing code**

Read `iOS/OptaPlusIOS/Views/DashboardView.swift` — find `ActivityFeedManager.shared`, `IOSActivityRow`, the activity section (lines 43-56).

**Step 2: Add activity feed to Bot Map**

In `BotMapView`, add the `ActivityFeedManager` observer and a collapsible activity feed overlay at the bottom of the ZStack:

```swift
// At the top of BotMapView, add:
@ObservedObject var activityFeed = ActivityFeedManager.shared
@State private var showActivityFeed = false

// In the body ZStack, after the constellation and radar overlay, add:
VStack {
    Spacer()

    // Activity feed toggle + content
    if !activityFeed.events.isEmpty {
        VStack(spacing: 0) {
            // Toggle bar
            Button {
                withAnimation(.optaSpring) {
                    showActivityFeed.toggle()
                }
            } label: {
                HStack {
                    Image(systemName: "bolt.fill")
                        .font(.sora(11, weight: .regular))
                        .foregroundColor(.optaPrimary)
                    Text("Activity")
                        .font(.sora(12, weight: .semibold))
                        .foregroundColor(.optaTextSecondary)
                    Spacer()
                    Text("\(activityFeed.events.count)")
                        .font(.sora(11, weight: .medium))
                        .foregroundColor(.optaTextMuted)
                    Image(systemName: showActivityFeed ? "chevron.down" : "chevron.up")
                        .font(.sora(10, weight: .regular))
                        .foregroundColor(.optaTextMuted)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }
            .buttonStyle(.plain)

            // Expandable event list
            if showActivityFeed {
                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(activityFeed.events.prefix(10)) { event in
                            IOSActivityRow(event: event)
                        }
                    }
                }
                .frame(maxHeight: 180)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(.ultraThinMaterial)
                .environment(\.colorScheme, .dark)
        )
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
    }
}
.animation(.optaSpring, value: showActivityFeed)
.animation(.optaSpring, value: activityFeed.events.count)
```

> **Note:** `IOSActivityRow` is defined in `DashboardView.swift`. We will NOT move it yet — it can stay there until Task 9 when we delete DashboardView and move surviving components.

**Step 3: Build and verify**

```bash
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add iOS/OptaPlusIOS/Views/BotMapView.swift
git commit -m "feat(ios): add collapsible activity feed to Bot Map"
```

---

## Task 5: Move Debug into Settings

**Goal:** Add a "Diagnostics" section to SettingsView with a NavigationLink to DebugView, so Debug can be removed as a tab.

**Files:**
- Modify: `iOS/OptaPlusIOS/Views/SettingsView.swift`

**Step 1: Read existing code**

Read `iOS/OptaPlusIOS/Views/SettingsView.swift` — find the "About" section (last section, ~line 234).

**Step 2: Add Diagnostics section before About**

Insert a new section between "Privacy & Security" and "About":

```swift
// Diagnostics — NavigationLink to full Debug view
Section {
    NavigationLink {
        DebugView()
            .environmentObject(appState)
    } label: {
        HStack {
            Label("Gateway Diagnostics", systemImage: "ant")
                .foregroundColor(.optaTextSecondary)
            Spacer()
            if let vm = appState.selectedViewModel, vm.connectionState == .connected {
                Circle()
                    .fill(Color.optaGreen)
                    .frame(width: 6, height: 6)
            }
        }
    }
    .listRowBackground(Color.optaSurface)

    NavigationLink {
        AboutView()
    } label: {
        Label("About OptaPlus", systemImage: "info.circle.fill")
            .foregroundColor(.optaPrimary)
    }
    .listRowBackground(Color.optaSurface)
} header: {
    Label("More", systemImage: "ellipsis.circle")
        .foregroundColor(.optaTextSecondary)
}
```

> **Note:** Remove the duplicate "About OptaPlus" NavigationLink from the old About section. Consolidate Version + Build info into the About section, or move them into this new "More" section.

**Step 3: Remove the Settings gear icon from Debug toolbar**

Read `iOS/OptaPlusIOS/Views/DebugView.swift`. Remove the settings toolbar button and sheet (lines 61-68, 85-88) since Debug is now accessed FROM Settings:

```swift
// REMOVE from DebugView toolbar:
// ToolbarItem(placement: .topBarLeading) {
//     Button { showSettings = true } ...
// }

// REMOVE from DebugView:
// @State private var showSettings = false
// .sheet(isPresented: $showSettings) { SettingsView() ... }
```

**Step 4: Build and verify**

```bash
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -5
```

**Step 5: Commit**

```bash
git add iOS/OptaPlusIOS/Views/SettingsView.swift iOS/OptaPlusIOS/Views/DebugView.swift
git commit -m "refactor(ios): move Debug into Settings as Diagnostics subsection"
```

---

## Task 6: Consolidate ContentView to 4 Tabs

**Goal:** Remove Dashboard, Bot Web, and Debug tabs. Add Settings as a tab. Result: Map, Chat, Automations, Settings.

**Files:**
- Modify: `iOS/OptaPlusIOS/ContentView.swift`

**Step 1: Read existing code**

Read `iOS/OptaPlusIOS/ContentView.swift` — the full file.

**Step 2: Rewrite ContentView**

Replace the entire `ContentView` body with the 4-tab layout:

```swift
struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTab: Tab = .map
    @AppStorage("optaplus.onboardingDone") private var onboardingDone = false

    enum Tab: String {
        case map, chat, automations, settings
    }

    var body: some View {
        if !onboardingDone && appState.botNodes.isEmpty {
            OnboardingView()
                .environmentObject(appState)
        } else {
            TabView(selection: $selectedTab) {
                BotMapView()
                    .environmentObject(appState)
                    .tabItem {
                        Label("Map", systemImage: selectedTab == .map ? "circle.hexagongrid.fill" : "circle.hexagongrid")
                    }
                    .tag(Tab.map)

                ChatPagerTab()
                    .environmentObject(appState)
                    .tabItem {
                        Label("Chat", systemImage: selectedTab == .chat ? "bubble.left.and.bubble.right.fill" : "bubble.left.and.bubble.right")
                    }
                    .tag(Tab.chat)

                AutomationsPagerTab()
                    .environmentObject(appState)
                    .tabItem {
                        Label("Automations", systemImage: selectedTab == .automations ? "bolt.circle.fill" : "bolt.circle")
                    }
                    .tag(Tab.automations)

                SettingsView()
                    .environmentObject(appState)
                    .tabItem {
                        Label("Settings", systemImage: selectedTab == .settings ? "gearshape.fill" : "gearshape")
                    }
                    .tag(Tab.settings)
            }
            .tint(.optaPrimary)
        }
    }
}
```

**Step 3: Remove settings sheet from ChatPagerTab**

In the same file, find `ChatPagerTab`. Remove the settings button and sheet since Settings is now a tab:

```swift
struct ChatPagerTab: View {
    @EnvironmentObject var appState: AppState
    @State private var showBotConfig = false
    @State private var showHistory = false

    var body: some View {
        NavigationStack {
            BotPagerView { bot in
                let vm = appState.viewModel(for: bot)
                VStack(spacing: 0) {
                    BotPageHeader(bot: bot, viewModel: vm)
                    ChatView(viewModel: vm, botConfig: bot)
                }
            }
            .navigationTitle("Chat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 14) {
                        Button {
                            showHistory = true
                        } label: {
                            Image(systemName: "clock.arrow.circlepath")
                                .foregroundColor(.optaTextSecondary)
                        }
                        .accessibilityLabel("Chat history")
                        Button {
                            showBotConfig = true
                        } label: {
                            Image(systemName: "slider.horizontal.3")
                                .foregroundColor(.optaTextSecondary)
                        }
                        .accessibilityLabel("Bot configuration")
                    }
                }
            }
            .sheet(isPresented: $showBotConfig) {
                if let bot = appState.selectedBot {
                    BotManagementSheet(viewModel: appState.viewModel(for: bot))
                }
            }
            .sheet(isPresented: $showHistory) {
                ChatHistoryView()
                    .environmentObject(appState)
            }
        }
    }
}
```

**Step 4: Update SettingsView to work as tab (not modal)**

Read `iOS/OptaPlusIOS/Views/SettingsView.swift`. If it has a "Done" dismiss button in the toolbar, make it conditional — only show when presented as a sheet:

```swift
// In SettingsView, replace the dismiss toolbar item:
@Environment(\.dismiss) private var dismiss
@Environment(\.isPresented) private var isPresented  // NOTE: may not exist

// Simpler approach: check if dismiss action works
// If SettingsView is now both a tab AND sometimes a sheet,
// wrap the toolbar dismiss button in a check:
// Actually, when shown as a tab, there's no dismiss context.
// The .toolbar with .confirmationAction won't show if not in a sheet.
// So just leave it — SwiftUI handles this automatically.
```

> **Note:** SwiftUI's `.confirmationAction` placement only appears in modal contexts. When SettingsView is a tab, the "Done" button won't show. If it does appear incorrectly, wrap it in an `if` check.

**Step 5: Build and verify**

```bash
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -5
```

**Step 6: Commit**

```bash
git add iOS/OptaPlusIOS/ContentView.swift iOS/OptaPlusIOS/Views/SettingsView.swift
git commit -m "refactor(ios): consolidate to 4 tabs — Map, Chat, Automations, Settings"
```

---

## Task 7: Update Settings Bot Management for BotNode

**Goal:** `BotEditSheet` now creates/updates `BotNode` + `PairingToken` through `AppState`'s new methods, rather than constructing raw `BotConfig` objects.

**Files:**
- Modify: `iOS/OptaPlusIOS/Views/SettingsView.swift` (BotEditSheet, ~line 307)

**Step 1: Read existing code**

Read `iOS/OptaPlusIOS/Views/SettingsView.swift` — find `BotEditSheet` struct.

**Step 2: Update BotEditSheet save handler**

The `BotEditSheet` currently constructs a `BotConfig` and calls `onSave(config)`. Since `AppState.addBot()` and `AppState.updateBot()` now internally route through `BotPairingStore`, the `BotEditSheet` code **may not need changes** — the same `BotConfig` creation and `onSave` callback will work because `AppState.addBot` converts to `BotNode` internally.

Verify by reading `AppState.addBot()` from Task 1 — it accepts `BotConfig` and converts. If this is correct, no changes needed in BotEditSheet.

However, update the **Settings bot list** to show `botNodes` instead of `bots` for better data:

```swift
// In SettingsView, Section "Bots":
ForEach(appState.bots) { bot in
    // This still works — bots is computed from botNodes
    // No change needed
}
```

**Step 3: Build and verify**

```bash
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -5
```

**Step 4: Commit (if changes were made)**

```bash
git add iOS/OptaPlusIOS/Views/SettingsView.swift
git commit -m "refactor(ios): settings bot management uses unified data layer"
```

---

## Task 8: Fix Onboarding Manual Entry

**Goal:** Onboarding's manual bot entry creates a `BotNode` + `PairingToken` through `AppState` instead of constructing raw `BotConfig`.

**Files:**
- Modify: `iOS/OptaPlusIOS/Views/OnboardingView.swift` (addManualBot function, ~line 591)

**Step 1: Read existing code**

Read `iOS/OptaPlusIOS/Views/OnboardingView.swift` — find `addManualBot()`.

**Step 2: Update addManualBot()**

The current code creates a `BotConfig` and calls `appState.addBot()`. Since `AppState.addBot(BotConfig)` now routes through `BotPairingStore` (from Task 1), this **should already work without changes**.

Verify by checking that `AppState.addBot(_ bot: BotConfig)` still exists and converts internally.

If it does, no code changes needed — just verify the build.

However, if you want to make onboarding use the native BotNode path:

```swift
private func addManualBot() {
    let port = Int(botPort) ?? 18793
    let node = BotNode(
        botId: UUID().uuidString,
        gatewayFingerprint: "manual",
        name: botName,
        emoji: "🤖",
        gatewayHost: botHost,
        gatewayPort: port,
        state: .paired
    )
    appState.addNode(node, token: botToken.isEmpty ? nil : botToken)
    appState.selectNode(node)
    // Reset fields
    botName = ""
    botHost = ""
    botPort = "18793"
    botToken = ""
}
```

**Step 3: Also update the onboarding condition**

In `ContentView` (Task 6), the onboarding gate checks `appState.botNodes.isEmpty`. In `OnboardingView`, the `@AppStorage("optaplus.onboardingDone")` flag controls this. Verify both paths work:
- Fresh install: `botNodes` is empty AND `onboardingDone` is false → shows onboarding
- After onboarding completes: `onboardingDone` is true → skips onboarding

**Step 4: Build and verify**

```bash
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -5
```

**Step 5: Commit**

```bash
git add iOS/OptaPlusIOS/Views/OnboardingView.swift
git commit -m "refactor(ios): onboarding manual entry uses unified data layer"
```

---

## Task 9: Delete Dead Code and Relocate Survivors

**Goal:** Remove `BotWebView.swift`, relocate `IOSActivityRow` and `StreamingDots` from `DashboardView.swift` to surviving files, then delete `DashboardView.swift` and `AutomationsView.swift`.

**Files:**
- Delete: `iOS/OptaPlusIOS/Views/BotWebView.swift`
- Delete: `iOS/OptaPlusIOS/Views/AutomationsView.swift`
- Modify: `iOS/OptaPlusIOS/Views/DashboardView.swift` → extract survivors, then delete
- Modify: `iOS/OptaPlusIOS/Views/BotMapView.swift` (add relocated components)
- Modify: `iOS/OptaPlusIOS.xcodeproj/project.pbxproj` (remove deleted files)

**Step 1: Check what components from DashboardView are still used**

Read `iOS/OptaPlusIOS/Views/DashboardView.swift`. Identify components referenced from outside:

- `IOSActivityRow` — used by Bot Map's activity feed (Task 4)
- `StreamingDots` — used by `IOSBotCardView`. If `IOSBotCardView` is no longer used (Dashboard is deleted), `StreamingDots` can be deleted too.
- `IOSBotCardView` — only used by DashboardView. Can be deleted.
- `ActivityFeedManager` — check if it's defined here or in Shared package.

Search for `IOSActivityRow` usage:
```bash
grep -r "IOSActivityRow" iOS/ --include="*.swift"
```

Search for `StreamingDots` usage:
```bash
grep -r "StreamingDots" iOS/ --include="*.swift"
```

Search for `ActivityFeedManager` definition:
```bash
grep -r "class ActivityFeedManager" . --include="*.swift"
```

**Step 2: Relocate IOSActivityRow**

If `IOSActivityRow` is used in `BotMapView.swift` (from Task 4), move the struct from `DashboardView.swift` to `BotMapView.swift`.

Copy the `IOSActivityRow` struct (~15 lines) and paste it at the bottom of `BotMapView.swift`.

**Step 3: Delete dead files**

```bash
rm iOS/OptaPlusIOS/Views/BotWebView.swift
rm iOS/OptaPlusIOS/Views/AutomationsView.swift
rm iOS/OptaPlusIOS/Views/DashboardView.swift
```

**Step 4: Update project.pbxproj**

Read `iOS/OptaPlusIOS.xcodeproj/project.pbxproj`. Find and remove all references to:
- `BotWebView.swift`
- `DashboardView.swift`
- `AutomationsView.swift`

Remove from: PBXBuildFile, PBXFileReference, PBXGroup (Views group), and PBXSourcesBuildPhase sections.

> **Tip:** Search for the filename (e.g., `BotWebView.swift`) in the pbxproj file. Each file typically has 3-4 entries (file reference, build file, group membership, build phase). Remove all of them.

**Step 5: Verify no dangling references**

```bash
grep -r "BotWebView\|DashboardView\|AutomationsView" iOS/OptaPlusIOS/ --include="*.swift" -l
```

If any file still references these deleted views, update it. `ContentView.swift` should already be clean from Task 6.

**Step 6: Build and verify**

```bash
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -5
```

**Step 7: Commit**

```bash
git add -A iOS/OptaPlusIOS/
git commit -m "refactor(ios): delete BotWebView, DashboardView, AutomationsView — absorbed into Map + Settings"
```

---

## Task 10: Fix Animation Violations

**Goal:** Replace all remaining `.linear(duration:)` and `.easeInOut` animations with spring physics tokens, ensuring A04 compliance.

**Files:**
- Modify: any iOS view files with violations

**Step 1: Find all violations**

Search for non-spring animations in the iOS codebase:

```bash
grep -rn "\.linear\|\.easeIn\|\.easeOut\|duration:" iOS/OptaPlusIOS/ --include="*.swift"
```

Also check the shared package views:
```bash
grep -rn "\.linear\|\.easeIn\|\.easeOut\|duration:" Shared/Sources/OptaMolt/ --include="*.swift"
```

**Step 2: Fix each violation**

Common replacements:
- `.linear(duration: X).repeatForever(autoreverses: false)` → `.optaSpin` or `.optaPulse`
- `.linear(duration: X).repeatForever(autoreverses: true)` → `.optaPulse`
- `.easeInOut(duration: X)` → `.optaSpring`
- `.easeIn(duration: X)` → `.optaSnap`
- Any `withAnimation(.linear(...))` → `withAnimation(.optaSpring)`

> **Reference:** Read `Shared/Sources/OptaMolt/DesignSystem/Animations.swift` to see all available animation tokens.

**Step 3: Build and verify**

```bash
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add -A iOS/ Shared/
git commit -m "fix(ios): replace all duration-based animations with spring physics (A04)"
```

---

## Task 11: Integration Build and Smoke Test

**Goal:** Verify everything builds and the test suite passes on both platforms.

**Files:** None (verification only)

**Step 1: Build shared package**

```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus
swift build --target OptaMolt 2>&1 | tail -5
```

Expected: `Build complete!`

**Step 2: Build iOS for simulator**

```bash
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -5
```

Expected: `BUILD SUCCEEDED`

**Step 3: Build macOS**

```bash
xcodebuild -project macOS/OptaPlusMacOS.xcodeproj -scheme OptaPlusMacOS build 2>&1 | tail -5
```

Expected: `BUILD SUCCEEDED` (macOS should be unaffected by iOS-only changes)

**Step 4: Run test suite**

```bash
swift test --filter OptaMoltTests 2>&1 | tail -30
```

Expected: All tests pass except Keychain tests (expected failure in test runner).

**Step 5: Build iOS for physical device**

```bash
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=YES build 2>&1 | tail -5
```

Expected: `BUILD SUCCEEDED`

**Step 6: Verify tab count**

Open the iOS simulator and visually confirm:
- 4 tabs: Map, Chat, Automations, Settings
- Map tab shows constellation + activity feed
- Settings tab has Diagnostics link
- No Dashboard, Web, or Debug tabs

**Step 7: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "chore(ios): integration build verification — 4-tab layout confirmed"
```

---

## Summary: Execution Order

| Task | Description | Depends On | Estimated Lines Changed |
|------|-------------|-----------|------------------------|
| 1 | Unify AppState data layer | — | ~180 |
| 2 | Live activity state in constellation | 1 | ~80 |
| 3 | Merge Bot Web features into Bot Map | 1, 2 | ~60 |
| 4 | Activity feed in Bot Map | 1 | ~50 |
| 5 | Debug → Settings subsection | — | ~30 |
| 6 | Consolidate to 4 tabs | 3, 4, 5 | ~40 |
| 7 | Settings bot management | 1 | ~10 (verify only) |
| 8 | Onboarding manual entry | 1 | ~15 |
| 9 | Delete dead code | 6 | -800 (net deletion) |
| 10 | Fix animation violations | 9 | ~20 |
| 11 | Integration build | 10 | 0 |

**Parallelizable tasks:** Tasks 2+5 can run in parallel (no shared files). Tasks 7+8 can run in parallel.

**Critical path:** 1 → 2 → 3 → 6 → 9 → 10 → 11

**Net effect:** ~6 files deleted, ~300 lines added, ~1100 lines removed = **~800 lines net reduction**.
