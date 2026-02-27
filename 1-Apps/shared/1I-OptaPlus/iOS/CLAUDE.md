---
parent: PLATFORM.md
scope: iOS coding rules
platform: iOS 17+
language: Swift 5.9+
ui_framework: SwiftUI (pure, no UIKit)
version: 0.9.0
updated: 2026-02-15
---

# OptaPlus iOS — CLAUDE.md

> Coding rules for Claude Code working on OptaPlus iOS. Pure SwiftUI, NavigationStack, App Intents for Siri, WidgetKit for home screen, ActivityKit for live activities, zero external dependencies.

---

## 1. Non-Negotiable Rules

### Language & Frameworks
- **Language:** Swift 5.9+
- **UI Framework:** SwiftUI ONLY (pure)
- **NO UIKit wrappers** — No `UIViewController`, `UIView`, `UINavigationController`
- **NO AppKit imports** — iOS is separate from macOS
- **NO external dependencies** — Zero pods, zero SPM packages (except Foundation)
- **Platform:** iOS 17+ (minimum)

### Project Structure
```
iOS/OptaPlusIOS/
├── OptaPlusIOSApp.swift            # App entry point
├── Views/
│   ├── ChatView.swift              # Per-bot chat
│   ├── BotPagerView.swift          # Swipeable pages
│   ├── BotListView.swift           # Side drawer
│   ├── DashboardView.swift         # Summary grid
│   ├── SettingsView.swift          # Preferences
│   ├── MessageBubble.swift         # Message cell
│   ├── ChatInputBar.swift          # Input area
│   ├── BotPageHeader.swift         # Bot name + status
│   ├── ThinkingOverlay.swift       # Thinking display
│   ├── BotAutomationsPage.swift    # Cron job list
│   ├── CreateJobSheet.swift        # Job creation
│   ├── JobHistorySheet.swift       # Execution log
│   ├── AboutView.swift             # App info
│   ├── DebugView.swift             # Diagnostics
│   └── SearchView.swift            # Message search
├── AppIntents/
│   ├── AskBotIntent.swift          # Siri entry
│   ├── SendMessageIntent.swift     # Quick send
│   ├── CheckStatusIntent.swift     # Status query
│   └── CreateCronIntent.swift      # Schedule automation
├── Widgets/
│   ├── BotStatusWidget.swift       # Lock screen + home
│   └── BotActionsWidget.swift      # Quick actions
├── LiveActivities/
│   ├── TaskProgressActivity.swift  # Cron progress
│   └── BotStatusActivity.swift     # Status indicator
├── Managers/
│   ├── PushNotificationManager.swift
│   ├── HapticManager.swift
│   └── WidgetDataManager.swift
└── Models/
    └── AppState.swift             # Shared state
```

**Reference existing code:** Check `iOS/OptaPlusIOS/*.swift` for patterns.

---

## 2. Navigation & State Management

### Single Source of Truth (AppState)
```swift
// File: iOS/OptaPlusIOS/Models/AppState.swift
@MainActor
class AppState: ObservableObject {
    static let shared = AppState()
    
    @Published var bots: [Bot] = []
    @Published var selectedBotId: UUID?
    @Published var messages: [ChatMessage: [ChatMessage]] = [:]  // botId → messages
    @Published var isConnected = false
    @Published var selectedTabIndex = 0
    @Published var navigationPath = NavigationPath()
    
    @Published var showDebugPanel = false
    @Published var showSettingsSheet = false
    @Published var showBotDrawer = false
    
    var selectedBot: Bot? { bots.first { $0.id == selectedBotId } }
    var selectedBotMessages: [ChatMessage] {
        guard let botId = selectedBotId else { return [] }
        return messages[botId] ?? []
    }
    
    func selectBot(_ bot: Bot) {
        selectedBotId = bot.id
    }
    
    func addMessage(_ msg: ChatMessage, to botId: UUID) {
        if messages[botId] == nil {
            messages[botId] = []
        }
        messages[botId]?.append(msg)
    }
}
```

### NavigationStack (iOS 16+)
```swift
@main
struct OptaPlusIOSApp: App {
    @StateObject var appState = AppState.shared
    
    var body: some Scene {
        WindowGroup {
            NavigationStack(path: $appState.navigationPath) {
                ContentView()
                    .navigationDestination(for: Navigation.Destination.self) { dest in
                        dest.view
                    }
            }
            .environmentObject(appState)
        }
    }
}

enum Navigation: Hashable {
    case botSettings(UUID)
    case jobDetails(String)
    case messageSearch
    case export(format: String)
    
    @ViewBuilder
    var view: some View {
        switch self {
        case .botSettings(let botId):
            BotSettingsView(botId: botId)
        case .jobDetails(let jobId):
            JobDetailsView(jobId: jobId)
        case .messageSearch:
            SearchView()
        case .export(let format):
            ExportView(format: format)
        }
    }
}
```

---

## 3. TabView & Pager Navigation

### Tab-Based Navigation
```swift
struct ContentView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        ZStack {
            TabView(selection: $appState.selectedTabIndex) {
                // Tab 0: Chat
                Group {
                    if let bot = appState.selectedBot {
                        ChatTabView(bot: bot)
                    } else {
                        EmptyBotSelectionView()
                    }
                }
                .tag(0)
                .tabItem {
                    Label("Chat", systemImage: "bubble.right.fill")
                }
                
                // Tab 1: Dashboard
                DashboardTabView()
                    .tag(1)
                    .tabItem {
                        Label("Bots", systemImage: "square.grid.2x2")
                    }
                
                // Tab 2: Automation
                AutomationTabView()
                    .tag(2)
                    .tabItem {
                        Label("Jobs", systemImage: "clock.badge.checkmark")
                    }
                
                // Tab 3: Search
                SearchTabView()
                    .tag(3)
                    .tabItem {
                        Label("Search", systemImage: "magnifyingglass")
                    }
                
                // Tab 4: Settings
                SettingsTabView()
                    .tag(4)
                    .tabItem {
                        Label("Settings", systemImage: "gear")
                    }
            }
            
            // Floating bot drawer (swipe from left)
            HStack(spacing: 0) {
                if appState.showBotDrawer {
                    BotDrawer()
                        .frame(maxWidth: 280)
                        .transition(.move(edge: .leading))
                }
                Spacer()
            }
        }
    }
}

// Swipe gesture to open drawer
.gesture(
    DragGesture()
        .onEnded { value in
            if value.translation.width > 100 {
                withAnimation(.optaSnap) {
                    appState.showBotDrawer = true
                }
            }
        }
)
```

### Bot Pager (Swipe Between Bots)
```swift
struct ChatTabView: View {
    @EnvironmentObject var appState: AppState
    @State var currentPage = 0
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            BotPageHeader(bot: appState.selectedBot)
            
            // Pager
            TabView(selection: $appState.selectedBotId) {
                ForEach(appState.bots) { bot in
                    ChatView(bot: bot)
                        .tag(bot.id)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
    }
}
```

---

## 4. App Intents (Siri Integration)

### Main Siri Entry Point
```swift
// File: iOS/OptaPlusIOS/AppIntents/AskBotIntent.swift
import AppIntents

struct AskBotIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask Bot"
    static var description: LocalizedStringResource = "Ask a specific bot to do something"
    static var isDiscoverable: Bool = true
    
    @Parameter(title: "Bot Name")
    var botName: String
    
    @Parameter(title: "Message")
    var message: String
    
    @Parameter(title: "Wait for Response", default: false)
    var waitForResponse: Bool
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        // Find bot
        guard let bot = AppState.shared.bots.first(where: { bot in
            bot.name.lowercased().contains(botName.lowercased())
        }) else {
            throw BotNotFoundError(botName: botName)
        }
        
        // Send message
        try await AppState.shared.client.send(message, to: bot)
        
        if waitForResponse {
            // Wait for bot response (max 30s)
            let response = try await AppState.shared.client.waitForResponse(timeout: 30)
            return .result(value: response.content)
        } else {
            return .result(value: "Message sent to \(bot.name)")
        }
    }
}

// Suggested shortcuts (appears in Siri suggestions)
struct SiriShortcuts: AppShortcutsProvider {
    static var allAppShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AskBotIntent(),
            phrases: ParameterizedVoicePhrase(
                "Ask <bot_name:botName> to <message:message>",
                "Tell <bot_name:botName> <message:message>"
            ),
            shortTitle: "Ask Bot"
        )
    }
}
```

### Quick Send Intent
```swift
struct SendMessageIntent: AppIntent {
    static var title: LocalizedStringResource = "Send Message"
    
    @Parameter(
        title: "Bot",
        optionsProvider: BotOptionsProvider(),
        requestValueDialog: IntentDialog("Which bot?")
    )
    var botId: UUID
    
    @Parameter(title: "Message")
    var message: String
    
    func perform() async throws -> some IntentResult {
        guard let bot = AppState.shared.bots.first(where: { $0.id == botId }) else {
            throw BotNotFoundError(botName: "Unknown bot")
        }
        
        try await AppState.shared.client.send(message, to: bot)
        
        // Haptic feedback
        HapticManager.shared.sendLight()
        
        return .result()
    }
}

struct BotOptionsProvider: DynamicOptionsProvider {
    func results() async throws -> ItemCollection<UUID> {
        ItemCollection(
            AppState.shared.bots.map { bot in
                Item(String(describing: bot.name), value: bot.id)
            }
        )
    }
}
```

---

## 5. Widgets (WidgetKit)

### App Intent Configuration
```swift
// File: iOS/OptaPlusIOS/Widgets/BotStatusWidget.swift
import WidgetKit
import SwiftUI

struct BotStatusWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> BotStatusEntry {
        BotStatusEntry(
            date: Date(),
            bots: AppState.shared.favoriteBots.prefix(4) |> Array.init,
            isPlaceholder: true
        )
    }
    
    func getSnapshot(in context: Context, completion: @escaping (BotStatusEntry) -> ()) {
        let bots = AppState.shared.favoriteBots.prefix(4) |> Array.init
        completion(BotStatusEntry(date: Date(), bots: bots))
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<BotStatusEntry>) -> ()) {
        var entries: [BotStatusEntry] = []
        let now = Date()
        
        // Generate timeline for 1 hour (12 x 5-min intervals)
        for i in 0..<12 {
            let entryDate = Calendar.current.date(byAdding: .minute, value: i * 5, to: now)!
            let bots = AppState.shared.favoriteBots.prefix(4) |> Array.init
            entries.append(BotStatusEntry(date: entryDate, bots: bots))
        }
        
        let timeline = Timeline(entries: entries, policy: .atEnd)
        completion(timeline)
    }
}

struct BotStatusEntry: TimelineEntry {
    let date: Date
    let bots: [Bot]
}

// Lock screen widget (circular)
struct LockScreenBotView: View {
    let entry: BotStatusEntry
    
    var body: some View {
        HStack(spacing: 4) {
            ForEach(entry.bots.prefix(4)) { bot in
                Circle()
                    .fill(bot.isConnected ? Color.green : Color.red)
                    .frame(width: 8, height: 8)
            }
        }
        .widgetLabel("Bots")
    }
}

// Home screen widget (small)
struct HomeScreenBotView: View {
    let entry: BotStatusEntry
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("OptaPlus")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(alignment: .leading, spacing: 3) {
                ForEach(entry.bots.prefix(3)) { bot in
                    HStack(spacing: 4) {
                        Circle()
                            .fill(bot.isConnected ? Color.green : Color.red)
                            .frame(width: 6, height: 6)
                        Text(bot.name)
                            .font(.caption)
                            .lineLimit(1)
                        Spacer()
                    }
                }
            }
        }
        .padding(10)
    }
}

@main
struct BotStatusWidgetBundle: WidgetBundle {
    var body: some Widget {
        // Lock screen widget
        if #available(iOS 17, *) {
            BotStatusWidget()
        }
        
        // Home screen widget
        HomeScreenBotWidget()
    }
}

struct BotStatusWidget: Widget {
    let kind: String = "com.optaplus.bot-status"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: BotStatusWidgetProvider()
        ) { entry in
            LockScreenBotView(entry: entry)
        }
        .supportedFamilies([.accessoryCircular])
        .configurationDisplayName("Bot Status")
        .description("Monitor bot status")
    }
}

struct HomeScreenBotWidget: Widget {
    let kind: String = "com.optaplus.home-bot"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: BotStatusWidgetProvider()
        ) { entry in
            HomeScreenBotView(entry: entry)
        }
        .supportedFamilies([.systemSmall])
    }
}
```

---

## 6. Live Activities (ActivityKit)

### Task Progress Activity
```swift
// File: iOS/OptaPlusIOS/LiveActivities/TaskProgressActivity.swift
import ActivityKit

struct TaskProgressActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var taskName: String
        var progress: Double        // 0.0-1.0
        var status: String          // "running", "completed", "failed"
        var timeRemaining: Int?     // seconds
        var botName: String
    }
    
    var taskId: String
    var botId: UUID
}

struct TaskProgressLiveActivityView: View {
    let context: ActivityViewContext<TaskProgressActivityAttributes>
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(context.state.taskName)
                    .font(.caption)
                    .fontWeight(.semibold)
                Spacer()
                Text(context.state.botName)
                    .font(.caption2)
                    .foregroundColor(.gray)
            }
            
            ProgressView(value: context.state.progress)
                .tint(.optaPrimary)
            
            HStack {
                Text(context.state.status)
                    .font(.caption2)
                    .textCase(.uppercase)
                Spacer()
                if let timeRemaining = context.state.timeRemaining {
                    Text("\(timeRemaining)s")
                        .font(.caption2)
                        .fontWeight(.semibold)
                }
            }
        }
        .padding(12)
        .activityBackground {
            Color.optaSurface
        }
    }
}

@main
struct TaskProgressActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TaskProgressActivityAttributes.self) { context in
            TaskProgressLiveActivityView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.botName)
                        .font(.caption)
                        .fontWeight(.semibold)
                }
                
                DynamicIslandExpandedRegion(.bottom) {
                    ProgressView(value: context.state.progress)
                        .tint(.optaPrimary)
                }
            } compactLeading: {
                Image(systemName: "clock")
            } compactTrailing: {
                Text("\(Int(context.state.progress * 100))%")
                    .font(.caption2)
            } minimal: {
                Image(systemName: "clock")
            }
        }
    }
}

// Start activity when cron job begins
func startTaskActivity(job: CronJob, bot: Bot) async {
    let attributes = TaskProgressActivityAttributes(taskId: job.id, botId: bot.id)
    let contentState = TaskProgressActivityAttributes.ContentState(
        taskName: job.name ?? "Untitled",
        progress: 0.0,
        status: "running",
        timeRemaining: 60,
        botName: bot.name
    )
    
    do {
        try await Activity<TaskProgressActivityAttributes>.request(
            attributes: attributes,
            contentState: contentState,
            pushType: .token
        )
    } catch {
        print("Failed to start activity: \(error)")
    }
}
```

---

## 7. Haptic Feedback

### HapticManager
```swift
// File: iOS/OptaPlusIOS/Managers/HapticManager.swift
import UIKit

class HapticManager {
    static let shared = HapticManager()
    
    func sendLight() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
    
    func sendMedium() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }
    
    func sendHeavy() {
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
    }
    
    func sendSelection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }
    
    func sendNotification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        UINotificationFeedbackGenerator().notificationOccurred(type)
    }
}

// Usage
Button(action: {
    sendMessage()
    HapticManager.shared.sendLight()
}) {
    Image(systemName: "arrow.up.circle.fill")
}
```

---

## 8. Push Notifications

### PushNotificationManager
```swift
// File: iOS/OptaPlusIOS/Managers/PushNotificationManager.swift
import UserNotifications

@MainActor
class PushNotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushNotificationManager()
    
    func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        
        do {
            return try await center.requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            print("Notification auth error: \(error)")
            return false
        }
    }
    
    func notifyNewMessage(_ message: ChatMessage, from bot: Bot) {
        let content = UNMutableNotificationContent()
        content.title = bot.name
        content.body = message.content.prefix(100) |> String.init
        content.sound = .default
        content.badge = NSNumber(value: UIApplication.shared.applicationIconBadgeNumber + 1)
        content.userInfo = ["botId": bot.id.uuidString, "messageId": message.id]
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: trigger
        )
        
        UNUserNotificationCenter.current().add(request)
    }
    
    // Handle notification tap
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        if let botId = userInfo["botId"] as? String {
            Task { @MainActor in
                AppState.shared.selectBot(UUID(uuidString: botId)!)
                AppState.shared.selectedTabIndex = 0
            }
        }
        completionHandler()
    }
}

// Request on app launch
.onAppear {
    Task {
        let granted = await PushNotificationManager.shared.requestAuthorization()
        if granted {
            DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
    }
}
```

---

## 9. Networking (WebSocket)

### Rule: Use NWConnection, NOT URLSession
```swift
// File: Shared/Sources/OptaMolt/Networking/OpenClawClient.swift
// (Same as macOS, shared in OptaMolt package)

class OpenClawClient {
    let bot: Bot
    var connection: NWConnection?
    
    func connect() async throws {
        let host = NWEndpoint.Host(bot.host)
        let port = NWEndpoint.Port(rawValue: UInt16(bot.port)) ?? 8000
        
        let params = NWParameters.tcp
        connection = NWConnection(host: host, port: port, using: params)
        
        return try await withCheckedThrowingContinuation { continuation in
            connection?.stateUpdateHandler = { state in
                if case .ready = state {
                    continuation.resume()
                } else if case .failed(let error) = state {
                    continuation.resume(throwing: error)
                }
            }
            connection?.start(queue: .global())
        }
    }
}
```

---

## 10. Data Persistence

### UserDefaults + CloudKit
```swift
// Save bot list to UserDefaults (fast, local)
func cacheBots() {
    let encoded = try! JSONEncoder().encode(AppState.shared.bots)
    UserDefaults.standard.set(encoded, forKey: "bots")
}

// Sync to CloudKit (background, iCloud)
func syncToCloudKit() {
    for bot in AppState.shared.bots {
        CloudKitCoordinator.shared.save(bot)
    }
}

// Load on app launch
func loadBots() {
    if let data = UserDefaults.standard.data(forKey: "bots") {
        if let bots = try? JSONDecoder().decode([Bot].self, from: data) {
            AppState.shared.bots = bots
        }
    }
    
    // Fetch from CloudKit in background
    Task {
        let freshBots = try await CloudKitCoordinator.shared.fetch([Bot].self)
        await MainActor.run {
            AppState.shared.bots = freshBots
        }
    }
}
```

---

## 11. Gestures & Interactions

### Swipe Handling
```swift
// Swipe to open bot drawer
.gesture(
    DragGesture()
        .onEnded { value in
            if value.translation.width > 100 {
                withAnimation(.optaSnap) {
                    appState.showBotDrawer = true
                }
            }
        }
)

// Swipe on message for quick reactions
.gesture(
    DragGesture()
        .onEnded { value in
            if value.translation.width < -80 {
                showQuickReactions = true
            }
        }
)

// Long-press for context menu
.contextMenu {
    Button("Reply", action: { replyTo(message) })
    Button("Forward", action: { forward(message) })
    Button("Copy", action: { UIPasteboard.general.string = message.content })
}
```

---

## 12. Testing Strategy

### SwiftUI Previews
```swift
#Preview {
    ChatView(bot: .mock)
        .environmentObject(AppState.shared)
}

#Preview("iPhone 16 Pro Max") {
    ChatView(bot: .mock)
        .environmentObject(AppState.shared)
        .previewDevice("iPhone 16 Pro Max")
}
```

### Unit Tests
```swift
@Test
func testBotModel() {
    let bot = Bot(id: UUID(), name: "Test", host: "localhost", port: 8000, token: "test")
    XCTAssertEqual(bot.name, "Test")
}

@Test
func testAppState() {
    let state = AppState()
    let bot = Bot.mock
    state.selectBot(bot)
    XCTAssertEqual(state.selectedBotId, bot.id)
}
```

---

## 13. Performance Checklist

- [ ] App launches in <2 seconds
- [ ] Tab switch is smooth (no stutter)
- [ ] Scroll through 1000+ messages at 60fps
- [ ] Memory usage <250MB
- [ ] Battery: 30 min of active use = <10% drain
- [ ] Widget updates within 5 minutes
- [ ] Siri response <2 seconds
- [ ] iCloud sync <30 seconds to macOS

---

## 14. Accessibility

```swift
// All buttons must have labels
Button(action: { sendMessage() }) {
    Image(systemName: "arrow.up.circle.fill")
}
.accessibilityLabel("Send message")

// Dynamic Type support
Text("Hello")
    .font(.headline)  // Automatically scales with system setting
```

---

## 15. Code Review Checklist

Before merging:
- [ ] No external dependencies
- [ ] No UIKit imports (except for haptic/notification)
- [ ] All views use SwiftUI only
- [ ] App Intents documented
- [ ] Widget tested on lock screen + home screen
- [ ] Live Activity updates correctly
- [ ] Haptic feedback added to key interactions
- [ ] Memory usage acceptable
- [ ] No hardcoded colors (use design tokens)
- [ ] CloudKit sync works end-to-end

---

## 16. Reference

- **PLATFORM.md** — iOS features, Siri, Widgets, haptics
- **SHARED.md** — Data models, networking, design tokens
- **Existing code:** `iOS/OptaPlusIOS/Views/*.swift`
- **App Intents:** `iOS/OptaPlusIOS/AppIntents/*.swift`
- **Widgets:** `iOS/OptaPlusIOS/Widgets/*.swift`

