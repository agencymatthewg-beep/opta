//
//  OptaPlusMacOSApp.swift
//  OptaPlusMacOS
//
//  Main entry point for the OptaPlus macOS chat client.
//  A native OpenClaw bot interface with the Cinematic Void design system.
//  Supports multiple independent windows, each showing a different bot.
//

import SwiftUI
import Combine
import Carbon.HIToolbox
import OptaPlus
import OptaMolt

// MARK: - Window State

/// Per-window state: tracks which bot is selected in THIS window.
@MainActor
final class WindowState: ObservableObject {
    @Published var selectedBotId: String?
    
    init(botId: String? = nil) {
        self.selectedBotId = botId
    }
    
    /// Select a bot in this window and connect if needed.
    func selectBot(_ bot: BotConfig, in appState: AppState) {
        selectedBotId = bot.id
        let vm = appState.viewModel(for: bot)
        if vm.connectionState == .disconnected {
            vm.connect()
        }
    }
    
    /// Currently selected bot config from shared app state.
    func selectedBot(in appState: AppState) -> BotConfig? {
        guard let id = selectedBotId else { return nil }
        return appState.bots.first { $0.id == id }
    }
    
    /// Currently selected chat view model from shared app state.
    func selectedViewModel(in appState: AppState) -> ChatViewModel? {
        guard let bot = selectedBot(in: appState) else { return nil }
        return appState.viewModel(for: bot)
    }
}

// MARK: - Window Identifier

/// Value passed to openWindow to optionally pre-select a bot.
struct WindowValue: Codable, Hashable {
    var botId: String?
    
    static let empty = WindowValue(botId: nil)
}

// MARK: - Window Root

/// Wrapper that owns the WindowState for each window instance.
struct WindowRoot: View {
    @StateObject private var windowState: WindowState
    @EnvironmentObject var appState: AppState
    
    init(initialBotId: String?) {
        _windowState = StateObject(wrappedValue: WindowState(botId: initialBotId))
    }
    
    private var windowTitle: String {
        guard let bot = windowState.selectedBot(in: appState) else {
            return "OptaPlus"
        }
        let vm = appState.viewModel(for: bot)
        switch vm.connectionState {
        case .connected:
            return "OptaPlus — \(bot.name)"
        case .connecting, .reconnecting:
            return "OptaPlus — Connecting…"
        case .disconnected:
            return "OptaPlus"
        }
    }
    
    var body: some View {
        ContentView()
            .environmentObject(windowState)
            .onChange(of: windowTitle) { _, newTitle in
                // Update NSWindow title for hidden title bar mode
                if let window = NSApp.keyWindow, window.title != newTitle {
                    window.title = newTitle
                }
            }
            .onAppear {
                // If no bot pre-selected, use the default
                if windowState.selectedBotId == nil {
                    windowState.selectedBotId = appState.selectedBotId
                }
            }
    }
}

// MARK: - App

@main
struct OptaPlusMacOSApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var pairingCoordinator = PairingCoordinator()
    @StateObject private var animPrefs = AnimationPreferences.shared
    @StateObject private var notificationManager = NotificationManager.shared
    @ObservedObject private var themeManager = ThemeManager.shared
    @AppStorage("optaplus.textAlignment") private var textAlignmentRaw: String = MessageTextAlignment.centeredExpanding.rawValue
    @Environment(\.openWindow) private var openWindow

    private var textAlignment: MessageTextAlignment {
        MessageTextAlignment(rawValue: textAlignmentRaw) ?? .centeredExpanding
    }
    
    var body: some Scene {
        // Main window group — each window gets its own WindowState
        WindowGroup(id: "chat", for: WindowValue.self) { $value in
            WindowRoot(initialBotId: value.botId)
                .environmentObject(appState)
                .environmentObject(pairingCoordinator)
                .environmentObject(animPrefs)
                .environmentObject(themeManager)
                .environment(\.animationLevel, animPrefs.level)
                .environment(\.messageTextAlignment, textAlignment)
                .environment(\.fontScaleOffset, themeManager.fontScale.offset)
                .environment(\.chatDensity, themeManager.chatDensity)
                .environment(\.backgroundMode, themeManager.backgroundMode)
                .frame(minWidth: 500, minHeight: 400)
                .preferredColorScheme(.dark)
                .onOpenURL { url in
                    if let info = PairingCoordinator.parseDeepLink(url) {
                        pairingCoordinator.pendingPairingInfo = info
                    }
                }
        } defaultValue: {
            WindowValue.empty
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 800, height: 600)
        .commands {
            // File → New Chat Window (⌘N)
            CommandGroup(after: .newItem) {
                Button("New Chat Window") {
                    openWindow(id: "chat", value: WindowValue.empty)
                }
                .keyboardShortcut("n", modifiers: .command)
                
                Divider()
            }
            
            // Edit → Clear Chat (⌘K) — now shows confirmation
            CommandGroup(after: .pasteboard) {
                Button("Clear Chat") {
                    if let vm = appState.selectedViewModel {
                        vm.showClearConfirmation = true
                    }
                }
                .keyboardShortcut("k", modifiers: .command)
            }
            
            // View → Refresh All (⌘⇧R)
            CommandGroup(after: .toolbar) {
                Button("Refresh All Connections") {
                    appState.refreshAll()
                }
                .keyboardShortcut("r", modifiers: [.command, .shift])
            }

            // Views menu
            CommandMenu("Views") {
                Button("Dashboard") {
                    NotificationCenter.default.post(name: .toggleDashboard, object: nil)
                }
                .keyboardShortcut("d", modifiers: .command)

                Button("Automations") {
                    NotificationCenter.default.post(name: .toggleAutomations, object: nil)
                }
                .keyboardShortcut("j", modifiers: .command)

                Button("Bot Web") {
                    NotificationCenter.default.post(name: .toggleBotWeb, object: nil)
                }
                .keyboardShortcut("b", modifiers: [.command, .shift])

                Button("Debug") {
                    NotificationCenter.default.post(name: .toggleDebug, object: nil)
                }
                .keyboardShortcut("g", modifiers: [.command, .shift])
            }

            // Window → Show Bot shortcuts (⌘1 through ⌘6)
            CommandMenu("Bots") {
                ForEach(Array(appState.bots.prefix(6).enumerated()), id: \.element.id) { index, bot in
                    Button("\(bot.emoji) \(bot.name)") {
                        openWindow(id: "chat", value: WindowValue(botId: bot.id))
                    }
                    .keyboardShortcut(KeyEquivalent(Character(String(index + 1))), modifiers: .command)
                }
            }
        }
        
        // Menu Bar Extra — mini status panel
        MenuBarExtra {
            MenuBarPanel()
                .environmentObject(appState)
        } label: {
            ZStack {
                Image(systemName: "circle.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.optaPrimary)
                if notificationManager.unreadCount > 0 {
                    Circle()
                        .fill(Color.optaRed)
                        .frame(width: 6, height: 6)
                        .offset(x: 6, y: -6)
                }
            }
        }
        .menuBarExtraStyle(.window)

        Settings {
            SettingsView()
                .environmentObject(appState)
                .environmentObject(animPrefs)
                .environmentObject(themeManager)
                .environment(\.animationLevel, animPrefs.level)
                .environment(\.messageTextAlignment, textAlignment)
                .environment(\.fontScaleOffset, themeManager.fontScale.offset)
                .environment(\.chatDensity, themeManager.chatDensity)
                .environment(\.backgroundMode, themeManager.backgroundMode)
        }
    }
    
    init() {
        // One-time migration from BotConfig to BotNode + PairingToken
        if !UserDefaults.standard.bool(forKey: "optaplus.v2.migrated") {
            if let data = UserDefaults.standard.data(forKey: "optaplus.bots"),
               let bots = try? JSONDecoder().decode([BotConfig].self, from: data) {
                let store = BotPairingStore()
                _ = store.migrateFromBotConfigs(bots, gatewayFingerprint: "legacy")
            }
            UserDefaults.standard.set(true, forKey: "optaplus.v2.migrated")
        }

        // Request notification permission on first launch
        NotificationManager.shared.requestPermission()
        
        // Register notification categories with actions
        NotificationManager.shared.registerCategories()
        
        // Clear badge when app becomes active
        NotificationCenter.default.addObserver(
            forName: NSApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { _ in
            Task { @MainActor in
                NotificationManager.shared.clearBadge()
            }
        }
        
        // Register global hotkey ⌘⇧O to bring app to front
        GlobalHotkey.register()
    }
}

// MARK: - App State

/// Global application state managing bot configurations and active sessions.
/// Shared across ALL windows — each window picks which bot to display via WindowState.
@MainActor
final class AppState: ObservableObject {

    /// All configured bots.
    @Published var bots: [BotConfig] = []

    /// Default selected bot ID (used for first window / backward compat).
    @Published var selectedBotId: String?

    /// Active chat view models keyed by bot ID (shared across windows).
    @Published var chatViewModels: [String: ChatViewModel] = [:]

    /// Whether the settings sheet is showing.
    @Published var showingSettings = false

    // MARK: - Sync

    /// Shared sync coordinator for message dedup and routing.
    @Published var syncCoordinator: SyncCoordinator?

    // MARK: - Persistence

    private let botsKey = "optaplus.bots"
    private let selectedBotKey = "optaplus.selectedBot"

    init() {
        loadBots()

        // If no bots configured, add defaults
        if bots.isEmpty {
            addDefaultBots()
        }

        // Restore selection
        if let savedId = UserDefaults.standard.string(forKey: selectedBotKey),
           bots.contains(where: { $0.id == savedId }) {
            selectedBotId = savedId
        } else {
            selectedBotId = bots.first?.id
        }

        // Initialize sync coordinator
        initializeSyncCoordinator()
    }

    // MARK: - Sync

    /// Create the SyncCoordinator for message dedup and routing.
    func initializeSyncCoordinator() {
        let sync = SyncCoordinator()
        self.syncCoordinator = sync

        // Inject coordinator into existing chat view models
        for (_, vm) in chatViewModels {
            vm.syncCoordinator = sync
        }
    }

    // MARK: - Bot Management
    
    /// Get or create a ChatViewModel for a bot.
    func viewModel(for bot: BotConfig) -> ChatViewModel {
        if let existing = chatViewModels[bot.id] {
            return existing
        }
        let vm = ChatViewModel(botConfig: bot, syncCoordinator: syncCoordinator)
        chatViewModels[bot.id] = vm
        return vm
    }
    
    /// Currently selected bot config (default/backward compat).
    var selectedBot: BotConfig? {
        bots.first { $0.id == selectedBotId }
    }
    
    /// Currently selected chat view model (default/backward compat).
    var selectedViewModel: ChatViewModel? {
        guard let bot = selectedBot else { return nil }
        return viewModel(for: bot)
    }
    
    /// Select a bot (updates default selection + persists).
    func selectBot(_ bot: BotConfig) {
        selectedBotId = bot.id
        UserDefaults.standard.set(bot.id, forKey: selectedBotKey)
        
        let vm = viewModel(for: bot)
        if vm.connectionState == .disconnected {
            vm.connect()
        }
    }
    
    /// Add a new bot configuration.
    func addBot(_ bot: BotConfig) {
        bots.append(bot)
        saveBots()
    }
    
    /// Remove a bot.
    func removeBot(id: String) {
        chatViewModels[id]?.disconnect()
        chatViewModels.removeValue(forKey: id)
        bots.removeAll { $0.id == id }
        
        if selectedBotId == id {
            selectedBotId = bots.first?.id
        }
        saveBots()
    }
    
    /// Update a bot configuration.
    func updateBot(_ bot: BotConfig) {
        if let idx = bots.firstIndex(where: { $0.id == bot.id }) {
            // Disconnect old if config changed
            let old = bots[idx]
            if old.host != bot.host || old.port != bot.port || old.token != bot.token
                || old.remoteURL != bot.remoteURL || old.connectionMode != bot.connectionMode {
                chatViewModels[bot.id]?.disconnect()
                chatViewModels.removeValue(forKey: bot.id)
            }
            bots[idx] = bot
            saveBots()
        }
    }
    
    // MARK: - Defaults
    
    private func addDefaultBots() {
        let defaults: [BotConfig] = [
            BotConfig(name: "Opta Max", host: "192.168.188.9", port: 18793,
                      token: "8c081eb5c0769f34ec0fedde6e6ddd5f5299fb946b91b1ed",
                      emoji: "🥷🏿", remoteURL: "wss://gateway.optamize.biz"),
            BotConfig(name: "Mono", host: "192.168.188.11", port: 19001,
                      token: "e5acead966cc3922795eaea658612d9c47e4b7fa87563729",
                      emoji: "🟢", remoteURL: "wss://mono.optamize.biz"),
            BotConfig(name: "Opta512", host: "192.168.188.11", port: 19000,
                      token: "", emoji: "🟣",
                      remoteURL: "wss://opta512.optamize.biz"),
            BotConfig(name: "Floda", host: "192.168.188.11", port: 19002,
                      token: "", emoji: "🧪",
                      remoteURL: "wss://floda.optamize.biz"),
            BotConfig(name: "Saturday", host: "192.168.188.11", port: 19003,
                      token: "", emoji: "🔵",
                      remoteURL: "wss://saturday.optamize.biz"),
            BotConfig(name: "YJ", host: "192.168.188.11", port: 19005,
                      token: "", emoji: "⚡",
                      remoteURL: "wss://yj.optamize.biz"),
        ]
        bots = defaults
        saveBots()
    }
    
    // MARK: - Persistence
    
    private func saveBots() {
        if let data = try? JSONEncoder().encode(bots) {
            UserDefaults.standard.set(data, forKey: botsKey)
        }
    }
    
    private func loadBots() {
        guard let data = UserDefaults.standard.data(forKey: botsKey),
              let decoded = try? JSONDecoder().decode([BotConfig].self, from: data) else {
            return
        }
        bots = decoded
    }

    // MARK: - Connected Bot Count

    /// Full app refresh — disconnect all bots, clear view models, reload config, reconnect.
    func refreshAll() {
        // 1. Disconnect all active connections
        for (_, vm) in chatViewModels {
            vm.disconnect()
        }
        
        // 2. Clear all cached view models
        chatViewModels.removeAll()
        
        // 3. Reload bot configs from persistence
        loadBots()
        if bots.isEmpty {
            addDefaultBots()
        }
        
        // 4. Re-initialize sync coordinator
        initializeSyncCoordinator()
        
        // 5. Reconnect selected bot
        if let bot = selectedBot {
            let vm = viewModel(for: bot)
            vm.connect()
        }
    }

    var connectedBotCount: Int {
        chatViewModels.values.filter { $0.connectionState == .connected }.count
    }

    /// Latest message preview across all bots.
    var latestMessagePreview: String? {
        chatViewModels.values
            .compactMap { $0.messages.last }
            .sorted { $0.timestamp > $1.timestamp }
            .first
            .map { String($0.content.prefix(60)) }
    }

    // MARK: - Bulk Actions

    func connectAll() {
        for bot in bots {
            let vm = viewModel(for: bot)
            if vm.connectionState == .disconnected {
                vm.connect()
            }
        }
    }

    func disconnectAll() {
        for (_, vm) in chatViewModels {
            vm.disconnect()
        }
    }
}

// MARK: - Menu Bar Panel

struct MenuBarPanel: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Status header
            HStack {
                Image(systemName: "circle.fill")
                    .font(.system(size: 10))
                    .foregroundColor(.optaPrimary)
                Text("OptaPlus")
                    .font(.sora(13, weight: .semibold))
                Spacer()
                Text("\(appState.connectedBotCount) connected")
                    .font(.sora(11))
                    .foregroundColor(.optaTextSecondary)
            }

            Divider()

            // Latest message preview
            if let preview = appState.latestMessagePreview {
                Text(preview)
                    .font(.sora(11))
                    .foregroundColor(.optaTextSecondary)
                    .lineLimit(2)
            } else {
                Text("No messages yet")
                    .font(.sora(11))
                    .foregroundColor(.optaTextSecondary)
            }

            Divider()

            // Quick actions
            Button("Open Main Window") {
                NSApp.activate(ignoringOtherApps: true)
                if let window = NSApp.windows.first(where: { $0.isVisible }) {
                    window.makeKeyAndOrderFront(nil)
                }
            }

            Button("Connect All") {
                appState.connectAll()
            }

            Button("Disconnect All") {
                appState.disconnectAll()
            }

            Divider()

            Button("Quit OptaPlus") {
                NSApp.terminate(nil)
            }
            .keyboardShortcut("q")
        }
        .padding(12)
        .frame(width: 240)
    }
}

// MARK: - Window State Persistence

enum WindowStatePersistence {
    private static let frameKey = "optaplus.windowFrame"
    private static let sidebarWidthKey = "optaplus.sidebarWidth"
    private static let selectedBotPerWindowKey = "optaplus.windowSelectedBot"

    static func saveFrame(_ frame: NSRect) {
        let dict: [String: CGFloat] = [
            "x": frame.origin.x, "y": frame.origin.y,
            "w": frame.size.width, "h": frame.size.height
        ]
        UserDefaults.standard.set(dict, forKey: frameKey)
    }

    static func restoreFrame() -> NSRect? {
        guard let dict = UserDefaults.standard.dictionary(forKey: frameKey) as? [String: CGFloat] else { return nil }
        guard let x = dict["x"], let y = dict["y"], let w = dict["w"], let h = dict["h"] else { return nil }
        return NSRect(x: x, y: y, width: w, height: h)
    }

    static func saveSidebarWidth(_ width: CGFloat) {
        UserDefaults.standard.set(width, forKey: sidebarWidthKey)
    }

    static func restoreSidebarWidth() -> CGFloat? {
        let val = UserDefaults.standard.double(forKey: sidebarWidthKey)
        return val > 0 ? val : nil
    }

    static func saveSelectedBot(_ botId: String?, windowId: String = "main") {
        UserDefaults.standard.set(botId, forKey: "\(selectedBotPerWindowKey).\(windowId)")
    }

    static func restoreSelectedBot(windowId: String = "main") -> String? {
        UserDefaults.standard.string(forKey: "\(selectedBotPerWindowKey).\(windowId)")
    }
}

// MARK: - Global Hotkey (⌘⇧O)

enum GlobalHotkey {
    private static var monitor: Any?

    static func register() {
        monitor = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { event in
            // ⌘⇧O
            if event.modifierFlags.contains([.command, .shift]),
               event.keyCode == UInt16(kVK_ANSI_O) {
                Task { @MainActor in
                    NSApp.activate(ignoringOtherApps: true)
                    if let window = NSApp.keyWindow ?? NSApp.windows.first(where: { $0.isVisible && $0.canBecomeKey }) {
                        window.makeKeyAndOrderFront(nil)
                    }
                    // Post notification to focus input field
                    NotificationCenter.default.post(name: .optaPlusFocusInput, object: nil)
                }
            }
        }
    }
}

extension Notification.Name {
    static let optaPlusFocusInput = Notification.Name("optaPlusFocusInput")
}
