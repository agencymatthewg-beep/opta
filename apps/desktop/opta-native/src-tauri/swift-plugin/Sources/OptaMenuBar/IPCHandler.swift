//
//  IPCHandler.swift
//  OptaMenuBar
//
//  Unix socket IPC handler for communicating with Rust backend.
//  Receives binary FlatBuffers data at 25Hz for real-time updates.
//  Created for Opta - Plan 20-08
//

import Foundation
import Darwin

// MARK: - IPC Handler

/// Handles Unix socket communication with the Rust backend.
/// Receives binary FlatBuffers data and invokes callback on new data.
final class IPCHandler: @unchecked Sendable {

    // MARK: - Types

    /// Callback invoked when new binary data is received
    typealias DataCallback = @Sendable (Data) -> Void

    /// Callback invoked when connection state changes
    typealias ConnectionCallback = @Sendable (Bool) -> Void

    // MARK: - Properties

    /// Callback for received data
    private let onData: DataCallback

    /// Callback for connection state changes
    var onConnectionChange: ConnectionCallback?

    /// File handle for socket communication
    private var socket: FileHandle?

    /// Socket file descriptor
    private var socketFD: Int32 = -1

    /// Path to Unix socket
    private let socketPath: String

    /// Whether we're currently connected
    private var isConnected: Bool = false

    /// Reconnection timer
    private var reconnectTimer: Timer?

    /// Background queue for socket operations
    private let socketQueue = DispatchQueue(label: "com.opta.ipc", qos: .userInteractive)

    /// Buffer for partial reads
    private var readBuffer = Data()

    // MARK: - Constants

    /// Default socket path for Opta metrics
    private static let defaultSocketPath = "/tmp/opta-metrics.sock"

    /// Reconnection interval in seconds
    private static let reconnectInterval: TimeInterval = 1.0

    /// Maximum buffer size before flush (1MB)
    private static let maxBufferSize = 1024 * 1024

    // MARK: - Initialization

    /// Initialize IPC handler with data callback.
    ///
    /// - Parameters:
    ///   - socketPath: Path to Unix socket (defaults to /tmp/opta-metrics.sock)
    ///   - onData: Callback invoked when data is received
    init(socketPath: String = defaultSocketPath, onData: @escaping DataCallback) {
        self.socketPath = socketPath
        self.onData = onData
        connect()
    }

    deinit {
        disconnect()
    }

    // MARK: - Connection Management

    /// Connect to the Unix socket
    func connect() {
        socketQueue.async { [weak self] in
            self?.connectInternal()
        }
    }

    /// Disconnect from the socket
    func disconnect() {
        reconnectTimer?.invalidate()
        reconnectTimer = nil

        socketQueue.async { [weak self] in
            self?.disconnectInternal()
        }
    }

    /// Internal connection logic (runs on socketQueue)
    private func connectInternal() {
        // Close existing connection if any
        disconnectInternal()

        // Create Unix socket
        socketFD = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard socketFD >= 0 else {
            print("[IPCHandler] Failed to create socket: \(String(cString: strerror(errno)))")
            scheduleReconnect()
            return
        }

        // Configure socket address
        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)

        // Copy socket path to sun_path
        socketPath.withCString { pathPtr in
            withUnsafeMutablePointer(to: &addr.sun_path) { sunPathPtr in
                sunPathPtr.withMemoryRebound(to: CChar.self, capacity: MemoryLayout.size(ofValue: addr.sun_path)) { destPtr in
                    strncpy(destPtr, pathPtr, MemoryLayout.size(ofValue: addr.sun_path) - 1)
                }
            }
        }

        // Attempt connection
        let result = withUnsafePointer(to: &addr) { addrPtr in
            addrPtr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockaddrPtr in
                Darwin.connect(socketFD, sockaddrPtr, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }

        if result == 0 {
            // Connection successful
            socket = FileHandle(fileDescriptor: socketFD, closeOnDealloc: true)
            isConnected = true

            print("[IPCHandler] Connected to \(socketPath)")

            DispatchQueue.main.async { [weak self] in
                self?.onConnectionChange?(true)
            }

            startReading()
        } else {
            print("[IPCHandler] Failed to connect: \(String(cString: strerror(errno)))")
            Darwin.close(socketFD)
            socketFD = -1
            scheduleReconnect()
        }
    }

    /// Internal disconnect logic (runs on socketQueue)
    private func disconnectInternal() {
        socket?.readabilityHandler = nil

        if socketFD >= 0 {
            Darwin.close(socketFD)
            socketFD = -1
        }

        socket = nil
        isConnected = false
        readBuffer.removeAll()

        DispatchQueue.main.async { [weak self] in
            self?.onConnectionChange?(false)
        }
    }

    // MARK: - Data Reading

    /// Start reading data from socket
    private func startReading() {
        guard let socket = socket else { return }

        socket.readabilityHandler = { [weak self] handle in
            guard let self = self else { return }

            let data = handle.availableData

            if data.isEmpty {
                // Socket closed
                print("[IPCHandler] Connection closed by server")
                self.socketQueue.async {
                    self.disconnectInternal()
                    self.scheduleReconnect()
                }
            } else {
                self.processData(data)
            }
        }
    }

    /// Process received data
    private func processData(_ data: Data) {
        readBuffer.append(data)

        // Try to parse complete messages
        while let message = extractMessage() {
            onData(message)
        }

        // Prevent buffer from growing too large
        if readBuffer.count > Self.maxBufferSize {
            print("[IPCHandler] Buffer overflow, clearing")
            readBuffer.removeAll()
        }
    }

    /// Extract a complete message from the buffer.
    ///
    /// Message format:
    /// - 4 bytes: message length (little-endian UInt32)
    /// - N bytes: message data
    ///
    /// - Returns: Complete message data or nil if incomplete
    private func extractMessage() -> Data? {
        // Need at least 4 bytes for length
        guard readBuffer.count >= 4 else { return nil }

        // Read message length
        let length = readBuffer.withUnsafeBytes { ptr in
            ptr.load(as: UInt32.self)
        }

        let totalLength = 4 + Int(length)

        // Check if complete message is available
        guard readBuffer.count >= totalLength else { return nil }

        // Extract message
        let message = readBuffer.subdata(in: 4..<totalLength)
        readBuffer.removeFirst(totalLength)

        return message
    }

    // MARK: - Reconnection

    /// Schedule a reconnection attempt
    private func scheduleReconnect() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            self.reconnectTimer?.invalidate()
            self.reconnectTimer = Timer.scheduledTimer(
                withTimeInterval: Self.reconnectInterval,
                repeats: false
            ) { [weak self] _ in
                self?.connect()
            }
        }
    }
}

// MARK: - IPC Message Writing

extension IPCHandler {
    /// Send data to the Rust backend.
    ///
    /// - Parameter data: Binary data to send
    /// - Returns: True if send was successful
    @discardableResult
    func send(_ data: Data) -> Bool {
        guard let socket = socket, isConnected else {
            print("[IPCHandler] Cannot send: not connected")
            return false
        }

        // Prepare message with length prefix
        var length = UInt32(data.count)
        var message = Data()
        message.append(contentsOf: withUnsafeBytes(of: &length) { Array($0) })
        message.append(data)

        do {
            try socket.write(contentsOf: message)
            return true
        } catch {
            print("[IPCHandler] Send failed: \(error)")
            return false
        }
    }

    /// Send a string command to the Rust backend.
    ///
    /// - Parameter command: Command string to send
    /// - Returns: True if send was successful
    @discardableResult
    func sendCommand(_ command: String) -> Bool {
        guard let data = command.data(using: .utf8) else {
            return false
        }
        return send(data)
    }
}

// MARK: - Testing Support

#if DEBUG
extension IPCHandler {
    /// Create a mock handler for testing
    static func mock(onData: @escaping DataCallback) -> IPCHandler {
        let handler = IPCHandler(socketPath: "/tmp/opta-mock.sock", onData: onData)
        return handler
    }

    /// Inject mock data for testing
    func injectMockData(_ data: Data) {
        onData(data)
    }
}
#endif
