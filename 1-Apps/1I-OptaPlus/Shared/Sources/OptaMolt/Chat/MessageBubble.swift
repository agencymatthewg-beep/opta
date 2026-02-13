//
//  MessageBubble.swift
//  OptaMolt
//
//  Centered floating chat bubble with glass effects.
//  Both user and bot messages are centered, differentiated by color.
//  Bot messages expand dynamically for wide content (tables, code, visuals).
//

import SwiftUI
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

// MARK: - Text Alignment Environment Key

private struct TextAlignmentKey: EnvironmentKey {
    static let defaultValue: MessageTextAlignment = .centeredExpanding
}

public extension EnvironmentValues {
    var messageTextAlignment: MessageTextAlignment {
        get { self[TextAlignmentKey.self] }
        set { self[TextAlignmentKey.self] = newValue }
    }
}

// MARK: - Conditional View Modifier

private extension View {
    @ViewBuilder
    func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }
}

// MARK: - Message Bubble (Centered Floating Design)

public struct MessageBubble: View {
    @Environment(\.messageTextAlignment) private var textAlignment

    private let message: ChatMessage?
    private let streamingContent: String?
    private let streamingSender: MessageSender?
    private let showTypingCursor: Bool
    private let hideTimestamp: Bool

    private var isStreaming: Bool { streamingContent != nil }

    @State private var isHovered = false

    // MARK: - Init (message)
    
    public init(message: ChatMessage, hideTimestamp: Bool = false) {
        self.message = message
        self.streamingContent = nil
        self.streamingSender = nil
        self.showTypingCursor = false
        self.hideTimestamp = hideTimestamp
    }

    // MARK: - Init (streaming)
    
    public init(
        streamingContent: String,
        sender: MessageSender = .bot(name: "Opta"),
        showTypingCursor: Bool = false
    ) {
        self.message = nil
        self.streamingContent = streamingContent
        self.streamingSender = sender
        self.showTypingCursor = false
        self.hideTimestamp = true
    }

    // MARK: - Computed

    private var displayContent: String {
        streamingContent ?? message?.content ?? ""
    }

    private var displaySender: MessageSender {
        streamingSender ?? message?.sender ?? .bot(name: "Unknown")
    }

    private var isUserMessage: Bool {
        if isStreaming { return false }
        if case .user = displaySender { return true }
        return false
    }
    
    /// Whether content is "wide" (code blocks, tables, long lines)
    private var isWideContent: Bool {
        let content = displayContent
        if content.contains("```") { return true }
        if content.contains("|") && content.contains("---") { return true }
        if content.split(separator: "\n").contains(where: { $0.count > 80 }) { return true }
        return false
    }
    
    /// Whether content is only emoji characters (1-5 emojis, no other text)
    private var isEmojiOnly: Bool {
        let trimmed = displayContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty && trimmed.count <= 10 else { return false }
        return trimmed.unicodeScalars.allSatisfy { scalar in
            scalar.properties.isEmoji && scalar.value > 0x23F // Exclude ASCII symbols
        }
    }

    /// Max width fraction based on content type
    private var maxWidthFraction: CGFloat {
        if isUserMessage { return 0.65 }
        if isWideContent { return 0.92 }
        return 0.75
    }

    // MARK: - Body

    /// Resolved alignment: centered-expanding keeps both centered; left/right shifts user vs bot.
    private var resolvedAlignment: Alignment {
        switch textAlignment {
        case .centeredExpanding: return .center
        case .leftAligned: return .leading
        case .rightAligned:
            return isUserMessage ? .trailing : .leading
        }
    }

    public var body: some View {
        HStack {
            if textAlignment == .rightAligned && isUserMessage {
                Spacer(minLength: 0)
            } else if textAlignment == .centeredExpanding {
                Spacer(minLength: 0)
            }

            VStack(spacing: 6) {
                // Sender label (bot only, not for streaming to reduce noise)
                if !isUserMessage && !isStreaming, case .bot(let name) = displaySender {
                    Text(name)
                        .font(.sora(11, weight: .medium))
                        .foregroundColor(.optaTextMuted)
                }
                
                // Message bubble
                ZStack(alignment: .topTrailing) {
                    VStack(alignment: .leading, spacing: 8) {
                        if isEmojiOnly {
                            Text(displayContent)
                                .font(.system(size: 48))
                                .padding(.horizontal, 4)
                                .padding(.vertical, 2)
                        } else {
                            HStack(alignment: .bottom, spacing: 0) {
                                MarkdownContent(content: displayContent, textColor: textColor, isStreaming: isStreaming)
                                    .font(.system(size: 14))

                                if showTypingCursor {
                                    TypingCursor()
                                }
                            }
                        }

                        // Inline attachments
                        if let msg = message, !msg.attachments.isEmpty {
                            ForEach(msg.attachments) { attachment in
                                InlineAttachmentView(attachment: attachment)
                            }
                        }
                    }
                    .padding(.horizontal, isEmojiOnly ? 8 : 16)
                    .padding(.vertical, isEmojiOnly ? 4 : 12)
                    .frame(maxWidth: .infinity)
                    .background(isEmojiOnly ? AnyView(Color.clear) : AnyView(bubbleBackground))
                    .clipShape(RoundedRectangle(cornerRadius: bubbleRadius))
                    .overlay(isEmojiOnly ? AnyView(EmptyView()) : AnyView(bubbleOverlay))

                    // Hover copy button
                    if isHovered && !isStreaming && !isEmojiOnly {
                        Button(action: { copyToClipboard(displayContent) }) {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 11))
                                .foregroundColor(.optaTextMuted)
                                .padding(6)
                                .background(.ultraThinMaterial)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                        .buttonStyle(.plain)
                        .padding(6)
                        .transition(.opacity)
                    }
                }
                .onHover { hovering in
                    withAnimation(.easeInOut(duration: 0.15)) { isHovered = hovering }
                }
                .if(isUserMessage) { view in
                    view.mask(
                        LinearGradient(
                            stops: [
                                .init(color: .clear, location: 0),
                                .init(color: .black, location: 0.03),
                                .init(color: .black, location: 0.97),
                                .init(color: .clear, location: 1.0)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                }
                .shadow(color: Color.black.opacity(0.3), radius: 12, y: 4)
                .contextMenu {
                    Button {
                        copyToClipboard(displayContent)
                    } label: {
                        Label("Copy Message", systemImage: "doc.on.doc")
                    }
                    Button {
                        copyToClipboard(displayContent)
                    } label: {
                        Label("Copy as Markdown", systemImage: "text.badge.checkmark")
                    }
                }
                .transition(.asymmetric(
                    insertion: .scale(scale: 0.95).combined(with: .opacity),
                    removal: .opacity
                ))
                
                // Timestamp row
                if !isStreaming && !hideTimestamp {
                    HStack(spacing: 4) {
                        if isUserMessage {
                            statusIcon
                        }
                        if let msg = message {
                            Text(msg.timestamp.formatted(date: .omitted, time: .shortened))
                                .font(.system(size: 9))
                                .foregroundColor(.optaTextMuted)
                                .opacity(0.5)

                            // Source badge (e.g. "via Telegram")
                            if msg.source == .telegram {
                                HStack(spacing: 3) {
                                    Image(systemName: "paperplane.fill")
                                        .font(.system(size: 8))
                                    Text("via Telegram")
                                        .font(.system(size: 9, weight: .medium))
                                }
                                .foregroundStyle(Color.optaTextMuted)
                            }
                        }
                    }
                }
            }
            .frame(maxWidth: maxWidthFraction * 800, alignment: resolvedAlignment)

            if textAlignment == .leftAligned && isUserMessage {
                Spacer(minLength: 0)
            } else if textAlignment == .centeredExpanding {
                Spacer(minLength: 0)
            } else if textAlignment == .rightAligned && !isUserMessage {
                Spacer(minLength: 0)
            }
        }
    }
    
    // MARK: - Styling
    
    private var textColor: Color {
        isUserMessage ? .white : .optaTextPrimary
    }
    
    private var bubbleRadius: CGFloat {
        isWideContent ? 20 : 18
    }
    
    @ViewBuilder
    private var bubbleBackground: some View {
        if isUserMessage {
            // User: violet gradient glass
            RoundedRectangle(cornerRadius: bubbleRadius)
                .fill(
                    LinearGradient(
                        colors: [
                            Color.optaPrimary.opacity(0.85),
                            Color.optaPrimary.opacity(0.65)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .background(.ultraThinMaterial)
        } else {
            // Bot: dark glass with subtle bot accent tint
            ZStack {
                RoundedRectangle(cornerRadius: bubbleRadius)
                    .fill(Color.optaSurface.opacity(0.5))
                    .background(.ultraThinMaterial)
                
                RoundedRectangle(cornerRadius: bubbleRadius)
                    .fill(Color.optaPrimary.opacity(0.025))
            }
        }
    }
    
    @ViewBuilder
    private var bubbleOverlay: some View {
        if isUserMessage {
            // Subtle inner glow for user messages
            RoundedRectangle(cornerRadius: bubbleRadius)
                .stroke(
                    LinearGradient(
                        colors: [Color.white.opacity(0.2), Color.clear],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        } else {
            // Glass border for bot messages
            RoundedRectangle(cornerRadius: bubbleRadius)
                .stroke(Color.optaBorder.opacity(0.2), lineWidth: 0.5)
        }
    }
    
    private var shadowColor: Color {
        if isUserMessage {
            return Color.optaPrimary.opacity(0.15)
        } else {
            return Color.black.opacity(0.2)
        }
    }
    
    private var shadowRadius: CGFloat {
        isUserMessage ? 12 : 8
    }
    
    // MARK: - Status Icon

    @ViewBuilder
    private var statusIcon: some View {
        if let msg = message {
            let (iconName, iconColor) = statusIconInfo(for: msg.status)
            Image(systemName: iconName)
                .font(.system(size: 8))
                .foregroundColor(iconColor)
        }
    }

    private func copyToClipboard(_ text: String) {
        #if canImport(AppKit)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        #elseif canImport(UIKit)
        UIPasteboard.general.string = text
        #endif
    }

    private func statusIconInfo(for status: ChatMessage.MessageStatus) -> (name: String, color: Color) {
        switch status {
        case .pending: return ("clock", .optaTextMuted)
        case .sent: return ("checkmark", .optaTextSecondary)
        case .delivered: return ("checkmark.circle", .optaGreen)
        case .failed: return ("exclamationmark.triangle", .optaRed)
        }
    }
}

// MARK: - Typing Cursor

private struct TypingCursor: View {
    @State private var pulseScale: CGFloat = 0.8

    var body: some View {
        Circle()
            .fill(Color.optaPrimary)
            .frame(width: 8, height: 8)
            .shadow(color: Color.optaPrimary.opacity(0.6), radius: 4)
            .scaleEffect(pulseScale)
            .padding(.leading, 4)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) {
                    pulseScale = 1.2
                }
            }
    }
}

// MARK: - Message List

public struct MessageList: View {
    let messages: [ChatMessage]
    let streamingMessages: [String: String]
    let botState: BotState

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
            LazyVStack(spacing: 8) {
                ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                    MessageBubble(message: message)
                        .staggeredIgnition(
                            index: index,
                            isVisible: true,
                            staggerInterval: 0.03
                        )
                }

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
            
            MessageBubble(message: ChatMessage(
                content: "Here's a wide table:\n\n| Name | Value | Status |\n|------|-------|--------|\n| Test | 42 | Active |",
                sender: .bot(name: "Opta"),
                status: .delivered
            ))
            
            MessageBubble(
                streamingContent: "Processing your request...",
                sender: .bot(name: "Opta"),
                showTypingCursor: true
            )
        }
        .padding()
        .background(Color.optaVoid)
    }
}
#endif
