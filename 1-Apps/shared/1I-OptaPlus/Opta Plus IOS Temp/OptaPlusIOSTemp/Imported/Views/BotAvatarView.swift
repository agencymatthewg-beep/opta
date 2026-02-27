//
//  BotAvatarView.swift
//  OptaPlusIOS
//

import SwiftUI
import OptaPlus
import OptaMolt

struct BotAvatarView: View {
    let emoji: String
    let connectionState: ConnectionState
    var size: CGFloat = 40

    @State private var pulseScale: CGFloat = 1.0

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.optaSurface)
                .frame(width: size, height: size)

            if connectionState == .connected {
                Circle()
                    .stroke(Color.optaPrimary.opacity(0.4), lineWidth: 2)
                    .frame(width: size + 4, height: size + 4)
                    .scaleEffect(pulseScale)
                    .opacity(2.0 - Double(pulseScale))
                    .onAppear {
                        withAnimation(.spring(response: 1.5, dampingFraction: 0.3).repeatForever(autoreverses: false)) {
                            pulseScale = 1.5
                        }
                    }
            }

            Circle()
                .stroke(ringColor, lineWidth: 2)
                .frame(width: size + 2, height: size + 2)

            Text(emoji)
                .font(.system(size: size * 0.5))
        }
    }

    private var ringColor: Color {
        switch connectionState {
        case .connected: return .optaPrimary
        case .connecting, .reconnecting: return .optaAmber
        case .disconnected: return .optaTextMuted.opacity(0.3)
        }
    }
}
