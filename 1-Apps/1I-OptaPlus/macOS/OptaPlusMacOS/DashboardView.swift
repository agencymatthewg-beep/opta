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
                            .font(.sora(28, weight: .bold))
                            .foregroundColor(.optaTextPrimary)

                        Spacer()

                        Button("Connect All") {
                            connectAll()
                        }
                        .buttonStyle(.bordered)
                        .tint(.optaGreen)

                        Button("Disconnect All") {
                            disconnectAll()
                        }
                        .buttonStyle(.bordered)
                        .tint(.optaRed)
                    }
                    .padding(.horizontal)

                    // Bot Grid
                    if appState.bots.isEmpty {
                        VStack(spacing: 16) {
                            Image(systemName: "cpu")
                                .font(.system(size: 40))
                                .foregroundColor(.optaTextMuted.opacity(0.4))

                            Text("No bots configured")
                                .font(.sora(16, weight: .medium))
                                .foregroundColor(.optaTextSecondary)

                            Text("Add a bot in Settings to start monitoring")
                                .font(.sora(13))
                                .foregroundColor(.optaTextMuted)

                            Button(action: { appState.showingSettings = true }) {
                                HStack(spacing: 6) {
                                    Image(systemName: "plus.circle")
                                        .font(.system(size: 13))
                                    Text("Open Settings")
                                        .font(.sora(13, weight: .medium))
                                }
                                .foregroundColor(.optaPrimary)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(Capsule().fill(Color.optaPrimary.opacity(0.12)))
                                .overlay(Capsule().stroke(Color.optaPrimary.opacity(0.3), lineWidth: 0.5))
                            }
                            .buttonStyle(.plain)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 60)
                    } else {
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
                    }

                    // Activity Feed
                    if !activityFeed.events.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Activity")
                                .font(.sora(18, weight: .semibold))
                                .foregroundColor(.optaTextPrimary)
                                .padding(.horizontal)

                            VStack(spacing: 2) {
                                ForEach(activityFeed.events) { event in
                                    ActivityEventRow(event: event)
                                        .transition(.opacity.combined(with: .move(edge: .top)))
                                }
                            }
                        }
                        .animation(.optaSpring, value: activityFeed.events.count)
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
    @State private var isHovered = false

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
                        .font(.sora(16, weight: .semibold))
                        .foregroundColor(.optaTextPrimary)

                    HStack(spacing: 6) {
                        // Animated status dot
                        Circle()
                            .fill(isConnected ? Color.optaGreen : Color.optaTextMuted)
                            .frame(width: 8, height: 8)

                        Text(connectionLabel)
                            .font(.sora(12))
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
                    .font(.sora(12))
                    .foregroundColor(.optaTextMuted)
                    .lineLimit(2)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.optaElevated)
                .shadow(color: accentColor.opacity(isHovered ? 0.4 : (isConnected ? 0.3 : 0.08)),
                        radius: isHovered ? 16 : (isConnected ? 12 : 4),
                        y: isHovered ? 4 : 0)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(accentColor.opacity(isHovered ? 0.5 : (isConnected ? 0.3 : 0.1)), lineWidth: isHovered ? 1.5 : 1)
        )
        .scaleEffect(isHovered ? 1.02 : 1)
        .animation(.optaSnap, value: isHovered)
        .onHover { isHovered = $0 }
        .onAppear { pulse = true }
        .accessibilityLabel("\(bot.name), \(connectionLabel), health \(viewModel.health.score)")
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
    @State private var isHovered = false

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: event.icon)
                .font(.system(size: 12))
                .foregroundColor(event.iconColor)
                .frame(width: 20)

            Text(event.botEmoji)
                .font(.system(size: 14))

            Text("\(event.botName) \(event.message)")
                .font(.sora(13))
                .foregroundColor(.optaTextSecondary)
                .lineLimit(1)

            Spacer()

            Text(event.relativeTime)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.optaTextMuted)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(isHovered ? Color.optaSurface.opacity(0.4) : Color.clear)
        )
        .animation(.optaSnap, value: isHovered)
        .onHover { isHovered = $0 }
    }
}
