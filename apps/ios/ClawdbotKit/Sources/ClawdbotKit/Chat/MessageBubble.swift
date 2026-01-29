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
/// - Streaming messages: bot-aligned with pulsing indicator
public struct MessageBubble: View {
    /// The message to display (nil for streaming content)
    private let message: ChatMessage?

    /// Streaming content (used when message is nil)
    private let streamingContent: String?

    /// Sender for streaming messages
    private let streamingSender: MessageSender?

    /// Whether this bubble shows streaming content
    private var isStreaming: Bool {
        streamingContent != nil
    }

    /// Initialize with a chat message
    public init(message: ChatMessage) {
        self.message = message
        self.streamingContent = nil
        self.streamingSender = nil
    }

    /// Initialize with streaming content (bot message in progress)
    /// - Parameters:
    ///   - streamingContent: The partial content accumulated so far
    ///   - sender: The bot sender (defaults to generic bot)
    public init(streamingContent: String, sender: MessageSender = .bot(name: "Clawdbot")) {
        self.message = nil
        self.streamingContent = streamingContent
        self.streamingSender = sender
    }

    // MARK: - Computed Properties

    /// The content to display (from message or streaming)
    private var displayContent: String {
        if let streaming = streamingContent {
            return streaming
        }
        return message?.content ?? ""
    }

    /// The sender (from message or streaming)
    private var displaySender: MessageSender {
        if let sender = streamingSender {
            return sender
        }
        return message?.sender ?? .bot(name: "Unknown")
    }

    /// Whether this is a user message
    private var isUserMessage: Bool {
        // Streaming messages are always from bot
        if isStreaming { return false }

        if case .user = displaySender {
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
                // Message content with streaming cursor
                HStack(spacing: 0) {
                    Text(displayContent)
                        .foregroundColor(textColor)

                    // Streaming cursor indicator
                    if isStreaming {
                        StreamingCursor()
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(bubbleBackground)
                )

                // Status indicator and timestamp (not shown during streaming)
                if !isStreaming {
                    HStack(spacing: 4) {
                        // Status icon (only for user messages)
                        if isUserMessage {
                            statusIcon
                        }

                        // Timestamp
                        if let msg = message {
                            Text(msg.timestamp.formatted(date: .omitted, time: .shortened))
                                .font(.caption2)
                                .foregroundColor(.clawdbotTextMuted)
                        }
                    }
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
        guard let msg = message else {
            // Streaming messages don't show status
            return ("circle", .clawdbotTextMuted)
        }
        switch msg.status {
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

// MARK: - Streaming Cursor

/// Animated cursor shown at end of streaming message
private struct StreamingCursor: View {
    @State private var isAnimating = false

    var body: some View {
        Circle()
            .fill(Color.clawdbotTextPrimary)
            .frame(width: 8, height: 8)
            .opacity(isAnimating ? 1.0 : 0.3)
            .animation(
                .easeInOut(duration: 0.5)
                .repeatForever(autoreverses: true),
                value: isAnimating
            )
            .onAppear {
                isAnimating = true
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

            // Streaming message preview
            MessageBubble(
                streamingContent: "I'm currently typing this response",
                sender: .bot(name: "Clawdbot")
            )
        }
        .padding()
        .background(Color.clawdbotBackground)
        .previewLayout(.sizeThatFits)
    }
}
#endif
