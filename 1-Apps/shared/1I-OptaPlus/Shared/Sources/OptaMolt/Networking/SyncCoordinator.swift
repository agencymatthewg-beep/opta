//
//  SyncCoordinator.swift
//  OptaMolt
//
//  Routes messages between the OpenClaw gateway and Telegram.
//  Deduplicates messages that arrive on both channels, maintains ID mapping,
//  and manages an offline queue for reliability.
//

import Foundation
import CryptoKit
import os.log

// MARK: - Message Mapping

/// Maps between local, gateway, and Telegram message identifiers.
public struct MessageMapping: Codable, Sendable {
    public let localId: String
    public var gatewayKey: String?
    public var telegramId: Int64?
    public let source: MessageSource
    public let timestamp: Date
}

// MARK: - Queued Message

/// A message pending delivery to one or more channels.
struct QueuedMessage: Codable, Sendable {
    let id: String
    let text: String
    let targetGateway: Bool
    let targetTelegram: Bool
    let createdAt: Date
    var retryCount: Int
}

// MARK: - SyncCoordinator

@MainActor
public final class SyncCoordinator: ObservableObject {

    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "Sync")

    // MARK: - Published

    @Published public var isSyncing = false

    // MARK: - Configuration

    private let deduplicationWindowSeconds: TimeInterval = 5
    private let maxFingerprints = 500
    private let fingerprintTTL: TimeInterval = 60

    // MARK: - Deduplication

    private var seenFingerprints: [(fingerprint: String, addedAt: Date)] = []

    // MARK: - ID Mapping

    private var mappings: [String: MessageMapping] = [:]

    // MARK: - Offline Queue

    private var offlineQueue: [QueuedMessage] = []
    private let maxQueueSize = 100
    private let maxRetries = 10
    private let maxQueueAge: TimeInterval = 86400
    private let queueKey = "optaplus.sync.offlineQueue"

    // MARK: - Init

    public init() {
        loadOfflineQueue()
    }

    // MARK: - Deduplication

    public func shouldProcess(sender: String, content: String, timestamp: Date) -> Bool {
        let fingerprint = computeFingerprint(sender: sender, content: content, timestamp: timestamp)
        let now = Date()
        seenFingerprints.removeAll { now.timeIntervalSince($0.addedAt) > fingerprintTTL }

        if seenFingerprints.contains(where: { $0.fingerprint == fingerprint }) {
            Self.logger.debug("Duplicate detected, discarding: \(content.prefix(30))...")
            return false
        }

        seenFingerprints.append((fingerprint: fingerprint, addedAt: now))
        if seenFingerprints.count > maxFingerprints {
            seenFingerprints.removeFirst(seenFingerprints.count - maxFingerprints)
        }
        return true
    }

    public func registerOutgoing(sender: String, content: String, timestamp: Date) {
        let fingerprint = computeFingerprint(sender: sender, content: content, timestamp: timestamp)
        seenFingerprints.append((fingerprint: fingerprint, addedAt: Date()))
    }

    private func computeFingerprint(sender: String, content: String, timestamp: Date) -> String {
        let roundedTs = Int(timestamp.timeIntervalSince1970 / deduplicationWindowSeconds) * Int(deduplicationWindowSeconds)
        let prefix = String(content.prefix(100))
        let input = "\(sender)|\(prefix)|\(roundedTs)"
        let hash = SHA256.hash(data: Data(input.utf8))
        return hash.map { String(format: "%02x", $0) }.joined()
    }

    // MARK: - ID Mapping

    public func recordMapping(_ mapping: MessageMapping) {
        mappings[mapping.localId] = mapping
    }

    public func setGatewayKey(_ key: String, forLocalId localId: String) {
        mappings[localId]?.gatewayKey = key
    }

    public func setTelegramId(_ id: Int64, forLocalId localId: String) {
        mappings[localId]?.telegramId = id
    }

    public func mapping(forLocalId localId: String) -> MessageMapping? {
        mappings[localId]
    }

    // MARK: - Telegram Send (Stub — requires TDLibKit)

    /// Placeholder for Telegram send. When TDLibKit is integrated,
    /// this will forward messages to the Telegram bot chat.
    public func sendViaTelegram(_ text: String, gatewayKey: String) {
        // TODO: Re-enable when TDLibKit dependency is restored
        Self.logger.info("Telegram send not available (TDLibKit not linked)")
        enqueue(text: text, targetGateway: false, targetTelegram: true)
    }

    // MARK: - Conflict Resolution

    /// Resolve a sync conflict between local and remote versions of data.
    /// Uses server-timestamp-wins strategy: the version with the later timestamp wins.
    /// For equal timestamps, gateway (remote) wins as it is the source of truth.
    ///
    /// - Parameters:
    ///   - local: The local version with its timestamp
    ///   - remote: The remote/gateway version with its timestamp
    /// - Returns: The winning version (`.local` or `.remote`)
    public enum ConflictWinner { case local, remote }

    public func resolveConflict(
        localTimestamp: Date,
        remoteTimestamp: Date
    ) -> ConflictWinner {
        // Server timestamp wins; ties go to remote (gateway is source of truth)
        if localTimestamp > remoteTimestamp {
            Self.logger.info("Conflict resolved: local wins (local=\(localTimestamp), remote=\(remoteTimestamp))")
            return .local
        }
        Self.logger.info("Conflict resolved: remote wins (local=\(localTimestamp), remote=\(remoteTimestamp))")
        return .remote
    }

    /// Merge message arrays from local cache and gateway, deduplicating by ID.
    /// Gateway messages take precedence for content when IDs match.
    public func mergeMessages(local: [MessageMapping], remote: [MessageMapping]) -> [MessageMapping] {
        var merged: [String: MessageMapping] = [:]

        // Local first
        for msg in local {
            merged[msg.localId] = msg
        }

        // Remote overwrites on conflict (server is source of truth)
        for msg in remote {
            if let existing = merged[msg.localId] {
                let winner = resolveConflict(
                    localTimestamp: existing.timestamp,
                    remoteTimestamp: msg.timestamp
                )
                if winner == .remote {
                    merged[msg.localId] = msg
                }
            } else {
                merged[msg.localId] = msg
            }
        }

        return Array(merged.values).sorted { $0.timestamp < $1.timestamp }
    }

    // MARK: - Offline Queue

    private func enqueue(text: String, targetGateway: Bool, targetTelegram: Bool) {
        guard offlineQueue.count < maxQueueSize else {
            Self.logger.error("Offline queue full, dropping message")
            return
        }
        let msg = QueuedMessage(
            id: UUID().uuidString,
            text: text,
            targetGateway: targetGateway,
            targetTelegram: targetTelegram,
            createdAt: Date(),
            retryCount: 0
        )
        offlineQueue.append(msg)
        saveOfflineQueue()
    }

    public func drainQueue() async {
        guard !offlineQueue.isEmpty else { return }
        isSyncing = true
        defer { isSyncing = false }

        let now = Date()
        var remaining: [QueuedMessage] = []

        for var msg in offlineQueue {
            if now.timeIntervalSince(msg.createdAt) > maxQueueAge || msg.retryCount >= maxRetries {
                Self.logger.info("Dropping expired/over-retried queued message: \(msg.id)")
                continue
            }
            // Telegram delivery not available yet — keep in queue
            if msg.targetTelegram {
                msg.retryCount += 1
                remaining.append(msg)
            }
        }

        offlineQueue = remaining
        saveOfflineQueue()
    }

    // MARK: - Persistence

    private func saveOfflineQueue() {
        if let data = try? JSONEncoder().encode(offlineQueue) {
            UserDefaults.standard.set(data, forKey: queueKey)
        }
    }

    private func loadOfflineQueue() {
        guard let data = UserDefaults.standard.data(forKey: queueKey),
              let queue = try? JSONDecoder().decode([QueuedMessage].self, from: data) else {
            return
        }
        offlineQueue = queue
    }
}
