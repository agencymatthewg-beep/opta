//
//  OptaCredentialService.swift
//  OptaLMiOS
//
//  Handles the migration and synchronization of third-party credentials
//  (Google, Todoist, etc.) to the unified Supabase vault.
//

import Foundation
import Supabase

@MainActor
class OptaCredentialService: ObservableObject {
    static let shared = OptaCredentialService()
    
    private let supabase = SupabaseService.shared.client
    
    private init() {}
    
    // MARK: - Migration logic
    
    /// Checks for local credentials and uploads them to Supabase if they don't exist there.
    func syncLocalCredentialsToCloud() async {
        guard SupabaseService.shared.auth.currentUser != nil else { return }
        
        // 1. Google Credentials
        if let googleToken = KeychainHelper.get("opta_google_token") {
            await uploadCredential(service: "google", type: "oauth_token", value: googleToken)
        }
        
        // 2. Todoist Credentials
        if let todoistToken = KeychainHelper.get("opta_todoist_token") {
            await uploadCredential(service: "todoist", type: "api_key", value: todoistToken)
        }
        
        // 3. OpenClaw Credentials
        if let gatewayURL = KeychainHelper.get("opta_gateway_url") {
            await uploadCredential(service: "openclaw", type: "gateway_url", value: gatewayURL)
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
    
    private func uploadCredential(service: String, type: String, value: String) async {
        guard let userId = SupabaseService.shared.auth.currentUser?.id else { return }
        
        let credentialData = CredentialUpsert(
            user_id: userId.uuidString,
            service_name: service,
            credential_type: type,
            encrypted_value: value,
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
        
        do {
            let credentials: [CredentialResponse] = try await supabase
                .from("credentials")
                .select()
                .eq("user_id", value: userId.uuidString)
                .execute()
                .value
            
            for cred in credentials {
                switch (cred.service_name, cred.credential_type) {
                case ("google", "oauth_token"):
                    KeychainHelper.set(cred.encrypted_value, forKey: "opta_google_token")
                case ("todoist", "api_key"):
                    KeychainHelper.set(cred.encrypted_value, forKey: "opta_todoist_token")
                case ("openclaw", "gateway_url"):
                    KeychainHelper.set(cred.encrypted_value, forKey: "opta_gateway_url")
                default:
                    break
                }
            }
            
            print("[CredentialSync] Pulled \(credentials.count) credentials from cloud.")
        } catch {
            print("[CredentialSync] Failed to pull credentials: \(error.localizedDescription)")
        }
    }
}

struct CredentialResponse: Codable {
    let service_name: String
    let credential_type: String
    let encrypted_value: String
}
