//
//  DashboardView.swift
//  OptaPlusIOS
//
//  Multi-bot monitoring dashboard for iOS — grid cards with health, uptime, and activity feed.
//

import SwiftUI
import OptaPlus
import OptaMolt

// MARK: - Dashboard View

struct DashboardView: View {
    @EnvironmentObject var appState: AppState
    @ObservedObject var activityFeed = ActivityFeedManager.shared
    @State private var selectedBotId: String?

    private let columns = [
        GridItem(.adaptive(minimum: 160, maximum: 300), spacing: 12)
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Bot Grid
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(appState.bots) { bot in
                            let vm = appState.viewModel(for: bot)
                            IOSBotCardView(bot: bot, viewModel: vm)
                                .onTapGesture {
                                    appState.selectBot(bot)
                                    selectedBotId = bot.id
                                }
                        }
                    }
                    .padding(.horizontal)

                    // Activity Feed
                    if !activityFeed.events.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Activity")
                                .font(.headline)
                                .foregroundColor(.optaTextPrimary)
                                .padding(.horizontal)

                            ForEach(activityFeed.events) { event in
                                IOSActivityRow(event: event)
                                    .transition(.opacity.combined(with: .move(edge: .top)))
                            }
                        }
                        .animation(.easeInOut(duration: 0.3), value: activityFeed.events.count)
                    }
                }
                .padding(.top, 8)
            }
            .background(Color.optaVoid)
            .navigationTitle("Dashboard")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button("Connect All") { connectAll() }
                        Button("Disconnect All") { disconnectAll() }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .refreshable {
                connectAll()
            }
            .navigationDestination(item: $selectedBotId) { botId in
                if let bot = appState.bots.first(where: { $0.id == botId }) {
                    ChatView(viewModel: appState.viewModel(for: bot), botConfig: bot)
                }
            }
        }
    }

    private func connectAll() {
        for bot in appState.bots {
            let vm = appState.viewModel(for: bot)
            if vm.connectionState == .disconnected {
                vm.connect()
            }
        }
    }

    private func disconnectAll() {
        for bot in appState.bots {
            appState.viewModel(for: bot).disconnect()
        }
    }
}

// MARK: - iOS Bot Card

struct IOSBotCardView: View {
    let bot: BotConfig
    @ObservedObject var viewModel: ChatViewModel
    @State private var pulse = false

    private var isConnected: Bool {
        viewModel.connectionState == .connected
    }

    private var accentColor: Color {
        // Simplified accent — iOS doesn't have the macOS botAccentColor helper
        switch bot.name {
        case "Opta Max": return .red
        case "Opta512": return .purple
        case "Mono": return .green
        case "Floda": return .orange
        case "Saturday": return .blue
        case "YJ": return .yellow
        default: return .purple
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(bot.emoji)
                    .font(.system(size: 24))

                Spacer()

                // Status dot
                Circle()
                    .fill(isConnected ? Color.green : Color.gray)
                    .frame(width: 8, height: 8)
                    .scaleEffect(pulse && isConnected ? 1.3 : 1.0)
                    .animation(
                        isConnected ? .easeInOut(duration: 1.2).repeatForever(autoreverses: true) : .default,
                        value: pulse
                    )
            }

            Text(bot.name)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.optaTextPrimary)

            HStack(spacing: 8) {
                // Health
                Text("\(viewModel.health.score)")
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundColor(viewModel.health.color)

                Text("•")
                    .foregroundColor(.optaTextMuted)

                // Uptime
                Text(viewModel.formattedUptime)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.optaTextSecondary)

                Text("•")
                    .foregroundColor(.optaTextMuted)

                // Messages
                Text("\(viewModel.totalMessageCount) msgs")
                    .font(.system(size: 12))
                    .foregroundColor(.optaTextSecondary)
            }

            if let preview = viewModel.lastMessagePreview {
                Text(preview)
                    .font(.system(size: 11))
                    .foregroundColor(.optaTextMuted)
                    .lineLimit(2)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.optaElevated)
                .shadow(color: accentColor.opacity(isConnected ? 0.3 : 0.08), radius: isConnected ? 10 : 3)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(accentColor.opacity(isConnected ? 0.25 : 0.08), lineWidth: 1)
        )
        .onAppear { pulse = true }
    }
}

// MARK: - iOS Activity Row

struct IOSActivityRow: View {
    let event: ActivityEvent

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: event.icon)
                .font(.system(size: 11))
                .foregroundColor(event.iconColor)
                .frame(width: 18)

            Text(event.botEmoji)
                .font(.system(size: 13))

            Text("\(event.botName) \(event.message)")
                .font(.system(size: 12))
                .foregroundColor(.optaTextSecondary)
                .lineLimit(1)

            Spacer()

            Text(event.relativeTime)
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(.optaTextMuted)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 4)
    }
}
