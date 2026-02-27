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
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var filteredBots: [BotConfig] {
        if searchText.isEmpty { return appState.bots }
        return appState.bots.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    private var columns: [GridItem] {
        if sizeClass == .regular {
            return [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
        }
        return [GridItem(.flexible())]
    }

    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(filteredBots) { bot in
                    let vm = appState.viewModel(for: bot)
                    BotCard(bot: bot, connectionState: vm.connectionState, lastMessage: vm.messages.last)
                        .onTapGesture {
                            appState.selectBot(bot)
                        }
                        .contextMenu {
                            Button {
                                appState.viewModel(for: bot).connect()
                            } label: {
                                Label("Connect", systemImage: "bolt.fill")
                            }
                            Button {
                                appState.viewModel(for: bot).disconnect()
                            } label: {
                                Label("Disconnect", systemImage: "wifi.slash")
                            }
                            Button(role: .destructive) {
                                appState.removeBot(id: bot.id)
                            } label: {
                                Label("Remove", systemImage: "trash")
                            }
                        }
                }
            }
            .padding(16)
        }
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

// MARK: - Bot Card

struct BotCard: View {
    let bot: BotConfig
    let connectionState: ConnectionState
    let lastMessage: ChatMessage?

    private var glowColor: Color {
        switch connectionState {
        case .connected: return .optaGreen
        case .connecting, .reconnecting: return .optaAmber
        case .disconnected: return .clear
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                BotAvatarView(emoji: bot.emoji, connectionState: connectionState, size: 40)

                VStack(alignment: .leading, spacing: 2) {
                    Text(bot.name)
                        .font(.headline)
                        .foregroundColor(.optaTextPrimary)

                    Text(statusText)
                        .font(.caption2.weight(.medium))
                        .foregroundColor(statusColor)
                }

                Spacer()

                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
            }

            if let msg = lastMessage {
                Text(msg.content)
                    .font(.caption)
                    .foregroundColor(.optaTextMuted)
                    .lineLimit(2)
            } else {
                Text("No messages yet")
                    .font(.caption)
                    .foregroundColor(.optaTextMuted.opacity(0.5))
                    .italic()
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.optaBorder, lineWidth: 1)
                )
        )
        .shadow(color: glowColor.opacity(0.25), radius: connectionState == .connected ? 8 : 0)
    }

    private var statusText: String {
        switch connectionState {
        case .connected: return "Connected"
        case .connecting: return "Connecting…"
        case .reconnecting: return "Reconnecting…"
        case .disconnected: return "Offline"
        }
    }

    private var statusColor: Color {
        switch connectionState {
        case .connected: return .optaGreen
        case .connecting, .reconnecting: return .optaAmber
        case .disconnected: return .optaTextMuted
        }
    }
}
