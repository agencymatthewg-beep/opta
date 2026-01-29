//
//  ConnectionState.swift
//  ClawdbotKit
//
//  Connection state machine for Clawdbot WebSocket connections.
//  Defines states, events, and valid transitions.
//

import Foundation

// MARK: - Connection State

/// Possible connection states
public enum ConnectionState: String, Sendable, Equatable {
    case disconnected
    case connecting
    case connected
    case reconnecting

    /// Human-readable description
    public var description: String {
        switch self {
        case .disconnected: return "Disconnected"
        case .connecting: return "Connecting..."
        case .connected: return "Connected"
        case .reconnecting: return "Reconnecting..."
        }
    }

    /// Whether messages can be sent in this state
    public var canSend: Bool {
        self == .connected
    }
}

// MARK: - Connection Events

/// Events that trigger state transitions
public enum ConnectionEvent: Sendable {
    case connect
    case connectionSucceeded
    case connectionFailed(Error)
    case disconnect
    case connectionLost(Error)
    case reconnectAttempt
    case reconnectSucceeded
    case reconnectFailed
    case maxRetriesReached
}

// MARK: - State Machine

/// State machine that validates transitions
public struct ConnectionStateMachine: Sendable {
    public private(set) var state: ConnectionState
    public private(set) var reconnectAttempts: Int = 0

    public let maxReconnectAttempts: Int

    public init(maxReconnectAttempts: Int = 5) {
        self.state = .disconnected
        self.maxReconnectAttempts = maxReconnectAttempts
    }

    /// Process an event and return the new state (or nil if invalid transition)
    @discardableResult
    public mutating func process(_ event: ConnectionEvent) -> ConnectionState? {
        switch (state, event) {
        // From disconnected
        case (.disconnected, .connect):
            state = .connecting
            reconnectAttempts = 0
            return state

        // From connecting
        case (.connecting, .connectionSucceeded):
            state = .connected
            reconnectAttempts = 0
            return state

        case (.connecting, .connectionFailed):
            state = .disconnected
            return state

        case (.connecting, .disconnect):
            state = .disconnected
            return state

        // From connected
        case (.connected, .disconnect):
            state = .disconnected
            return state

        case (.connected, .connectionLost):
            state = .reconnecting
            return state

        // From reconnecting
        case (.reconnecting, .reconnectAttempt):
            reconnectAttempts += 1
            return state  // Stay in reconnecting

        case (.reconnecting, .reconnectSucceeded):
            state = .connected
            reconnectAttempts = 0
            return state

        case (.reconnecting, .reconnectFailed):
            if reconnectAttempts >= maxReconnectAttempts {
                state = .disconnected
            }
            return state

        case (.reconnecting, .maxRetriesReached):
            state = .disconnected
            return state

        case (.reconnecting, .disconnect):
            state = .disconnected
            return state

        // Invalid transitions
        default:
            return nil
        }
    }
}

// MARK: - Reconnection Configuration

/// Configuration for reconnection behavior
public struct ReconnectionConfig: Sendable {
    /// Base delay between reconnection attempts (seconds)
    public let baseDelay: TimeInterval

    /// Maximum delay cap (seconds)
    public let maxDelay: TimeInterval

    /// Maximum number of reconnection attempts
    public let maxAttempts: Int

    /// Jitter factor (0-1) for randomizing delays
    public let jitterFactor: Double

    /// Heartbeat/ping interval (seconds)
    public let heartbeatInterval: TimeInterval

    /// Default configuration
    public static let `default` = ReconnectionConfig(
        baseDelay: 1.0,
        maxDelay: 30.0,
        maxAttempts: 5,
        jitterFactor: 0.2,
        heartbeatInterval: 30.0
    )

    /// Aggressive configuration for important connections
    public static let aggressive = ReconnectionConfig(
        baseDelay: 0.5,
        maxDelay: 10.0,
        maxAttempts: 10,
        jitterFactor: 0.1,
        heartbeatInterval: 15.0
    )

    public init(
        baseDelay: TimeInterval = 1.0,
        maxDelay: TimeInterval = 30.0,
        maxAttempts: Int = 5,
        jitterFactor: Double = 0.2,
        heartbeatInterval: TimeInterval = 30.0
    ) {
        self.baseDelay = baseDelay
        self.maxDelay = maxDelay
        self.maxAttempts = maxAttempts
        self.jitterFactor = min(max(jitterFactor, 0), 1)
        self.heartbeatInterval = heartbeatInterval
    }

    /// Calculate delay for attempt n using exponential backoff with jitter
    public func delay(forAttempt attempt: Int) -> TimeInterval {
        // Exponential backoff: base * 2^attempt
        let exponentialDelay = baseDelay * pow(2.0, Double(attempt))
        let cappedDelay = min(exponentialDelay, maxDelay)

        // Add jitter
        let jitterRange = cappedDelay * jitterFactor
        let jitter = Double.random(in: -jitterRange...jitterRange)

        return max(0, cappedDelay + jitter)
    }
}
