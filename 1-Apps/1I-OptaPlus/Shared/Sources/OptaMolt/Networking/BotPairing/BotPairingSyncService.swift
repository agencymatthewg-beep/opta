//
//  BotPairingSyncService.swift
//  OptaMolt
//
//  Merge logic for syncing PairingTokens between local Keychain and Supabase.
//  Conflict resolution: most-recent createdAt wins.
//  Actual Supabase REST calls deferred to sync sprint.
//

import Foundation
import os.log

public final class BotPairingSyncService {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "PairingSync")

    /// Resolve conflict between local and remote tokens — most recent wins.
    public static func resolveConflict(local: PairingToken, remote: PairingToken) -> PairingToken {
        remote.createdAt > local.createdAt ? remote : local
    }

    /// Merge local and remote token lists.
    /// Tokens are keyed by keychainKey (gatewayFingerprint + botId).
    /// Conflicts resolved by most recent createdAt.
    public static func mergeTokens(local: [PairingToken], remote: [PairingToken]) -> [PairingToken] {
        var result: [String: PairingToken] = [:]
        for token in local {
            result[token.keychainKey] = token
        }
        for token in remote {
            if let existing = result[token.keychainKey] {
                result[token.keychainKey] = resolveConflict(local: existing, remote: token)
            } else {
                result[token.keychainKey] = token
            }
        }
        return Array(result.values)
    }

    /// Upload local tokens to Supabase (skeleton — actual REST calls deferred).
    public static func uploadTokens(_ tokens: [PairingToken], supabaseURL: String, accessToken: String) async throws {
        logger.info("Would upload \(tokens.count) tokens to Supabase")
    }

    /// Download tokens from Supabase (skeleton — actual REST calls deferred).
    public static func downloadTokens(supabaseURL: String, accessToken: String) async throws -> [PairingToken] {
        logger.info("Would download tokens from Supabase")
        return []
    }
}
