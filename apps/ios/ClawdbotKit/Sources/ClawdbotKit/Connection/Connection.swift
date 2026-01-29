//
//  Connection.swift
//  ClawdbotKit
//
//  Connection module for Clawdbot native apps.
//
//  Future Purpose:
//  This module will contain WebSocket connection infrastructure:
//  - WebSocket client (URLSessionWebSocketTask or Starscream)
//  - Connection state machine (connecting, connected, disconnected, reconnecting)
//  - Automatic reconnection with exponential backoff
//  - Tailscale network detection and handling
//  - Network reachability monitoring
//  - Connection health and ping/pong handling
//
//  This will be implemented in Phase 2 (Connection Layer).
//
//  Created by Matthew Byrden
//

import Foundation

/// Connection infrastructure namespace for Clawdbot apps
public enum ClawdbotConnection {
    /// Module status - will be populated in Phase 2
    public static let status = "placeholder"

    /// Possible connection states (preview)
    public enum State: String {
        case disconnected
        case connecting
        case connected
        case reconnecting
    }
}
