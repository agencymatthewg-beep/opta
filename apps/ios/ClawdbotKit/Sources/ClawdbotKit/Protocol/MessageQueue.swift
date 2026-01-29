//
//  MessageQueue.swift
//  ClawdbotKit
//
//  Outgoing message queue with delivery tracking and retry logic.
//

import Foundation
import Combine

/// Configuration for message queue retry behavior
public struct MessageQueueConfig: Sendable {
    /// Maximum retry attempts before marking as failed
    public let maxRetries: Int

    /// Base delay between retries (exponential backoff)
    public let baseRetryDelay: TimeInterval

    /// Maximum delay between retries
    public let maxRetryDelay: TimeInterval

    /// How long to wait for delivery confirmation
    public let deliveryTimeout: TimeInterval

    public static let `default` = MessageQueueConfig(
        maxRetries: 3,
        baseRetryDelay: 1.0,
        maxRetryDelay: 10.0,
        deliveryTimeout: 30.0
    )

    public init(
        maxRetries: Int,
        baseRetryDelay: TimeInterval,
        maxRetryDelay: TimeInterval,
        deliveryTimeout: TimeInterval
    ) {
        self.maxRetries = maxRetries
        self.baseRetryDelay = baseRetryDelay
        self.maxRetryDelay = maxRetryDelay
        self.deliveryTimeout = deliveryTimeout
    }
}

/// Entry in the outgoing queue
public struct QueuedMessage: Sendable, Identifiable {
    public let id: MessageID
    public let message: ChatMessage
    public var status: QueueStatus
    public var retryCount: Int
    public let queuedAt: Date
    public var lastAttempt: Date?

    public enum QueueStatus: String, Sendable {
        case queued          // Waiting to send
        case sending         // Currently being sent
        case awaitingAck     // Sent, waiting for server ack
        case delivered       // Server confirmed receipt
        case failed          // Exceeded retry attempts
    }

    public init(message: ChatMessage) {
        self.id = message.id
        self.message = message
        self.status = .queued
        self.retryCount = 0
        self.queuedAt = Date()
        self.lastAttempt = nil
    }
}

/// Delegate for queue events
public protocol MessageQueueDelegate: AnyObject, Sendable {
    /// Called when a message is ready to send
    func messageQueue(_ queue: OutgoingMessageQueue, shouldSend message: ChatMessage) async

    /// Called when a message delivery is confirmed
    func messageQueue(_ queue: OutgoingMessageQueue, didDeliver messageID: MessageID)

    /// Called when a message permanently fails
    func messageQueue(_ queue: OutgoingMessageQueue, didFail messageID: MessageID, error: Error?)
}

/// Error types for message queue
public enum MessageQueueError: Error, Sendable {
    case messageNotFound(MessageID)
    case alreadyDelivered(MessageID)
    case maxRetriesExceeded(MessageID)
    case queueFull
}

/// Actor managing outgoing message queue with delivery tracking
public actor OutgoingMessageQueue {

    // MARK: - Properties

    private var queue: [QueuedMessage] = []
    private var pendingAcks: [MessageID: QueuedMessage] = [:]
    private let config: MessageQueueConfig
    private var sequenceNumber: Int = 0

    public weak var delegate: MessageQueueDelegate?

    /// Publisher for queue state changes (for UI binding)
    public nonisolated let queuePublisher = CurrentValueSubject<[QueuedMessage], Never>([])

    // MARK: - Initialization

    public init(config: MessageQueueConfig = .default) {
        self.config = config
    }

    // MARK: - Queue Operations

    /// Add a message to the queue
    public func enqueue(_ message: ChatMessage) async {
        var queuedMessage = QueuedMessage(message: message)
        queuedMessage.status = .queued
        queue.append(queuedMessage)
        publishQueueState()

        // Trigger send
        await processQueue()
    }

    /// Get next sequence number
    public func nextSequence() -> Int {
        sequenceNumber += 1
        return sequenceNumber
    }

    /// Process queued messages
    public func processQueue() async {
        // Find messages ready to send
        for i in queue.indices {
            guard queue[i].status == .queued else { continue }

            queue[i].status = .sending
            queue[i].lastAttempt = Date()
            publishQueueState()

            // Delegate handles actual send
            await delegate?.messageQueue(self, shouldSend: queue[i].message)
        }
    }

    /// Mark message as sent (awaiting ack)
    public func markSent(_ messageID: MessageID) async {
        guard let index = queue.firstIndex(where: { $0.id == messageID }) else {
            return
        }

        queue[index].status = .awaitingAck
        pendingAcks[messageID] = queue[index]
        publishQueueState()

        // Start timeout timer
        let timeout = config.deliveryTimeout
        Task {
            try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
            await self.handleTimeout(messageID: messageID)
        }
    }

    /// Handle delivery confirmation from server
    public func confirmDelivery(_ messageID: MessageID) async {
        // Remove from pending acks
        pendingAcks.removeValue(forKey: messageID)

        // Update status in queue
        if let index = queue.firstIndex(where: { $0.id == messageID }) {
            queue[index].status = .delivered
            publishQueueState()

            // Notify delegate
            delegate?.messageQueue(self, didDeliver: messageID)

            // Remove from queue after short delay (allows UI to show delivered state)
            Task {
                try? await Task.sleep(nanoseconds: 1_000_000_000)  // 1 second
                await self.removeDelivered(messageID)
            }
        }
    }

    /// Handle send failure (will retry or fail permanently)
    public func handleSendFailure(_ messageID: MessageID, error: Error?) async {
        guard let index = queue.firstIndex(where: { $0.id == messageID }) else {
            return
        }

        pendingAcks.removeValue(forKey: messageID)

        queue[index].retryCount += 1

        if queue[index].retryCount >= config.maxRetries {
            // Max retries exceeded
            queue[index].status = .failed
            publishQueueState()
            delegate?.messageQueue(self, didFail: messageID, error: error)
        } else {
            // Schedule retry with exponential backoff
            queue[index].status = .queued
            publishQueueState()

            let delay = calculateRetryDelay(attempt: queue[index].retryCount)
            Task {
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                await self.processQueue()
            }
        }
    }

    // MARK: - Query

    /// Get all queued messages
    public func allMessages() -> [QueuedMessage] {
        queue
    }

    /// Get pending (not yet delivered) messages
    public func pendingMessages() -> [QueuedMessage] {
        queue.filter { $0.status != .delivered && $0.status != .failed }
    }

    /// Get message by ID
    public func message(for id: MessageID) -> QueuedMessage? {
        queue.first { $0.id == id }
    }

    /// Count of pending messages
    public func pendingCount() -> Int {
        pendingMessages().count
    }

    // MARK: - Private

    private func handleTimeout(messageID: MessageID) async {
        // Only handle timeout if still awaiting ack
        guard let pending = pendingAcks[messageID],
              pending.status == .awaitingAck else {
            return
        }

        await handleSendFailure(messageID, error: nil)
    }

    private func removeDelivered(_ messageID: MessageID) {
        queue.removeAll { $0.id == messageID && $0.status == .delivered }
        publishQueueState()
    }

    private func calculateRetryDelay(attempt: Int) -> TimeInterval {
        let delay = config.baseRetryDelay * pow(2.0, Double(attempt - 1))
        return min(delay, config.maxRetryDelay)
    }

    private func publishQueueState() {
        queuePublisher.send(queue)
    }

    // MARK: - Reset

    /// Clear all messages (e.g., on disconnect)
    public func clear() {
        queue.removeAll()
        pendingAcks.removeAll()
        publishQueueState()
    }

    /// Retry all failed messages
    public func retryFailed() async {
        for i in queue.indices where queue[i].status == .failed {
            queue[i].status = .queued
            queue[i].retryCount = 0
        }
        publishQueueState()
        await processQueue()
    }

    // MARK: - Delegate Access

    /// Set the delegate (actor-isolated setter)
    public func setDelegate(_ delegate: MessageQueueDelegate?) {
        self.delegate = delegate
    }
}
