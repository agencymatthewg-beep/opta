//
//  Protocol.swift
//  ClawdbotKit
//
//  Message protocol module for Clawdbot native apps.
//
//  This module contains the complete Clawdbot message protocol:
//  - MessageTypes.swift: Core message types (ChatMessage, ProtocolEnvelope)
//  - StreamingTypes.swift: Streaming response types (StreamingChunk, BotState)
//  - ProtocolCodec.swift: JSON encoder/decoder
//  - MessageQueue.swift: Outgoing queue with delivery tracking
//  - ProtocolHandler.swift: Coordination layer
//

import Foundation

/// Message protocol namespace for Clawdbot apps
public enum ClawdbotProtocol {
    /// Protocol version (tracks message format changes)
    public static let version = "1.0.0"

    /// Module status
    public static let status = "implemented"

    /// Default bot names
    public enum Bots {
        public static let opta = "Opta"
        public static let mono = "Mono"
    }

    /// Message type identifiers (matching ProtocolMessageType)
    public enum MessageTypes {
        public static let chatMessage = "chat.message"
        public static let messageAck = "message.ack"
        public static let botState = "bot.state"
        public static let streamingChunk = "streaming.chunk"
        public static let ping = "system.ping"
        public static let pong = "system.pong"
    }
}

// MARK: - Convenience Typealiases

/// Re-export common types at module level for convenience
public typealias Message = ChatMessage
public typealias Envelope<T: Codable & Sendable> = ProtocolEnvelope<T>
