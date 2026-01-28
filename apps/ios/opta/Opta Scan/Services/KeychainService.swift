//
//  KeychainService.swift
//  Opta Scan
//
//  Secure credential storage using iOS Keychain
//  Part of Research-Driven Improvements
//

import Foundation
import Security

// MARK: - Keychain Service

/// Thread-safe Keychain operations for secure credential storage
actor KeychainService {
    static let shared = KeychainService()

    private let serviceName = "com.opta.scan"

    // MARK: - Keys

    enum Key: String {
        case downloadedModelId = "downloaded_model_id"
        case modelCachePath = "model_cache_path"
    }

    // MARK: - Save

    /// Save a string value to Keychain
    func save(_ value: String, for key: Key) throws {
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.encodingFailed
        }

        // Delete existing item first
        try? delete(key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key.rawValue,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]

        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }
    }

    // MARK: - Retrieve

    /// Retrieve a string value from Keychain
    func retrieve(_ key: Key) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess else {
            throw KeychainError.retrieveFailed(status)
        }

        guard let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            throw KeychainError.decodingFailed
        }

        return string
    }

    // MARK: - Delete

    /// Delete a value from Keychain
    func delete(_ key: Key) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key.rawValue
        ]

        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status)
        }
    }

    // MARK: - Exists

    /// Check if a key exists in Keychain
    func exists(_ key: Key) -> Bool {
        do {
            return try retrieve(key) != nil
        } catch {
            return false
        }
    }
}

// MARK: - Keychain Error

enum KeychainError: LocalizedError {
    case encodingFailed
    case decodingFailed
    case saveFailed(OSStatus)
    case retrieveFailed(OSStatus)
    case deleteFailed(OSStatus)

    var errorDescription: String? {
        switch self {
        case .encodingFailed:
            return "Failed to encode value for Keychain storage."
        case .decodingFailed:
            return "Failed to decode value from Keychain."
        case .saveFailed(let status):
            return "Failed to save to Keychain (status: \(status))."
        case .retrieveFailed(let status):
            return "Failed to retrieve from Keychain (status: \(status))."
        case .deleteFailed(let status):
            return "Failed to delete from Keychain (status: \(status))."
        }
    }
}
