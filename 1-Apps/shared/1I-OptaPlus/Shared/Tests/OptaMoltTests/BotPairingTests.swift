//
//  BotPairingTests.swift
//  OptaMoltTests
//

import XCTest
@testable import OptaMolt

final class BotPairingTests: XCTestCase {

    // MARK: - BotNode

    func testBotNodeId() {
        let node = BotNode(botId: "jarvis", gatewayFingerprint: "gw1", name: "Jarvis", emoji: "\u{1F916}")
        XCTAssertEqual(node.id, "gw1:jarvis")
    }

    func testBotNodeCodable() throws {
        let node = BotNode(botId: "jarvis", gatewayFingerprint: "gw1", name: "Jarvis", emoji: "\u{1F916}")
        let data = try JSONEncoder().encode(node)
        let decoded = try JSONDecoder().decode(BotNode.self, from: data)
        XCTAssertEqual(decoded.id, node.id)
        XCTAssertEqual(decoded.emoji, "\u{1F916}")
    }

    func testBotNodeDefaultState() {
        let node = BotNode(botId: "b1", gatewayFingerprint: "gw1", name: "Bot", emoji: "\u{1F916}")
        XCTAssertEqual(node.state, .discovered)
    }

    // MARK: - PairingToken

    func testPairingTokenKeyFormat() {
        let token = PairingToken(botId: "jarvis", gatewayFingerprint: "gw1", token: "abc123", deviceId: "dev1")
        XCTAssertEqual(token.keychainKey, "pairing.gw1.jarvis")
    }

    func testPairingTokenCodable() throws {
        let token = PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "tok", deviceId: "dev")
        let data = try JSONEncoder().encode(token)
        let decoded = try JSONDecoder().decode(PairingToken.self, from: data)
        XCTAssertEqual(decoded.token, "tok")
    }

    // MARK: - DeviceIdentity

    func testDeviceIdentityGeneration() {
        let id1 = DeviceIdentity.current
        let id2 = DeviceIdentity.current
        XCTAssertEqual(id1.deviceId, id2.deviceId, "Should return same ID across calls")
        XCTAssertFalse(id1.deviceName.isEmpty)
    }

    // MARK: - BotConnectionState transitions

    func testValidStateTransitions() {
        XCTAssertTrue(BotConnectionState.discovered.canTransitionTo(.pairing))
        XCTAssertTrue(BotConnectionState.paired.canTransitionTo(.connecting))
        XCTAssertTrue(BotConnectionState.connected.canTransitionTo(.disconnected))
        XCTAssertTrue(BotConnectionState.disconnected.canTransitionTo(.connecting))
    }

    func testInvalidStateTransitions() {
        XCTAssertFalse(BotConnectionState.discovered.canTransitionTo(.connected))
        XCTAssertFalse(BotConnectionState.paired.canTransitionTo(.discovered))
        XCTAssertFalse(BotConnectionState.connecting.canTransitionTo(.pairing))
    }
}
