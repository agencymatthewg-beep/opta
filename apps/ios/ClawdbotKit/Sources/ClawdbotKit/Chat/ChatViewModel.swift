//
//  ChatViewModel.swift
//  ClawdbotKit
//
//  Observable view model wrapping ProtocolHandler for SwiftUI binding.
//  Follows "Observable View Model Wrapping Actor" pattern from 04-RESEARCH.md.
//

import Foundation
import Combine

/// Observable view model for chat interface
///
/// Wraps ProtocolHandler actor and exposes state for SwiftUI views.
/// All UI updates happen on MainActor via Combine's receive(on:).
@Observable
@MainActor
public final class ChatViewModel {

    // MARK: - Published State (read-only externally)

    /// All chat messages in conversation
    public private(set) var messages: [ChatMessage] = []

    /// Current connection state
    public private(set) var connectionState: ConnectionState = .disconnected

    /// Whether a send operation is in progress
    public private(set) var isLoading: Bool = false

    // MARK: - Private Properties

    private let protocolHandler: ProtocolHandler
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize with a ProtocolHandler
    /// - Parameter protocolHandler: The protocol handler for message operations
    public init(protocolHandler: ProtocolHandler) {
        self.protocolHandler = protocolHandler
        observeMessages()
    }

    // MARK: - Combine Observation

    /// Subscribe to incoming messages from ProtocolHandler
    private func observeMessages() {
        // Subscribe to incoming messages
        // CRITICAL: Use .receive(on: DispatchQueue.main) before sink for UI safety
        protocolHandler.incomingMessages
            .receive(on: DispatchQueue.main)
            .sink { [weak self] message in
                self?.handleIncomingMessage(message)
            }
            .store(in: &cancellables)

        // Subscribe to bot state updates (for future use)
        protocolHandler.botStateUpdates
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.handleBotStateUpdate(state)
            }
            .store(in: &cancellables)
    }

    /// Handle incoming message, preventing duplicates
    private func handleIncomingMessage(_ message: ChatMessage) {
        // Check for duplicate by MessageID
        if let existingIndex = messages.firstIndex(where: { $0.id == message.id }) {
            // Update existing message (e.g., status change from pending to delivered)
            messages[existingIndex] = message
        } else {
            // New message, append
            messages.append(message)
        }
    }

    /// Handle bot state update
    private func handleBotStateUpdate(_ state: BotStateUpdate) {
        // For future use - thinking indicators, typing status
        // Will be implemented in Phase 5 (Streaming & State)
    }

    // MARK: - Send Methods

    /// Send a text message
    /// - Parameter text: The message text to send
    ///
    /// Uses optimistic update pattern:
    /// 1. Create message with .pending status
    /// 2. Append to messages immediately (instant feedback)
    /// 3. Send via ProtocolHandler
    /// 4. Status updated when server confirms
    public func send(_ text: String) async {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        isLoading = true
        defer { isLoading = false }

        // Create user message with pending status
        let message = ChatMessage(
            content: text,
            sender: .user,
            status: .pending
        )

        // Optimistic update - append BEFORE sending
        messages.append(message)

        // Send via protocol handler
        await protocolHandler.send(message: message)
    }

    /// Send a message as a reply to another message
    /// - Parameters:
    ///   - text: The message text
    ///   - replyTo: The message being replied to
    public func send(_ text: String, replyTo: MessageID) async {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        isLoading = true
        defer { isLoading = false }

        let message = ChatMessage(
            content: text,
            sender: .user,
            status: .pending,
            replyTo: replyTo
        )

        messages.append(message)
        await protocolHandler.send(message: message)
    }

    // MARK: - State Management

    /// Clear all messages
    public func clearMessages() {
        messages.removeAll()
    }

    /// Update connection state (called by connection layer)
    public func updateConnectionState(_ state: ConnectionState) {
        connectionState = state
    }

    /// Retry sending failed messages
    public func retryFailed() async {
        await protocolHandler.retryFailedMessages()
    }
}
