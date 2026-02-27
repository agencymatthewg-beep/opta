//
//  BotConfigSecurityTests.swift
//  OptaMoltTests
//

import XCTest
@testable import OptaMolt

final class BotConfigSecurityTests: XCTestCase {

    func testUserDefaultsPersistedCopyClearsToken() {
        let bot = BotConfig(
            id: "bot-1",
            name: "Secure Bot",
            host: "10.0.0.1",
            port: 8080,
            token: "super-secret-token",
            emoji: "🤖",
            sessionKey: "main",
            remoteURL: "wss://bot.example.com",
            connectionMode: .remote
        )

        let persisted = bot.userDefaultsPersistedCopy

        XCTAssertEqual(persisted.token, "")
        XCTAssertEqual(persisted.id, bot.id)
        XCTAssertEqual(persisted.name, bot.name)
        XCTAssertEqual(persisted.host, bot.host)
        XCTAssertEqual(persisted.port, bot.port)
        XCTAssertEqual(persisted.remoteURL, bot.remoteURL)
        XCTAssertEqual(persisted.connectionMode, bot.connectionMode)
    }

    func testApplyingRuntimeTokenRestoresToken() {
        let bot = BotConfig(
            id: "bot-2",
            name: "Runtime Bot",
            host: "127.0.0.1",
            port: 3000,
            token: "",
            emoji: "🟢",
            sessionKey: "main",
            remoteURL: "wss://runtime.example.com",
            connectionMode: .auto
        )

        let hydrated = bot.applyingRuntimeToken("restored-token")

        XCTAssertEqual(hydrated.token, "restored-token")
        XCTAssertEqual(hydrated.id, bot.id)
        XCTAssertEqual(hydrated.name, bot.name)
        XCTAssertEqual(hydrated.host, bot.host)
        XCTAssertEqual(hydrated.port, bot.port)
        XCTAssertEqual(hydrated.remoteURL, bot.remoteURL)
        XCTAssertEqual(hydrated.connectionMode, bot.connectionMode)
    }
}
