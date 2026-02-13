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
    
    var body: some View {
        ContentView()
            .environmentObject(windowState)
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
    @StateObject private var animPrefs = AnimationPreferences.shared
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
                .environmentObject(animPrefs)
                .environment(\.animationLevel, animPrefs.level)
                .environment(\.messageTextAlignment, textAlignment)
                .frame(minWidth: 500, minHeight: 400)
                .preferredColorScheme(.dark)
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
            
            // Edit → Clear Chat (⌘K)
            CommandGroup(after: .pasteboard) {
                Button("Clear Chat") {
                    if let vm = appState.selectedViewModel {
                        vm.messages.removeAll()
                    }
                }
                .keyboardShortcut("k", modifiers: .command)
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
        
        Settings {
            SettingsView()
                .environmentObject(appState)
                .environmentObject(animPrefs)
                .environment(\.animationLevel, animPrefs.level)
                .environment(\.messageTextAlignment, textAlignment)
        }
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
            if old.host != bot.host || old.port != bot.port || old.token != bot.token {
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
            BotConfig(name: "Opta Max", host: "127.0.0.1", port: 18793,
                      token: "8c081eb5c0769f34ec0fedde6e6ddd5f5299fb946b91b1ed",
                      emoji: "🥷🏿"),
            BotConfig(name: "Opta512", host: "Mono512.local", port: 19000,
                      token: "", emoji: "🟣"),
            BotConfig(name: "Mono", host: "Mono512.local", port: 19001,
                      token: "", emoji: "🟢"),
            BotConfig(name: "Floda", host: "Mono512.local", port: 19002,
                      token: "", emoji: "🧪"),
            BotConfig(name: "Saturday", host: "Mono512.local", port: 19003,
                      token: "", emoji: "🔵"),
            BotConfig(name: "YJ", host: "Mono512.local", port: 19005,
                      token: "", emoji: "⚡"),
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
}
