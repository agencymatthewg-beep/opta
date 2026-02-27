//
//  OptaCredentialService.swift
//  OptaLMiOS
//
//  Handles the migration and synchronization of third-party credentials
//  (Google, Todoist, etc.) to the unified Supabase vault.
//

import Foundation
import CryptoKit
import Security
import Supabase

enum CredentialSyncCrypto {
    static let envelopePrefix = "opta_sync_v1:"

    static func encrypt(_ value: String, using key: SymmetricKey) -> String? {
        guard let plaintextData = value.data(using: .utf8) else { return nil }

        do {
            let sealedBox = try AES.GCM.seal(plaintextData, using: key)
            guard let combined = sealedBox.combined else { return nil }
            return envelopePrefix + combined.base64EncodedString()
        } catch {
            return nil
        }
    }

    static func decrypt(_ payload: String, using key: SymmetricKey) -> String? {
        guard payload.hasPrefix(envelopePrefix) else { return nil }

        let encoded = String(payload.dropFirst(envelopePrefix.count))
        guard let combinedData = Data(base64Encoded: encoded) else { return nil }

        do {
            let sealedBox = try AES.GCM.SealedBox(combined: combinedData)
            let plaintext = try AES.GCM.open(sealedBox, using: key)
            return String(data: plaintext, encoding: .utf8)
        } catch {
            return nil
        }
    }

    static func isSecureEnvelope(_ payload: String) -> Bool {
        payload.hasPrefix(envelopePrefix)
    }
}

@MainActor
class OptaCredentialService: ObservableObject {
    static let shared = OptaCredentialService()
    
    private let supabase = SupabaseService.shared.client

    private struct CredentialTarget {
        let service: String
        let type: String
        let keychainKey: String
    }

    private static let syncTargets: [CredentialTarget] = [
        .init(service: "google", type: "oauth_token", keychainKey: "opta_google_token"),
        .init(service: "todoist", type: "api_key", keychainKey: "opta_todoist_token"),
        .init(service: "openclaw", type: "gateway_url", keychainKey: "opta_gateway_url")
    ]

    private static let encryptionKeyAccount = "opta_cloud_credential_encryption_key_v1"
    
    private init() {}
    
    // MARK: - Migration logic
    
    /// Checks for local credentials and uploads them to Supabase if they don't exist there.
    func syncLocalCredentialsToCloud() async {
        guard SupabaseService.shared.auth.currentUser != nil else { return }

        guard let encryptionKey = loadOrCreateEncryptionKey() else {
            print("[CredentialSync][SECURITY] Failed to load encryption key. Skipping cloud upload.")
            return
        }

        for target in Self.syncTargets {
            guard let localValue = KeychainHelper.get(target.keychainKey), !localValue.isEmpty else {
                continue
            }

            guard let encryptedPayload = CredentialSyncCrypto.encrypt(localValue, using: encryptionKey) else {
                print("[CredentialSync][SECURITY] Failed to encrypt \(target.service) \(target.type). Skipping upload.")
                continue
            }

            await uploadCredential(service: target.service, type: target.type, encryptedValue: encryptedPayload)
        }
    }
    
    // MARK: - Private helpers
    
    private struct CredentialUpsert: Encodable {
        let user_id: String
        let service_name: String
        let credential_type: String
        let encrypted_value: String
        let updated_at: String
    }
    
    private func uploadCredential(service: String, type: String, encryptedValue: String) async {
        guard let userId = SupabaseService.shared.auth.currentUser?.id else { return }
        
        let credentialData = CredentialUpsert(
            user_id: userId.uuidString,
            service_name: service,
            credential_type: type,
            encrypted_value: encryptedValue,
            updated_at: ISO8601DateFormatter().string(from: Date())
        )
        
        do {
            try await supabase
                .from("credentials")
                .upsert(credentialData, onConflict: "user_id,service_name,credential_type")
                .execute()
            
            print("[CredentialSync] Successfully synced \(service) \(type) to cloud.")
        } catch {
            print("[CredentialSync] Failed to sync \(service): \(error.localizedDescription)")
        }
    }
    
    /// Pulls credentials from the cloud and stores them in the local keychain.
    func pullCredentialsFromCloud() async {
        guard let userId = SupabaseService.shared.auth.currentUser?.id else { return }

        guard let encryptionKey = loadOrCreateEncryptionKey() else {
            print("[CredentialSync][SECURITY] Failed to load encryption key. Skipping cloud download.")
            return
        }

        do {
            let credentials: [CredentialResponse] = try await supabase
                .from("credentials")
                .select()
                .eq("user_id", value: userId.uuidString)
                .execute()
                .value
            
            for cred in credentials {
                guard let keychainTarget = Self.syncTargets.first(where: {
                    $0.service == cred.service_name && $0.type == cred.credential_type
                }) else {
                    continue
                }

                guard CredentialSyncCrypto.isSecureEnvelope(cred.encrypted_value) else {
                    print("[CredentialSync][SECURITY] Refused plaintext cloud payload for \(cred.service_name) \(cred.credential_type).")
                    continue
                }

                guard let decryptedValue = CredentialSyncCrypto.decrypt(cred.encrypted_value, using: encryptionKey) else {
                    print("[CredentialSync][SECURITY] Failed to decrypt cloud payload for \(cred.service_name) \(cred.credential_type).")
                    continue
                }

                KeychainHelper.set(decryptedValue, forKey: keychainTarget.keychainKey)
            }
            
            print("[CredentialSync] Pulled \(credentials.count) credentials from cloud.")
        } catch {
            print("[CredentialSync] Failed to pull credentials: \(error.localizedDescription)")
        }
    }

    private func loadOrCreateEncryptionKey() -> SymmetricKey? {
        if let existing = readEncryptionKeyData() {
            return SymmetricKey(data: existing)
        }

        let createdKey = SymmetricKey(size: .bits256)
        let keyData = createdKey.withUnsafeBytes { Data($0) }

        guard storeEncryptionKeyData(keyData) else {
            return nil
        }

        return createdKey
    }

    private func readEncryptionKeyData() -> Data? {
        let syncedQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: Self.encryptionKeyAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecAttrSynchronizable as String: kCFBooleanTrue as Any
        ]

        var syncedResult: AnyObject?
        let syncedStatus = SecItemCopyMatching(syncedQuery as CFDictionary, &syncedResult)
        if syncedStatus == errSecSuccess, let data = syncedResult as? Data {
            return data
        }

        let localQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: Self.encryptionKeyAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var localResult: AnyObject?
        let localStatus = SecItemCopyMatching(localQuery as CFDictionary, &localResult)
        guard localStatus == errSecSuccess, let data = localResult as? Data else {
            return nil
        }

        return data
    }

    private func storeEncryptionKeyData(_ keyData: Data) -> Bool {
        if upsertEncryptionKeyData(keyData, synchronizable: true) {
            return true
        }

        return upsertEncryptionKeyData(keyData, synchronizable: false)
    }

    private func upsertEncryptionKeyData(_ keyData: Data, synchronizable: Bool) -> Bool {
        let accessibility: CFString = synchronizable
            ? kSecAttrAccessibleAfterFirstUnlock
            : kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        var addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: Self.encryptionKeyAccount,
            kSecValueData as String: keyData,
            kSecAttrAccessible as String: accessibility
        ]

        if synchronizable {
            addQuery[kSecAttrSynchronizable as String] = kCFBooleanTrue as Any
        }

        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        if addStatus == errSecSuccess {
            return true
        }

        guard addStatus == errSecDuplicateItem else {
            return false
        }

        var updateQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: Self.encryptionKeyAccount
        ]

        if synchronizable {
            updateQuery[kSecAttrSynchronizable as String] = kCFBooleanTrue as Any
        }

        let attributes: [String: Any] = [
            kSecValueData as String: keyData
        ]

        let updateStatus = SecItemUpdate(updateQuery as CFDictionary, attributes as CFDictionary)
        return updateStatus == errSecSuccess
    }
}

struct CredentialResponse: Codable {
    let service_name: String
    let credential_type: String
    let encrypted_value: String
}
