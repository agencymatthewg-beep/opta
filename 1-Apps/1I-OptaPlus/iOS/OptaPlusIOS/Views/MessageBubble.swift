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

    /// Detect emoji-only messages (1-3 emoji, no other chars)
    private var isEmojiOnly: Bool {
        let trimmed = message.content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed.count <= 3 else { return false }
        return trimmed.allSatisfy { char in
            char.unicodeScalars.allSatisfy { scalar in
                scalar.properties.isEmoji && scalar.properties.isEmojiPresentation
                || (scalar.value >= 0x200D) // ZWJ and variation selectors
                || (scalar.value >= 0xFE00 && scalar.value <= 0xFE0F)
            }
        }
    }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 60) }

            if isEmojiOnly {
                Text(message.content)
                    .font(.system(size: 48))
                    .contextMenu {
                        Button {
                            UIPasteboard.general.string = message.content
                        } label: {
                            Label("Copy", systemImage: "doc.on.doc")
                        }
                    }
            } else {
                VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                    Text(message.content)
                        .font(.body)
                        .foregroundColor(.optaTextPrimary)
                        .textSelection(.enabled)
                }
                .padding(12)
                .background(bubbleBackground)
                .contextMenu {
                    Button {
                        UIPasteboard.general.string = message.content
                    } label: {
                        Label("Copy", systemImage: "doc.on.doc")
                    }
                }
            }

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
