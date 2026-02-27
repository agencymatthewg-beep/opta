//
//  SupabaseService.swift
//  OptaLMiOS
//
//  Central service for Supabase SDK integration.
//  Provides access to Auth, Database, and Storage.
//

import Foundation
import Supabase

@MainActor
class SupabaseService: ObservableObject {
    static let shared = SupabaseService()
    
    // MARK: - Client
    
    public let client: SupabaseClient
    
    private init() {
        let supabaseURLString = Self.requiredConfigValue(forKey: "SUPABASE_URL")
        guard let supabaseURL = URL(string: supabaseURLString) else {
            fatalError(
                "Invalid Supabase configuration: SUPABASE_URL must be a valid URL. " +
                "Set SUPABASE_URL in Info.plist via xcconfig."
            )
        }
        let supabaseAnonKey = Self.requiredConfigValue(forKey: "SUPABASE_ANON_KEY")

        self.client = SupabaseClient(
            supabaseURL: supabaseURL,
            supabaseKey: supabaseAnonKey
        )
    }
    
    // MARK: - Helpers
    
    var auth: AuthClient { client.auth }
    var storage: SupabaseStorageClient { client.storage }
    
    /// Access a database table
    func from(_ table: String) -> PostgrestQueryBuilder {
        client.from(table)
    }

    private static func requiredConfigValue(forKey key: String) -> String {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: key) as? String else {
            fatalError(
                "Missing Supabase configuration: \(key) not found in Info.plist. " +
                "Define \(key) in xcconfig and map it in Info.plist."
            )
        }

        let value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, !value.contains("$(") else {
            fatalError(
                "Invalid Supabase configuration: \(key) is empty or unresolved. " +
                "Set \(key) in xcconfig."
            )
        }

        return value
    }
}
