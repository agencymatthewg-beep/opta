import SwiftUI
import WidgetKit
import OptaPlus
import OptaMolt

@MainActor
final class AppState: ObservableObject {
    static var shared: AppState!

    @Published private(set) var botNodes: [BotNode] = []
    @Published var selectedBotId: String?
    private var chatViewModels: [String: ChatViewModel] = [:]

    let pairingStore = BotPairingStore()
    private var tokenCache: [String: String] = [:]

    private let selectedBotKey = "optaplus.selectedBot"
    private let legacyBotsKey = "optaplus.bots"
    private let migrationKey = "optaplus.v2.migrated"

    var bots: [BotConfig] {
        botNodes.map { node in
            BotConfig(botNode: node, token: tokenCache[node.id] ?? "")
        }
    }

    init() {
        migrateIfNeeded()
        reloadFromStore()
        if botNodes.isEmpty { addDefaultBots() }
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

    func viewModel(forNode node: BotNode) -> ChatViewModel {
        let config = BotConfig(botNode: node, token: tokenCache[node.id] ?? "")
        return viewModel(for: config)
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

    func selectNode(_ node: BotNode) {
        let config = BotConfig(botNode: node, token: tokenCache[node.id] ?? "")
        selectBot(config)
    }

    func addBot(_ bot: BotConfig) {
        let node = BotNode(
            botId: bot.id,
            gatewayFingerprint: "legacy",
            name: bot.name,
            emoji: bot.emoji,
            gatewayHost: bot.host,
            gatewayPort: bot.port,
            remoteURL: bot.remoteURL,
            connectionMode: bot.connectionMode,
            state: .paired
        )
        addNode(node, token: bot.token.isEmpty ? nil : bot.token)
    }

    func addNode(_ node: BotNode, token: String?) {
        pairingStore.saveBotNode(node)
        if let token, !token.isEmpty {
            let pairingToken = PairingToken(
                botId: node.botId,
                gatewayFingerprint: node.gatewayFingerprint,
                token: token,
                deviceId: DeviceIdentity.current.deviceId
            )
            pairingStore.saveToken(pairingToken)
        }
        reloadFromStore()
    }

    func removeBot(id: String) {
        chatViewModels[id]?.disconnect()
        chatViewModels.removeValue(forKey: id)
        if let node = botNodes.first(where: { $0.botId == id }) {
            pairingStore.removeBotNode(id: node.id)
            pairingStore.deleteToken(botId: node.botId, gatewayFingerprint: node.gatewayFingerprint)
        }
        if selectedBotId == id { selectedBotId = nil }
        reloadFromStore()
        if selectedBotId == nil { selectedBotId = bots.first?.id }
    }

    func updateBot(_ bot: BotConfig) {
        guard let node = botNodes.first(where: { $0.botId == bot.id }) else { return }
        let old = BotConfig(botNode: node, token: tokenCache[node.id] ?? "")
        if old.host != bot.host || old.port != bot.port || old.token != bot.token
            || old.remoteURL != bot.remoteURL || old.connectionMode != bot.connectionMode {
            chatViewModels[bot.id]?.disconnect()
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
            let pairingToken = PairingToken(
                botId: updated.botId,
                gatewayFingerprint: updated.gatewayFingerprint,
                token: bot.token,
                deviceId: DeviceIdentity.current.deviceId
            )
            pairingStore.saveToken(pairingToken)
        }
        reloadFromStore()
    }

    func syncWidgetData() {
        let widgetBots = bots.map { bot -> WidgetBotInfo in
            let vm = chatViewModels[bot.id]
            let lastMsg = vm?.messages.last
            return WidgetBotInfo(
                id: bot.id,
                name: bot.name,
                emoji: bot.emoji,
                isConnected: vm?.connectionState == .connected,
                lastMessage: lastMsg?.content.prefix(100).description,
                lastMessageDate: lastMsg?.timestamp,
                accentColorHex: "#8B5CF6"
            )
        }
        WidgetDataManager.shared.updateBotStatuses(widgetBots)
    }

    private func addDefaultBots() {
        let defaults: [(name: String, host: String, port: Int, token: String, emoji: String, remote: String)] = [
            ("Opta Max", "192.168.188.9", 18793, "", "🥷🏿", "wss://gateway.optamize.biz"),
            ("Mono", "192.168.188.11", 19001, "", "🟢", "wss://mono.optamize.biz"),
            ("Opta512", "192.168.188.11", 19000, "", "🟣", "wss://opta512.optamize.biz"),
            ("Floda", "192.168.188.11", 19002, "", "🧪", "wss://floda.optamize.biz"),
            ("Saturday", "192.168.188.11", 19003, "", "🔵", "wss://saturday.optamize.biz"),
            ("YJ", "192.168.188.11", 19005, "", "⚡", "wss://yj.optamize.biz"),
        ]
        let deviceId = DeviceIdentity.current.deviceId
        for d in defaults {
            let node = BotNode(
                botId: d.name.lowercased().replacingOccurrences(of: " ", with: "-"),
                gatewayFingerprint: "default",
                name: d.name,
                emoji: d.emoji,
                gatewayHost: d.host,
                gatewayPort: d.port,
                remoteURL: d.remote,
                state: .paired
            )
            pairingStore.saveBotNode(node)
            if !d.token.isEmpty {
                let token = PairingToken(
                    botId: node.botId,
                    gatewayFingerprint: node.gatewayFingerprint,
                    token: d.token,
                    deviceId: deviceId
                )
                pairingStore.saveToken(token)
            }
        }
        reloadFromStore()
    }

    private func migrateIfNeeded() {
        guard !UserDefaults.standard.bool(forKey: migrationKey) else { return }
        guard let data = UserDefaults.standard.data(forKey: legacyBotsKey),
              let legacyBots = try? JSONDecoder().decode([BotConfig].self, from: data),
              !legacyBots.isEmpty else {
            UserDefaults.standard.set(true, forKey: migrationKey)
            return
        }
        let deviceId = DeviceIdentity.current.deviceId
        for config in legacyBots {
            let node = BotNode(
                botId: config.id,
                gatewayFingerprint: "legacy",
                name: config.name,
                emoji: config.emoji,
                gatewayHost: config.host,
                gatewayPort: config.port,
                remoteURL: config.remoteURL,
                connectionMode: config.connectionMode,
                state: .paired
            )
            pairingStore.saveBotNode(node)
            if !config.token.isEmpty {
                let token = PairingToken(
                    botId: config.id,
                    gatewayFingerprint: "legacy",
                    token: config.token,
                    deviceId: deviceId
                )
                pairingStore.saveToken(token)
            }
        }
        UserDefaults.standard.set(true, forKey: migrationKey)
    }

    func reloadFromStore() {
        botNodes = pairingStore.loadBotNodes()
        let allTokens = pairingStore.allTokens()
        var cache: [String: String] = [:]
        for node in botNodes {
            if let pt = allTokens.first(where: { $0.botId == node.botId && $0.gatewayFingerprint == node.gatewayFingerprint }) {
                cache[node.id] = pt.token
            }
        }
        tokenCache = cache
    }
}
