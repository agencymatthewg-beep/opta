---
parent: APP.md
scope: iOS
identity: Quick Draw
platforms: [iOS 17+]
version: 0.9.0
updated: 2026-02-15
---

# OptaPlus iOS — PLATFORM.md

> **Platform identity:** Quick Draw. Telegram replacement. Siri Shortcuts (App Intents), Widgets (WidgetKit), Live Activities, haptic feedback, thumb-zone layout, swipe navigation. Quick bot switching (no multi-window). v1.0 bar = complete Telegram replacement.

---

## 1. iOS Identity

| Aspect | Definition |
|--------|-----------|
| **Name** | OptaPlus: Quick Draw |
| **Role** | Mobile-first Telegram replacement for bot communication |
| **Input Model** | Touch-first + voice |
| **Layout** | Single-focus, swipe navigation, thumb zones |
| **Feature Ratio** | Baseline (100%) — iOS defines feature parity |
| **Target Users** | All OpenClaw users, friends testing Telegram replacement |
| **v1.0 Bar** | Complete Telegram replacement (chat, bots, cron, notifications) |

---

## 2. Feature Set (iOS-Exclusive + Shared)

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
- ✅ Push notifications (APNs)

### iOS Exclusive

1. **Siri Shortcuts (App Intents)**
   - "Ask Opta to [command]" — natural voice commands
   - "Send to [bot]: [message]" — quick message
   - "Create cron job: [name] at [time]" — automation
   - "Check [bot] status" — status query
   - App Intents defined in `iOS/OptaPlusIOS/AppIntents/`
   - Siri learns custom phrases from user's bots

2. **Widgets (WidgetKit)**
   - **Lock Screen Widget** — Bot status dot (1-4 favorite bots)
   - **Home Screen Widget** — Bot quick access (2x2, 2x4 sizes)
   - **Dynamic Island** — Message notification badge
   - Update frequency: 5 minutes (+ real-time via push)
   - Tap to open app, jump to bot

3. **Live Activities (ActivityKit)**
   - **Task Progress** — Cron job or spawned task
     - Task name, progress bar, time remaining
     - Shows on lock screen + Dynamic Island
     - Update every 5-10 seconds via push
   - **Bot Status** — Current bot is active, typing indicator
   - **Message Streaming** — Long message generation in progress

4. **Haptic Feedback (UIImpactFeedbackGenerator)**
   - Light impact: Message sent
   - Medium impact: Bot status change
   - Heavy impact: Error / reconnection failed
   - Selection haptic: Reaction added
   - Notification haptic: Important event (cron complete, error)

5. **Thumb-Zone Optimized Layout**
   - Message input at bottom (thumb-friendly)
   - Tab bar in reachable area (bottom 5 tabs)
   - Scrollable content centered vertically
   - Top bar minimal (collapse on scroll)
   - Swipe from left edge: bot list drawer
   - Swipe from right edge: message actions

6. **Swipe Navigation**
   - Swipe left on message: quick reactions
   - Swipe right on message: reply-to
   - Swipe down on chat: refresh + pull-to-clear
   - Swipe from left edge: bot drawer
   - Swipe from right edge: session/context panel

7. **Quick Bot Switching (No Multi-Window)**
   - Side drawer: all bots (swipe left to open)
   - Bottom tabs: 5 favorite bots
   - Long-press tab: reorder favorites
   - Tap bot: open chat, smooth transition
   - Pinch to zoom: multi-bot view (future)

8. **Smart Notifications**
   - Per-bot notification control
   - Smart grouping: last 3 messages from bot in one notification
   - Inline reply from notification
   - Thread-based conversation in lock screen
   - Custom notification sound per bot

---

## 3. Code Paths (Reference Existing iOS Implementation)

### App Entry Point
- **File:** `iOS/OptaPlusIOS/OptaPlusIOSApp.swift`
- **Responsibility:** App lifecycle, environment setup, push registration

### Core Views
| Component | File | Purpose |
|-----------|------|---------|
| Main Pager | `iOS/OptaPlusIOS/Views/BotPagerView.swift` | Swipeable bot pages |
| Chat View | `iOS/OptaPlusIOS/Views/ChatView.swift` | Per-bot conversation |
| Bot List Drawer | `iOS/OptaPlusIOS/Views/BotListView.swift` | Side drawer, all bots |
| Dashboard | `iOS/OptaPlusIOS/Views/DashboardView.swift` | Simplified summary |
| Settings | `iOS/OptaPlusIOS/Views/SettingsView.swift` | Preferences, connections |
| Message Bubble | `iOS/OptaPlusIOS/Views/MessageBubble.swift` | Reusable message cell |
| Input Bar | `iOS/OptaPlusIOS/Views/ChatInputBar.swift` | Message input + send |
| Debug View | `iOS/OptaPlusIOS/Views/DebugView.swift` | Connection diagnostics |

### Supporting Components
| Component | File | Purpose |
|-----------|------|---------|
| Thinking Overlay | `iOS/OptaPlusIOS/Views/ThinkingOverlay.swift` | Streaming thinking display |
| Page Header | `iOS/OptaPlusIOS/Views/BotPageHeader.swift` | Bot name, status dot, menu |
| Automation Page | `iOS/OptaPlusIOS/Views/BotAutomationsPage.swift` | Cron job list per bot |
| Job Creation | `iOS/OptaPlusIOS/Views/CreateJobSheet.swift` | Add/edit cron job modal |
| Job History | `iOS/OptaPlusIOS/Views/JobHistorySheet.swift` | Cron execution log |
| About | `iOS/OptaPlusIOS/Views/AboutView.swift` | App info, credits |

### Shared Code (OptaMolt Package)
- **Networking:** `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift` (WebSocket)
- **Chat:** `Shared/Sources/OptaMolt/Chat/MessageModel.swift`, `MarkdownContent.swift`
- **Design:** `Shared/Sources/OptaMolt/DesignSystem/*.swift`
- **Storage:** `Shared/Sources/OptaMolt/Storage/MessageStore.swift`
- **Sync:** `Shared/Sources/OptaMolt/Sync/CloudKitCoordinator.swift`

### iOS-Only Code
- **App Intents:** `iOS/OptaPlusIOS/AppIntents/`
  - `AskBotIntent.swift` — Main Siri entry
  - `SendMessageIntent.swift` — Quick send
  - `CheckStatusIntent.swift` — Bot status
  - `CreateCronIntent.swift` — Schedule automation
- **Widgets:** `iOS/OptaPlusIOS/Widgets/`
  - `BotWidgetBundle.swift` — Widget family definitions
  - `BotStatusWidget.swift` — Lock screen + home screen
  - `BotActionsWidget.swift` — Quick actions
- **Live Activities:** `iOS/OptaPlusIOS/LiveActivities/`
  - `TaskProgressActivity.swift` — Cron job progress
  - `BotStatusActivity.swift` — Active bot indicator

---

## 4. Navigation Architecture

### NavigationStack (Pure SwiftUI, iOS 16+)
```swift
@main
struct OptaPlusIOSApp: App {
    @StateObject var appState = AppState.shared
    
    var body: some Scene {
        WindowGroup {
            NavigationStack(path: $appState.navigationPath) {
                TabView(selection: $appState.selectedTabIndex) {
                    // Tab 1: Chat (active bot)
                    ChatTabView()
                        .tabItem {
                            Label("Chat", systemImage: "bubble.right")
                        }
                        .tag(0)
                    
                    // Tab 2: Dashboard
                    DashboardTabView()
                        .tabItem {
                            Label("Bots", systemImage: "square.grid.2x2")
                        }
                        .tag(1)
                    
                    // Tab 3: Automations
                    AutomationTabView()
                        .tabItem {
                            Label("Jobs", systemImage: "clock.badge.checkmark")
                        }
                        .tag(2)
                    
                    // Tab 4: Search
                    SearchTabView()
                        .tabItem {
                            Label("Search", systemImage: "magnifyingglass")
                        }
                        .tag(3)
                    
                    // Tab 5: Settings
                    SettingsTabView()
                        .tabItem {
                            Label("Settings", systemImage: "gear")
                        }
                        .tag(4)
                }
                .navigationDestination(for: Navigation.Destination.self) { dest in
                    dest.view
                }
            }
            .environmentObject(appState)
        }
    }
}
```

---

## 5. Bot Switching & Pager

### Swipe-Based Bot Navigation
```swift
struct ChatTabView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        ZStack {
            // Pager view for bot scrolling
            TabView(selection: $appState.selectedBotId) {
                ForEach(appState.bots) { bot in
                    ChatView(bot: bot)
                        .tag(bot.id)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            
            // Header (top, collapses on scroll)
            VStack {
                BotPageHeader(bot: appState.selectedBot)
                Spacer()
            }
            
            // Drawer (swipe from left)
            HStack(spacing: 0) {
                BotDrawerView()
                    .frame(maxWidth: 280)
                Spacer()
            }
        }
    }
}

// Bot drawer (all bots, favorite marker)
struct BotDrawerView: View {
    @EnvironmentObject var appState: AppState
    @State var showEditor = false
    
    var body: some View {
        VStack(alignment: .leading) {
            HStack {
                Text("Bots")
                    .font(.title2)
                    .fontWeight(.bold)
                Spacer()
                Button(action: { showEditor = true }) {
                    Image(systemName: "plus.circle")
                }
            }
            .padding()
            
            List(appState.bots) { bot in
                BotDrawerItem(bot: bot)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        appState.selectBot(bot)
                    }
            }
            .listStyle(.plain)
            
            Spacer()
        }
        .background(Color.optaSurface)
        .sheet(isPresented: $showEditor) {
            AddBotSheet()
        }
    }
}
```

---

## 6. Siri Shortcuts (App Intents)

### Main Siri Intent
```swift
// File: iOS/OptaPlusIOS/AppIntents/AskBotIntent.swift
import AppIntents

struct AskBotIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask Bot"
    static var description: LocalizedStringResource = "Ask a specific bot to do something"
    
    @Parameter(title: "Bot Name")
    var botName: String
    
    @Parameter(title: "Message")
    var message: String
    
    @Parameter(title: "Wait for Response")
    var waitForResponse: Bool = true
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        // Find bot by name
        guard let bot = AppState.shared.bots.first(where: { $0.name.lowercased() == botName.lowercased() }) else {
            throw BotNotFoundError(botName)
        }
        
        // Send message
        let response = try await AppState.shared.client.send(message, to: bot)
        
        if waitForResponse {
            let result = try await AppState.shared.client.waitForResponse(timeout: 60)
            return .result(value: result)
        } else {
            return .result(value: "Message sent to \(bot.name)")
        }
    }
}

// Suggested shortcuts (Siri learns from user behavior)
struct BotAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AskBotIntent(),
            phrases: ParameterizedVoicePhrase(
                "Ask <bot_name:botName> <command:message>"
            )
        )
    }
}
```

### Quick Send Intent
```swift
struct SendMessageIntent: AppIntent {
    static var title: LocalizedStringResource = "Send Message"
    
    @Parameter(title: "Bot", optionsProvider: BotOptionsProvider())
    var botId: UUID
    
    @Parameter(title: "Message")
    var message: String
    
    func perform() async throws -> some IntentResult {
        let bot = AppState.shared.bots.first { $0.id == botId }!
        try await AppState.shared.client.send(message, to: bot)
        return .result()
    }
}
```

---

## 7. Widgets (WidgetKit)

### Lock Screen Widget
```swift
// File: iOS/OptaPlusIOS/Widgets/BotStatusWidget.swift
import WidgetKit
import SwiftUI

struct BotStatusWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> BotStatusEntry {
        let bots = AppState.shared.favoriteBots.prefix(4)
        return BotStatusEntry(date: Date(), bots: Array(bots), isPlaceholder: true)
    }
    
    func getSnapshot(in context: Context, completion: @escaping (BotStatusEntry) -> ()) {
        let bots = AppState.shared.favoriteBots.prefix(4)
        let entry = BotStatusEntry(date: Date(), bots: Array(bots))
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<BotStatusEntry>) -> ()) {
        var entries: [BotStatusEntry] = []
        
        // Refresh every 5 minutes
        let currentDate = Date()
        for offset in 0..<12 {  // 1 hour of data
            let entryDate = Calendar.current.date(byAdding: .minute, value: offset * 5, to: currentDate)!
            let bots = AppState.shared.favoriteBots.prefix(4)
            entries.append(BotStatusEntry(date: entryDate, bots: Array(bots)))
        }
        
        let timeline = Timeline(entries: entries, policy: .atEnd)
        completion(timeline)
    }
}

struct BotStatusEntry: TimelineEntry {
    let date: Date
    let bots: [Bot]
    let isPlaceholder: Bool = false
}

struct BotStatusWidgetView: View {
    var entry: BotStatusEntry
    
    var body: some View {
        // Lock screen widget (circular, small)
        HStack(spacing: 6) {
            ForEach(entry.bots.prefix(4)) { bot in
                Circle()
                    .fill(bot.isConnected ? .green : .red)
                    .frame(width: 10, height: 10)
            }
        }
        .padding(8)
    }
}

@main
struct BotStatusWidget: Widget {
    let kind: String = "com.optaplus.bot-status"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: BotStatusWidgetProvider()
        ) { entry in
            BotStatusWidgetView(entry: entry)
        }
        .supportedFamilies([.accessoryCircular, .systemSmall])
        .configurationDisplayName("Bot Status")
        .description("Shows status of your favorite bots")
    }
}
```

### Home Screen Widget
```swift
struct BotActionsWidgetView: View {
    var entry: BotStatusEntry
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("OptaPlus")
                .font(.headline)
            
            VStack(alignment: .leading, spacing: 4) {
                ForEach(entry.bots.prefix(3)) { bot in
                    HStack {
                        Circle()
                            .fill(bot.isConnected ? .green : .red)
                            .frame(width: 8, height: 8)
                        Text(bot.name)
                            .font(.caption)
                        Spacer()
                        Text(bot.lastMessage ?? "—")
                            .font(.caption2)
                            .lineLimit(1)
                    }
                    .tap {
                        openApp(bot: bot)
                    }
                }
            }
        }
        .padding()
        .background(Color.optaSurface)
    }
}

@main
struct BotActionsWidget: Widget {
    let kind: String = "com.optaplus.bot-actions"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: BotStatusWidgetProvider()
        ) { entry in
            BotActionsWidgetView(entry: entry)
        }
        .supportedFamilies([.systemSmall, .systemMedium])
        .configurationDisplayName("Bot Quick Access")
        .description("Quick access to favorite bots")
    }
}
```

---

## 8. Live Activities (ActivityKit)

### Task Progress Live Activity
```swift
// File: iOS/OptaPlusIOS/LiveActivities/TaskProgressActivity.swift
import ActivityKit
import WidgetKit

struct TaskProgressActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var taskName: String
        var progress: Double  // 0.0 to 1.0
        var status: String    // "running", "completed", "failed"
        var timeRemaining: Int  // seconds
        var botName: String
    }
    
    var taskId: String
    var botId: UUID
}

struct TaskProgressLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TaskProgressActivityAttributes.self) { context in
            // Lock screen appearance
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(context.attributes.taskId)
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
                    Spacer()
                    if context.state.status == "running" {
                        Text("\(context.state.timeRemaining)s")
                            .font(.caption2)
                    }
                }
            }
            .padding(12)
            .background(Color.optaSurface)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.botName)
                        .font(.caption)
                        .fontWeight(.semibold)
                }
                
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.timeRemaining)s")
                        .font(.caption)
                }
                
                DynamicIslandExpandedRegion(.bottom) {
                    ProgressView(value: context.state.progress)
                }
            } compactLeading: {
                Image(systemName: "clock.badge.checkmark")
            } compactTrailing: {
                Text("\(Int(context.state.progress * 100))%")
                    .font(.caption2)
                    .fontWeight(.semibold)
            } minimal: {
                Image(systemName: "clock")
            }
        }
    }
}
```

### Start Live Activity
```swift
// In ChatView, when task starts
func startTaskActivity(task: CronJob) {
    let attributes = TaskProgressActivityAttributes(taskId: task.id, botId: selectedBot.id)
    let initialContent = TaskProgressActivityAttributes.ContentState(
        taskName: task.name ?? "Untitled",
        progress: 0.0,
        status: "running",
        timeRemaining: task.estimatedDuration ?? 60,
        botName: selectedBot.name
    )
    
    do {
        let activity = try Activity<TaskProgressActivityAttributes>.request(
            attributes: attributes,
            contentState: initialContent,
            pushType: .token
        )
    } catch {
        print("Failed to start activity: \(error)")
    }
}
```

---

## 9. Haptic Feedback

### Pattern
```swift
import UIKit

// Message sent
UIImpactFeedbackGenerator(style: .light).impactOccurred()

// Bot status change
UIImpactFeedbackGenerator(style: .medium).impactOccurred()

// Error
UIImpactFeedbackGenerator(style: .heavy).impactOccurred()

// Reaction added
UISelectionFeedbackGenerator().selectionChanged()

// Notification
UNUserNotificationCenter.current().requestAuthorization(options: [.sound, .badge, .alert])
```

### Usage in Views
```swift
Button(action: {
    sendMessage()
    UIImpactFeedbackGenerator(style: .light).impactOccurred()
}) {
    Image(systemName: "arrow.up.circle.fill")
}
```

---

## 10. Thumb-Zone Layout

### Safe Zones for iOS
```
┌─────────────────────────┐
│  ⓘ  Bot Name    ≡       │  ← Top bar (minimize on scroll)
├─────────────────────────┤
│                         │
│                         │
│     Chat Messages       │
│     (scrollable)        │
│                         │
│                         │
├─────────────────────────┤
│  😊 😀 🎉 🔔 ⋮          │  ← Quick reactions (swipe left)
│  ┌─────────────────────┐│
│  │ Type message... ▸ 🎤││  ← Input area (always at bottom)
│  └─────────────────────┘│
├─┬─────────┬─────────┬──┤  ← Tab bar (5 tabs, bottom)
│░│Chat    │Dashboard│░░│
└─┴─────────┴─────────┴──┘

Swipe left edge → Bot drawer (bots list)
Swipe right edge → Message actions (reply, forward, copy)
```

### Bottom Tab Implementation
```swift
TabView(selection: $appState.selectedTab) {
    // Chat, Dashboard, Jobs, Search, Settings
}
.frame(height: 50)  // Reachable from thumb
```

---

## 11. Smart Notifications

### Local Notifications (Non-APNs)
```swift
// New message from bot
func notifyNewMessage(_ message: ChatMessage, from bot: Bot) {
    let content = UNMutableNotificationContent()
    content.title = bot.name
    content.body = message.content.prefix(100)
    content.sound = .default
    content.badge = NSNumber(value: UIApplication.shared.applicationIconBadgeNumber + 1)
    content.userInfo = ["botId": bot.id.uuidString, "messageId": message.id]
    
    // Custom notification sound per bot
    if let customSound = bot.notificationSettings.customSound {
        content.sound = UNNotificationSound(named: UNNotificationSoundName(customSound))
    }
    
    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
    let request = UNNotificationRequest(identifier: message.id, content: content, trigger: trigger)
    
    UNUserNotificationCenter.current().add(request)
}

// Smart grouping (last 3 messages)
func notifyGroupedMessages(from bot: Bot) {
    let lastMessages = bot.messages.suffix(3)
    let content = UNMutableNotificationContent()
    content.title = bot.name
    content.body = "3 new messages"
    content.badge = NSNumber(value: lastMessages.count)
    
    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)
    let request = UNNotificationRequest(identifier: "grouped-\(bot.id)", content: content, trigger: trigger)
    
    UNUserNotificationCenter.current().add(request)
}
```

---

## 12. Performance Targets

| Metric | Target |
|--------|--------|
| App launch | <2s (cold start) |
| Bot switch (swipe) | <300ms |
| Message send → echo | <1s |
| Scroll smoothness | 60fps (constant) |
| Memory usage | <250MB |
| Battery: 30 min active use | <10% drain |
| Widget refresh | <5 min latency |
| Siri response | <2s |

---

## 13. Testing Checklist

- [ ] Chat works on iPhone 14, 15, 16 (landscape + portrait)
- [ ] Bot drawer swipe is smooth, no stutter
- [ ] Siri "Ask Opta" works correctly
- [ ] Widget shows correct bot status
- [ ] Live Activity updates during cron job
- [ ] Haptic feedback on message send
- [ ] Push notifications arrive within 2s
- [ ] iCloud sync to macOS within 30s
- [ ] Search works on 1000+ messages
- [ ] App restores to previous bot after relaunch

---

## 14. Read Next

- **CLAUDE.md** — iOS-specific coding rules for Claude Code
- **SHARED.md** — Cross-platform data models and design tokens
- **APP.md** — Overall product vision
- **docs/GUARDRAILS.md** — Safety and zero-dependency rules

