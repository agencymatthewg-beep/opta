//
//  OfflineQueue.swift
//  OptaMolt
//
//  Persistent FIFO queue for messages sent while the WebSocket is disconnected.
//  Survives app restart via JSON file in Application Support.
//

import Foundation
import os.log

// MARK: - Queued Message

/// A message waiting to be sent when the connection is restored.
public struct OfflineQueuedMessage: Codable, Identifiable, Sendable {
    public let id: String
    public let text: String
    public let botId: String
    public let sessionKey: String
    public let timestamp: Date
    public var retryCount: Int
    public let deliver: Bool

    /// Message ID in the ChatMessage list (for status updates).
    public let chatMessageId: String

    /// Base64-encoded attachment data (optional).
    public let attachments: [QueuedAttachment]

    public init(
        text: String,
        botId: String,
        sessionKey: String,
        deliver: Bool,
        chatMessageId: String,
        attachments: [QueuedAttachment] = []
    ) {
        self.id = UUID().uuidString
        self.text = text
        self.botId = botId
        self.sessionKey = sessionKey
        self.timestamp = Date()
        self.retryCount = 0
        self.deliver = deliver
        self.chatMessageId = chatMessageId
        self.attachments = attachments
    }
}

/// Codable representation of an attachment for queue persistence.
public struct QueuedAttachment: Codable, Sendable {
    public let filename: String
    public let mimeType: String
    public let base64Data: String

    public init(filename: String, mimeType: String, base64Data: String) {
        self.filename = filename
        self.mimeType = mimeType
        self.base64Data = base64Data
    }
}

// MARK: - Offline Queue

/// Persistent FIFO message queue for offline support.
///
/// When the WebSocket is disconnected, messages are added here and persisted
/// to disk. On reconnect, `flush()` sends them in order with a delay between
/// each to avoid overwhelming the gateway.
@MainActor
public final class OfflineQueue: ObservableObject {

    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "OfflineQueue")

    /// Maximum number of messages the queue will hold. Oldest are dropped when exceeded.
    public static let maxQueueSize = 50

    /// Delay between sending queued messages during flush (milliseconds).
    private static let flushDelayMs: UInt64 = 500

    /// Maximum retry attempts per message before marking as failed.
    private static let maxRetries = 3

    // MARK: - Published State

    /// Messages waiting to be sent.
    @Published public private(set) var messages: [OfflineQueuedMessage] = []

    /// Whether a flush is currently in progress.
    @Published public private(set) var isFlushing = false

    /// Number of queued messages.
    public var count: Int { messages.count }

    /// Whether the queue is empty.
    public var isEmpty: Bool { messages.isEmpty }

    // MARK: - Private

    private let botId: String
    private let fileManager = FileManager.default

    // MARK: - Init

    public init(botId: String) {
        self.botId = botId
        self.messages = loadFromDisk()
        Self.logger.info("Initialized queue for bot \(botId): \(self.messages.count) persisted messages")
    }

    // MARK: - Public API

    /// Add a message to the queue.
    public func add(_ message: OfflineQueuedMessage) {
        // Evict oldest if at capacity
        while messages.count >= Self.maxQueueSize {
            let removed = messages.removeFirst()
            Self.logger.info("Queue full — dropped oldest message \(removed.id)")
        }
        messages.append(message)
        saveToDisk()
        Self.logger.info("Queued message \(message.id) (\(self.messages.count) in queue)")
    }

    /// Flush all queued messages by sending them through the provided closure.
    ///
    /// - Parameters:
    ///   - sender: Async closure that sends a single message. Returns true on success.
    ///   - onStatusUpdate: Called with (chatMessageId, newStatus) for UI updates.
    public func flush(
        sender: @escaping (OfflineQueuedMessage) async -> Bool,
        onStatusUpdate: @escaping (String, ChatMessage.MessageStatus) -> Void
    ) {
        guard !isFlushing, !messages.isEmpty else { return }
        isFlushing = true

        let snapshot = messages
        Self.logger.info("Flushing \(snapshot.count) queued messages")

        Task { [self] in
            for message in snapshot {
                let success = await sender(message)

                if success {
                    self.messages.removeAll { $0.id == message.id }
                    onStatusUpdate(message.chatMessageId, .sent)
                    Self.logger.info("Flushed message \(message.id) successfully")
                } else {
                    if let idx = self.messages.firstIndex(where: { $0.id == message.id }) {
                        self.messages[idx].retryCount += 1
                        if self.messages[idx].retryCount >= Self.maxRetries {
                            let failed = self.messages.remove(at: idx)
                            onStatusUpdate(failed.chatMessageId, .failed)
                            Self.logger.error("Message \(message.id) exceeded max retries — marked failed")
                        }
                    }
                    // Stop flushing on first failure to preserve order
                    break
                }

                try? await Task.sleep(nanoseconds: Self.flushDelayMs * 1_000_000)
            }

            self.saveToDisk()
            self.isFlushing = false
            Self.logger.info("Flush complete — \(self.messages.count) messages remaining")
        }
    }

    /// Remove all messages from the queue.
    public func clear() {
        messages.removeAll()
        saveToDisk()
    }

    // MARK: - Persistence

    private var storageDir: URL {
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = appSupport.appendingPathComponent("OptaPlus/OfflineQueue", isDirectory: true)
        try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private var fileURL: URL {
        storageDir.appendingPathComponent("queue-\(botId).json")
    }

    private func saveToDisk() {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(messages)
            try data.write(to: fileURL, options: .atomic)
        } catch {
            Self.logger.error("Failed to save queue: \(error.localizedDescription)")
        }
    }

    private func loadFromDisk() -> [OfflineQueuedMessage] {
        guard fileManager.fileExists(atPath: fileURL.path) else { return [] }
        do {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode([OfflineQueuedMessage].self, from: data)
        } catch {
            Self.logger.error("Failed to load queue: \(error.localizedDescription)")
            return []
        }
    }
}


// MARK: - Draft Store

/// Persists unsent draft text per bot/session so it survives app restarts.
/// Drafts are saved to Application Support and cleared when the message is sent.
@MainActor
public final class DraftStore: ObservableObject {

    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "DraftStore")

    /// Current draft text (bound to the input field).
    @Published public var text: String = "" {
        didSet {
            scheduleSave()
        }
    }

    private let botId: String
    private let sessionKey: String
    private let fileManager = FileManager.default
    private var saveTask: Task<Void, Never>?

    /// Debounce interval for saving drafts (seconds).
    private static let saveDebounce: TimeInterval = 0.5

    public init(botId: String, sessionKey: String = "main") {
        self.botId = botId
        self.sessionKey = sessionKey
        self.text = loadFromDisk()
        if !text.isEmpty {
            Self.logger.info("Restored draft for bot \(botId)/\(sessionKey): \(self.text.prefix(50))...")
        }
    }

    /// Clear the draft (called after successful send).
    public func clear() {
        text = ""
        deleteFromDisk()
    }

    // MARK: - Persistence

    private var storageDir: URL {
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = appSupport.appendingPathComponent("OptaPlus/Drafts", isDirectory: true)
        try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private var fileURL: URL {
        storageDir.appendingPathComponent("draft-\(botId)-\(sessionKey).txt")
    }

    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(Self.saveDebounce * 1_000_000_000))
            guard !Task.isCancelled else { return }
            saveToDisk()
        }
    }

    private func saveToDisk() {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            deleteFromDisk()
            return
        }
        do {
            try text.write(to: fileURL, atomically: true, encoding: .utf8)
        } catch {
            Self.logger.error("Failed to save draft: \(error.localizedDescription)")
        }
    }

    private func loadFromDisk() -> String {
        guard fileManager.fileExists(atPath: fileURL.path) else { return "" }
        do {
            return try String(contentsOf: fileURL, encoding: .utf8)
        } catch {
            Self.logger.error("Failed to load draft: \(error.localizedDescription)")
            return ""
        }
    }

    private func deleteFromDisk() {
        try? fileManager.removeItem(at: fileURL)
    }
}
