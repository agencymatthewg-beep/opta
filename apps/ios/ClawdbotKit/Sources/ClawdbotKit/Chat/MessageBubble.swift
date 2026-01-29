//
//  MessageBubble.swift
//  ClawdbotKit
//
//  Chat bubble view for rendering individual messages.
//  User messages align right with accent color, bot messages align left.
//

import SwiftUI

/// A chat message bubble with sender-based styling
///
/// Layout:
/// - User messages: right-aligned with clawdbotPurple background
/// - Bot messages: left-aligned with clawdbotSurface background
public struct MessageBubble: View {
    /// The message to display
    public let message: ChatMessage

    /// Initialize with a chat message
    public init(message: ChatMessage) {
        self.message = message
    }

    // MARK: - Computed Properties

    /// Whether this is a user message
    private var isUserMessage: Bool {
        if case .user = message.sender {
            return true
        }
        return false
    }

    /// Background color based on sender
    private var bubbleBackground: Color {
        isUserMessage ? .clawdbotPurple : .clawdbotSurface
    }

    /// Text color based on sender
    private var textColor: Color {
        isUserMessage ? .white : .clawdbotTextPrimary
    }

    /// Horizontal alignment based on sender
    private var alignment: HorizontalAlignment {
        isUserMessage ? .trailing : .leading
    }

    // MARK: - Body

    public var body: some View {
        HStack {
            if isUserMessage {
                Spacer(minLength: 60)
            }

            VStack(alignment: alignment, spacing: 4) {
                // Message content
                Text(message.content)
                    .foregroundColor(textColor)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(bubbleBackground)
                    )

                // Status indicator and timestamp
                HStack(spacing: 4) {
                    // Status icon (only for user messages)
                    if isUserMessage {
                        statusIcon
                    }

                    // Timestamp
                    Text(message.timestamp.formatted(date: .omitted, time: .shortened))
                        .font(.caption2)
                        .foregroundColor(.clawdbotTextMuted)
                }
            }

            if !isUserMessage {
                Spacer(minLength: 60)
            }
        }
    }

    // MARK: - Status Icon

    /// Status indicator icon for user messages
    @ViewBuilder
    private var statusIcon: some View {
        let (iconName, iconColor) = statusIconInfo

        Image(systemName: iconName)
            .font(.caption2)
            .foregroundColor(iconColor)
    }

    /// Get icon name and color based on message status
    private var statusIconInfo: (name: String, color: Color) {
        switch message.status {
        case .pending:
            return ("clock", .clawdbotTextMuted)
        case .sent:
            return ("checkmark", .clawdbotTextSecondary)
        case .delivered:
            return ("checkmark.circle", .clawdbotGreen)
        case .failed:
            return ("exclamationmark.triangle", .clawdbotRed)
        }
    }
}

// MARK: - Preview

#if DEBUG
struct MessageBubble_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 12) {
            MessageBubble(message: ChatMessage(
                content: "Hello! How can I help you today?",
                sender: .bot(name: "Clawdbot"),
                status: .delivered
            ))

            MessageBubble(message: ChatMessage(
                content: "What's the weather like?",
                sender: .user,
                status: .delivered
            ))

            MessageBubble(message: ChatMessage(
                content: "Sending...",
                sender: .user,
                status: .pending
            ))

            MessageBubble(message: ChatMessage(
                content: "This message failed to send",
                sender: .user,
                status: .failed
            ))
        }
        .padding()
        .background(Color.clawdbotBackground)
        .previewLayout(.sizeThatFits)
    }
}
#endif
