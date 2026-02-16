//
//  OptaAccountService.swift
//  OptaPlus
//
//  Unified authentication and credential sync service for the Opta Ecosystem.
//  Connects to https://lm.optamize.biz and Supabase.
//

import Foundation

@MainActor
public final class OptaAccountService: ObservableObject {
    public static let shared = OptaAccountService()

    private let baseURL = URL(string: "https://lm.optamize.biz")! // Known-valid static URL
    private static let jwtKeychainKey = "opta.account.jwt"

    @Published public var currentUser: UserProfile?
    @Published public var isAuthenticated: Bool = false

    private init() {
        migrateJWTFromUserDefaultsIfNeeded()
        loadSession()
    }

    public struct UserProfile: Codable {
        public let id: String
        public let email: String
        public var optaLifeEnabled: Bool
    }

    public func login(token: String) async throws {
        SecureStorage.shared.save(key: Self.jwtKeychainKey, value: token)
        isAuthenticated = true
    }

    public func logout() {
        SecureStorage.shared.delete(key: Self.jwtKeychainKey)
        currentUser = nil
        isAuthenticated = false
    }

    private func loadSession() {
        if SecureStorage.shared.load(key: Self.jwtKeychainKey) != nil {
            isAuthenticated = true
        }
    }

    /// One-time migration: move JWT from UserDefaults to Keychain if present.
    private func migrateJWTFromUserDefaultsIfNeeded() {
        let legacyKey = "opta.account.jwt"
        if let legacyToken = UserDefaults.standard.string(forKey: legacyKey) {
            SecureStorage.shared.save(key: Self.jwtKeychainKey, value: legacyToken)
            UserDefaults.standard.removeObject(forKey: legacyKey)
            NSLog("[OptaAccountService] Migrated JWT from UserDefaults to Keychain")
        }
    }
}
