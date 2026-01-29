//
//  Chat.swift
//  ClawdbotKit
//
//  Chat UI module for Clawdbot native apps.
//
//  This module contains chat interface components:
//  - ChatViewModel.swift: Observable view model wrapping ProtocolHandler
//  - MessageBubble.swift: Chat bubble view for individual messages
//  - ChatInputBar.swift: Input bar with send button
//  - MessageStore.swift: Actor for message persistence
//

import Foundation

/// Chat UI namespace for Clawdbot apps
public enum ClawdbotChat {
    /// Module version (tracks UI component changes)
    public static let version = "1.1.0"

    /// Module status
    public static let status = "implemented"
}

// MARK: - Re-exports for Convenience

// Public types exported from this module:
// - ChatViewModel: Observable view model with persistence via MessageStore
// - MessageBubble: Chat bubble view for individual messages
// - ChatInputBar: Input bar with send button
// - MessageStore: Actor for thread-safe message persistence
//
// All types are already public and exported from their respective files.
// This file serves as the module entry point and provides the ClawdbotChat namespace.
