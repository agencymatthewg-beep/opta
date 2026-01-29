//
//  Protocol.swift
//  ClawdbotKit
//
//  Message protocol module for Clawdbot native apps.
//
//  Future Purpose:
//  This module will contain the Clawdbot message protocol:
//  - Message type definitions (Codable structs)
//  - Protocol encoder/decoder with streaming support
//  - Message queue and delivery confirmation
//  - Typing indicators and thinking state signals
//  - Rich content types (tables, graphs, GenUI components)
//  - Message threading and conversation management
//
//  This will reuse the existing Clawdbot JSON message format
//  from the Telegram channel implementation (Phase 3).
//
//  Created by Matthew Byrden
//

import Foundation

/// Message protocol namespace for Clawdbot apps
public enum ClawdbotProtocol {
    /// Module status - will be populated in Phase 3
    public static let status = "placeholder"

    /// Protocol version (tracks message format changes)
    public static let version = "0.0.0"

    /// Message direction (preview)
    public enum Direction: String, Codable {
        case incoming
        case outgoing
    }
}
