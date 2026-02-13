//
//  MessageBubble.swift
//  OptaMolt
//
//  Centered floating chat bubble with glass effects.
//  Both user and bot messages are centered, differentiated by color.
//  Bot messages expand dynamically for wide content (tables, code, visuals).
//

import SwiftUI
import Combine
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
    private let allMessages: [ChatMessage]
    private let botId: String
    private let botName: String
    private let onReply: ((ChatMessage) -> Void)?
    private let onScrollTo: ((String) -> Void)?

    private var isStreaming: Bool { streamingContent != nil }

    @State private var isHovered = false
    @State private var isExpanded = false
    @State private var relativeTimestamp: String = ""
    @State private var showRunConfirm = false
    @State private var pendingCode = ""
    @StateObject private var reactionStore = ReactionStore.shared
    @StateObject private var pinManager = PinManager.shared
    @StateObject private var bookmarkManager = BookmarkManager.shared

    // MARK: - Init (message)
    
    public init(
        message: ChatMessage,
        hideTimestamp: Bool = false,
        allMessages: [ChatMessage] = [],
        botId: String = "",
        botName: String = "",
        onReply: ((ChatMessage) -> Void)? = nil,
        onScrollTo: ((String) -> Void)? = nil
    ) {
        self.message = message
        self.streamingContent = nil
        self.streamingSender = nil
        self.showTypingCursor = false
        self.hideTimestamp = hideTimestamp
        self.allMessages = allMessages
        self.botId = botId
        self.botName = botName
        self.onReply = onReply
        self.onScrollTo = onScrollTo
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
        self.allMessages = []
        self.botId = ""
        self.botName = ""
        self.onReply = nil
        self.onScrollTo = nil
    }

    // MARK: - Helpers

    private var isPinned: Bool {
        guard let msg = message else { return false }
        return pinManager.isPinned(msg.id, botId: botId)
    }

    private var repliedMessage: ChatMessage? {
        guard let replyId = message?.replyTo else { return nil }
        return allMessages.first { $0.id == replyId }
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
    /// Whether the message should be truncatable (>600 chars, not slightly over)
    private var isTruncatable: Bool {
        !isStreaming && displayContent.count > 600
    }
    
    /// Content to actually display (truncated or full)
    private var visibleContent: String {
        guard isTruncatable && !isExpanded else { return displayContent }
        let content = displayContent
        // Find a safe truncation point — don't cut inside code blocks
        let target = 500
        let prefix = String(content.prefix(target))
        // If we're inside a code block (odd number of ```), extend to end of block
        let fenceCount = prefix.components(separatedBy: "```").count - 1
        if fenceCount % 2 == 1 {
            // Inside a code block — find the closing fence
            if let closeRange = content.range(of: "```", range: content.index(content.startIndex, offsetBy: target)..<content.endIndex) {
                let endIdx = content.index(closeRange.upperBound, offsetBy: 0)
                return String(content[content.startIndex..<endIdx]) + "\n…"
            }
        }
        return prefix + "…"
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
                
                // Reply quote (above bubble)
                if let replied = repliedMessage {
                    ReplyQuoteView(originalMessage: replied) {
                        onScrollTo?(replied.id)
                    }
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
                            VStack(alignment: .leading, spacing: 4) {
                                ZStack(alignment: .bottomLeading) {
                                    HStack(alignment: .bottom, spacing: 0) {
                                        MarkdownContent(content: visibleContent, textColor: textColor, isStreaming: isStreaming)
                                            .font(.system(size: 14))

                                        if showTypingCursor {
                                            TypingCursor()
                                        }
                                    }
                                    .animateHeight(isExpanded: isExpanded || !isTruncatable)
                                    
                                    // Gradient fade at truncation point
                                    if isTruncatable && !isExpanded {
                                        LinearGradient(
                                            colors: [.clear, isUserMessage ? Color.optaPrimary.opacity(0.7) : Color.optaSurface.opacity(0.85)],
                                            startPoint: .top,
                                            endPoint: .bottom
                                        )
                                        .frame(height: 40)
                                        .allowsHitTesting(false)
                                        .frame(maxHeight: .infinity, alignment: .bottom)
                                    }
                                }
                                
                                if isTruncatable {
                                    Button(action: {
                                        withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                                            isExpanded.toggle()
                                        }
                                    }) {
                                        HStack(spacing: 4) {
                                            Text(isExpanded ? "Show less" : "Show more")
                                                .font(.system(size: 12, weight: .medium))
                                            Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                                                .font(.system(size: 9, weight: .bold))
                                        }
                                        .foregroundColor(.optaPrimary)
                                    }
                                    .buttonStyle(.plain)
                                    .padding(.top, 2)
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
                    withAnimation(.spring(response: 0.2, dampingFraction: 0.8)) { isHovered = hovering }
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
                .brightness(isHovered ? 0.03 : 0)
                .shadow(color: Color.black.opacity(0.3), radius: 12, y: 4)
                .animation(.spring(response: 0.25, dampingFraction: 0.8), value: isHovered)
                .accessibilityElement(children: .combine)
                .accessibilityLabel(isUserMessage ? "Your message: \(displayContent.prefix(100))" : "\(displaySender.accessibleName) said: \(displayContent.prefix(100))")
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
                
                // Link previews for URLs in message
                if !isStreaming, let msg = message {
                    LinkPreviewsView(text: msg.content)
                    InlineImageURLsView(text: msg.content)
                }

                // Reaction pills
                if let msg = message {
                    ReactionPillsView(messageId: msg.id, store: reactionStore)
                }

                // Timestamp row (always visible when not hidden, or show on hover)
                if !isStreaming && (!hideTimestamp || isHovered) {
                    HStack(spacing: 4) {
                        if isUserMessage {
                            statusIcon
                        }
                        if message != nil {
                            Text(relativeTimestamp)
                                .font(.system(size: 9))
                                .foregroundColor(.optaTextMuted)
                                .opacity(0.5)
                                .onAppear { updateRelativeTimestamp() }
                                .onReceive(Timer.publish(every: 60, on: .main, in: .common).autoconnect()) { _ in
                                    updateRelativeTimestamp()
                                }

                            // Source badge (e.g. "via Telegram")
                            if let msg = message, msg.source == .telegram {
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
            // User: violet → darker violet gradient glass
            RoundedRectangle(cornerRadius: bubbleRadius)
                .fill(
                    LinearGradient(
                        colors: [
                            Color.optaPrimary.opacity(0.9),
                            Color.optaIndigo.opacity(0.7)
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
            // Glass border + inner shadow for bot messages (glass depth illusion)
            ZStack {
                RoundedRectangle(cornerRadius: bubbleRadius)
                    .stroke(Color.optaBorder.opacity(0.2), lineWidth: 0.5)
                
                // Subtle inner shadow
                RoundedRectangle(cornerRadius: bubbleRadius)
                    .stroke(Color.black.opacity(0.15), lineWidth: 1)
                    .blur(radius: 3)
                    .offset(y: 1)
                    .clipShape(RoundedRectangle(cornerRadius: bubbleRadius))
            }
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

    private func relativeTime(for date: Date) -> String {
        let now = Date()
        let interval = now.timeIntervalSince(date)
        if interval < 60 { return "just now" }
        if interval < 3600 {
            let mins = Int(interval / 60)
            return "\(mins)m ago"
        }
        if interval < 86400 {
            let hours = Int(interval / 3600)
            return "\(hours)h ago"
        }
        return date.formatted(date: .abbreviated, time: .shortened)
    }

    private func updateRelativeTimestamp() {
        if let msg = message {
            relativeTimestamp = relativeTime(for: msg.timestamp)
        }
    }

    private func statusIconInfo(for status: ChatMessage.MessageStatus) -> (name: String, color: Color) {
        switch status {
        case .pending: return ("clock", .optaTextMuted)
        case .sent: return ("checkmark", .optaTextSecondary)       // Single check = sent
        case .delivered: return ("checkmark.circle.fill", .optaGreen) // Filled check = delivered
        case .failed: return ("exclamationmark.triangle.fill", .optaRed)
        }
    }
}

// MARK: - Animate Height Modifier

private struct AnimateHeightModifier: ViewModifier {
    let isExpanded: Bool
    
    func body(content: Content) -> some View {
        content
            .fixedSize(horizontal: false, vertical: true)
            .clipped()
            .animation(.spring(response: 0.35, dampingFraction: 0.82), value: isExpanded)
    }
}

private extension View {
    func animateHeight(isExpanded: Bool) -> some View {
        modifier(AnimateHeightModifier(isExpanded: isExpanded))
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
