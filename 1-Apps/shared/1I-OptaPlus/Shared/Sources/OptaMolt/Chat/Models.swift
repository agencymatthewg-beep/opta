//
//  Models.swift
//  OptaMolt
//
//  Core chat data models: message sender, bot state, and chat messages.
//  These types are used throughout the chat UI layer (MessageBubble, MessageList, etc.).
//

import Foundation
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

// MARK: - Message Text Alignment

/// User-configurable text alignment for chat bubbles.
public enum MessageTextAlignment: String, CaseIterable, Sendable {
    case centeredExpanding
    case leftAligned
    case rightAligned

    public var label: String {
        switch self {
        case .centeredExpanding: return "Centered"
        case .leftAligned: return "Left"
        case .rightAligned: return "Right"
        }
    }
}

// MARK: - Message Source

/// Identifies which channel a message originated from.
public enum MessageSource: String, Codable, Equatable, Sendable {
    case optaplus
    case telegram
    case bot
}

// MARK: - Chat Attachment

/// A file or image attached to a chat message.
public struct ChatAttachment: Identifiable, Equatable, Sendable {
    public let id: String
    public let filename: String
    public let mimeType: String
    public let sizeBytes: Int
    public let data: Data?
    public let thumbnailData: Data?

    public init(
        id: String = UUID().uuidString,
        filename: String,
        mimeType: String,
        sizeBytes: Int,
        data: Data? = nil,
        thumbnailData: Data? = nil
    ) {
        self.id = id
        self.filename = filename
        self.mimeType = mimeType
        self.sizeBytes = sizeBytes
        self.data = data
        self.thumbnailData = thumbnailData
    }

    public var isImage: Bool {
        mimeType.hasPrefix("image/")
    }

    public var isAudio: Bool {
        mimeType.hasPrefix("audio/")
    }

    public var formattedSize: String {
        if sizeBytes < 1024 { return "\(sizeBytes) B" }
        if sizeBytes < 1024 * 1024 { return String(format: "%.1f KB", Double(sizeBytes) / 1024) }
        return String(format: "%.1f MB", Double(sizeBytes) / (1024 * 1024))
    }
}

// MARK: - Message Sender

/// Identifies the sender of a chat message.
///
/// Messages originate from either the user or a named bot. The bot's display
/// name is carried inline so the UI can show it without a separate lookup.
///
/// ```swift
/// let sender: MessageSender = .bot(name: "Opta")
/// ```
public enum MessageSender: Equatable, Sendable {
    /// The human user of the application.
    case user

    /// A bot identified by its display name.
    ///
    /// - Parameter name: The bot's display name shown in the UI.
    case bot(name: String)

    /// Accessible name for VoiceOver.
    public var accessibleName: String {
        switch self {
        case .user: return "You"
        case .bot(let name): return name
        }
    }
}

// MARK: - Bot State

/// The current activity state of a bot in a chat session.
///
/// Use this to drive UI indicators such as typing cursors and thinking spinners.
///
/// ```swift
/// if botState == .typing {
///     TypingCursor()
/// }
/// ```
public enum BotState: Equatable, Sendable {
    /// The bot is not actively processing anything.
    case idle

    /// The bot is processing a request but has not started producing output.
    case thinking

    /// The bot is actively streaming output tokens.
    case typing
}

// MARK: - Chat Message

/// A single message in a chat conversation.
///
/// Each message carries its own unique identifier, textual content, sender,
/// creation timestamp, and delivery status. The struct is `Identifiable` so it
/// can be used directly in SwiftUI `ForEach` views.
///
/// ```swift
/// let message = ChatMessage(
///     content: "Hello, world!",
///     sender: .user,
///     status: .sent
/// )
/// ```
public struct ChatMessage: Identifiable, Equatable, Sendable {

    // MARK: Nested Types

    /// The delivery status of a chat message.
    ///
    /// Status progresses through the lifecycle: `pending` -> `sent` -> `delivered`.
    /// A message may also transition to `failed` at any point.
    public enum MessageStatus: Equatable, Sendable {
        /// The message has been created locally but not yet sent.
        case pending

        /// The message has been sent to the server.
        case sent

        /// The message has been confirmed as delivered.
        case delivered

        /// The message failed to send.
        case failed
    }

    // MARK: Properties

    /// Unique identifier for this message.
    public let id: String

    /// The textual content of the message (may contain markdown).
    public let content: String

    /// Who sent this message.
    public let sender: MessageSender

    /// When the message was created.
    public let timestamp: Date

    /// Current delivery status.
    public var status: MessageStatus

    /// Which channel this message originated from (nil for legacy messages).
    public let source: MessageSource?

    /// File or image attachments.
    public let attachments: [ChatAttachment]

    /// ID of the message this is replying to (quote/reply feature).
    public let replyTo: String?

    // MARK: Initializer

    /// Creates a new chat message.
    ///
    /// - Parameters:
    ///   - id: Unique identifier. Defaults to a new UUID string.
    ///   - content: The message text.
    ///   - sender: Who sent the message.
    ///   - timestamp: When the message was created. Defaults to the current date.
    ///   - status: Delivery status. Defaults to `.sent`.
    ///   - source: Origin channel. Defaults to `nil`.
    ///   - attachments: Attached files. Defaults to empty.
    ///   - replyTo: ID of message being replied to. Defaults to `nil`.
    public init(
        id: String = UUID().uuidString,
        content: String,
        sender: MessageSender,
        timestamp: Date = Date(),
        status: MessageStatus = .sent,
        source: MessageSource? = nil,
        attachments: [ChatAttachment] = [],
        replyTo: String? = nil
    ) {
        self.id = id
        self.content = content
        self.sender = sender
        self.timestamp = timestamp
        self.status = status
        self.source = source
        self.attachments = attachments
        self.replyTo = replyTo
    }
}
