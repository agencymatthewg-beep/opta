//
//  WebSocketMessage.swift
//  ClawdbotKit
//
//  WebSocket message types for Clawdbot communication.
//

import Foundation

/// Represents a WebSocket message (text or binary)
public enum ClawdbotMessage: Sendable {
    case text(String)
    case data(Data)

    /// Convert to URLSessionWebSocketTask.Message
    var urlSessionMessage: URLSessionWebSocketTask.Message {
        switch self {
        case .text(let string):
            return .string(string)
        case .data(let data):
            return .data(data)
        }
    }

    /// Create from URLSessionWebSocketTask.Message
    init(from message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let string):
            self = .text(string)
        case .data(let data):
            self = .data(data)
        @unknown default:
            self = .data(Data())
        }
    }
}

/// WebSocket-specific errors
public enum ClawdbotWebSocketError: Error, Sendable {
    case notConnected
    case invalidURL
    case connectionFailed(Error)
    case sendFailed(Error)
    case receiveFailed(Error)
    case cancelled
}
