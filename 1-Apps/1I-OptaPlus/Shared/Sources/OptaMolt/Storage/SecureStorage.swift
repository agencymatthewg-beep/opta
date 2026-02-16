//
//  SecureStorage.swift
//  OptaMolt
//
//  Keychain-based secure storage for bot tokens and sensitive data.
//  Platform-agnostic wrapper using Security framework.
//

import Foundation
import Security
import os.log

// MARK: - Secure Storage

public final class SecureStorage {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "Security")
    public static let shared = SecureStorage()

    private let serviceName = "com.optaoperations.optaplus"
    
    private init() {}
    
    // MARK: - CRUD
    
    /// Save a string value to Keychain.
    @discardableResult
    public func save(key: String, value: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }
        
        // Delete existing item first
        delete(key: key)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }

    /// Save a string value to Keychain with iCloud sync enabled.
    /// Use for pairing tokens that should persist across Apple devices.
    @discardableResult
    public func saveSyncable(key: String, value: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }
        delete(key: key)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlocked,
            kSecAttrSynchronizable as String: true
        ]
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }

    /// Retrieve a string value from Keychain.
    public func load(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    
    /// Update an existing Keychain item.
    @discardableResult
    public func update(key: String, value: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key
        ]
        
        let attributes: [String: Any] = [
            kSecValueData as String: data
        ]
        
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            return save(key: key, value: value)
        }
        return status == errSecSuccess
    }
    
    /// Delete an item from Keychain.
    @discardableResult
    public func delete(key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key
        ]
        
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
    
    /// Delete all items for this service.
    @discardableResult
    public func deleteAll() -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName
        ]
        
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
    
    // MARK: - Bot Token Helpers
    
    /// Key for a bot's token in Keychain.
    private func tokenKey(botId: String) -> String {
        "bot.token.\(botId)"
    }
    
    /// Save a bot token securely.
    @discardableResult
    public func saveBotToken(_ token: String, botId: String) -> Bool {
        save(key: tokenKey(botId: botId), value: token)
    }
    
    /// Load a bot token from Keychain.
    public func loadBotToken(botId: String) -> String? {
        load(key: tokenKey(botId: botId))
    }
    
    /// Delete a bot token from Keychain.
    @discardableResult
    public func deleteBotToken(botId: String) -> Bool {
        delete(key: tokenKey(botId: botId))
    }
    
    // MARK: - Migration
    
    /// Migrate bot tokens from UserDefaults to Keychain (one-time on first launch).
    /// Call this at app startup.
    public func migrateTokensIfNeeded(bots: [BotConfig]) {
        let migrationKey = "optaplus.keychain.migrated"
        guard !UserDefaults.standard.bool(forKey: migrationKey) else { return }
        
        for bot in bots {
            if !bot.token.isEmpty {
                saveBotToken(bot.token, botId: bot.id)
            }
        }
        
        UserDefaults.standard.set(true, forKey: migrationKey)
        Self.logger.info("Migrated \(bots.count) bot tokens to Keychain")
    }
    
    // MARK: - Token Masking
    
    /// Mask a token for display (e.g., "abc...xyz" or "••••••••").
    public static func maskToken(_ token: String) -> String {
        guard token.count > 8 else { return String(repeating: "•", count: max(token.count, 8)) }
        let prefix = String(token.prefix(4))
        let suffix = String(token.suffix(4))
        return "\(prefix)••••\(suffix)"
    }
}
