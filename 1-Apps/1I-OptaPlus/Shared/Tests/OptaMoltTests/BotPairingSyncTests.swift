//
//  BotPairingSyncTests.swift
//  OptaMoltTests
//

import XCTest
@testable import OptaMolt

final class BotPairingSyncTests: XCTestCase {

    // MARK: - Conflict Resolution

    func testResolveConflictMostRecentWins() {
        let older = Date(timeIntervalSinceReferenceDate: 1000)
        let newer = Date(timeIntervalSinceReferenceDate: 2000)

        let local = PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "local-tok", deviceId: "d1", createdAt: older)
        let remote = PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "remote-tok", deviceId: "d2", createdAt: newer)

        let winner = BotPairingSyncService.resolveConflict(local: local, remote: remote)
        XCTAssertEqual(winner.token, "remote-tok", "Remote token with later createdAt should win")
    }

    func testResolveConflictLocalWinsWhenNewer() {
        let older = Date(timeIntervalSinceReferenceDate: 1000)
        let newer = Date(timeIntervalSinceReferenceDate: 2000)

        let local = PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "local-tok", deviceId: "d1", createdAt: newer)
        let remote = PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "remote-tok", deviceId: "d2", createdAt: older)

        let winner = BotPairingSyncService.resolveConflict(local: local, remote: remote)
        XCTAssertEqual(winner.token, "local-tok", "Local token with later createdAt should win")
    }

    func testResolveConflictEqualDatesKeepsLocal() {
        let date = Date(timeIntervalSinceReferenceDate: 1000)

        let local = PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "local-tok", deviceId: "d1", createdAt: date)
        let remote = PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "remote-tok", deviceId: "d2", createdAt: date)

        let winner = BotPairingSyncService.resolveConflict(local: local, remote: remote)
        XCTAssertEqual(winner.token, "local-tok", "Equal createdAt should keep local (tie-break)")
    }

    // MARK: - Merge

    func testMergeDisjointSets() {
        let local = [
            PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "t1", deviceId: "d1"),
            PairingToken(botId: "b2", gatewayFingerprint: "gw1", token: "t2", deviceId: "d1"),
        ]
        let remote = [
            PairingToken(botId: "b3", gatewayFingerprint: "gw2", token: "t3", deviceId: "d2"),
        ]
        let merged = BotPairingSyncService.mergeTokens(local: local, remote: remote)
        XCTAssertEqual(merged.count, 3, "Disjoint sets should produce union")
    }

    func testMergeWithConflictResolution() {
        let older = Date(timeIntervalSinceReferenceDate: 1000)
        let newer = Date(timeIntervalSinceReferenceDate: 2000)

        let local = [PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "old-token", deviceId: "d1", createdAt: older)]
        let remote = [PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "new-token", deviceId: "d2", createdAt: newer)]

        let merged = BotPairingSyncService.mergeTokens(local: local, remote: remote)
        XCTAssertEqual(merged.count, 1, "Same keychainKey should merge to one entry")
        XCTAssertEqual(merged.first?.token, "new-token", "Newer token should survive merge")
    }

    func testMergeEmptyLocal() {
        let remote = [
            PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "t1", deviceId: "d1"),
        ]
        let merged = BotPairingSyncService.mergeTokens(local: [], remote: remote)
        XCTAssertEqual(merged.count, 1, "Empty local should adopt all remote tokens")
    }

    func testMergeEmptyRemote() {
        let local = [
            PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "t1", deviceId: "d1"),
        ]
        let merged = BotPairingSyncService.mergeTokens(local: local, remote: [])
        XCTAssertEqual(merged.count, 1, "Empty remote should keep all local tokens")
    }

    func testMergeBothEmpty() {
        let merged = BotPairingSyncService.mergeTokens(local: [], remote: [])
        XCTAssertTrue(merged.isEmpty, "Both empty should produce empty result")
    }

    // MARK: - Skeleton Endpoints

    func testDownloadTokensReturnsEmpty() async throws {
        let tokens = try await BotPairingSyncService.downloadTokens(supabaseURL: "https://example.supabase.co", accessToken: "test")
        XCTAssertTrue(tokens.isEmpty, "Skeleton download should return empty array")
    }

    func testUploadTokensDoesNotThrow() async throws {
        let tokens = [PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "t1", deviceId: "d1")]
        try await BotPairingSyncService.uploadTokens(tokens, supabaseURL: "https://example.supabase.co", accessToken: "test")
        // No assertion needed — just verify it doesn't throw
    }
}
