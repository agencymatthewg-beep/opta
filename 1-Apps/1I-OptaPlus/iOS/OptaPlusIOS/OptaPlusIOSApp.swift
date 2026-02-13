//
//  OptaPlusIOSApp.swift
//  OptaPlusIOS
//
//  iOS entry point for the OptaPlus chat client.
//

import SwiftUI
import OptaPlus
import OptaMolt

// MARK: - App State

@MainActor
final class AppState: ObservableObject {
    @Published var bots: [BotConfig] = []
    @Published var selectedBotId: String?
    @Published var chatViewModels: [String: ChatViewModel] = [:]

    private let botsKey = "optaplus.bots"
    private let selectedBotKey = "optaplus.selectedBot"

    init() {
        loadBots()
        if bots.isEmpty { addDefaultBots() }
        if let saved = UserDefaults.standard.string(forKey: selectedBotKey),
           bots.contains(where: { $0.id == saved }) {
            selectedBotId = saved
        } else {
            selectedBotId = bots.first?.id
        }
    }

    func viewModel(for bot: BotConfig) -> ChatViewModel {
        if let existing = chatViewModels[bot.id] { return existing }
        let vm = ChatViewModel(botConfig: bot)
        chatViewModels[bot.id] = vm
        return vm
    }

    var selectedBot: BotConfig? {
        bots.first { $0.id == selectedBotId }
    }

    var selectedViewModel: ChatViewModel? {
        guard let bot = selectedBot else { return nil }
        return viewModel(for: bot)
    }

    func selectBot(_ bot: BotConfig) {
        selectedBotId = bot.id
        UserDefaults.standard.set(bot.id, forKey: selectedBotKey)
        let vm = viewModel(for: bot)
        if vm.connectionState == .disconnected {
            vm.connect()
        }
    }

    func addBot(_ bot: BotConfig) {
        bots.append(bot)
        saveBots()
    }

    func removeBot(id: String) {
        chatViewModels[id]?.disconnect()
        chatViewModels.removeValue(forKey: id)
        bots.removeAll { $0.id == id }
        if selectedBotId == id { selectedBotId = bots.first?.id }
        saveBots()
    }

    func updateBot(_ bot: BotConfig) {
        if let idx = bots.firstIndex(where: { $0.id == bot.id }) {
            let old = bots[idx]
            if old.host != bot.host || old.port != bot.port || old.token != bot.token {
                chatViewModels[bot.id]?.disconnect()
                chatViewModels.removeValue(forKey: bot.id)
            }
            bots[idx] = bot
            saveBots()
        }
    }

    private func addDefaultBots() {
        bots = [
            BotConfig(name: "Opta Max", host: "192.168.188.9", port: 18793,
                      token: "8c081eb5c0769f34ec0fedde6e6ddd5f5299fb946b91b1ed", emoji: "🥷🏿"),
            BotConfig(name: "Mono", host: "192.168.188.11", port: 19001,
                      token: "e5acead966cc3922795eaea658612d9c47e4b7fa87563729", emoji: "🟢"),
            BotConfig(name: "Opta512", host: "192.168.188.11", port: 19000, token: "", emoji: "🟣"),
            BotConfig(name: "Floda", host: "192.168.188.11", port: 19002, token: "", emoji: "🧪"),
            BotConfig(name: "Saturday", host: "192.168.188.11", port: 19003, token: "", emoji: "🔵"),
            BotConfig(name: "YJ", host: "192.168.188.11", port: 19005, token: "", emoji: "⚡"),
        ]
        saveBots()
    }

    private func saveBots() {
        if let data = try? JSONEncoder().encode(bots) {
            UserDefaults.standard.set(data, forKey: botsKey)
        }
    }

    private func loadBots() {
        guard let data = UserDefaults.standard.data(forKey: botsKey),
              let decoded = try? JSONDecoder().decode([BotConfig].self, from: data) else { return }
        bots = decoded
    }
}

// MARK: - App

@main
struct OptaPlusIOSApp: App {
    @StateObject private var appState = AppState()
    @ObservedObject private var themeManager = ThemeManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(themeManager)
                .environment(\.fontScaleOffset, themeManager.fontScale.offset)
                .environment(\.chatDensity, themeManager.chatDensity)
                .environment(\.backgroundMode, themeManager.backgroundMode)
                .preferredColorScheme(.dark)
                .onAppear {
                    if let bot = appState.selectedBot {
                        appState.selectBot(bot)
                    }
                }
        }
    }
}
