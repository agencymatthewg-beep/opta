//
//  WebSocketClientTests.swift
//  ClawdbotKit
//
//  Tests for ClawdbotWebSocket client.
//

import XCTest
@testable import ClawdbotKit

final class WebSocketClientTests: XCTestCase {

    func testMessageConversion() {
        // Test text message conversion
        let textMessage = ClawdbotMessage.text("Hello")
        let urlMessage = textMessage.urlSessionMessage

        if case .string(let str) = urlMessage {
            XCTAssertEqual(str, "Hello")
        } else {
            XCTFail("Expected string message")
        }

        // Test data message conversion
        let data = "Binary".data(using: .utf8)!
        let dataMessage = ClawdbotMessage.data(data)
        let urlDataMessage = dataMessage.urlSessionMessage

        if case .data(let d) = urlDataMessage {
            XCTAssertEqual(d, data)
        } else {
            XCTFail("Expected data message")
        }
    }

    func testInvalidURLThrows() async {
        let client = ClawdbotWebSocket()
        let invalidURL = URL(string: "http://example.com")!

        do {
            try await client.connect(to: invalidURL)
            XCTFail("Should have thrown for http:// URL")
        } catch ClawdbotWebSocketError.invalidURL {
            // Expected
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testSendWithoutConnectionThrows() async {
        let client = ClawdbotWebSocket()

        do {
            try await client.send(text: "Test")
            XCTFail("Should have thrown for disconnected send")
        } catch ClawdbotWebSocketError.notConnected {
            // Expected
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testPingWithoutConnectionThrows() async {
        let client = ClawdbotWebSocket()

        do {
            try await client.ping()
            XCTFail("Should have thrown for disconnected ping")
        } catch ClawdbotWebSocketError.notConnected {
            // Expected
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
}
