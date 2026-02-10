//
//  Models.swift
//  OptaMolt
//
//  Core chat data models: message sender, bot state, and chat messages.
//  These types are used throughout the chat UI layer (MessageBubble, MessageList, etc.).
//

import Foundation

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
    public let status: MessageStatus

    // MARK: Initializer

    /// Creates a new chat message.
    ///
    /// - Parameters:
    ///   - id: Unique identifier. Defaults to a new UUID string.
    ///   - content: The message text.
    ///   - sender: Who sent the message.
    ///   - timestamp: When the message was created. Defaults to the current date.
    ///   - status: Delivery status. Defaults to `.sent`.
    public init(
        id: String = UUID().uuidString,
        content: String,
        sender: MessageSender,
        timestamp: Date = Date(),
        status: MessageStatus = .sent
    ) {
        self.id = id
        self.content = content
        self.sender = sender
        self.timestamp = timestamp
        self.status = status
    }
}
