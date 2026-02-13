//
//  MessageBubble.swift
//  OptaPlusIOS
//

import SwiftUI
import OptaPlus
import OptaMolt

struct MessageBubble: View {
    let message: ChatMessage
    let botName: String

    private var isUser: Bool {
        message.sender == .user
    }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 60) }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.body)
                    .foregroundColor(.optaTextPrimary)
                    .textSelection(.enabled)

                Text(message.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundColor(.optaTextMuted)
            }
            .padding(12)
            .background(bubbleBackground)

            if !isUser { Spacer(minLength: 60) }
        }
    }

    @ViewBuilder
    private var bubbleBackground: some View {
        if isUser {
            RoundedRectangle(cornerRadius: 16)
                .fill(
                    LinearGradient(
                        colors: [Color.optaPrimary.opacity(0.6), Color.optaPrimary.opacity(0.3)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.optaPrimary.opacity(0.3), lineWidth: 1)
                )
        } else {
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.optaElevated)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.optaBorder, lineWidth: 1)
                )
        }
    }
}
