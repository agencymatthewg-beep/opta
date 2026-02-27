//
//  BotPairingStoreTests.swift
//  OptaMoltTests
//

import XCTest
@testable import OptaMolt

final class BotPairingStoreTests: XCTestCase {

    var store: BotPairingStore!

    override func setUp() {
        store = BotPairingStore()
        store.removeAll()
    }

    override func tearDown() {
        store.removeAll()
    }

    func testSaveAndLoadToken() {
        let token = PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "abc", deviceId: "dev1")
        store.saveToken(token)
        let loaded = store.loadToken(botId: "b1", gatewayFingerprint: "gw1")
        XCTAssertEqual(loaded?.token, "abc")
    }

    func testDeleteToken() {
        let token = PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "abc", deviceId: "dev1")
        store.saveToken(token)
        store.deleteToken(botId: "b1", gatewayFingerprint: "gw1")
        XCTAssertNil(store.loadToken(botId: "b1", gatewayFingerprint: "gw1"))
    }

    func testLoadAllTokens() {
        store.saveToken(PairingToken(botId: "b1", gatewayFingerprint: "gw1", token: "t1", deviceId: "d"))
        store.saveToken(PairingToken(botId: "b2", gatewayFingerprint: "gw1", token: "t2", deviceId: "d"))
        let all = store.allTokens()
        XCTAssertEqual(all.count, 2)
    }

    func testSaveAndLoadBotNodes() {
        var node = BotNode(botId: "b1", gatewayFingerprint: "gw1", name: "Jarvis", emoji: "🤖")
        node.state = .paired
        store.saveBotNode(node)
        let loaded = store.loadBotNodes()
        XCTAssertEqual(loaded.first?.name, "Jarvis")
        XCTAssertEqual(loaded.first?.state, .paired)
    }

    func testRemoveBotNode() {
        let node = BotNode(botId: "b1", gatewayFingerprint: "gw1", name: "Jarvis", emoji: "🤖")
        store.saveBotNode(node)
        store.removeBotNode(id: "gw1:b1")
        XCTAssertTrue(store.loadBotNodes().isEmpty)
    }
}
