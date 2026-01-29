//
//  ConnectionManager.swift
//  ClawdbotKit
//
//  Manages WebSocket connection lifecycle with automatic reconnection.
//  Wraps ClawdbotWebSocket with state machine, heartbeat, and retry logic.
//

import Foundation
import Combine

// MARK: - Delegate Protocol

/// Delegate for connection manager events
public protocol ConnectionManagerDelegate: AnyObject, Sendable {
    func connectionManager(_ manager: ConnectionManager, didChangeState state: ConnectionState)
    func connectionManager(_ manager: ConnectionManager, didReceiveMessage message: ClawdbotMessage)
    func connectionManager(_ manager: ConnectionManager, didEncounterError error: Error)
}

// MARK: - Connection Manager

/// Manages WebSocket connection with automatic reconnection
public actor ConnectionManager: ClawdbotWebSocketDelegate {

    // MARK: - Properties

    private let webSocket: ClawdbotWebSocket
    private var stateMachine: ConnectionStateMachine
    private let config: ReconnectionConfig

    private var serverURL: URL?
    private var heartbeatTask: Task<Void, Never>?
    private var reconnectTask: Task<Void, Never>?

    public weak var delegate: ConnectionManagerDelegate?

    /// Current connection state
    public var state: ConnectionState {
        stateMachine.state
    }

    /// Number of reconnection attempts
    public var reconnectAttempts: Int {
        stateMachine.reconnectAttempts
    }

    // MARK: - State Publisher (for SwiftUI)

    /// Thread-safe subject for state changes (accessed from nonisolated context)
    private nonisolated(unsafe) let stateSubject = CurrentValueSubject<ConnectionState, Never>(.disconnected)

    /// Publisher for connection state changes
    public nonisolated var statePublisher: AnyPublisher<ConnectionState, Never> {
        stateSubject.eraseToAnyPublisher()
    }

    // MARK: - Initialization

    public init(config: ReconnectionConfig = .default) {
        self.webSocket = ClawdbotWebSocket()
        self.stateMachine = ConnectionStateMachine(maxReconnectAttempts: config.maxAttempts)
        self.config = config

        Task {
            await webSocket.setDelegate(self)
        }
    }

    // MARK: - Connection Lifecycle

    /// Connect to the Clawdbot server
    public func connect(to url: URL) async {
        serverURL = url

        guard stateMachine.process(.connect) != nil else {
            return  // Invalid state transition
        }

        notifyStateChange()

        do {
            try await webSocket.connect(to: url)
            stateMachine.process(.connectionSucceeded)
            notifyStateChange()
            startHeartbeat()
        } catch {
            stateMachine.process(.connectionFailed(error))
            notifyStateChange()
            delegate?.connectionManager(self, didEncounterError: error)
        }
    }

    /// Disconnect from the server
    public func disconnect() async {
        stopHeartbeat()
        stopReconnect()

        stateMachine.process(.disconnect)
        await webSocket.disconnect()
        serverURL = nil

        notifyStateChange()
    }

    /// Send a message (only when connected)
    public func send(_ message: ClawdbotMessage) async throws {
        guard state.canSend else {
            throw ClawdbotWebSocketError.notConnected
        }
        try await webSocket.send(message)
    }

    /// Send text message (convenience)
    public func send(text: String) async throws {
        try await send(.text(text))
    }

    // MARK: - Heartbeat

    private func startHeartbeat() {
        stopHeartbeat()

        let heartbeatInterval = config.heartbeatInterval
        heartbeatTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(heartbeatInterval * 1_000_000_000))

                guard !Task.isCancelled else { break }

                do {
                    try await self?.webSocket.ping()
                } catch {
                    // Ping failed, connection may be dead
                    // The receive loop will detect the disconnect
                }
            }
        }
    }

    private func stopHeartbeat() {
        heartbeatTask?.cancel()
        heartbeatTask = nil
    }

    // MARK: - Reconnection

    private func startReconnect() {
        guard let url = serverURL else { return }
        stopReconnect()

        let maxAttempts = config.maxAttempts
        let configCopy = config

        reconnectTask = Task { [weak self] in
            guard let self = self else { return }

            while !Task.isCancelled {
                await self.processReconnectAttempt()
                let attempt = await self.reconnectAttempts

                // Check if max attempts reached
                if attempt > maxAttempts {
                    await self.processMaxRetriesReached()
                    return
                }

                // Calculate delay with exponential backoff
                let delay = configCopy.delay(forAttempt: attempt - 1)

                do {
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))

                    guard !Task.isCancelled else { return }

                    // Attempt reconnection
                    try await self.webSocket.connect(to: url)

                    // Success!
                    await self.processReconnectSucceeded()
                    return

                } catch {
                    await self.processReconnectFailed(error: error)
                }
            }
        }
    }

    private func processReconnectAttempt() {
        stateMachine.process(.reconnectAttempt)
    }

    private func processMaxRetriesReached() {
        stateMachine.process(.maxRetriesReached)
        notifyStateChange()
    }

    private func processReconnectSucceeded() {
        stateMachine.process(.reconnectSucceeded)
        notifyStateChange()
        startHeartbeat()
    }

    private func processReconnectFailed(error: Error) {
        stateMachine.process(.reconnectFailed)
        delegate?.connectionManager(self, didEncounterError: error)
    }

    private func stopReconnect() {
        reconnectTask?.cancel()
        reconnectTask = nil
    }

    // MARK: - State Notifications

    private func notifyStateChange() {
        let currentState = stateMachine.state
        stateSubject.send(currentState)
        delegate?.connectionManager(self, didChangeState: currentState)
    }

    // MARK: - Handle Connection Lost (called from delegate)

    private func handleConnectionLost(error: Error?) {
        if state == .connected {
            // Unexpected disconnect - start reconnection
            stateMachine.process(.connectionLost(error ?? ClawdbotWebSocketError.cancelled))
            notifyStateChange()
            stopHeartbeat()
            startReconnect()
        }
    }

    // MARK: - WebSocket Delegate

    nonisolated public func webSocketDidConnect() {
        // Handled in connect() method
    }

    nonisolated public func webSocketDidDisconnect(error: Error?) {
        Task {
            await self.handleConnectionLost(error: error)
        }
    }

    nonisolated public func webSocketDidReceiveMessage(_ message: ClawdbotMessage) {
        Task {
            await self.delegate?.connectionManager(self, didReceiveMessage: message)
        }
    }
}
