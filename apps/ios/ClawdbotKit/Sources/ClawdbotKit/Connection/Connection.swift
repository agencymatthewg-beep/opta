//
//  Connection.swift
//  ClawdbotKit
//
//  Connection module for Clawdbot native apps.
//
//  This module contains WebSocket connection infrastructure:
//  - ClawdbotWebSocket: Core WebSocket client (URLSessionWebSocketTask)
//  - ClawdbotMessage: Message types (text/data)
//  - ClawdbotWebSocketError: Connection errors
//
//  State machine and reconnection: ConnectionManager (Plan 02-02)
//  Network reachability: NetworkMonitor (Plan 02-03)
//

import Foundation

/// Connection infrastructure namespace for Clawdbot apps
public enum ClawdbotConnection {
    /// Module version
    public static let version = "0.2.0"

    /// Connection states for state machine (implemented in Plan 02-02)
    public enum State: String, Sendable {
        case disconnected
        case connecting
        case connected
        case reconnecting
    }
}
