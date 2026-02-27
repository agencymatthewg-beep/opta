//
//  BotPageHeader.swift
//  OptaPlusIOS
//
//  Glass-styled header showing bot identity and connection status per pager page.
//

import SwiftUI
import OptaPlus
import OptaMolt

struct BotPageHeader: View {
    let bot: BotConfig
    @ObservedObject var viewModel: ChatViewModel
    var compact: Bool = false

    private var isConnected: Bool { viewModel.connectionState == .connected }

    var body: some View {
        HStack(spacing: 10) {
            Text(bot.emoji)
                .font(.system(size: compact ? 20 : 28))
                .ambientFloat(amplitude: isConnected ? 2.5 : 0, period: 4.0)

            VStack(alignment: .leading, spacing: compact ? 0 : 2) {
                HStack(spacing: 6) {
                    Text(bot.name)
                        .font(.system(size: compact ? 15 : 17, weight: .semibold))
                        .foregroundColor(.optaTextPrimary)

                    ConnectionPulseDot(
                        color: connectionDotColor,
                        size: 7,
                        isConnecting: viewModel.connectionState == .connecting
                    )
                }

                if !compact {
                    HStack(spacing: 8) {
                        // Channel indicator
                        if let ct = viewModel.activeSession?.channelType {
                            HStack(spacing: 4) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(ct.color)
                                    .frame(width: 3, height: 10)
                                Text(ct.label)
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundColor(ct.color)
                            }
                        }

                        Text(connectionLabel)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.optaTextMuted)

                        if isConnected, viewModel.sessions.count > 1 {
                            Text("\(viewModel.sessions.count) chats")
                                .font(.system(size: 10))
                                .foregroundColor(.optaTextMuted)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Capsule().fill(Color.optaSurface))
                        }

                        if let state = botStateText {
                            Text(state)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(.optaPrimary)
                        }
                    }
                }
            }

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, compact ? 6 : 10)
        .glassSubtle()
        .optaEntrance()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(bot.name), \(connectionLabel)")
    }

    private var connectionDotColor: Color {
        switch viewModel.connectionState {
        case .connected: return .optaGreen
        case .connecting, .reconnecting: return .optaAmber
        case .disconnected: return .optaTextMuted
        }
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

    private var botStateText: String? {
        switch viewModel.botState {
        case .thinking: return "Thinking..."
        case .typing: return "Responding..."
        default: return nil
        }
    }
}
