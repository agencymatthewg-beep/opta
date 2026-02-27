//
//  AskBotIntent.swift
//  OptaPlusIOS
//
//  Siri Shortcut: "Ask [bot] to [message]"
//  Sends a message to a bot and optionally waits for the response.
//
//  v1.0 — iOS only
//

import AppIntents
import OptaPlus
import OptaMolt

// MARK: - Ask Bot Intent

struct AskBotIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask Bot"
    static var description: IntentDescription = "Send a message to one of your bots and get a response."
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Bot Name", description: "The name of the bot to ask")
    var botName: String

    @Parameter(title: "Message", description: "What to ask or tell the bot")
    var message: String

    @Parameter(title: "Wait for Response", default: true,
               description: "Wait for the bot to respond (up to 30 seconds)")
    var waitForResponse: Bool

    static var parameterSummary: some ParameterSummary {
        Summary("Ask \(\.$botName) \(\.$message)") {
            \.$waitForResponse
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        // Find matching bot
        let appState = AppState.shared
        guard let bot = appState.bots.first(where: {
            $0.name.localizedCaseInsensitiveContains(botName)
        }) else {
            throw IntentError.botNotFound(botName)
        }

        // Get or create view model and ensure connected
        let vm = appState.viewModel(for: bot)
        if vm.connectionState == .disconnected {
            vm.connect()
            // Wait briefly for connection
            try await Task.sleep(nanoseconds: 2_000_000_000)
        }

        guard vm.connectionState == .connected else {
            throw IntentError.botOffline(bot.name)
        }

        // Send the message
        await vm.send(message)

        if waitForResponse {
            // Poll for a new bot message (max 30s)
            let startCount = vm.messages.count
            for _ in 0..<60 {
                try await Task.sleep(nanoseconds: 500_000_000)
                if vm.messages.count > startCount,
                   let last = vm.messages.last,
                   case .bot = last.sender {
                    return .result(value: last.content)
                }
            }
            return .result(value: "Bot is still processing. Check OptaPlus for the response.")
        }

        return .result(value: "Message sent to \(bot.name)")
    }
}

// MARK: - Send Message Intent

struct SendMessageIntent: AppIntent {
    static var title: LocalizedStringResource = "Send Message to Bot"
    static var description: IntentDescription = "Quickly send a message to a bot without waiting for a response."
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Bot Name")
    var botName: String

    @Parameter(title: "Message")
    var message: String

    static var parameterSummary: some ParameterSummary {
        Summary("Send \(\.$message) to \(\.$botName)")
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        let appState = AppState.shared
        guard let bot = appState.bots.first(where: {
            $0.name.localizedCaseInsensitiveContains(botName)
        }) else {
            throw IntentError.botNotFound(botName)
        }

        let vm = appState.viewModel(for: bot)
        if vm.connectionState == .disconnected {
            vm.connect()
            try await Task.sleep(nanoseconds: 2_000_000_000)
        }

        guard vm.connectionState == .connected else {
            throw IntentError.botOffline(bot.name)
        }

        await vm.send(message)
        HapticManager.shared.impact(.light)
        return .result()
    }
}

// MARK: - Check Status Intent

struct CheckBotStatusIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Bot Status"
    static var description: IntentDescription = "Check if a bot is online and get its status."
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Bot Name")
    var botName: String

    static var parameterSummary: some ParameterSummary {
        Summary("Check status of \(\.$botName)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let appState = AppState.shared
        guard let bot = appState.bots.first(where: {
            $0.name.localizedCaseInsensitiveContains(botName)
        }) else {
            throw IntentError.botNotFound(botName)
        }

        let vm = appState.viewModel(for: bot)
        let state = vm.connectionState
        let uptime = vm.formattedUptime
        let msgCount = vm.totalMessageCount
        let route = vm.connectionRoute.rawValue

        let status = """
        \(bot.emoji) \(bot.name): \(state == .connected ? "Online ✅" : "Offline ❌")
        Route: \(route) | Uptime: \(uptime) | Messages: \(msgCount)
        """

        return .result(value: status)
    }
}

// MARK: - Intent Errors

enum IntentError: Error, CustomLocalizedStringResourceConvertible {
    case botNotFound(String)
    case botOffline(String)

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .botNotFound(let name):
            return "No bot named '\(name)' found. Check your bot list in OptaPlus."
        case .botOffline(let name):
            return "\(name) is currently offline. Try again when it's connected."
        }
    }
}

// MARK: - App Shortcuts Provider

struct OptaPlusShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AskBotIntent(),
            phrases: [
                "Ask \(\.$botName) \(\.$message) in \(.applicationName)",
                "Tell \(\.$botName) \(\.$message) with \(.applicationName)",
                "Ask \(\.$botName) in \(.applicationName)"
            ],
            shortTitle: "Ask Bot",
            systemImageName: "bubble.left.fill"
        )
        AppShortcut(
            intent: SendMessageIntent(),
            phrases: [
                "Send \(\.$message) to \(\.$botName) in \(.applicationName)"
            ],
            shortTitle: "Send Message",
            systemImageName: "paperplane.fill"
        )
        AppShortcut(
            intent: CheckBotStatusIntent(),
            phrases: [
                "Check \(\.$botName) status in \(.applicationName)",
                "Is \(\.$botName) online in \(.applicationName)"
            ],
            shortTitle: "Check Status",
            systemImageName: "heart.text.square.fill"
        )
    }
}
