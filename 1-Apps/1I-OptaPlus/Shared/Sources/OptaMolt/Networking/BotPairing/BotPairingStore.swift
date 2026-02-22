//
//  BotPairingStore.swift
//  OptaMolt
//
//  Persistent storage for bot pairing tokens and metadata.
//  Tokens stored in iCloud-syncable Keychain, metadata in UserDefaults.
//

import Foundation
import os.log

public final class BotPairingStore {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "BotPairing")
    private let storage = SecureStorage.shared
    private let nodesKey = "optaplus.paired.botnodes"

    public init() {}

    // MARK: - Token CRUD

    public func saveToken(_ token: PairingToken) {
        guard let data = try? JSONEncoder().encode(token),
              let json = String(data: data, encoding: .utf8) else { return }
        guard storage.saveSyncable(key: token.keychainKey, value: json) else {
            Self.logger.error("Failed to persist pairing token for \(token.botId)")
            return
        }
        var index = tokenIndex()
        index.insert(token.keychainKey)
        saveTokenIndex(index)
        Self.logger.info("Saved pairing token for \(token.botId)")
    }

    public func loadToken(botId: String, gatewayFingerprint: String) -> PairingToken? {
        let key = "pairing.\(gatewayFingerprint).\(botId)"
        guard let json = storage.load(key: key),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(PairingToken.self, from: data)
    }

    public func deleteToken(botId: String, gatewayFingerprint: String) {
        let key = "pairing.\(gatewayFingerprint).\(botId)"
        storage.delete(key: key)
        var index = tokenIndex()
        index.remove(key)
        saveTokenIndex(index)
    }

    public func allTokens() -> [PairingToken] {
        tokenIndex().compactMap { key in
            guard let json = storage.load(key: key),
                  let data = json.data(using: .utf8) else { return nil }
            return try? JSONDecoder().decode(PairingToken.self, from: data)
        }
    }

    public func removeAll() {
        for key in tokenIndex() {
            storage.delete(key: key)
        }
        saveTokenIndex([])
        UserDefaults.standard.removeObject(forKey: nodesKey)
    }

    // MARK: - BotNode Persistence

    public func saveBotNode(_ node: BotNode) {
        var nodes = loadBotNodes()
        nodes.removeAll { $0.id == node.id }
        nodes.append(node)
        saveBotNodes(nodes)
    }

    public func loadBotNodes() -> [BotNode] {
        guard let data = UserDefaults.standard.data(forKey: nodesKey) else { return [] }
        return (try? JSONDecoder().decode([BotNode].self, from: data)) ?? []
    }

    public func removeBotNode(id: String) {
        var nodes = loadBotNodes()
        nodes.removeAll { $0.id == id }
        saveBotNodes(nodes)
    }

    private func saveBotNodes(_ nodes: [BotNode]) {
        guard let data = try? JSONEncoder().encode(nodes) else { return }
        UserDefaults.standard.set(data, forKey: nodesKey)
    }

    // MARK: - Migration

    public func migrateFromBotConfigs(_ configs: [BotConfig], gatewayFingerprint: String) -> [PairingToken] {
        let deviceId = DeviceIdentity.current.deviceId
        var tokens: [PairingToken] = []
        for config in configs {
            guard !config.token.isEmpty else { continue }
            let token = PairingToken(
                botId: config.id,
                gatewayFingerprint: gatewayFingerprint,
                token: config.token,
                deviceId: deviceId
            )
            saveToken(token)
            let node = BotNode(
                botId: config.id,
                gatewayFingerprint: gatewayFingerprint,
                name: config.name,
                emoji: config.emoji,
                gatewayHost: config.host,
                gatewayPort: config.port,
                remoteURL: config.remoteURL,
                state: .paired
            )
            saveBotNode(node)
            tokens.append(token)
        }
        Self.logger.info("Migrated \(configs.count) BotConfigs to pairing tokens")
        return tokens
    }

    // MARK: - Private: Token Index

    private let indexKey = "optaplus.pairing.token.index"

    private func tokenIndex() -> Set<String> {
        guard let json = storage.load(key: indexKey),
              let data = json.data(using: .utf8),
              let keys = try? JSONDecoder().decode([String].self, from: data) else {
            return []
        }
        return Set(keys)
    }

    private func saveTokenIndex(_ index: Set<String>) {
        guard let data = try? JSONEncoder().encode(Array(index)),
              let json = String(data: data, encoding: .utf8) else { return }
        storage.save(key: indexKey, value: json)
    }
}
