//
//  WidgetModule.swift
//  OptaPlusMacOS
//
//  X5. WidgetKit Desktop Widgets — macOS desktop widgets showing bot status,
//  recent messages, quick-send buttons, and health dashboard.
//
//  This file contains the shared data layer and App Group provider that bridges
//  the main app with the WidgetKit extension target. The actual widget views
//  would live in a separate WidgetKit extension target.
//
//  Module registration:  WidgetModule.register(appState:)
//  Module removal:       Delete this file + the widget extension target. App unaffected.
//
//  Event bus:
//    Listens:  Connection state changes, new messages, health updates
//    Posts:    .module_widget_deepLink (botId, action)
//
//  Frameworks: WidgetKit, SwiftUI, Intents
//

import SwiftUI
import Combine
import OptaMolt
import os.log
#if canImport(WidgetKit)
import WidgetKit
#endif

// MARK: - Widget Data Models (Shared via App Group)

/// Compact bot state for widget display. Codable for App Group container serialization.
struct WidgetBotState: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let emoji: String
    var isConnected: Bool
    var isReconnecting: Bool
    var uptimeFormatted: String
    var latencyMs: Double?
    var healthScore: Int
    var healthLabel: String
    var healthColor: WidgetColor
    var errorRate: Double
    var lastMessagePreview: String?
    var lastMessageTime: Date?
    var totalMessages: Int
}

/// Codable-safe color representation for widgets.
enum WidgetColor: String, Codable {
    case green, amber, red, muted

    var swiftUIColor: Color {
        switch self {
        case .green: return .optaGreen
        case .amber: return .optaAmber
        case .red: return .optaRed
        case .muted: return .optaTextMuted
        }
    }
}

/// A recent message for the message feed widget.
struct WidgetMessage: Identifiable, Codable, Equatable {
    let id: String
    let botId: String
    let botEmoji: String
    let botName: String
    let content: String
    let timestamp: Date
    let isUser: Bool
}

/// A quick-send button configuration.
struct QuickSendButton: Identifiable, Codable, Equatable {
    let id: String
    var label: String
    var targetBotId: String
    var targetBotName: String
    var message: String
    var icon: String  // SF Symbol

    init(id: String = UUID().uuidString, label: String, targetBotId: String,
         targetBotName: String, message: String, icon: String = "paperplane") {
        self.id = id
        self.label = label
        self.targetBotId = targetBotId
        self.targetBotName = targetBotName
        self.message = message
        self.icon = icon
    }
}

/// Complete widget data payload — written by the app, read by widgets.
struct WidgetData: Codable, Equatable {
    var botStates: [WidgetBotState]
    var recentMessages: [WidgetMessage]
    var quickSendButtons: [QuickSendButton]
    var lastUpdated: Date

    static let empty = WidgetData(
        botStates: [],
        recentMessages: [],
        quickSendButtons: [],
        lastUpdated: Date()
    )
}

// MARK: - Widget Data Provider

/// Writes widget data to the App Group container for WidgetKit to read.
/// Calls `WidgetCenter.shared.reloadAllTimelines()` on significant changes.
@MainActor
final class WidgetDataProvider: ObservableObject {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "Widget")

    static let shared = WidgetDataProvider()
    static let appGroupId = "group.biz.optamize.optaplus"

    @Published var data: WidgetData = .empty
    @Published var quickSendButtons: [QuickSendButton] = []

    private var cancellables = Set<AnyCancellable>()
    private var updateTimer: Timer?
    private let updateInterval: TimeInterval = 300  // 5 minutes
    private let containerURL: URL?

    private init() {
        // App Group shared container
        containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: Self.appGroupId
        )

        // Load persisted quick-send buttons
        loadQuickSendButtons()

        // Start periodic update timer
        updateTimer = Timer.scheduledTimer(withTimeInterval: updateInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.writeData()
            }
        }
    }

    // MARK: - Update from App State

    /// Refresh widget data from the current app state.
    func update(from appState: AppState) {
        var botStates: [WidgetBotState] = []
        var recentMessages: [WidgetMessage] = []

        for bot in appState.bots {
            let vm = appState.viewModel(for: bot)

            // Bot state
            let healthColor: WidgetColor
            switch vm.health.score {
            case 70...: healthColor = .green
            case 40...: healthColor = .amber
            default: healthColor = .red
            }

            let state = WidgetBotState(
                id: bot.id,
                name: bot.name,
                emoji: bot.emoji,
                isConnected: vm.connectionState == .connected,
                isReconnecting: vm.connectionState == .reconnecting,
                uptimeFormatted: vm.formattedUptime,
                latencyMs: vm.pingLatencyMs,
                healthScore: vm.health.score,
                healthLabel: vm.health.label,
                healthColor: healthColor,
                errorRate: Double(vm.errorCount) / max(1, Double(vm.totalMessageCount)),
                lastMessagePreview: vm.lastMessagePreview,
                lastMessageTime: vm.messages.last?.timestamp,
                totalMessages: vm.totalMessageCount
            )
            botStates.append(state)

            // Recent messages (last 2 per bot)
            for msg in vm.messages.suffix(2) {
                let widgetMsg = WidgetMessage(
                    id: msg.id,
                    botId: bot.id,
                    botEmoji: bot.emoji,
                    botName: bot.name,
                    content: String(msg.content.prefix(80)),
                    timestamp: msg.timestamp,
                    isUser: msg.sender == .user
                )
                recentMessages.append(widgetMsg)
            }
        }

        // Sort messages by recency
        recentMessages.sort { $0.timestamp > $1.timestamp }
        recentMessages = Array(recentMessages.prefix(5))

        let newData = WidgetData(
            botStates: botStates,
            recentMessages: recentMessages,
            quickSendButtons: quickSendButtons,
            lastUpdated: Date()
        )

        // Only write if data changed
        if newData != data {
            data = newData
            writeData()
            reloadWidgets()
        }
    }

    /// Force reload all widget timelines (call on significant events).
    func reloadWidgets() {
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadAllTimelines()
        Self.logger.info("Widget timelines reloaded")
        #endif
    }

    // MARK: - Quick Send Management

    func addQuickSendButton(_ button: QuickSendButton) {
        quickSendButtons.append(button)
        persistQuickSendButtons()
        writeData()
        reloadWidgets()
    }

    func removeQuickSendButton(_ id: String) {
        quickSendButtons.removeAll { $0.id == id }
        persistQuickSendButtons()
        writeData()
        reloadWidgets()
    }

    func updateQuickSendButton(_ button: QuickSendButton) {
        if let idx = quickSendButtons.firstIndex(where: { $0.id == button.id }) {
            quickSendButtons[idx] = button
            persistQuickSendButtons()
            writeData()
            reloadWidgets()
        }
    }

    // MARK: - App Group I/O

    private func writeData() {
        guard let url = containerURL?.appendingPathComponent("widget-data.json") else {
            Self.logger.warning("No App Group container available")
            return
        }
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let bytes = try encoder.encode(data)
            try bytes.write(to: url, options: .atomic)
            Self.logger.debug("Widget data written (\(bytes.count) bytes)")
        } catch {
            Self.logger.error("Failed to write widget data: \(error.localizedDescription)")
        }
    }

    /// Read widget data from the App Group container (used by the widget extension).
    static func readData() -> WidgetData {
        guard let url = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        )?.appendingPathComponent("widget-data.json") else {
            return .empty
        }
        do {
            let data = try Data(contentsOf: url)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(WidgetData.self, from: data)
        } catch {
            return .empty
        }
    }

    // MARK: - Quick Send Persistence

    private func loadQuickSendButtons() {
        guard let url = containerURL?.appendingPathComponent("quick-send.json") else { return }
        if let data = try? Data(contentsOf: url),
           let decoded = try? JSONDecoder().decode([QuickSendButton].self, from: data) {
            quickSendButtons = decoded
        } else {
            // Default buttons
            quickSendButtons = [
                QuickSendButton(label: "Status", targetBotId: "", targetBotName: "Any", message: "Give me a status report", icon: "gauge"),
                QuickSendButton(label: "Hello", targetBotId: "", targetBotName: "Any", message: "Hello!", icon: "hand.wave"),
            ]
        }
    }

    private func persistQuickSendButtons() {
        guard let url = containerURL?.appendingPathComponent("quick-send.json") else { return }
        if let data = try? JSONEncoder().encode(quickSendButtons) {
            try? data.write(to: url, options: .atomic)
        }
    }
}

// MARK: - Deep Link Handler

/// Handles deep links from widgets to the main app.
/// URL scheme: optaplus://bot/{botId}
///             optaplus://send/{botId}/{message}
enum WidgetDeepLinkHandler {

    /// Parse and execute a deep link URL.
    @MainActor
    static func handle(_ url: URL, appState: AppState) {
        guard url.scheme == "optaplus" else { return }
        let components = url.pathComponents.filter { $0 != "/" }

        switch url.host {
        case "bot":
            // Open/focus a specific bot
            guard let botId = components.first,
                  let bot = appState.bots.first(where: { $0.id == botId }) else { return }
            appState.selectBot(bot)
            NSApp.activate(ignoringOtherApps: true)

        case "send":
            // Send a message to a specific bot
            guard components.count >= 2 else { return }
            let botId = components[0]
            let message = components.dropFirst().joined(separator: "/")
                .removingPercentEncoding ?? components[1]

            guard let bot = appState.bots.first(where: { $0.id == botId }) else { return }
            let vm = appState.viewModel(for: bot)
            Task { await vm.send(message) }
            NSApp.activate(ignoringOtherApps: true)

        default:
            break
        }
    }
}

// MARK: - Widget Preview Views (for Main App Settings)

/// Settings panel for configuring widgets and quick-send buttons.
struct WidgetSettingsView: View {
    @StateObject private var provider = WidgetDataProvider.shared
    @EnvironmentObject var appState: AppState
    @State private var editingButton: QuickSendButton?
    @State private var showAddButton = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack(spacing: 8) {
                Image(systemName: "widget.small")
                    .font(.system(size: 16))
                    .foregroundColor(.optaPrimary)
                Text("Desktop Widgets")
                    .font(.sora(15, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                Spacer()

                Button(action: { provider.reloadWidgets() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 10))
                        Text("Refresh")
                            .font(.sora(10))
                    }
                    .foregroundColor(.optaPrimary)
                }
                .buttonStyle(.plain)
            }

            // Widget status
            HStack(spacing: 12) {
                widgetStatusCard(
                    "Bot Status",
                    icon: "circle.fill",
                    subtitle: "\(provider.data.botStates.filter(\.isConnected).count) connected"
                )
                widgetStatusCard(
                    "Message Feed",
                    icon: "text.bubble",
                    subtitle: "\(provider.data.recentMessages.count) recent"
                )
                widgetStatusCard(
                    "Quick Send",
                    icon: "bolt.circle",
                    subtitle: "\(provider.quickSendButtons.count) buttons"
                )
            }

            Divider().background(Color.optaBorder.opacity(0.3))

            // Quick-send button editor
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Quick Send Buttons")
                        .font(.sora(12, weight: .semibold))
                        .foregroundColor(.optaTextPrimary)
                    Spacer()
                    Button(action: { showAddButton = true }) {
                        Image(systemName: "plus")
                            .font(.system(size: 11))
                            .foregroundColor(.optaPrimary)
                    }
                    .buttonStyle(.plain)
                }

                ForEach(provider.quickSendButtons) { button in
                    quickSendRow(button)
                }

                if provider.quickSendButtons.isEmpty {
                    Text("No quick-send buttons configured")
                        .font(.sora(11))
                        .foregroundColor(.optaTextMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
            }

            // Last updated
            if provider.data.lastUpdated.timeIntervalSinceNow < -1 {
                Text("Last updated: \(provider.data.lastUpdated, style: .relative) ago")
                    .font(.sora(9))
                    .foregroundColor(.optaTextMuted)
            }
        }
        .padding(16)
        .onAppear {
            provider.update(from: appState)
        }
        .sheet(isPresented: $showAddButton) {
            QuickSendEditorSheet(
                button: QuickSendButton(label: "", targetBotId: appState.bots.first?.id ?? "", targetBotName: appState.bots.first?.name ?? "", message: ""),
                bots: appState.bots,
                isNew: true
            ) { newButton in
                provider.addQuickSendButton(newButton)
            }
        }
        .sheet(item: $editingButton) { button in
            QuickSendEditorSheet(button: button, bots: appState.bots, isNew: false) { updated in
                provider.updateQuickSendButton(updated)
            }
        }
    }

    private func widgetStatusCard(_ title: String, icon: String, subtitle: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(.optaPrimary)
            Text(title)
                .font(.sora(10, weight: .medium))
                .foregroundColor(.optaTextPrimary)
            Text(subtitle)
                .font(.sora(9))
                .foregroundColor(.optaTextMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.optaSurface.opacity(0.3))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.optaBorder.opacity(0.3), lineWidth: 0.5)
        )
    }

    private func quickSendRow(_ button: QuickSendButton) -> some View {
        HStack(spacing: 10) {
            Image(systemName: button.icon)
                .font(.system(size: 12))
                .foregroundColor(.optaPrimary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 1) {
                Text(button.label)
                    .font(.sora(11, weight: .medium))
                    .foregroundColor(.optaTextPrimary)
                HStack(spacing: 4) {
                    Text("-> \(button.targetBotName)")
                        .font(.sora(9))
                        .foregroundColor(.optaTextMuted)
                    Text("|")
                        .font(.sora(9))
                        .foregroundColor(.optaBorder)
                    Text(button.message.prefix(30))
                        .font(.sora(9))
                        .foregroundColor(.optaTextMuted)
                        .lineLimit(1)
                }
            }

            Spacer()

            Button(action: { editingButton = button }) {
                Image(systemName: "pencil")
                    .font(.system(size: 10))
                    .foregroundColor(.optaTextMuted)
            }
            .buttonStyle(.plain)

            Button(action: { provider.removeQuickSendButton(button.id) }) {
                Image(systemName: "trash")
                    .font(.system(size: 10))
                    .foregroundColor(.optaRed.opacity(0.6))
            }
            .buttonStyle(.plain)
        }
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(Color.optaSurface.opacity(0.2))
        )
    }
}

// MARK: - Quick Send Editor Sheet

struct QuickSendEditorSheet: View {
    @State var button: QuickSendButton
    let bots: [BotConfig]
    let isNew: Bool
    var onSave: (QuickSendButton) -> Void
    @Environment(\.dismiss) private var dismiss

    private let icons = ["paperplane", "bolt", "gauge", "hand.wave", "wrench", "play",
                         "arrow.clockwise", "checkmark.circle", "brain", "exclamationmark.triangle"]

    var body: some View {
        VStack(spacing: 16) {
            Text(isNew ? "Add Quick Send Button" : "Edit Quick Send Button")
                .font(.sora(14, weight: .semibold))
                .foregroundColor(.optaTextPrimary)

            // Label
            VStack(alignment: .leading, spacing: 4) {
                Text("Label")
                    .font(.sora(11, weight: .medium))
                    .foregroundColor(.optaTextSecondary)
                TextField("Button label", text: $button.label)
                    .textFieldStyle(.roundedBorder)
                    .font(.sora(12))
            }

            // Icon picker
            VStack(alignment: .leading, spacing: 4) {
                Text("Icon")
                    .font(.sora(11, weight: .medium))
                    .foregroundColor(.optaTextSecondary)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(icons, id: \.self) { icon in
                            Button(action: { button.icon = icon }) {
                                Image(systemName: icon)
                                    .font(.system(size: 14))
                                    .foregroundColor(button.icon == icon ? .optaPrimary : .optaTextSecondary)
                                    .frame(width: 28, height: 28)
                                    .background(
                                        RoundedRectangle(cornerRadius: 6)
                                            .fill(button.icon == icon ? Color.optaPrimaryDim : Color.optaSurface.opacity(0.3))
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }

            // Target bot
            VStack(alignment: .leading, spacing: 4) {
                Text("Target Bot")
                    .font(.sora(11, weight: .medium))
                    .foregroundColor(.optaTextSecondary)
                Picker("Bot", selection: $button.targetBotId) {
                    ForEach(bots) { bot in
                        HStack {
                            Text(bot.emoji)
                            Text(bot.name)
                        }
                        .tag(bot.id)
                    }
                }
                .onChange(of: button.targetBotId) { _, newId in
                    if let bot = bots.first(where: { $0.id == newId }) {
                        button.targetBotName = bot.name
                    }
                }
            }

            // Message
            VStack(alignment: .leading, spacing: 4) {
                Text("Message")
                    .font(.sora(11, weight: .medium))
                    .foregroundColor(.optaTextSecondary)
                TextField("Message to send", text: $button.message)
                    .textFieldStyle(.roundedBorder)
                    .font(.sora(12))
            }

            HStack {
                Button("Cancel") { dismiss() }
                    .foregroundColor(.optaTextSecondary)
                Spacer()
                Button("Save") {
                    onSave(button)
                    dismiss()
                }
                .foregroundColor(.optaPrimary)
                .font(.sora(13, weight: .semibold))
                .disabled(button.label.isEmpty || button.message.isEmpty)
            }
        }
        .padding(20)
        .frame(width: 380)
        .background(Color.optaVoid)
    }
}

// MARK: - Widget Extension Types (for the separate WidgetKit target)

// These types provide the structure for the actual WidgetKit extension.
// They would live in the extension target, but are defined here as reference.

/// Timeline entry for all widget types.
struct OptaPlusWidgetEntry: Sendable {
    let date: Date
    let data: WidgetData
}

// MARK: - Bot Status Widget View (Small)

struct BotStatusWidgetView: View {
    let bot: WidgetBotState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Bot header
            HStack(spacing: 6) {
                Text(bot.emoji)
                    .font(.system(size: 18))
                Text(bot.name)
                    .font(.sora(12, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                    .lineLimit(1)
            }

            Spacer()

            // Connection status
            HStack(spacing: 4) {
                Circle()
                    .fill(bot.isConnected ? Color.optaGreen : bot.isReconnecting ? Color.optaAmber : Color.optaRed)
                    .frame(width: 6, height: 6)
                Text(bot.isConnected ? "Connected" : bot.isReconnecting ? "Reconnecting" : "Offline")
                    .font(.sora(10))
                    .foregroundColor(.optaTextSecondary)
            }

            // Uptime
            if bot.isConnected {
                Text("Up \(bot.uptimeFormatted)")
                    .font(.sora(9))
                    .foregroundColor(.optaTextMuted)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.optaVoid)
    }
}

// MARK: - Message Feed Widget View (Medium)

struct MessageFeedWidgetView: View {
    let messages: [WidgetMessage]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Header
            HStack {
                Image(systemName: "bubble.left.and.bubble.right")
                    .font(.system(size: 10))
                    .foregroundColor(.optaPrimary)
                Text("Recent Messages")
                    .font(.sora(10, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                Spacer()
            }

            // Messages
            ForEach(messages.prefix(4)) { msg in
                HStack(spacing: 6) {
                    Text(msg.botEmoji)
                        .font(.system(size: 10))
                    Text(msg.content)
                        .font(.sora(10))
                        .foregroundColor(.optaTextPrimary)
                        .lineLimit(1)
                    Spacer()
                    Text(msg.timestamp, style: .relative)
                        .font(.sora(8))
                        .foregroundColor(.optaTextMuted)
                }
            }

            if messages.isEmpty {
                Text("No recent messages")
                    .font(.sora(10))
                    .foregroundColor(.optaTextMuted)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.optaVoid)
    }
}

// MARK: - Health Dashboard Widget View (Large)

struct HealthDashboardWidgetView: View {
    let bots: [WidgetBotState]

    private let columns = [
        GridItem(.flexible(), spacing: 8),
        GridItem(.flexible(), spacing: 8),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Image(systemName: "heart.text.square")
                    .font(.system(size: 12))
                    .foregroundColor(.optaPrimary)
                Text("Bot Health")
                    .font(.sora(11, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                Spacer()
            }

            // Bot grid
            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(bots) { bot in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 4) {
                            Text(bot.emoji)
                                .font(.system(size: 12))
                            Text(bot.name)
                                .font(.sora(10, weight: .medium))
                                .foregroundColor(.optaTextPrimary)
                                .lineLimit(1)
                        }

                        // Health bar
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(Color.optaSurface)
                                    .frame(height: 4)
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(bot.healthColor.swiftUIColor)
                                    .frame(width: geo.size.width * CGFloat(bot.healthScore) / 100, height: 4)
                            }
                        }
                        .frame(height: 4)

                        HStack(spacing: 4) {
                            Text("\(bot.healthScore)%")
                                .font(.system(size: 8, weight: .medium, design: .monospaced))
                                .foregroundColor(bot.healthColor.swiftUIColor)

                            if let latency = bot.latencyMs {
                                Text("\(Int(latency))ms")
                                    .font(.system(size: 8, design: .monospaced))
                                    .foregroundColor(.optaTextMuted)
                            }
                        }
                    }
                    .padding(8)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color.optaSurface.opacity(0.3))
                    )
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.optaVoid)
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let module_widget_deepLink = Notification.Name("module.widget.deepLink")
}

// MARK: - Module Registration

/// Integration point: wire widget data updates into the app lifecycle.
///
/// **To add:**
///   1. Call `WidgetModule.register(appState:)` in AppState.init()
///   2. Add WidgetSettingsView to the Settings sheet
///   3. Create a WidgetKit extension target with the actual widget configurations
///   4. Add the App Group capability to both the app and widget extension
///   5. Handle deep links via `onOpenURL { WidgetDeepLinkHandler.handle($0, appState:) }`
///
/// **To remove:**
///   Delete this file and the widget extension target. Remove register call
///   and settings view. App is completely unaffected.
@MainActor
enum WidgetModule {
    private static var cancellables = Set<AnyCancellable>()

    static func register(appState: AppState) {
        let provider = WidgetDataProvider.shared

        // Initial data write
        provider.update(from: appState)

        // Observe connection state changes
        for bot in appState.bots {
            let vm = appState.viewModel(for: bot)

            // Update widget on connection changes
            vm.$connectionState
                .removeDuplicates()
                .debounce(for: .seconds(1), scheduler: DispatchQueue.main)
                .sink { _ in
                    provider.update(from: appState)
                }
                .store(in: &cancellables)

            // Update widget on new messages
            vm.$messages
                .map(\.count)
                .removeDuplicates()
                .debounce(for: .seconds(2), scheduler: DispatchQueue.main)
                .sink { _ in
                    provider.update(from: appState)
                }
                .store(in: &cancellables)

            // Update widget on health changes
            vm.$health
                .removeDuplicates(by: { $0.score == $1.score })
                .debounce(for: .seconds(5), scheduler: DispatchQueue.main)
                .sink { _ in
                    provider.update(from: appState)
                }
                .store(in: &cancellables)
        }
    }
}
