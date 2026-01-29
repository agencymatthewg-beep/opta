//
//  ProtocolHandler.swift
//  ClawdbotKit
//
//  Coordinates message encoding, decoding, and queue management.
//  Bridges Protocol layer with Connection layer.
//

import Foundation
import Combine

/// Delegate for protocol-level events
public protocol ProtocolHandlerDelegate: AnyObject, Sendable {
    /// Called when a chat message is received
    func protocolHandler(_ handler: ProtocolHandler, didReceiveMessage message: ChatMessage)

    /// Called when bot state changes
    func protocolHandler(_ handler: ProtocolHandler, didReceiveBotState state: BotStateUpdate)

    /// Called when a streaming chunk arrives
    func protocolHandler(_ handler: ProtocolHandler, didReceiveChunk chunk: StreamingChunk)

    /// Called when message delivery is confirmed
    func protocolHandler(_ handler: ProtocolHandler, didDeliverMessage messageID: MessageID)

    /// Called when message delivery fails
    func protocolHandler(_ handler: ProtocolHandler, didFailMessage messageID: MessageID, error: Error?)
}

/// Default implementations for optional delegate methods
public extension ProtocolHandlerDelegate {
    func protocolHandler(_ handler: ProtocolHandler, didReceiveBotState state: BotStateUpdate) {}
    func protocolHandler(_ handler: ProtocolHandler, didReceiveChunk chunk: StreamingChunk) {}
    func protocolHandler(_ handler: ProtocolHandler, didDeliverMessage messageID: MessageID) {}
    func protocolHandler(_ handler: ProtocolHandler, didFailMessage messageID: MessageID, error: Error?) {}
}

/// Central coordinator for Clawdbot protocol communication
public actor ProtocolHandler {

    // MARK: - Properties

    private let codec: ProtocolCodec
    private let queue: OutgoingMessageQueue
    private let assembler: StreamingMessageAssembler

    public weak var delegate: ProtocolHandlerDelegate?

    /// Connection manager reference (set after init)
    private weak var connectionManager: ConnectionManager?

    /// Publisher for incoming messages (alternative to delegate)
    public nonisolated let incomingMessages = PassthroughSubject<ChatMessage, Never>()

    /// Publisher for bot state updates
    public nonisolated let botStateUpdates = PassthroughSubject<BotStateUpdate, Never>()

    // MARK: - Initialization

    public init(queueConfig: MessageQueueConfig = .default) {
        self.codec = ProtocolCodec()
        self.queue = OutgoingMessageQueue(config: queueConfig)
        self.assembler = StreamingMessageAssembler()
    }

    /// Connect to a ConnectionManager
    public func connect(to connectionManager: ConnectionManager) async {
        self.connectionManager = connectionManager
        // Queue delegate is set up to trigger sends
    }

    // MARK: - Sending

    /// Send a user message
    public func send(_ content: String, replyTo: MessageID? = nil, threadID: String? = nil) async {
        let message = ChatMessage(
            content: content,
            sender: .user,
            threadID: threadID,
            replyTo: replyTo
        )

        await queue.enqueue(message)
    }

    /// Send a pre-constructed message
    public func send(message: ChatMessage) async {
        await queue.enqueue(message)
    }

    /// Internal: Actually send a message over WebSocket
    internal func performSend(_ message: ChatMessage) async throws {
        guard let connection = connectionManager else {
            throw ProtocolHandlerError.notConnected
        }

        let sequence = await queue.nextSequence()
        let data = try codec.encode(message: message, sequence: sequence)

        // Convert to string for WebSocket text message
        guard let jsonString = String(data: data, encoding: .utf8) else {
            throw ProtocolHandlerError.encodingFailed
        }

        try await connection.send(text: jsonString)
        await queue.markSent(message.id)
    }

    // MARK: - Receiving

    /// Process incoming WebSocket message
    public func handleIncoming(_ text: String) async {
        do {
            let decoded = try codec.decode(text)

            switch decoded {
            case .chatMessage(let envelope):
                let message = envelope.payload
                delegate?.protocolHandler(self, didReceiveMessage: message)
                incomingMessages.send(message)

            case .messageAck(let envelope):
                let ack = envelope.payload
                if ack.status == .received || ack.status == .processed {
                    await queue.confirmDelivery(ack.messageID)
                    delegate?.protocolHandler(self, didDeliverMessage: ack.messageID)
                } else {
                    await queue.handleSendFailure(ack.messageID, error: nil)
                    delegate?.protocolHandler(self, didFailMessage: ack.messageID, error: nil)
                }

            case .botState(let envelope):
                let state = envelope.payload
                delegate?.protocolHandler(self, didReceiveBotState: state)
                botStateUpdates.send(state)

            case .streamingChunk(let envelope):
                let chunk = envelope.payload
                await assembler.addChunk(chunk)
                delegate?.protocolHandler(self, didReceiveChunk: chunk)

                // Check if stream is complete
                if chunk.isFinal {
                    if let content = await assembler.complete(messageID: chunk.messageID) {
                        // Create completed message
                        let completedMessage = ChatMessage(
                            id: chunk.messageID,
                            content: content,
                            sender: .bot(name: "Unknown"),  // Would be set from context
                            status: .delivered
                        )
                        delegate?.protocolHandler(self, didReceiveMessage: completedMessage)
                        incomingMessages.send(completedMessage)
                    }
                }

            case .ping(let sequence):
                // Respond with pong
                await sendPong(sequence: sequence)

            case .pong:
                // Heartbeat response received (handled by connection layer)
                break

            case .unknown(let type, _):
                // Log unknown message type but don't error
                print("[ProtocolHandler] Unknown message type: \(type)")
            }
        } catch {
            print("[ProtocolHandler] Failed to decode message: \(error)")
        }
    }

    /// Process incoming binary data
    public func handleIncoming(_ data: Data) async {
        guard let text = String(data: data, encoding: .utf8) else {
            print("[ProtocolHandler] Failed to decode binary data as UTF-8")
            return
        }
        await handleIncoming(text)
    }

    // MARK: - Ping/Pong

    private func sendPong(sequence: Int) async {
        guard let connection = connectionManager else { return }

        do {
            let data = try codec.encodePong(sequence: sequence)
            guard let jsonString = String(data: data, encoding: .utf8) else { return }
            try await connection.send(text: jsonString)
        } catch {
            print("[ProtocolHandler] Failed to send pong: \(error)")
        }
    }

    // MARK: - State

    /// Get current streaming content for a message
    public func streamingContent(for messageID: MessageID) async -> String {
        await assembler.currentContent(for: messageID)
    }

    /// Reset streaming state (e.g., on disconnect)
    public func resetStreaming() async {
        await assembler.reset()
    }

    /// Get pending message count
    public func pendingMessageCount() async -> Int {
        await queue.pendingCount()
    }

    /// Retry all failed messages
    public func retryFailedMessages() async {
        await queue.retryFailed()
    }

    /// Clear message queue
    public func clearQueue() async {
        await queue.clear()
    }

    // MARK: - Delegate Access

    /// Set the delegate (actor-isolated setter)
    public func setDelegate(_ delegate: ProtocolHandlerDelegate?) {
        self.delegate = delegate
    }
}

/// Errors from protocol handler
public enum ProtocolHandlerError: Error, Sendable {
    case notConnected
    case encodingFailed
    case decodingFailed
}

// MARK: - MessageQueueDelegate Conformance

extension ProtocolHandler: MessageQueueDelegate {
    public nonisolated func messageQueue(_ queue: OutgoingMessageQueue, shouldSend message: ChatMessage) async {
        do {
            try await performSend(message)
        } catch {
            await queue.handleSendFailure(message.id, error: error)
        }
    }

    public nonisolated func messageQueue(_ queue: OutgoingMessageQueue, didDeliver messageID: MessageID) {
        // Already handled in handleIncoming
    }

    public nonisolated func messageQueue(_ queue: OutgoingMessageQueue, didFail messageID: MessageID, error: Error?) {
        Task {
            await delegate?.protocolHandler(self, didFailMessage: messageID, error: error)
        }
    }
}
