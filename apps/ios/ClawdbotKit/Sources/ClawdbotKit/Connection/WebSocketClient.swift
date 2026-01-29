//
//  WebSocketClient.swift
//  ClawdbotKit
//
//  Core WebSocket client using URLSessionWebSocketTask.
//  Provides basic connect/disconnect/send/receive operations.
//
//  State management and reconnection handled by ConnectionManager (Plan 02-02).
//

import Foundation

/// Delegate protocol for WebSocket events
public protocol ClawdbotWebSocketDelegate: AnyObject, Sendable {
    func webSocketDidConnect()
    func webSocketDidDisconnect(error: Error?)
    func webSocketDidReceiveMessage(_ message: ClawdbotMessage)
}

/// Core WebSocket client using URLSessionWebSocketTask
public actor ClawdbotWebSocket {

    // MARK: - Properties

    private var webSocketTask: URLSessionWebSocketTask?
    private let session: URLSession
    private var isReceiving = false

    public weak var delegate: ClawdbotWebSocketDelegate?

    /// Current connection state
    public private(set) var isConnected = false

    // MARK: - Delegate Setter

    /// Set the delegate (for actor-isolated access)
    public func setDelegate(_ delegate: ClawdbotWebSocketDelegate?) {
        self.delegate = delegate
    }

    // MARK: - Initialization

    public init() {
        let configuration = URLSessionConfiguration.default
        configuration.waitsForConnectivity = true
        configuration.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: configuration)
    }

    // MARK: - Connection

    /// Connect to WebSocket server
    /// - Parameter url: WebSocket URL (ws:// or wss://)
    public func connect(to url: URL) async throws {
        guard !isConnected else { return }

        // Validate URL scheme
        guard let scheme = url.scheme,
              scheme == "ws" || scheme == "wss" else {
            throw ClawdbotWebSocketError.invalidURL
        }

        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()

        isConnected = true
        isReceiving = true

        // Notify delegate
        delegate?.webSocketDidConnect()

        // Start receive loop
        await startReceiveLoop()
    }

    /// Disconnect from WebSocket server
    public func disconnect(code: URLSessionWebSocketTask.CloseCode = .normalClosure) {
        guard isConnected else { return }

        isReceiving = false
        webSocketTask?.cancel(with: code, reason: nil)
        webSocketTask = nil
        isConnected = false

        delegate?.webSocketDidDisconnect(error: nil)
    }

    // MARK: - Send

    /// Send a message
    public func send(_ message: ClawdbotMessage) async throws {
        guard let task = webSocketTask, isConnected else {
            throw ClawdbotWebSocketError.notConnected
        }

        do {
            try await task.send(message.urlSessionMessage)
        } catch {
            throw ClawdbotWebSocketError.sendFailed(error)
        }
    }

    /// Send a text message (convenience)
    public func send(text: String) async throws {
        try await send(.text(text))
    }

    /// Send binary data (convenience)
    public func send(data: Data) async throws {
        try await send(.data(data))
    }

    // MARK: - Receive Loop

    private func startReceiveLoop() async {
        while isReceiving {
            guard let task = webSocketTask else { break }

            do {
                let message = try await task.receive()
                let clawdbotMessage = ClawdbotMessage(from: message)
                delegate?.webSocketDidReceiveMessage(clawdbotMessage)
            } catch {
                if isReceiving {
                    // Unexpected disconnect
                    isConnected = false
                    isReceiving = false
                    delegate?.webSocketDidDisconnect(error: error)
                }
                break
            }
        }
    }

    // MARK: - Ping

    /// Send a ping to keep connection alive
    public func ping() async throws {
        guard let task = webSocketTask, isConnected else {
            throw ClawdbotWebSocketError.notConnected
        }

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            task.sendPing { error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }
}
