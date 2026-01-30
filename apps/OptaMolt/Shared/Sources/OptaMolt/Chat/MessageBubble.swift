//
//  MessageBubble.swift
//  OptaMolt
//
//  Chat bubble view for rendering individual messages.
//  User messages align right with accent color, bot messages align left.
//

import SwiftUI

/// A chat message bubble with sender-based styling
///
/// Layout:
/// - User messages: right-aligned with optaPurple background
/// - Bot messages: left-aligned with optaSurface background
/// - Streaming messages: bot-aligned with optional typing cursor
public struct MessageBubble: View {
    /// The message to display (nil for streaming content)
    private let message: ChatMessage?

    /// Streaming content (used when message is nil)
    private let streamingContent: String?

    /// Sender for streaming messages
    private let streamingSender: MessageSender?

    /// Whether to show the typing cursor (blinking vertical bar)
    /// Only shown when botState is .typing
    private let showTypingCursor: Bool

    /// Whether this bubble shows streaming content
    private var isStreaming: Bool {
        streamingContent != nil
    }

    /// Initialize with a chat message
    public init(message: ChatMessage) {
        self.message = message
        self.streamingContent = nil
        self.streamingSender = nil
        self.showTypingCursor = false
    }

    /// Initialize with streaming content (bot message in progress)
    /// - Parameters:
    ///   - streamingContent: The partial content accumulated so far
    ///   - sender: The bot sender (defaults to generic bot)
    ///   - showTypingCursor: Whether to show the blinking typing cursor (default: false)
    public init(
        streamingContent: String,
        sender: MessageSender = .bot(name: "Opta"),
        showTypingCursor: Bool = false
    ) {
        self.message = nil
        self.streamingContent = streamingContent
        self.streamingSender = sender
        self.showTypingCursor = showTypingCursor
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
        isUserMessage ? .optaPurple : .optaSurface
    }

    /// Text color based on sender
    private var textColor: Color {
        isUserMessage ? .white : .optaTextPrimary
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
                // Message content with optional typing cursor
                HStack(alignment: .bottom, spacing: 0) {
                    MarkdownContent(content: displayContent, textColor: textColor)
                        .font(.soraBody)

                    // Typing cursor indicator (only when actively typing)
                    if showTypingCursor {
                        TypingCursor()
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    Group {
                        if isUserMessage {
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Color.optaPurple)
                        } else {
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Color.optaSurface.opacity(0.6))
                                .background(.ultraThinMaterial)
                        }
                    }
                )
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(
                    Group {
                        if !isUserMessage {
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.optaBorder.opacity(0.3), lineWidth: 1)
                        }
                    }
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
                                .font(.soraCaption)
                                .foregroundColor(.optaTextMuted)
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
            .font(.soraCaption)
            .foregroundColor(iconColor)
    }

    /// Get icon name and color based on message status
    private var statusIconInfo: (name: String, color: Color) {
        guard let msg = message else {
            // Streaming messages don't show status
            return ("circle", .optaTextMuted)
        }
        switch msg.status {
        case .pending:
            return ("clock", .optaTextMuted)
        case .sent:
            return ("checkmark", .optaTextSecondary)
        case .delivered:
            return ("checkmark.circle", .optaGreen)
        case .failed:
            return ("exclamationmark.triangle", .optaRed)
        }
    }
}

// MARK: - Typing Cursor

/// Blinking vertical bar cursor shown when bot is actively typing
///
/// Matches familiar text editor/chat app typing indicators.
/// Uses optaPurple color and 0.5s blink animation.
private struct TypingCursor: View {
    @State private var isVisible = true

    var body: some View {
        Rectangle()
            .fill(Color.optaPurple)
            .frame(width: 2, height: 18)
            .opacity(isVisible ? 1 : 0)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.5).repeatForever()) {
                    isVisible.toggle()
                }
            }
    }
}

// MARK: - Message List with Ignition

/// A view that displays a list of messages with staggered ignition animation
///
/// Usage:
/// ```swift
/// MessageList(messages: viewModel.messages)
/// ```
///
/// Messages appear with cascading wake-from-darkness animation,
/// creating a premium entrance effect. Respects Reduce Motion.
public struct MessageList: View {
    let messages: [ChatMessage]
    let streamingMessages: [String: String]
    let botState: BotState

    /// Initialize message list with messages and streaming state
    /// - Parameters:
    ///   - messages: Array of chat messages to display
    ///   - streamingMessages: Dictionary of messageID -> partial content
    ///   - botState: Current bot state for typing cursor
    public init(
        messages: [ChatMessage],
        streamingMessages: [String: String] = [:],
        botState: BotState = .idle
    ) {
        self.messages = messages
        self.streamingMessages = streamingMessages
        self.botState = botState
    }

    public var body: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                // Regular messages with staggered ignition
                ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                    MessageBubble(message: message)
                        .staggeredIgnition(
                            index: index,
                            isVisible: true,
                            staggerInterval: 0.03  // Faster stagger for messages
                        )
                }

                // Streaming messages
                ForEach(Array(streamingMessages.keys.sorted()), id: \.self) { messageID in
                    if let content = streamingMessages[messageID] {
                        MessageBubble(
                            streamingContent: content,
                            showTypingCursor: botState == .typing
                        )
                        .ignition()
                    }
                }
            }
            .padding(.horizontal)
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
                sender: .bot(name: "Opta"),
                status: .delivered
            ))

            MessageBubble(message: ChatMessage(
                content: "What's the weather like?",
                sender: .user,
                status: .delivered
            ))

            // Markdown formatted message
            MessageBubble(message: ChatMessage(
                content: "Here's what I found:\n\n- **Temperature**: 72F\n- **Conditions**: Sunny\n- Use `weather --detailed` for more",
                sender: .bot(name: "Opta"),
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

            // Streaming message preview (without cursor - thinking state)
            MessageBubble(
                streamingContent: "I'm processing your request",
                sender: .bot(name: "Opta"),
                showTypingCursor: false
            )

            // Streaming message preview with markdown (with cursor - typing state)
            MessageBubble(
                streamingContent: "Here's a **bold** and *italic* example with `code`",
                sender: .bot(name: "Opta"),
                showTypingCursor: true
            )
        }
        .padding()
        .background(Color.optaBackground)
        .previewLayout(.sizeThatFits)
    }
}

struct MessageList_Previews: PreviewProvider {
    static var previews: some View {
        let messages = [
            ChatMessage(
                content: "Hello! How can I help you today?",
                sender: .bot(name: "Opta"),
                status: .delivered
            ),
            ChatMessage(
                content: "What's the weather like?",
                sender: .user,
                status: .delivered
            ),
            ChatMessage(
                content: "The weather is sunny and warm today!",
                sender: .bot(name: "Opta"),
                status: .delivered
            )
        ]

        MessageList(messages: messages)
            .background(Color.optaBackground)
    }
}
#endif
