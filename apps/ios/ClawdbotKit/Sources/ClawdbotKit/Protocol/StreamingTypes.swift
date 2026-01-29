//
//  StreamingTypes.swift
//  ClawdbotKit
//
//  Types for streaming responses and bot state indicators.
//

import Foundation

/// Bot's current processing state
public enum BotState: String, Codable, Sendable {
    case idle           // Not processing
    case thinking       // Processing request (before streaming)
    case typing         // Actively generating response
    case toolUse        // Using external tool
}

/// State update from bot
public struct BotStateUpdate: Codable, Sendable {
    public let state: BotState
    public let botName: String
    public let detail: String?      // e.g., "Searching web..." for toolUse
    public let timestamp: Date

    public init(
        state: BotState,
        botName: String,
        detail: String? = nil,
        timestamp: Date = Date()
    ) {
        self.state = state
        self.botName = botName
        self.detail = detail
        self.timestamp = timestamp
    }
}

/// A chunk of streaming response
public struct StreamingChunk: Codable, Sendable {
    /// ID of the message being streamed
    public let messageID: MessageID

    /// Chunk sequence number (for ordering)
    public let chunkIndex: Int

    /// The text content of this chunk
    public let content: String

    /// Is this the final chunk?
    public let isFinal: Bool

    public init(
        messageID: MessageID,
        chunkIndex: Int,
        content: String,
        isFinal: Bool = false
    ) {
        self.messageID = messageID
        self.chunkIndex = chunkIndex
        self.content = content
        self.isFinal = isFinal
    }
}

/// Aggregates streaming chunks into complete message
public actor StreamingMessageAssembler {
    private var chunks: [MessageID: [StreamingChunk]] = [:]

    public init() {}

    /// Add a chunk to the assembler
    public func addChunk(_ chunk: StreamingChunk) {
        var messageChunks = chunks[chunk.messageID] ?? []
        messageChunks.append(chunk)
        chunks[chunk.messageID] = messageChunks
    }

    /// Get current accumulated content for a message
    public func currentContent(for messageID: MessageID) -> String {
        guard let messageChunks = chunks[messageID] else { return "" }
        return messageChunks
            .sorted { $0.chunkIndex < $1.chunkIndex }
            .map(\.content)
            .joined()
    }

    /// Check if message is complete
    public func isComplete(messageID: MessageID) -> Bool {
        guard let messageChunks = chunks[messageID] else { return false }
        return messageChunks.contains { $0.isFinal }
    }

    /// Complete and remove a message from the assembler
    public func complete(messageID: MessageID) -> String? {
        guard isComplete(messageID: messageID) else { return nil }
        let content = currentContent(for: messageID)
        chunks.removeValue(forKey: messageID)
        return content
    }

    /// Clear all pending streams
    public func reset() {
        chunks.removeAll()
    }
}
