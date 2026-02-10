//
//  MCPWebSocketServer.swift
//  OptaNative
//
//  WebSocket transport for MCP server enabling real-time bidirectional communication.
//  Supports push notifications for thermal alerts and status changes without polling.
//
//  Created for Opta Native macOS - Quick Win 1
//

import Foundation
import Network

// MARK: - WebSocket Connection

actor MCPWebSocketConnection: Identifiable {
    let id: UUID
    private let connection: NWConnection
    private var isActive = true

    init(connection: NWConnection) {
        self.id = UUID()
        self.connection = connection
    }

    func start(handler: @escaping (Data) async -> Data?) async {
        connection.stateUpdateHandler = { [weak self] state in
            Task {
                await self?.handleStateChange(state)
            }
        }

        connection.start(queue: .global(qos: .userInteractive))
        await receiveLoop(handler: handler)
    }

    private func handleStateChange(_ state: NWConnection.State) {
        switch state {
        case .ready:
            print("MCPWebSocket: Connection \(id) ready")
        case .failed(let error):
            print("MCPWebSocket: Connection \(id) failed: \(error)")
            isActive = false
        case .cancelled:
            print("MCPWebSocket: Connection \(id) cancelled")
            isActive = false
        default:
            break
        }
    }

    private func receiveLoop(handler: @escaping (Data) async -> Data?) async {
        while isActive {
            do {
                let data = try await receiveMessage()
                if let response = await handler(data) {
                    try await send(response)
                }
            } catch {
                if isActive {
                    print("MCPWebSocket: Receive error: \(error)")
                }
                break
            }
        }
    }

    private func receiveMessage() async throws -> Data {
        return try await withCheckedThrowingContinuation { continuation in
            connection.receiveMessage { content, context, isComplete, error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else if let data = content {
                    continuation.resume(returning: data)
                } else {
                    continuation.resume(throwing: MCPWebSocketError.noData)
                }
            }
        }
    }

    func send(_ data: Data) async throws {
        let metadata = NWProtocolWebSocket.Metadata(opcode: .text)
        let context = NWConnection.ContentContext(identifier: "mcp", metadata: [metadata])

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            connection.send(content: data, contentContext: context, isComplete: true, completion: .contentProcessed { error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            })
        }
    }

    func close() {
        isActive = false
        connection.cancel()
    }
}

enum MCPWebSocketError: Error {
    case noData
    case invalidMessage
    case connectionClosed
}

// MARK: - WebSocket Server

actor MCPWebSocketServer {

    // MARK: - Configuration

    private let port: UInt16
    private var listener: NWListener?
    private var connections: [UUID: MCPWebSocketConnection] = [:]
    private let mcpServer = OptaMCPServer()
    private var isRunning = false

    // MARK: - Initialization

    init(port: UInt16 = 9877) {
        self.port = port
    }

    // MARK: - Server Lifecycle

    func start() async throws {
        guard !isRunning else { return }

        let parameters = NWParameters.tcp

        // Add WebSocket protocol
        let wsOptions = NWProtocolWebSocket.Options()
        wsOptions.autoReplyPing = true
        parameters.defaultProtocolStack.applicationProtocols.insert(wsOptions, at: 0)

        do {
            listener = try NWListener(using: parameters, on: NWEndpoint.Port(rawValue: port)!)
        } catch {
            print("MCPWebSocket: Failed to create listener: \(error)")
            throw error
        }

        listener?.stateUpdateHandler = { [weak self] state in
            Task {
                await self?.handleListenerState(state)
            }
        }

        listener?.newConnectionHandler = { [weak self] connection in
            Task {
                await self?.handleNewConnection(connection)
            }
        }

        listener?.start(queue: .global(qos: .userInteractive))
        isRunning = true
        print("MCPWebSocket: Server started on port \(port)")
    }

    func stop() async {
        isRunning = false

        for (_, connection) in connections {
            await connection.close()
        }
        connections.removeAll()

        listener?.cancel()
        listener = nil
        print("MCPWebSocket: Server stopped")
    }

    // MARK: - Connection Handling

    private func handleListenerState(_ state: NWListener.State) {
        switch state {
        case .ready:
            print("MCPWebSocket: Listener ready on port \(port)")
        case .failed(let error):
            print("MCPWebSocket: Listener failed: \(error)")
            isRunning = false
        case .cancelled:
            print("MCPWebSocket: Listener cancelled")
            isRunning = false
        default:
            break
        }
    }

    private func handleNewConnection(_ nwConnection: NWConnection) async {
        let connection = MCPWebSocketConnection(connection: nwConnection)
        connections[connection.id] = connection

        print("MCPWebSocket: New connection \(connection.id)")

        await connection.start { [weak self] data in
            await self?.handleMessage(data, from: connection.id)
        }

        // Connection ended
        connections.removeValue(forKey: connection.id)
        print("MCPWebSocket: Connection \(connection.id) ended")
    }

    private func handleMessage(_ data: Data, from connectionId: UUID) async -> Data? {
        guard let requestString = String(data: data, encoding: .utf8) else {
            return nil
        }

        // Parse JSON-RPC request
        guard let requestData = requestString.data(using: .utf8),
              let request = try? JSONDecoder().decode(MCPRequest.self, from: requestData) else {
            let errorResponse: [String: Any] = [
                "jsonrpc": "2.0",
                "id": NSNull(),
                "error": [
                    "code": -32700,
                    "message": "Parse error"
                ]
            ]
            return try? JSONSerialization.data(withJSONObject: errorResponse)
        }

        // Handle request through MCP server
        let response = await mcpServer.handleRequest(request)
        return try? JSONEncoder().encode(response)
    }

    // MARK: - Push Notifications

    /// Broadcast a notification to all connected clients
    func broadcast(_ notification: MCPNotification) async {
        guard let data = try? JSONEncoder().encode(notification) else { return }

        for (_, connection) in connections {
            do {
                try await connection.send(data)
            } catch {
                print("MCPWebSocket: Failed to send to connection: \(error)")
            }
        }
    }

    /// Send notification to specific connection
    func send(_ notification: MCPNotification, to connectionId: UUID) async {
        guard let connection = connections[connectionId],
              let data = try? JSONEncoder().encode(notification) else { return }

        do {
            try await connection.send(data)
        } catch {
            print("MCPWebSocket: Failed to send notification: \(error)")
        }
    }

    /// Get number of active connections
    func connectionCount() -> Int {
        return connections.count
    }
}
