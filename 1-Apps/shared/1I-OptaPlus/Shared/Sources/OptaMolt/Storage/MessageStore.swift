//
//  MessageStore.swift
//  OptaMolt
//
//  Thread-safe local message persistence using actor isolation.
//  Stores messages as JSON files (one per bot) in Application Support.
//

import Foundation
import os.log

// MARK: - Codable Wrappers

/// Codable representation of a ChatMessage for local persistence.
struct StoredMessage: Codable {
    let id: String
    let content: String
    let isUser: Bool
    let botName: String?
    let timestamp: Date
    let sourceRaw: String?
    let replyTo: String?

    init(from message: ChatMessage) {
        self.id = message.id
        self.content = message.content
        self.timestamp = message.timestamp
        self.sourceRaw = message.source?.rawValue
        self.replyTo = message.replyTo
        switch message.sender {
        case .user:
            self.isUser = true
            self.botName = nil
        case .bot(let name):
            self.isUser = false
            self.botName = name
        }
    }

    func toChatMessage() -> ChatMessage {
        ChatMessage(
            id: id,
            content: content,
            sender: isUser ? .user : .bot(name: botName ?? "Bot"),
            timestamp: timestamp,
            status: .delivered,
            source: sourceRaw.flatMap { MessageSource(rawValue: $0) },
            replyTo: replyTo
        )
    }
}

// MARK: - Message Store Actor

/// Thread-safe message store that persists chat history per bot as JSON files.
public actor MessageStore {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "Storage")
    public static let shared = MessageStore()

    private let maxMessagesPerBot = 200
    private let fileManager = FileManager.default
    private var saveWorkItems: [String: Task<Void, Never>] = [:]
    private let debounceInterval: UInt64 = 2_000_000_000 // 2 seconds

    private var storageDir: URL {
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = appSupport.appendingPathComponent("OptaPlus/ChatHistory", isDirectory: true)
        try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private func fileURL(for botId: String) -> URL {
        storageDir.appendingPathComponent("chat-\(botId).json")
    }

    // MARK: - Load

    /// Load persisted messages for a bot. Returns up to `maxMessagesPerBot` most recent.
    public func loadMessages(botId: String) -> [ChatMessage] {
        let url = fileURL(for: botId)
        guard fileManager.fileExists(atPath: url.path) else { return [] }
        do {
            let data = try Data(contentsOf: url)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let stored = try decoder.decode([StoredMessage].self, from: data)
            return stored.suffix(maxMessagesPerBot).map { $0.toChatMessage() }
        } catch {
            Self.logger.error("Failed to load messages for \(botId): \(error.localizedDescription)")
            return []
        }
    }

    // MARK: - Save (Debounced)

    /// Schedule a debounced save of messages for a bot.
    public func saveMessages(_ messages: [ChatMessage], botId: String) {
        saveWorkItems[botId]?.cancel()
        let interval = debounceInterval
        saveWorkItems[botId] = Task {
            try? await Task.sleep(nanoseconds: interval)
            guard !Task.isCancelled else { return }
            await self.writeMessages(messages, botId: botId)
        }
    }

    /// Immediately persist messages (used on app termination).
    public func saveMessagesNow(_ messages: [ChatMessage], botId: String) {
        Task { await writeMessages(messages, botId: botId) }
    }

    private func writeMessages(_ messages: [ChatMessage], botId: String) {
        let recent = messages.suffix(maxMessagesPerBot)
        let stored = recent.map { StoredMessage(from: $0) }
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = .prettyPrinted
            let data = try encoder.encode(stored)
            try data.write(to: fileURL(for: botId), options: .atomic)
        } catch {
            Self.logger.error("Failed to save messages for \(botId): \(error.localizedDescription)")
        }
    }

    // MARK: - Clear

    /// Delete persisted messages for a bot.
    public func clearMessages(botId: String) {
        let url = fileURL(for: botId)
        try? fileManager.removeItem(at: url)
    }
}
