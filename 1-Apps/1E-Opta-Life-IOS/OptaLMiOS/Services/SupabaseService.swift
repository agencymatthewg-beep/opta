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
    
    // MARK: - Configuration
    
    private let supabaseURL = URL(string: "https://cytjsmezydytbmjrolyz.supabase.co")!
    private let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dGpzbWV6eWR5dGJtanJvbHl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5OTcyNDUsImV4cCI6MjA4NjU3MzI0NX0.DuYyYixsjdl9R5Uq4hIL4TQMGvCCssw_1wNo-J7De6Q"
    
    // MARK: - Client
    
    public let client: SupabaseClient
    
    private init() {
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
}
