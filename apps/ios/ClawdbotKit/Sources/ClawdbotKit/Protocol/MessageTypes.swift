//
//  MessageTypes.swift
//  ClawdbotKit
//
//  Core message types for Clawdbot protocol.
//

import Foundation

/// Unique message identifier
public struct MessageID: Hashable, Codable, Sendable, ExpressibleByStringLiteral {
    public let value: String

    public init(_ value: String) {
        self.value = value
    }

    public init(stringLiteral value: String) {
        self.value = value
    }

    public static func generate() -> MessageID {
        MessageID(UUID().uuidString.lowercased())
    }
}

/// Message delivery status
public enum MessageStatus: String, Codable, Sendable {
    case pending       // Queued locally, not sent
    case sent          // Sent to server, awaiting confirmation
    case delivered     // Server confirmed receipt
    case failed        // Send failed, may retry
}

/// Sender identification
public enum MessageSender: Codable, Sendable, Equatable {
    case user
    case bot(name: String)

    private enum CodingKeys: String, CodingKey {
        case type, name
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "user":
            self = .user
        case "bot":
            let name = try container.decode(String.self, forKey: .name)
            self = .bot(name: name)
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unknown sender type: \(type)"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .user:
            try container.encode("user", forKey: .type)
        case .bot(let name):
            try container.encode("bot", forKey: .type)
            try container.encode(name, forKey: .name)
        }
    }
}

/// A chat message in the Clawdbot protocol
public struct ChatMessage: Codable, Sendable, Identifiable {
    public let id: MessageID
    public let content: String
    public let sender: MessageSender
    public let timestamp: Date
    public var status: MessageStatus

    /// Thread ID for conversation grouping (optional)
    public let threadID: String?

    /// Reply to another message (optional)
    public let replyTo: MessageID?

    public init(
        id: MessageID = .generate(),
        content: String,
        sender: MessageSender,
        timestamp: Date = Date(),
        status: MessageStatus = .pending,
        threadID: String? = nil,
        replyTo: MessageID? = nil
    ) {
        self.id = id
        self.content = content
        self.sender = sender
        self.timestamp = timestamp
        self.status = status
        self.threadID = threadID
        self.replyTo = replyTo
    }
}

/// Protocol envelope wrapping messages with metadata
public struct ProtocolEnvelope<T: Codable & Sendable>: Codable, Sendable {
    /// Protocol version for compatibility
    public let version: String

    /// Message type identifier
    public let type: String

    /// Sequence number for ordering
    public let sequence: Int

    /// The wrapped payload
    public let payload: T

    /// Server timestamp (set by server, nil for outgoing)
    public let serverTimestamp: Date?

    public init(
        version: String = "1.0",
        type: String,
        sequence: Int,
        payload: T,
        serverTimestamp: Date? = nil
    ) {
        self.version = version
        self.type = type
        self.sequence = sequence
        self.payload = payload
        self.serverTimestamp = serverTimestamp
    }
}

/// Acknowledgment for message receipt
public struct MessageAck: Codable, Sendable {
    public let messageID: MessageID
    public let status: AckStatus
    public let serverTimestamp: Date

    public enum AckStatus: String, Codable, Sendable {
        case received
        case processed
        case error
    }

    public init(messageID: MessageID, status: AckStatus, serverTimestamp: Date = Date()) {
        self.messageID = messageID
        self.status = status
        self.serverTimestamp = serverTimestamp
    }
}
