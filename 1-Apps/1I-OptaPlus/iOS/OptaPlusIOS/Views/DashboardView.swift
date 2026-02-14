//
//  DashboardView.swift
//  OptaPlusIOS
//
//  Multi-bot monitoring dashboard — centered emoji cards with real-time activity states.
//

import SwiftUI
import OptaPlus
import OptaMolt

// MARK: - Dashboard View

struct DashboardView: View {
    @EnvironmentObject var appState: AppState
    @ObservedObject var activityFeed = ActivityFeedManager.shared
    @State private var selectedBotId: String?
    @State private var showSettings = false

    private let columns = [
        GridItem(.adaptive(minimum: 160, maximum: 300), spacing: 12)
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
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
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                            .foregroundColor(.optaTextSecondary)
                    }
                }
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
            .sheet(isPresented: $showSettings) {
                SettingsView()
                    .environmentObject(appState)
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

// MARK: - iOS Bot Card (Enhanced)

struct IOSBotCardView: View {
    let bot: BotConfig
    @ObservedObject var viewModel: ChatViewModel
    @State private var breathe = false
    @State private var rotationAngle: Double = 0

    private var isConnected: Bool {
        viewModel.connectionState == .connected
    }

    private var accentColor: Color {
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
        VStack(spacing: 10) {
            // Centered emoji with activity ring
            ZStack {
                // Thinking ring
                if viewModel.botState == .thinking {
                    Circle()
                        .trim(from: 0, to: 0.7)
                        .stroke(
                            AngularGradient(
                                colors: [.optaPrimary, .optaPrimary.opacity(0)],
                                center: .center
                            ),
                            style: StrokeStyle(lineWidth: 2.5, lineCap: .round)
                        )
                        .frame(width: 52, height: 52)
                        .rotationEffect(.degrees(rotationAngle))
                        .onAppear {
                            withAnimation(.linear(duration: 1.0).repeatForever(autoreverses: false)) {
                                rotationAngle = 360
                            }
                        }
                        .onDisappear { rotationAngle = 0 }
                }

                // Idle breathing glow
                if isConnected && viewModel.botState == .idle {
                    Circle()
                        .fill(accentColor.opacity(breathe ? 0.15 : 0.05))
                        .frame(width: 52, height: 52)
                        .animation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true), value: breathe)
                }

                Text(bot.emoji)
                    .font(.system(size: 32))
            }
            .frame(height: 56)
            .onAppear { breathe = true }

            // Bot name
            Text(bot.name)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.optaTextPrimary)

            // Connection + route badge
            HStack(spacing: 4) {
                Circle()
                    .fill(isConnected ? Color.green : viewModel.connectionState == .disconnected ? Color.gray : Color.optaAmber)
                    .frame(width: 6, height: 6)

                Text(connectionLabel)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.optaTextMuted)
            }

            // Activity state label
            activityLabel

            // Last message preview
            if let preview = viewModel.lastMessagePreview {
                Text(preview)
                    .font(.system(size: 11))
                    .foregroundColor(.optaTextMuted)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            // Stats row
            HStack(spacing: 6) {
                Text("\(viewModel.health.score)")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundColor(viewModel.health.color)

                Text("·")
                    .foregroundColor(.optaTextMuted)

                Text(viewModel.formattedUptime)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.optaTextSecondary)

                Text("·")
                    .foregroundColor(.optaTextMuted)

                Text("\(viewModel.totalMessageCount) msgs")
                    .font(.system(size: 11))
                    .foregroundColor(.optaTextSecondary)
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.optaElevated)
                .shadow(color: accentColor.opacity(isConnected ? 0.25 : 0.06), radius: isConnected ? 10 : 3)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(accentColor.opacity(isConnected ? 0.2 : 0.06), lineWidth: 1)
        )
    }

    private var connectionLabel: String {
        switch viewModel.connectionState {
        case .connected:
            switch viewModel.connectionRoute {
            case .lan: return "LAN"
            case .remote: return "Remote"
            case .unknown: return "Connected"
            }
        case .connecting: return "Connecting..."
        case .reconnecting: return "Reconnecting..."
        case .disconnected: return "Offline"
        }
    }

    @ViewBuilder
    private var activityLabel: some View {
        switch viewModel.botState {
        case .thinking:
            HStack(spacing: 4) {
                ProgressView()
                    .scaleEffect(0.6)
                    .tint(.optaPrimary)
                Text("Thinking...")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.optaPrimary)
            }
        case .typing:
            HStack(spacing: 3) {
                StreamingDots()
                Text("Responding...")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.optaPrimary)
            }
        default:
            EmptyView()
        }
    }
}

// MARK: - Streaming Dots Animation

struct StreamingDots: View {
    @State private var phase = 0

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(Color.optaPrimary)
                    .frame(width: 4, height: 4)
                    .opacity(phase == i ? 1.0 : 0.3)
            }
        }
        .onAppear {
            Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { _ in
                withAnimation(.easeInOut(duration: 0.2)) {
                    phase = (phase + 1) % 3
                }
            }
        }
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
