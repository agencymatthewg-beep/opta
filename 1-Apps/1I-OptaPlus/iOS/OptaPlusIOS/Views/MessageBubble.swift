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
    var botId: String = ""
    var allMessages: [ChatMessage] = []
    var onReply: ((ChatMessage) -> Void)? = nil
    var onScrollTo: ((String) -> Void)? = nil
    @StateObject private var pinManager = PinManager.shared
    @StateObject private var bookmarkManager = BookmarkManager.shared

    private var isUser: Bool {
        message.sender == .user
    }

    private var isPinned: Bool {
        pinManager.isPinned(message.id, botId: botId)
    }

    private var repliedMessage: ChatMessage? {
        guard let replyId = message.replyTo else { return nil }
        return allMessages.first { $0.id == replyId }
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

            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                // Reply quote
                if let replied = repliedMessage {
                    ReplyQuoteView(originalMessage: replied) {
                        onScrollTo?(replied.id)
                    }
                }

                if isEmojiOnly {
                    Text(message.content)
                        .font(.system(size: 48))
                        .contextMenu { messageContextMenu }
                } else {
                    VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                        Text(message.content)
                            .font(.body)
                            .foregroundColor(.optaTextPrimary)
                            .textSelection(.enabled)
                    }
                    .padding(12)
                    .background(bubbleBackground)
                    .overlay(alignment: .topLeading) {
                        if isPinned {
                            Image(systemName: "pin.fill")
                                .font(.system(size: 8))
                                .foregroundColor(.yellow)
                                .padding(4)
                        }
                    }
                    .overlay(
                        isPinned
                            ? AnyView(RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.yellow.opacity(0.4), lineWidth: 1.5))
                            : AnyView(EmptyView())
                    )
                    .contextMenu { messageContextMenu }
                }
            }

            if !isUser { Spacer(minLength: 60) }
        }
    }

    @ViewBuilder
    private var messageContextMenu: some View {
        Button {
            UIPasteboard.general.string = message.content
        } label: {
            Label("Copy", systemImage: "doc.on.doc")
        }
        ShareLink(item: message.content) {
            Label("Share", systemImage: "square.and.arrow.up")
        }
        Divider()
        Button {
            onReply?(message)
        } label: {
            Label("Reply", systemImage: "arrowshape.turn.up.left")
        }
        Button {
            pinManager.togglePin(message.id, botId: botId)
        } label: {
            Label(isPinned ? "Unpin Message" : "Pin Message", systemImage: isPinned ? "pin.slash" : "pin")
        }
        Button {
            bookmarkManager.toggle(message: message, botName: botName, botId: botId)
        } label: {
            Label(
                bookmarkManager.isBookmarked(message.id) ? "Remove Bookmark" : "Bookmark",
                systemImage: bookmarkManager.isBookmarked(message.id) ? "bookmark.slash" : "bookmark"
            )
        }
        SmartActionsMenu(text: message.content)
        Divider()
        Button(role: .destructive) {
            // Deletion handled by parent — this is a visual placeholder
        } label: {
            Label("Delete", systemImage: "trash")
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
