//
//  BotListView.swift
//  OptaPlusIOS
//

import SwiftUI
import OptaPlus
import OptaMolt

struct BotListView: View {
    @EnvironmentObject var appState: AppState
    @State private var searchText = ""

    private var filteredBots: [BotConfig] {
        if searchText.isEmpty { return appState.bots }
        return appState.bots.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        List(filteredBots, selection: Binding(
            get: { appState.selectedBotId },
            set: { newId in
                if let id = newId, let bot = appState.bots.first(where: { $0.id == id }) {
                    appState.selectBot(bot)
                }
            }
        )) { bot in
            let vm = appState.viewModel(for: bot)
            BotRow(bot: bot, connectionState: vm.connectionState, lastMessage: vm.messages.last)
                .tag(bot.id)
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    Button(role: .destructive) {
                        appState.viewModel(for: bot).disconnect()
                    } label: {
                        Label("Disconnect", systemImage: "wifi.slash")
                    }
                    .tint(.optaRed)
                }
                .swipeActions(edge: .leading, allowsFullSwipe: false) {
                    Button {
                        appState.viewModel(for: bot).connect()
                    } label: {
                        Label("Connect", systemImage: "bolt.fill")
                    }
                    .tint(.optaPrimary)
                }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .background(Color.optaVoid)
        .navigationTitle("Bots")
        .searchable(text: $searchText, prompt: "Search bots")
        .refreshable {
            for bot in appState.bots {
                let vm = appState.viewModel(for: bot)
                if vm.connectionState == .disconnected {
                    vm.connect()
                }
            }
            try? await Task.sleep(nanoseconds: 500_000_000)
        }
    }
}

// MARK: - Bot Row

struct BotRow: View {
    let bot: BotConfig
    let connectionState: ConnectionState
    let lastMessage: ChatMessage?

    var body: some View {
        HStack(spacing: 12) {
            BotAvatarView(emoji: bot.emoji, connectionState: connectionState, size: 44)

            VStack(alignment: .leading, spacing: 3) {
                Text(bot.name)
                    .font(.headline)
                    .foregroundColor(.optaTextPrimary)

                Text(connectionStatusText)
                    .font(.caption2.weight(.medium))
                    .foregroundColor(statusColor)

                if let msg = lastMessage {
                    Text(msg.content)
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                        .lineLimit(1)
                }
            }

            Spacer()

            statusDot
        }
        .padding(.vertical, 4)
        .listRowBackground(Color.optaSurface.opacity(0.5))
    }

    private var connectionStatusText: String {
        switch connectionState {
        case .connected: return "Connected"
        case .connecting: return "Connecting…"
        case .reconnecting: return "Reconnecting…"
        case .disconnected: return "Offline"
        }
    }

    private var statusDot: some View {
        Circle()
            .fill(statusColor)
            .frame(width: 8, height: 8)
    }

    private var statusColor: Color {
        switch connectionState {
        case .connected: return .optaGreen
        case .connecting, .reconnecting: return .optaAmber
        case .disconnected: return .optaTextMuted
        }
    }
}
