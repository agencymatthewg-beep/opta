//
//  ConnectionStateTests.swift
//  ClawdbotKit
//
//  Tests for ConnectionStateMachine and ReconnectionConfig.
//

import XCTest
@testable import ClawdbotKit

final class ConnectionStateTests: XCTestCase {

    // MARK: - State Machine Tests

    func testInitialState() {
        let machine = ConnectionStateMachine()
        XCTAssertEqual(machine.state, .disconnected)
        XCTAssertEqual(machine.reconnectAttempts, 0)
    }

    func testConnectTransition() {
        var machine = ConnectionStateMachine()
        let newState = machine.process(.connect)

        XCTAssertEqual(newState, .connecting)
        XCTAssertEqual(machine.state, .connecting)
    }

    func testConnectionSucceeded() {
        var machine = ConnectionStateMachine()
        machine.process(.connect)
        let newState = machine.process(.connectionSucceeded)

        XCTAssertEqual(newState, .connected)
        XCTAssertEqual(machine.state, .connected)
    }

    func testConnectionFailed() {
        var machine = ConnectionStateMachine()
        machine.process(.connect)
        let error = ClawdbotWebSocketError.cancelled
        let newState = machine.process(.connectionFailed(error))

        XCTAssertEqual(newState, .disconnected)
        XCTAssertEqual(machine.state, .disconnected)
    }

    func testConnectionLostTriggersReconnect() {
        var machine = ConnectionStateMachine()
        machine.process(.connect)
        machine.process(.connectionSucceeded)

        let error = ClawdbotWebSocketError.cancelled
        let newState = machine.process(.connectionLost(error))

        XCTAssertEqual(newState, .reconnecting)
        XCTAssertEqual(machine.state, .reconnecting)
    }

    func testReconnectAttemptIncrementsCounter() {
        var machine = ConnectionStateMachine()
        machine.process(.connect)
        machine.process(.connectionSucceeded)
        machine.process(.connectionLost(ClawdbotWebSocketError.cancelled))

        XCTAssertEqual(machine.reconnectAttempts, 0)

        machine.process(.reconnectAttempt)
        XCTAssertEqual(machine.reconnectAttempts, 1)

        machine.process(.reconnectAttempt)
        XCTAssertEqual(machine.reconnectAttempts, 2)
    }

    func testReconnectSucceededResetsCounter() {
        var machine = ConnectionStateMachine()
        machine.process(.connect)
        machine.process(.connectionSucceeded)
        machine.process(.connectionLost(ClawdbotWebSocketError.cancelled))
        machine.process(.reconnectAttempt)
        machine.process(.reconnectAttempt)

        XCTAssertEqual(machine.reconnectAttempts, 2)

        machine.process(.reconnectSucceeded)
        XCTAssertEqual(machine.reconnectAttempts, 0)
        XCTAssertEqual(machine.state, .connected)
    }

    func testMaxRetriesReached() {
        var machine = ConnectionStateMachine(maxReconnectAttempts: 3)
        machine.process(.connect)
        machine.process(.connectionSucceeded)
        machine.process(.connectionLost(ClawdbotWebSocketError.cancelled))

        // Simulate 3 failed attempts
        for _ in 0..<3 {
            machine.process(.reconnectAttempt)
            machine.process(.reconnectFailed)
        }

        // Should be disconnected after max retries
        XCTAssertEqual(machine.state, .disconnected)
    }

    func testInvalidTransitionReturnsNil() {
        var machine = ConnectionStateMachine()
        // Can't go from disconnected to reconnecting directly
        let result = machine.process(.reconnectAttempt)
        XCTAssertNil(result)
    }

    func testCanSendOnlyWhenConnected() {
        XCTAssertFalse(ConnectionState.disconnected.canSend)
        XCTAssertFalse(ConnectionState.connecting.canSend)
        XCTAssertTrue(ConnectionState.connected.canSend)
        XCTAssertFalse(ConnectionState.reconnecting.canSend)
    }

    // MARK: - Reconnection Config Tests

    func testExponentialBackoff() {
        let config = ReconnectionConfig(baseDelay: 1.0, maxDelay: 30.0, jitterFactor: 0)

        // Without jitter, delays should be exactly: 1, 2, 4, 8, 16, 30 (capped)
        XCTAssertEqual(config.delay(forAttempt: 0), 1.0)
        XCTAssertEqual(config.delay(forAttempt: 1), 2.0)
        XCTAssertEqual(config.delay(forAttempt: 2), 4.0)
        XCTAssertEqual(config.delay(forAttempt: 3), 8.0)
        XCTAssertEqual(config.delay(forAttempt: 4), 16.0)
        XCTAssertEqual(config.delay(forAttempt: 5), 30.0)  // Capped
        XCTAssertEqual(config.delay(forAttempt: 10), 30.0) // Still capped
    }

    func testJitterAddsVariation() {
        let config = ReconnectionConfig(baseDelay: 10.0, maxDelay: 100.0, jitterFactor: 0.5)

        // With 50% jitter on a 10s base delay, result should be between 5 and 15
        for _ in 0..<10 {
            let delay = config.delay(forAttempt: 0)
            XCTAssertGreaterThanOrEqual(delay, 5.0)
            XCTAssertLessThanOrEqual(delay, 15.0)
        }
    }

    func testDefaultConfig() {
        let config = ReconnectionConfig.default

        XCTAssertEqual(config.baseDelay, 1.0)
        XCTAssertEqual(config.maxDelay, 30.0)
        XCTAssertEqual(config.maxAttempts, 5)
        XCTAssertEqual(config.heartbeatInterval, 30.0)
    }

    func testAggressiveConfig() {
        let config = ReconnectionConfig.aggressive

        XCTAssertEqual(config.baseDelay, 0.5)
        XCTAssertEqual(config.maxDelay, 10.0)
        XCTAssertEqual(config.maxAttempts, 10)
        XCTAssertEqual(config.heartbeatInterval, 15.0)
    }
}
