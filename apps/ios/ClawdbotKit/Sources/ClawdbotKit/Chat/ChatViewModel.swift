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
/// Includes message persistence via MessageStore for conversation continuity.
@Observable
@MainActor
public final class ChatViewModel {

    // MARK: - Published State (read-only externally)

    /// All chat messages in conversation
    public private(set) var messages: [ChatMessage] = []

    /// Current connection state
    public private(set) var connectionState: ConnectionState = .disconnected

    /// Whether a send operation or history load is in progress
    public private(set) var isLoading: Bool = false

    // MARK: - Private Properties

    private let protocolHandler: ProtocolHandler
    private let messageStore: MessageStore
    private var cancellables = Set<AnyCancellable>()

    /// Set of known message IDs for deduplication
    private var knownMessageIDs: Set<String> = []

    // MARK: - Initialization

    /// Initialize with a ProtocolHandler and optional MessageStore
    /// - Parameters:
    ///   - protocolHandler: The protocol handler for message operations
    ///   - messageStore: Store for message persistence (default: MessageStore())
    public init(
        protocolHandler: ProtocolHandler,
        messageStore: MessageStore = MessageStore()
    ) {
        self.protocolHandler = protocolHandler
        self.messageStore = messageStore
        observeMessages()
        loadHistory()
    }

    // MARK: - History Loading

    /// Load message history from persistence
    ///
    /// Called during initialization to restore conversation continuity.
    /// Sets isLoading during load operation.
    private func loadHistory() {
        Task {
            isLoading = true
            let stored = await messageStore.loadMessages()
            messages = stored
            // Populate known IDs for deduplication
            knownMessageIDs = Set(stored.map { $0.id.value })
            isLoading = false
        }
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
        // Deduplication: check if we've already seen this message
        let messageIDValue = message.id.value
        guard !knownMessageIDs.contains(messageIDValue) else {
            // Update existing message if it exists (e.g., status change from pending to delivered)
            if let existingIndex = messages.firstIndex(where: { $0.id == message.id }) {
                messages[existingIndex] = message
                // Persist the update
                Task { await messageStore.save(message) }
            }
            return
        }

        // New message - add to known IDs, append to list, and persist
        knownMessageIDs.insert(messageIDValue)
        messages.append(message)

        // Persist incoming message asynchronously
        Task { await messageStore.save(message) }
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
    /// 3. Persist to MessageStore
    /// 4. Send via ProtocolHandler
    /// 5. Status updated when server confirms
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

        // Track message ID for deduplication
        knownMessageIDs.insert(message.id.value)

        // Optimistic update - append BEFORE sending
        messages.append(message)

        // Persist to store (non-blocking)
        Task { await messageStore.save(message) }

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

        // Track message ID for deduplication
        knownMessageIDs.insert(message.id.value)

        messages.append(message)

        // Persist to store (non-blocking)
        Task { await messageStore.save(message) }

        await protocolHandler.send(message: message)
    }

    // MARK: - State Management

    /// Clear all messages and history
    public func clearMessages() {
        messages.removeAll()
        knownMessageIDs.removeAll()
        // Clear persistent storage
        Task { await messageStore.clearHistory() }
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
