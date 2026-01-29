//
//  MessageStore.swift
//  ClawdbotKit
//
//  Actor for thread-safe message persistence with file-based JSON storage.
//  Provides in-memory cache with write-through to disk.
//

import Foundation

/// Thread-safe message store with file-based persistence
///
/// Uses actor isolation for safe concurrent access.
/// Messages are stored as JSON in Application Support directory.
/// One file per conversation (prepared for multi-bot in Phase 9).
public actor MessageStore {

    // MARK: - Properties

    private let conversationId: String
    private let fileManager = FileManager.default
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    /// In-memory cache of messages
    private var cachedMessages: [ChatMessage] = []

    /// Maximum messages to keep in history (memory management)
    private let maxHistorySize: Int = 1000

    // MARK: - Initialization

    /// Initialize MessageStore for a conversation
    /// - Parameter conversationId: Unique identifier for the conversation (defaults to "default")
    public init(conversationId: String = "default") {
        self.conversationId = conversationId

        // Configure encoder/decoder for ISO8601 dates (matches ProtocolCodec)
        self.encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        self.decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
    }

    // MARK: - Public API

    /// Load messages from disk
    /// - Returns: Array of messages, empty if no history exists
    public func loadMessages() async -> [ChatMessage] {
        // Return cache if already loaded
        if !cachedMessages.isEmpty {
            return cachedMessages
        }

        // Load from disk
        guard let fileURL = messageFileURL() else {
            return []
        }

        guard fileManager.fileExists(atPath: fileURL.path) else {
            // New conversation, no history
            return []
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let messages = try decoder.decode([ChatMessage].self, from: data)
            cachedMessages = messages
            return messages
        } catch {
            // Log error but don't throw - persistence failures shouldn't crash chat
            print("[MessageStore] Failed to load messages: \(error)")
            return []
        }
    }

    /// Save a single message
    /// - Parameter message: The message to save
    ///
    /// Uses write-through cache: updates memory AND disk.
    public func save(_ message: ChatMessage) async {
        // Check for duplicate by ID and update existing, or append
        if let existingIndex = cachedMessages.firstIndex(where: { $0.id == message.id }) {
            cachedMessages[existingIndex] = message
        } else {
            cachedMessages.append(message)
        }

        // Enforce history size limit
        enforceHistoryLimit()

        // Write to disk
        await writeToDisk()
    }

    /// Save multiple messages at once
    /// - Parameter messages: Array of messages to save
    public func saveAll(_ messages: [ChatMessage]) async {
        for message in messages {
            if let existingIndex = cachedMessages.firstIndex(where: { $0.id == message.id }) {
                cachedMessages[existingIndex] = message
            } else {
                cachedMessages.append(message)
            }
        }

        // Enforce history size limit
        enforceHistoryLimit()

        // Write to disk
        await writeToDisk()
    }

    /// Clear all message history
    public func clearHistory() async {
        cachedMessages.removeAll()

        // Delete file from disk
        guard let fileURL = messageFileURL() else { return }

        do {
            if fileManager.fileExists(atPath: fileURL.path) {
                try fileManager.removeItem(at: fileURL)
            }
        } catch {
            print("[MessageStore] Failed to clear history: \(error)")
        }
    }

    // MARK: - Private Methods

    /// Get the file URL for message storage
    /// - Returns: URL to the messages JSON file, or nil if directory cannot be created
    private func messageFileURL() -> URL? {
        guard let appSupportURL = fileManager.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first else {
            return nil
        }

        // Create Clawdbot subdirectory
        let clawdbotDir = appSupportURL.appendingPathComponent("Clawdbot", isDirectory: true)
        let messagesDir = clawdbotDir.appendingPathComponent("Messages", isDirectory: true)

        // Create directories if needed
        do {
            try fileManager.createDirectory(at: messagesDir, withIntermediateDirectories: true)
        } catch {
            print("[MessageStore] Failed to create directory: \(error)")
            return nil
        }

        // File name: messages_{conversationId}.json
        return messagesDir.appendingPathComponent("messages_\(conversationId).json")
    }

    /// Write cached messages to disk
    private func writeToDisk() async {
        guard let fileURL = messageFileURL() else { return }

        do {
            let data = try encoder.encode(cachedMessages)
            try data.write(to: fileURL, options: .atomic)
        } catch {
            print("[MessageStore] Failed to write messages: \(error)")
        }
    }

    /// Enforce maximum history size by removing oldest messages
    private func enforceHistoryLimit() {
        if cachedMessages.count > maxHistorySize {
            let overflow = cachedMessages.count - maxHistorySize
            cachedMessages.removeFirst(overflow)
        }
    }
}
