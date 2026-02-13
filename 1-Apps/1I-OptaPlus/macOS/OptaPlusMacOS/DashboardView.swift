//
//  DashboardView.swift
//  OptaPlusMacOS
//
//  Multi-bot monitoring dashboard — grid of bot cards with health, uptime, and activity feed.
//

import SwiftUI
import OptaPlus
import OptaMolt

// MARK: - Dashboard View

struct DashboardView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var windowState: WindowState
    @ObservedObject var activityFeed = ActivityFeedManager.shared
    @State private var showDashboard = false

    private let columns = [
        GridItem(.adaptive(minimum: 280, maximum: 400), spacing: 16)
    ]

    var body: some View {
        ZStack {
            Color.optaVoid.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Header
                    HStack {
                        Text("Dashboard")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundColor(.optaTextPrimary)

                        Spacer()

                        Button("Connect All") {
                            connectAll()
                        }
                        .buttonStyle(.bordered)
                        .tint(.green)

                        Button("Disconnect All") {
                            disconnectAll()
                        }
                        .buttonStyle(.bordered)
                        .tint(.red)
                    }
                    .padding(.horizontal)

                    // Bot Grid
                    LazyVGrid(columns: columns, spacing: 16) {
                        ForEach(appState.bots) { bot in
                            let vm = appState.viewModel(for: bot)
                            BotCardView(bot: bot, viewModel: vm)
                                .onTapGesture {
                                    windowState.selectBot(bot, in: appState)
                                }
                        }
                    }
                    .padding(.horizontal)

                    // Activity Feed
                    if !activityFeed.events.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Activity")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundColor(.optaTextPrimary)
                                .padding(.horizontal)

                            VStack(spacing: 2) {
                                ForEach(activityFeed.events) { event in
                                    ActivityEventRow(event: event)
                                        .transition(.opacity.combined(with: .move(edge: .top)))
                                }
                            }
                        }
                        .animation(.easeInOut(duration: 0.3), value: activityFeed.events.count)
                    }

                    Spacer(minLength: 40)
                }
                .padding(.top, 20)
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
            let vm = appState.viewModel(for: bot)
            vm.disconnect()
        }
    }
}

// MARK: - Bot Card

struct BotCardView: View {
    let bot: BotConfig
    @ObservedObject var viewModel: ChatViewModel
    @State private var pulse = false

    private var accentColor: Color {
        botAccentColor(for: bot)
    }

    private var isConnected: Bool {
        viewModel.connectionState == .connected
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header: emoji, name, status dot
            HStack {
                Text(bot.emoji)
                    .font(.system(size: 28))

                VStack(alignment: .leading, spacing: 2) {
                    Text(bot.name)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.optaTextPrimary)

                    HStack(spacing: 6) {
                        // Animated status dot
                        Circle()
                            .fill(isConnected ? Color.green : Color.gray)
                            .frame(width: 8, height: 8)
                            .scaleEffect(pulse && isConnected ? 1.3 : 1.0)
                            .animation(
                                isConnected ? .easeInOut(duration: 1.2).repeatForever(autoreverses: true) : .default,
                                value: pulse
                            )

                        Text(connectionLabel)
                            .font(.system(size: 12))
                            .foregroundColor(.optaTextSecondary)
                    }
                }

                Spacer()

                // Health score badge
                Text("\(viewModel.health.score)")
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundColor(viewModel.health.color)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(viewModel.health.color.opacity(0.15))
                    .clipShape(Capsule())
            }

            Divider().opacity(0.3)

            // Stats row
            HStack(spacing: 16) {
                StatPill(icon: "clock", label: viewModel.formattedUptime)
                StatPill(icon: "message", label: "\(viewModel.totalMessageCount)")
                if let avg = viewModel.stats.averageResponseTime {
                    StatPill(icon: "bolt", label: avg < 1 ? String(format: "%.0fms", avg * 1000) : String(format: "%.1fs", avg))
                }
            }

            // Last message preview
            if let preview = viewModel.lastMessagePreview {
                Text(preview)
                    .font(.system(size: 12))
                    .foregroundColor(.optaTextMuted)
                    .lineLimit(2)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.optaElevated)
                .shadow(color: accentColor.opacity(isConnected ? 0.3 : 0.08), radius: isConnected ? 12 : 4)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(accentColor.opacity(isConnected ? 0.3 : 0.1), lineWidth: 1)
        )
        .onAppear { pulse = true }
    }

    private var connectionLabel: String {
        switch viewModel.connectionState {
        case .connected: return "Connected"
        case .connecting: return "Connecting…"
        case .disconnected: return "Disconnected"
        case .reconnecting: return "Reconnecting…"
        }
    }
}

// MARK: - Stat Pill

struct StatPill: View {
    let icon: String
    let label: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 10))
                .foregroundColor(.optaTextMuted)
            Text(label)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.optaTextSecondary)
        }
    }
}

// MARK: - Activity Event Row

struct ActivityEventRow: View {
    let event: ActivityEvent

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: event.icon)
                .font(.system(size: 12))
                .foregroundColor(event.iconColor)
                .frame(width: 20)

            Text(event.botEmoji)
                .font(.system(size: 14))

            Text("\(event.botName) \(event.message)")
                .font(.system(size: 13))
                .foregroundColor(.optaTextSecondary)
                .lineLimit(1)

            Spacer()

            Text(event.relativeTime)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.optaTextMuted)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
    }
}
