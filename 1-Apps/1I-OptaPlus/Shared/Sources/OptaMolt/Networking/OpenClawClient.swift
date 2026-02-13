//
//  OpenClawClient.swift
//  OptaMolt
//
//  WebSocket client for the OpenClaw Gateway (Protocol v3).
//  Uses NWConnection (Network.framework) for reliable WebSocket with full header control.
//

import Foundation
import Network

// MARK: - Connection State

public enum ConnectionState: Equatable, Sendable {
    case disconnected
    case connecting
    case connected
    case reconnecting
}

// MARK: - OpenClaw Client

@MainActor
public final class OpenClawClient: ObservableObject {
    
    // MARK: - Configuration
    
    public let host: String
    public let port: UInt16
    public let token: String?
    public let clientId: String
    public let clientVersion: String
    public let useTLS: Bool
    
    // MARK: - State
    
    @Published public private(set) var state: ConnectionState = .disconnected
    @Published public private(set) var lastError: String?
    @Published public private(set) var hello: [String: Any]?
    @Published public private(set) var reconnectAttempts: Int = 0
    @Published public private(set) var latencyMs: Double?
    
    // MARK: - Callbacks
    
    public var onEvent: ((EventFrame) -> Void)?
    public var onStateChange: ((ConnectionState) -> Void)?
    public var onHello: (([String: Any]) -> Void)?
    
    // MARK: - Private
    
    private var connection: NWConnection?
    private var pending: [String: (Result<AnyCodable?, Error>) -> Void] = [:]
    private var backoffMs: Double = 800
    private var isClosed = false
    private var lastSeq: Int?
    private var connectSent = false
    private var receiveActive = false
    private var pingTimer: Timer?
    private var pongDeadlineTask: Task<Void, Never>?
    private var pingSentAt: Date?
    
    // MARK: - Init
    
    public init(
        host: String,
        port: UInt16,
        token: String? = nil,
        useTLS: Bool = false,
        clientId: String = "openclaw-control-ui",
        clientVersion: String = "0.1.0"
    ) {
        self.host = host
        self.port = port
        self.token = token
        self.useTLS = useTLS
        self.clientId = clientId
        self.clientVersion = clientVersion
    }
    
    /// Convenience init from URL.
    public convenience init(
        url: URL,
        token: String? = nil,
        clientId: String = "openclaw-control-ui",
        clientVersion: String = "0.1.0"
    ) {
        let host = url.host ?? "127.0.0.1"
        let port = UInt16(url.port ?? (url.scheme == "wss" ? 443 : 18793))
        let useTLS = url.scheme == "wss"
        self.init(host: host, port: port, token: token, useTLS: useTLS, clientId: clientId, clientVersion: clientVersion)
    }
    
    // MARK: - Public API
    
    public func connect() {
        isClosed = false
        openConnection()
    }
    
    public func disconnect() {
        isClosed = true
        stopPingTimer()
        connection?.cancel()
        connection = nil
        flushPending(error: CancellationError())
        setState(.disconnected)
    }
    
    public func request<T: Encodable>(_ method: String, params: T) async throws -> AnyCodable? {
        let frame = RequestFrame(method: method, params: encodeParams(params))
        return try await sendRequest(frame)
    }
    
    public func request(_ method: String, params: AnyCodable? = nil) async throws -> AnyCodable? {
        let frame = RequestFrame(method: method, params: params)
        return try await sendRequest(frame)
    }
    
    // MARK: - Chat Convenience
    
    public func chatHistory(sessionKey: String, limit: Int = 200, before: String? = nil) async throws -> ChatHistoryResponse {
        let params = ChatHistoryParams(sessionKey: sessionKey, limit: limit, before: before)
        let response = try await request("chat.history", params: params)
        return parseChatHistory(response)
    }
    
    @discardableResult
    public func chatSend(sessionKey: String, message: String, deliver: Bool = false, attachments: [ChatSendAttachment]? = nil) async throws -> String {
        let params = ChatSendParams(sessionKey: sessionKey, message: message, deliver: deliver, attachments: attachments)
        _ = try await request("chat.send", params: params)
        return params.idempotencyKey
    }
    
    public func chatAbort(sessionKey: String) async throws {
        let params = ChatAbortParams(sessionKey: sessionKey)
        _ = try await request("chat.abort", params: params)
    }
    
    public func sessionsList(activeMinutes: Int? = 120) async throws -> [GatewaySession] {
        let params = SessionsListParams(activeMinutes: activeMinutes)
        let response = try await request("sessions.list", params: params)
        return parseSessionsList(response)
    }
    
    // MARK: - NWConnection Lifecycle
    
    private func openConnection() {
        setState(.connecting)
        connectSent = false
        receiveActive = false
        
        // Build WebSocket URL endpoint — NWConnection WebSocket requires a URL endpoint
        let scheme = useTLS ? "wss" : "ws"
        let urlString = "\(scheme)://\(host):\(port)"
        guard let url = URL(string: urlString) else {
            lastError = "Invalid WebSocket URL: \(urlString)"
            scheduleReconnect()
            return
        }
        let endpoint = NWEndpoint.url(url)
        
        // Configure WebSocket options with custom headers
        let wsOptions = NWProtocolWebSocket.Options()
        wsOptions.autoReplyPing = true
        
        let origin = "\(useTLS ? "https" : "http")://\(host):\(port)"
        wsOptions.setAdditionalHeaders([
            ("Origin", origin),
            ("User-Agent", "OptaPlus/\(clientVersion) macOS")
        ])
        
        // Build parameter stack: TCP + WebSocket
        let parameters: NWParameters
        if useTLS {
            parameters = .tls
        } else {
            parameters = .tcp
        }
        parameters.defaultProtocolStack.applicationProtocols.insert(wsOptions, at: 0)
        
        let conn = NWConnection(to: endpoint, using: parameters)
        self.connection = conn
        
        conn.stateUpdateHandler = { [weak self] newState in
            Task { @MainActor in
                self?.handleConnectionState(newState)
            }
        }
        
        conn.start(queue: .main)
    }
    
    private func handleConnectionState(_ newState: NWConnection.State) {
        NSLog("[OC] NWConnection state: \(newState)")
        switch newState {
        case .ready:
            // WebSocket is connected, start receiving
            NSLog("[OC] Connection READY — starting receive loop")
            startReceiving()
            
        case .failed(let error):
            NSLog("[OC] Connection FAILED: \(error)")
            lastError = "Connection failed: \(error.localizedDescription)"
            connection = nil
            flushPending(error: error)
            scheduleReconnect()
            
        case .cancelled:
            NSLog("[OC] Connection CANCELLED (isClosed=\(isClosed))")
            if !isClosed {
                lastError = "Connection cancelled"
                connection = nil
                flushPending(error: OpenClawError.notConnected)
                scheduleReconnect()
            }
            
        case .waiting(let error):
            NSLog("[OC] Connection WAITING: \(error)")
            lastError = "Waiting: \(error.localizedDescription)"
            
        default:
            NSLog("[OC] Connection state: \(newState)")
            break
        }
    }
    
    // MARK: - Receiving
    
    private func startReceiving() {
        guard !receiveActive else { return }
        receiveActive = true
        receiveNext()
    }
    
    private func receiveNext() {
        guard let conn = connection, !isClosed else { return }
        
        conn.receiveMessage { [weak self] content, context, isComplete, error in
            Task { @MainActor in
                guard let self = self else { return }
                
                if let error = error {
                    self.receiveActive = false
                    if !self.isClosed {
                        self.lastError = "Receive error: \(error.localizedDescription)"
                        self.connection?.cancel()
                        self.connection = nil
                        self.flushPending(error: error)
                        self.scheduleReconnect()
                    }
                    return
                }
                
                if let content = content, !content.isEmpty {
                    // Check if it's a WebSocket text message
                    if let text = String(data: content, encoding: .utf8) {
                        NSLog("[OC] Received WS message (\(content.count) bytes): \(String(text.prefix(200)))")
                        self.handleMessage(text)
                    } else {
                        NSLog("[OC] Received non-text data: \(content.count) bytes")
                    }
                } else {
                    NSLog("[OC] receiveMessage: empty content, isComplete=\(isComplete)")
                }
                
                // Continue receiving
                self.receiveNext()
            }
        }
    }
    
    // MARK: - Sending
    
    private func sendText(_ text: String) {
        guard let conn = connection else { NSLog("[OC] sendText: no connection!"); return }
        
        NSLog("[OC] Sending WS text (\(text.count) chars): \(String(text.prefix(200)))")
        let data = text.data(using: .utf8)!
        
        // Create WebSocket metadata for text frame
        let metadata = NWProtocolWebSocket.Metadata(opcode: .text)
        let context = NWConnection.ContentContext(identifier: "ws-text", metadata: [metadata])
        
        conn.send(content: data, contentContext: context, isComplete: true, completion: .contentProcessed { error in
            if let error = error {
                Task { @MainActor in
                    self.lastError = "Send error: \(error.localizedDescription)"
                }
            }
        })
    }
    
    // MARK: - Message Handling
    
    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else {
            return
        }
        
        switch type {
        case "event":
            handleEvent(json: json, data: data)
        case "res":
            handleResponse(json: json)
        default:
            break
        }
    }
    
    private func handleEvent(json: [String: Any], data: Data) {
        guard let eventName = json["event"] as? String else { return }
        
        // Handle connect.challenge
        if eventName == "connect.challenge" {
            Task { await sendConnect() }
            return
        }
        
        // Track sequence numbers
        if let seq = json["seq"] as? Int {
            if let lastSeq = lastSeq, seq > lastSeq + 1 {
                lastError = "Event gap: expected \(lastSeq + 1), got \(seq)"
            }
            lastSeq = seq
        }
        
        // Decode event frame
        if let frame = try? JSONDecoder().decode(EventFrame.self, from: data) {
            onEvent?(frame)
        } else {
            let payload = json["payload"].map { AnyCodable($0) }
            let frame = EventFrame(type: "event", event: eventName, payload: payload, seq: json["seq"] as? Int)
            onEvent?(frame)
        }
    }
    
    private func handleResponse(json: [String: Any]) {
        guard let id = json["id"] as? String,
              let handler = pending.removeValue(forKey: id) else {
            return
        }
        
        let ok = json["ok"] as? Bool ?? false
        
        if ok {
            let payload = json["payload"].map { AnyCodable($0) }
            handler(.success(payload))
        } else {
            let errorDict = json["error"] as? [String: Any]
            let errorMsg = errorDict?["message"] as? String ?? "Request failed"
            let errorCode = errorDict?["code"] as? String ?? ""
            
            let error: OpenClawError
            switch errorCode.uppercased() {
            case "NOT_PAIRED":
                error = .notPaired
            case "AUTH_FAILED", "INVALID_TOKEN", "FORBIDDEN":
                error = .authenticationFailed(errorMsg)
            default:
                error = .requestFailed(errorMsg)
            }
            handler(.failure(error))
        }
    }
    
    // MARK: - Connect Handshake
    
    private func sendConnect() async {
        guard !connectSent else { NSLog("[OC] sendConnect: already sent, skipping"); return }
        connectSent = true
        NSLog("[OC] Sending connect handshake...")
        
        let params = ConnectParams(
            token: token,
            clientId: clientId,
            clientVersion: clientVersion
        )
        
        do {
            let response = try await request("connect", params: params)
            NSLog("[OC] Connect handshake SUCCESS")
            let helloDict = response?.dict ?? [:]
            self.hello = helloDict
            self.backoffMs = 800
            self.reconnectAttempts = 0
            self.lastError = nil
            setState(.connected)
            startPingTimer()
            onHello?(helloDict)
        } catch {
            NSLog("[OC] Connect handshake FAILED: \(error)")
            lastError = "Connect handshake failed: \(error.localizedDescription)"
            connection?.cancel()
            scheduleReconnect()
        }
    }
    
    // MARK: - Request/Response
    
    private func sendRequest(_ frame: RequestFrame) async throws -> AnyCodable? {
        guard connection != nil else {
            throw OpenClawError.notConnected
        }
        
        let data = try JSONEncoder().encode(frame)
        guard let text = String(data: data, encoding: .utf8) else {
            throw OpenClawError.encodingFailed
        }
        
        return try await withCheckedThrowingContinuation { continuation in
            pending[frame.id] = { result in
                continuation.resume(with: result)
            }
            sendText(text)
        }
    }
    
    // MARK: - Ping/Pong Health Monitoring
    
    private func startPingTimer() {
        stopPingTimer()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.sendPing()
            }
        }
    }
    
    private func stopPingTimer() {
        pingTimer?.invalidate()
        pingTimer = nil
        pongDeadlineTask?.cancel()
        pongDeadlineTask = nil
    }
    
    private func sendPing() {
        guard let conn = connection, state == .connected else { return }
        
        pingSentAt = Date()
        let metadata = NWProtocolWebSocket.Metadata(opcode: .ping)
        metadata.setPongHandler(.main) { [weak self] error in
            Task { @MainActor in
                guard let self = self else { return }
                self.pongDeadlineTask?.cancel()
                self.pongDeadlineTask = nil
                if let sentAt = self.pingSentAt {
                    self.latencyMs = Date().timeIntervalSince(sentAt) * 1000
                }
            }
        }
        let context = NWConnection.ContentContext(identifier: "ws-ping", metadata: [metadata])
        conn.send(content: Data(), contentContext: context, isComplete: true, completion: .contentProcessed { _ in })
        
        // Deadline: if no pong within 5s, reconnect
        pongDeadlineTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            guard !Task.isCancelled else { return }
            guard let self = self, self.state == .connected else { return }
            NSLog("[OC] Ping timeout — no pong in 5s, reconnecting")
            self.latencyMs = nil
            self.connection?.cancel()
            self.connection = nil
            self.flushPending(error: OpenClawError.timeout)
            self.scheduleReconnect()
        }
    }
    
    // MARK: - Reconnection
    
    private func scheduleReconnect() {
        guard !isClosed else { return }
        stopPingTimer()
        setState(.reconnecting)
        reconnectAttempts += 1
        
        // Exponential backoff with ±20% jitter
        let jitter = Double.random(in: 0.8...1.2)
        let delay = backoffMs * jitter
        backoffMs = min(backoffMs * 1.7, 15_000)
        
        NSLog("[OC] Reconnect #\(reconnectAttempts) in \(Int(delay))ms (base=\(Int(backoffMs / 1.7)))")
        
        Task {
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000))
            guard !isClosed else { return }
            openConnection()
        }
    }
    
    private func flushPending(error: Error) {
        let handlers = pending
        pending.removeAll()
        for (_, handler) in handlers {
            handler(.failure(error))
        }
    }
    
    private func setState(_ newState: ConnectionState) {
        guard state != newState else { return }
        state = newState
        onStateChange?(newState)
    }
    
    // MARK: - Response Parsing
    
    private func parseChatHistory(_ response: AnyCodable?) -> ChatHistoryResponse {
        guard let dict = response?.dict else {
            return ChatHistoryResponse(messages: [], thinkingLevel: nil)
        }
        
        let thinkingLevel = dict["thinkingLevel"] as? String
        
        guard let rawMessages = dict["messages"] as? [[String: Any]] else {
            return ChatHistoryResponse(messages: [], thinkingLevel: thinkingLevel)
        }
        
        let messages: [GatewayMessage] = rawMessages.compactMap { msg in
            guard let role = msg["role"] as? String else { return nil }
            
            let content: String
            if let text = msg["content"] as? String {
                content = text
            } else if let blocks = msg["content"] as? [[String: Any]] {
                content = blocks.compactMap { block -> String? in
                    if block["type"] as? String == "text" {
                        return block["text"] as? String
                    }
                    return nil
                }.joined()
            } else {
                content = ""
            }
            
            var timestamp: Date? = nil
            if let ts = msg["timestamp"] as? Double {
                timestamp = Date(timeIntervalSince1970: ts / 1000)
            } else if let ts = msg["ts"] as? Double {
                timestamp = Date(timeIntervalSince1970: ts / 1000)
            }
            
            let id = msg["id"] as? String ?? UUID().uuidString
            let runId = msg["runId"] as? String
            
            return GatewayMessage(id: id, role: role, content: content, timestamp: timestamp, runId: runId)
        }
        
        return ChatHistoryResponse(messages: messages, thinkingLevel: thinkingLevel)
    }
    
    private func parseSessionsList(_ response: AnyCodable?) -> [GatewaySession] {
        guard let dict = response?.dict,
              let rawSessions = dict["sessions"] as? [[String: Any]] else {
            return []
        }
        
        return rawSessions.compactMap { s in
            guard let key = s["sessionKey"] as? String ?? s["key"] as? String else {
                return nil
            }
            
            var lastActive: Date? = nil
            if let ts = s["lastActiveAt"] as? Double {
                lastActive = Date(timeIntervalSince1970: ts / 1000)
            }
            
            return GatewaySession(
                id: key,
                agentId: s["agentId"] as? String,
                kind: s["kind"] as? String,
                label: s["label"] as? String,
                lastActiveAt: lastActive,
                channel: s["channel"] as? String
            )
        }
    }
}

// MARK: - Errors

public enum OpenClawError: LocalizedError, Sendable {
    case notConnected
    case encodingFailed
    case requestFailed(String)
    case timeout
    case notPaired
    case authenticationFailed(String)
    
    public var errorDescription: String? {
        switch self {
        case .notConnected: return "Not connected to gateway"
        case .encodingFailed: return "Failed to encode request"
        case .requestFailed(let msg): return msg
        case .timeout: return "Request timed out"
        case .notPaired: return "This device is not paired with the gateway. Open OpenClaw settings to pair your device."
        case .authenticationFailed(let msg): return "Authentication failed: \(msg)"
        }
    }
    
    /// Whether this error is transient and should be retried.
    public var isTransient: Bool {
        switch self {
        case .notConnected, .timeout: return true
        case .notPaired, .authenticationFailed: return false
        case .requestFailed(let msg):
            let permanent = ["NOT_PAIRED", "AUTH_FAILED", "REJECTED", "FORBIDDEN", "INVALID_TOKEN"]
            return !permanent.contains(where: { msg.uppercased().contains($0) })
        case .encodingFailed: return false
        }
    }
}
