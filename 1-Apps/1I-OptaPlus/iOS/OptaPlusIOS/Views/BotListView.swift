//
//  BotListView.swift
//  OptaPlusIOS
//

import SwiftUI
import OptaPlus
import OptaMolt

struct BotListView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        List(appState.bots, selection: Binding(
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
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .background(Color.optaVoid)
        .navigationTitle("Bots")
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

            VStack(alignment: .leading, spacing: 4) {
                Text(bot.name)
                    .font(.headline)
                    .foregroundColor(.optaTextPrimary)

                if let msg = lastMessage {
                    Text(msg.content)
                        .font(.subheadline)
                        .foregroundColor(.optaTextSecondary)
                        .lineLimit(1)
                } else {
                    Text(bot.host + ":\(bot.port)")
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                }
            }

            Spacer()

            statusDot
        }
        .padding(.vertical, 4)
        .listRowBackground(Color.optaSurface.opacity(0.5))
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
