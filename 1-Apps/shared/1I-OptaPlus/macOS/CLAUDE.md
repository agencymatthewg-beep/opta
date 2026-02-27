---
parent: PLATFORM.md
scope: macOS coding rules
platform: macOS 14+
language: Swift 5.9+
ui_framework: SwiftUI (pure, no AppKit)
version: 0.9.0
updated: 2026-02-15
---

# OptaPlus macOS — CLAUDE.md

> Coding rules for Claude Code working on OptaPlus macOS. Pure SwiftUI, multi-window via WindowGroup, keyboard-first navigation, spring physics only, zero external dependencies.

---

## 1. Non-Negotiable Rules

### Language & Frameworks
- **Language:** Swift 5.9+
- **UI Framework:** SwiftUI ONLY (pure)
- **NO AppKit wrappers** — No `NSView`, `NSViewController`, `NSWindow` in SwiftUI code
- **NO UIKit or AppKit imports** — Except when absolutely necessary (NotificationCenter, pasteboard)
- **NO external dependencies** — Zero pods, zero SPM packages, zero build artifacts
- **Platform:** macOS 14+ (Sonoma minimum)

### Project Structure
```
macOS/OptaPlusMacOS/
├── OptaPlusMacOSApp.swift          # App entry point
├── ChatView.swift                  # Main chat window
├── DashboardView.swift             # Bot status grid
├── CommandPalette.swift            # ⌘K fuzzy search
├── ContextPanel.swift              # Left sidebar
├── ThinkingOverlay.swift           # Right panel
├── KeyboardShortcuts.swift         # Keyboard handler
├── MenuBarManager.swift            # Top menu integration
├── BotProfileSheet.swift           # Config editor
├── SessionViews.swift              # Session management
├── DebugView.swift                 # WebSocket inspector
├── SettingsViews.swift             # Preferences
├── NotificationManager.swift       # Local notifications
├── ChatTextInput.swift             # Message input
└── SoundManager.swift              # Audio playback
```

**Reference existing code:** Check actual Swift files in `macOS/OptaPlusMacOS/` for patterns.

---

## 2. Multi-Window Management

### WindowGroup Pattern (Pure SwiftUI)
```swift
@main
struct OptaPlusMacOSApp: App {
    @StateObject var appState = AppState.shared
    
    var body: some Scene {
        // Main window group for chat windows
        WindowGroup("OptaPlus", id: "main") {
            ContentView()
        }
        .defaultSize(width: 1000, height: 700)
        
        // Dashboard window (singleton)
        Window("Dashboard", id: "dashboard") {
            DashboardView()
        }
        
        // Settings window (singleton)
        Window("Settings", id: "settings") {
            SettingsView()
        }
        
        // Per-bot chat windows (dynamic)
        ForEach(appState.bots) { bot in
            Window(bot.name, id: "chat-\(bot.id)") {
                ChatView(bot: bot)
                    .environmentObject(appState)
            }
        }
    }
}
```

### Opening New Windows
```swift
// From any view, open new chat window
@Environment(\.openWindow) var openWindow

Button("New Chat") {
    openWindow(id: "chat-\(selectedBot.id)")
}
```

### Window State Persistence
```swift
// Save/restore window layout on app restart
struct WindowState: Codable {
    let botId: UUID
    let frame: CGRect
    let isPinned: Bool
    let scrollPosition: CGFloat
}

// Save to ~/Library/Application Support/OptaPlus/windows.json
// Load on app launch in AppState.init()
```

---

## 3. Keyboard Shortcuts

### Global Keyboard Handler
```swift
// File: KeyboardShortcuts.swift
import SwiftUI

class KeyboardHandler: NSObject {
    static let shared = KeyboardHandler()
    var appState: AppState?
    
    func registerShortcuts() {
        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            self.handleKeyDown(event)
            return event
        }
    }
    
    func handleKeyDown(_ event: NSEvent) {
        let modifiers = event.modifierFlags
        let key = event.characters ?? ""
        
        // ⌘N → New window
        if modifiers.contains(.command) && key == "n" {
            openNewWindow()
            return
        }
        
        // ⌘1-6 → Switch to bot
        if modifiers.contains(.command) && "123456".contains(key) {
            switchToBot(number: Int(String(key)) ?? 0)
            return
        }
        
        // ⌘K → Command palette
        if modifiers.contains(.command) && key == "k" {
            showCommandPalette()
            return
        }
        
        // ⌘[ / ⌘] → Toggle panels
        if modifiers.contains(.command) && key == "[" {
            toggleLeftPanel()
            return
        }
        if modifiers.contains(.command) && key == "]" {
            toggleRightPanel()
            return
        }
        
        // ⌘Enter → Send message
        if modifiers.contains(.command) && event.keyCode == 36 { // Return
            sendCurrentMessage()
            return
        }
    }
}
```

### View-Level Keyboard Shortcuts
```swift
// In ChatView.swift
.keyboardShortcut("r", modifiers: [.command, .option]) {
    restartBot()
}
.keyboardShortcut(",", modifiers: .command) {
    showSettings()
}
.keyboardShortcut("d", modifiers: [.command, .option]) {
    showDebugPanel()
}
```

---

## 4. Command Palette (⌘K)

### Pattern
```swift
// File: CommandPalette.swift
struct CommandPalette: View {
    @State var query = ""
    @State var results: [Command] = []
    @State var selectedIndex = 0
    
    @FocusState var isFocused: Bool
    
    var filteredCommands: [Command] {
        let all = CommandLibrary.all
        if query.isEmpty { return Array(all.prefix(20)) }
        return all.filter { cmd in
            fuzzMatch(query, cmd.name + " " + cmd.description)
        }.sorted { a, b in
            matchScore(query, a.name) > matchScore(query, b.name)
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Search input
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.optaTextSecondary)
                
                TextField("Search commands...", text: $query)
                    .textFieldStyle(.plain)
                    .font(.system(.body, design: .default))
                    .focused($isFocused)
                
                if !query.isEmpty {
                    Button(action: { query = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.optaTextSecondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(12)
            .background(Color.optaSurface)
            .overlay(Divider(), alignment: .bottom)
            
            // Results list
            List(filteredCommands.indices, id: \.self) { index in
                CommandRow(
                    command: filteredCommands[index],
                    isSelected: index == selectedIndex,
                    action: { executeCommand(filteredCommands[index]) }
                )
            }
            .listStyle(.plain)
        }
        .frame(width: 500, height: 400)
        .onAppear { isFocused = true }
        .onKeyPress { key in
            handleKey(key)
        }
    }
    
    func handleKey(_ key: KeyEquivalent) {
        switch key {
        case .upArrow:
            selectedIndex = max(0, selectedIndex - 1)
        case .downArrow:
            selectedIndex = min(filteredCommands.count - 1, selectedIndex + 1)
        case .return:
            if !filteredCommands.isEmpty {
                executeCommand(filteredCommands[selectedIndex])
            }
        case .escape:
            closeCommandPalette()
        default:
            break
        }
    }
    
    func executeCommand(_ cmd: Command) {
        cmd.execute()
        closeCommandPalette()
    }
}

// Command library
struct CommandLibrary {
    static let all: [Command] = [
        Command(name: "Restart bot", description: "Restart current bot", action: restartBot),
        Command(name: "Edit config", description: "Edit bot configuration", action: editConfig),
        Command(name: "Show dashboard", description: "Open dashboard view", action: showDashboard),
        // ... 50+ commands
    ]
}
```

---

## 5. Panel Management (⌘[ / ⌘])

### Left Panel (Context) & Right Panel (Thinking)
```swift
struct ChatView: View {
    @State var showLeftPanel = true
    @State var showRightPanel = true
    @State var leftPanelWidth: CGFloat = 300
    @State var rightPanelWidth: CGFloat = 300
    
    var body: some View {
        HStack(spacing: 0) {
            // Left panel (context)
            if showLeftPanel {
                ContextPanel(bot: bot)
                    .frame(width: leftPanelWidth)
                    .background(Color.optaSurface)
                    .overlay(alignment: .trailing) {
                        Divider()
                            .frame(width: 1)
                    }
                    .onContinuousHover { phase in
                        // Allow panel resize
                    }
            }
            
            // Main chat content
            VStack {
                ChatMessagesView(messages: bot.messages)
                ChatTextInput(bot: bot)
            }
            .frame(maxWidth: .infinity)
            
            // Right panel (thinking)
            if showRightPanel {
                ThinkingOverlay(bot: bot)
                    .frame(width: rightPanelWidth)
                    .background(Color.optaSurface)
                    .overlay(alignment: .leading) {
                        Divider()
                            .frame(width: 1)
                    }
            }
        }
        .keyboardShortcut("[", modifiers: .command) {
            withAnimation(.optaSnap) {
                showLeftPanel.toggle()
            }
        }
        .keyboardShortcut("]", modifiers: .command) {
            withAnimation(.optaSnap) {
                showRightPanel.toggle()
            }
        }
    }
}
```

---

## 6. Animation & Motion (Spring Physics Only)

### Rule: NEVER use duration-based animations
```swift
// ✅ CORRECT: Spring physics
withAnimation(.spring(response: 0.55, damping: 0.78)) {
    state.toggle()
}

// ❌ WRONG: Never use this
withAnimation(.easeInOut(duration: 0.3)) {
    state.toggle()
}

// ✅ Define motion tokens
extension Animation {
    static let optaSpring = Animation.spring(response: 0.55, damping: 0.78)
    static let optaSnap = Animation.spring(response: 0.35, damping: 0.85)
    static let optaGentle = Animation.spring(response: 0.8, damping: 0.72)
}
```

### Particle Effects (Ambient)
```swift
// Background particles - available in both regular and reduced motion
struct ParticleBackground: View {
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    
    var body: some View {
        ZStack {
            Color.optaVoid.ignoresSafeArea()
            
            if !reduceMotion {
                Canvas { context, size in
                    // Draw 20-30 animated particles (sine wave motion)
                    for i in 0..<20 {
                        // Particles move smoothly, continuously
                    }
                }
                .ignoresSafeArea()
                .opacity(0.1)  // Subtle
            }
        }
    }
}
```

---

## 7. Menu Bar Integration

### Status Indicator
```swift
// File: MenuBarManager.swift
import SwiftUI

class MenuBarManager: NSObject {
    static let shared = MenuBarManager()
    var statusItem: NSStatusItem?
    
    func setupMenuBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: 30)
        
        if let button = statusItem?.button {
            button.image = NSImage(systemSymbolName: "circle.fill", accessibilityDescription: nil)
            button.action = #selector(toggleDashboard)
            
            let menu = NSMenu()
            menu.addItem(NSMenuItem(title: "Dashboard", action: #selector(showDashboard), keyEquivalent: "d"))
            menu.addItem(NSMenuItem(title: "New Window", action: #selector(newWindow), keyEquivalent: "n"))
            menu.addItem(NSMenuItem.separator())
            menu.addItem(NSMenuItem(title: "Settings", action: #selector(showSettings), keyEquivalent: ","))
            menu.addItem(NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
            
            statusItem?.menu = menu
        }
    }
    
    @objc func toggleDashboard() {
        // Toggle dashboard window visibility
    }
}
```

### Update Status Dot (Keyboard Shortcut ⌘⌥B)
```swift
.keyboardShortcut("b", modifiers: [.command, .option]) {
    updateMenuBarStatus(bot.isConnected ? .online : .offline)
}
```

---

## 8. Data Binding & State Management

### AppState (Singleton)
```swift
@MainActor
class AppState: ObservableObject {
    static let shared = AppState()
    
    @Published var bots: [Bot] = []
    @Published var currentBot: Bot?
    @Published var messages: [ChatMessage] = []
    @Published var isConnected = false
    @Published var connectionError: String?
    
    @Published var showCommandPalette = false
    @Published var showDebugPanel = false
    @Published var showDashboard = false
    
    private var client: OpenClawClient?
    
    func loadBots() {
        // Load from iCloud/UserDefaults
    }
    
    func connect(to bot: Bot) {
        client = OpenClawClient(bot: bot)
        client?.delegate = self
    }
}

// Usage in views
struct ChatView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        VStack {
            if appState.isConnected {
                // Show chat
            } else {
                Text("Connecting...")
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
import Network

class OpenClawClient {
    let bot: Bot
    var connection: NWConnection?
    var receiveQueue = DispatchQueue(label: "com.optaplus.ws.receive")
    
    func connect() {
        let parameters = NWParameters.tcp
        parameters.allowLocalEndpointReuse = true
        
        let host = NWEndpoint.Host(bot.host)
        let port = NWEndpoint.Port(rawValue: UInt16(bot.port)) ?? 8000
        
        connection = NWConnection(host: host, port: port, using: parameters)
        connection?.stateUpdateHandler = { state in
            self.handleConnectionState(state)
        }
        connection?.start(queue: receiveQueue)
    }
    
    func sendFrame(_ frame: GatewayFrame) {
        let encoded = try! JSONEncoder().encode(frame)
        connection?.send(content: encoded, completion: .contentProcessed { error in
            if let error = error {
                print("Send error: \(error)")
            }
        })
    }
    
    func receiveFrames() {
        connection?.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, _, error in
            guard let data = data else { return }
            
            let frame = try! JSONDecoder().decode(GatewayFrame.self, from: data)
            DispatchQueue.main.async {
                self.delegate?.didReceive(frame)
            }
            
            self.receiveFrames()  // Continue receiving
        }
    }
}
```

---

## 10. Storage & Sync

### Rule: Use CloudKit for iCloud Sync (Production), UserDefaults for Local Prefs
```swift
// Shared bot config → syncs to iOS
struct Bot: Identifiable, Codable {
    let id: UUID
    var name: String
    var host: String
    var port: Int
    var token: String
    var accentColor: String
    
    func save() {
        // Save to CloudKit (async)
        CloudKitCoordinator.shared.save(self)
        
        // Also cache in UserDefaults
        UserDefaults.standard.set(
            try! JSONEncoder().encode(self),
            forKey: "bot-\(id)"
        )
    }
}

// Chat messages → iCloud sync
struct ChatMessage: Identifiable, Codable {
    let id: String
    var content: String
    let timestamp: Date
    
    func save() {
        // Save to CloudKit
        CloudKitCoordinator.shared.save(self)
        
        // Also cache locally
        MessageStore.shared.add(self)
    }
}
```

---

## 11. Testing Strategy

### View Tests (SwiftUI Previews)
```swift
#Preview {
    ChatView(bot: .mock)
        .environmentObject(AppState.shared)
}

#Preview("Dark Theme") {
    ChatView(bot: .mock)
        .environmentObject(AppState.shared)
        .preferredColorScheme(.dark)
}
```

### Unit Tests (Models)
```swift
@Test
func testBotModel() {
    let bot = Bot(id: UUID(), name: "Test", host: "localhost", port: 8000, token: "test")
    XCTAssertEqual(bot.name, "Test")
    XCTAssertFalse(bot.isConnected)
}
```

### Integration Tests (Networking)
```swift
@Test
func testWebSocketConnect() {
    let bot = Bot.mock
    let client = OpenClawClient(bot: bot)
    
    let expectation = XCTestExpectation(description: "Connected")
    client.delegate = self
    client.connect()
    
    wait(for: [expectation], timeout: 5)
    XCTAssertTrue(client.isConnected)
}
```

---

## 12. Common Patterns

### Conditional Compilation (macOS Only)
```swift
#if os(macOS)
import AppKit

class MenuBarManager { /* ... */ }
#endif
```

### Error Handling
```swift
do {
    let encoded = try JSONEncoder().encode(frame)
    sendFrame(encoded)
} catch {
    print("Encoding error: \(error)")
    // Show error in UI
}
```

### Async/Await for Networking
```swift
func fetchBotStatus() async throws -> BotStatus {
    let frame = GatewayFrame.request("bot.status", params: [:])
    let response = try await client.sendAndWait(frame)
    return try response.decode(to: BotStatus.self)
}

// Usage
.task {
    do {
        let status = try await fetchBotStatus()
        await MainActor.run {
            self.botStatus = status
        }
    } catch {
        print("Error: \(error)")
    }
}
```

---

## 13. Performance Checklist

- [ ] No synchronous operations on main thread
- [ ] Images are cached (never reload same image twice)
- [ ] MessageView is rendered in a List (not VStack) for scrolling perf
- [ ] WebSocket frames are processed on background thread
- [ ] iCloud sync is non-blocking
- [ ] Command palette search is debounced (< 300ms before filtering)
- [ ] Animations use spring physics (no duration-based)
- [ ] No circular dependencies in View models

---

## 14. Accessibility

```swift
// Label all interactive elements
Button(action: { restartBot() }) {
    Image(systemName: "arrow.clockwise")
}
.accessibilityLabel("Restart bot")
.accessibilityHint("Restart the currently selected bot")

// Test with VoiceOver
```

---

## 15. Code Review Checklist

Before merging any PR:
- [ ] No external dependencies added
- [ ] No AppKit/UIKit imports (except NotificationCenter)
- [ ] All animations use spring physics
- [ ] Keyboard shortcuts documented
- [ ] CloudKit sync implemented for new data models
- [ ] UI tested on macOS 14+
- [ ] Command palette supports new actions
- [ ] Memory usage acceptable (<800MB)
- [ ] No hardcoded colors (use design tokens)

---

## 16. Reference

- **PLATFORM.md** — macOS features, keyboard shortcuts, UI layout
- **SHARED.md** — Data models, networking, design tokens
- **Existing code:** `macOS/OptaPlusMacOS/*.swift`
- **Design system:** `Shared/Sources/OptaMolt/DesignSystem/*.swift`
- **Networking:** `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift`

