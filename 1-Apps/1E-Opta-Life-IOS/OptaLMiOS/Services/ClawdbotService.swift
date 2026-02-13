import Foundation
import SwiftUI
import Combine

// MARK: - Clawdbot Service

/// WebSocket client for Clawdbot AI assistant integration
@MainActor
final class ClawdbotService: ObservableObject {
    static let shared = ClawdbotService()

    // MARK: - Configuration

    @AppStorage("clawdbotEnabled") private(set) var isEnabled = false
    @AppStorage("clawdbotServerURL") private(set) var serverURL = ""
    @AppStorage("clawdbotAutoConnect") private(set) var autoConnect = true

    // MARK: - Published State

    @Published var connectionState: ClawdbotConnectionState = .disconnected
    @Published var messages: [ClawdbotMessage] = []
    @Published var botState: ClawdbotBotState = .idle
    @Published var botStateDetail: String?
    @Published var streamingContent: [String: String] = [:]
    @Published var lastError: String?

    // MARK: - Private Properties

    private var webSocket: URLSessionWebSocketTask?
    private var session: URLSession?
    private var sequenceNumber: Int = 0
    private var heartbeatTimer: Timer?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5

    // MARK: - Computed Properties

    var isConnected: Bool {
        connectionState == .connected
    }

    var isLoading: Bool {
        botState == .thinking || botState == .typing || botState == .toolUse
    }

    // MARK: - Initialization

    private init() {
        // Auto-connect on init if enabled
        if isEnabled && autoConnect && !serverURL.isEmpty {
            Task {
                await connect()
            }
        }
    }

    // MARK: - Configuration Methods

    func setEnabled(_ enabled: Bool) {
        isEnabled = enabled
        if !enabled {
            Task {
                await disconnect()
            }
        } else if autoConnect && !serverURL.isEmpty {
            Task {
                await connect()
            }
        }
    }

    func setServerURL(_ url: String) {
        serverURL = url
    }

    func setAutoConnect(_ auto: Bool) {
        autoConnect = auto
    }

    func resetToDefaults() {
        Task {
            await disconnect()
        }
        isEnabled = false
        serverURL = ""
        autoConnect = true
        messages = []
        streamingContent = [:]
    }

    // MARK: - Connection Management

    func connect() async {
        guard isEnabled else {
            lastError = "Clawdbot is disabled"
            return
        }

        guard !serverURL.isEmpty else {
            lastError = "Server URL not configured"
            return
        }

        guard let url = URL(string: serverURL) else {
            lastError = "Invalid server URL"
            return
        }

        connectionState = .connecting
        lastError = nil

        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        session = URLSession(configuration: config)

        webSocket = session?.webSocketTask(with: url)
        webSocket?.resume()

        connectionState = .connected
        reconnectAttempts = 0
        HapticManager.shared.notification(.success)

        startHeartbeat()
        await receiveMessages()
    }

    func disconnect() async {
        stopHeartbeat()
        webSocket?.cancel(with: .normalClosure, reason: nil)
        webSocket = nil
        session?.invalidateAndCancel()
        session = nil
        connectionState = .disconnected
        botState = .idle
        botStateDetail = nil
    }

    // MARK: - Message Handling

    func sendMessage(_ content: String) {
        guard isConnected else {
            lastError = "Not connected to server"
            return
        }

        let messageId = UUID().uuidString
        let userMessage = ClawdbotMessage(
            id: messageId,
            role: .user,
            content: content,
            timestamp: Date()
        )

        messages.append(userMessage)

        let payload = ChatMessagePayload(
            messageID: messageId,
            role: "user",
            content: content,
            timestamp: ISO8601DateFormatter().string(from: Date())
        )

        let envelope = ProtocolEnvelope(
            version: "1.0",
            type: "chat.message",
            sequence: nextSequence(),
            payload: payload,
            serverTimestamp: ISO8601DateFormatter().string(from: Date())
        )

        do {
            let data = try JSONEncoder().encode(envelope)
            if let jsonString = String(data: data, encoding: .utf8) {
                let message = URLSessionWebSocketTask.Message.string(jsonString)
                webSocket?.send(message) { [weak self] error in
                    if let error = error {
                        Task { @MainActor in
                            self?.lastError = error.localizedDescription
                        }
                    }
                }
            }
        } catch {
            lastError = "Failed to encode message"
        }

        HapticManager.shared.impact(.light)
    }

    func clearMessages() {
        messages = []
        streamingContent = [:]
    }

    // MARK: - Private Methods

    private func receiveMessages() async {
        guard let webSocket = webSocket else { return }

        do {
            while connectionState == .connected {
                let message = try await webSocket.receive()
                await handleMessage(message)
            }
        } catch {
            if connectionState != .disconnected {
                connectionState = .reconnecting
                await attemptReconnect()
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) async {
        switch message {
        case .string(let text):
            await parseMessage(text)
        case .data(let data):
            if let text = String(data: data, encoding: .utf8) {
                await parseMessage(text)
            }
        @unknown default:
            break
        }
    }

    private func parseMessage(_ text: String) async {
        guard let data = text.data(using: .utf8) else { return }

        // First decode to get the type
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else {
            return
        }

        switch type {
        case "chat.message":
            if let payload = json["payload"] as? [String: Any],
               let messageId = payload["messageID"] as? String,
               let role = payload["role"] as? String,
               let content = payload["content"] as? String {
                let newMessage = ClawdbotMessage(
                    id: messageId,
                    role: role == "assistant" ? .assistant : .user,
                    content: content,
                    timestamp: Date()
                )
                messages.append(newMessage)
                HapticManager.shared.impact(.light)
            }

        case "bot.state":
            if let payload = json["payload"] as? [String: Any],
               let stateStr = payload["state"] as? String {
                botState = ClawdbotBotState(rawValue: stateStr) ?? .idle
                botStateDetail = payload["detail"] as? String
            }

        case "streaming.chunk":
            if let payload = json["payload"] as? [String: Any],
               let messageId = payload["messageID"] as? String,
               let content = payload["content"] as? String,
               let isFinal = payload["isFinal"] as? Bool {

                if isFinal {
                    // Finalize streaming message
                    if let finalContent = streamingContent[messageId] {
                        let completeMessage = ClawdbotMessage(
                            id: messageId,
                            role: .assistant,
                            content: finalContent + content,
                            timestamp: Date()
                        )
                        messages.append(completeMessage)
                        streamingContent.removeValue(forKey: messageId)
                    }
                } else {
                    // Accumulate chunk
                    streamingContent[messageId, default: ""] += content
                }
            }

        case "system.pong":
            // Heartbeat response received
            break

        case "message.ack":
            // Message acknowledged
            break

        default:
            break
        }
    }

    private func startHeartbeat() {
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.sendPing()
            }
        }
    }

    private func stopHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }

    private func sendPing() {
        let envelope: [String: Any] = [
            "version": "1.0",
            "type": "system.ping",
            "sequence": nextSequence(),
            "payload": [:],
            "serverTimestamp": ISO8601DateFormatter().string(from: Date())
        ]

        if let data = try? JSONSerialization.data(withJSONObject: envelope),
           let jsonString = String(data: data, encoding: .utf8) {
            let message = URLSessionWebSocketTask.Message.string(jsonString)
            webSocket?.send(message) { _ in }
        }
    }

    private func attemptReconnect() async {
        guard reconnectAttempts < maxReconnectAttempts else {
            connectionState = .disconnected
            lastError = "Max reconnection attempts reached"
            HapticManager.shared.notification(.error)
            return
        }

        reconnectAttempts += 1
        let delay = pow(2.0, Double(reconnectAttempts))

        try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))

        if connectionState == .reconnecting {
            await connect()
        }
    }

    private func nextSequence() -> Int {
        sequenceNumber += 1
        return sequenceNumber
    }
}

// MARK: - Types

enum ClawdbotConnectionState: String {
    case disconnected
    case connecting
    case connected
    case reconnecting

    var displayText: String {
        switch self {
        case .disconnected: return "Disconnected"
        case .connecting: return "Connecting..."
        case .connected: return "Connected"
        case .reconnecting: return "Reconnecting..."
        }
    }

    var color: Color {
        switch self {
        case .disconnected: return .optaTextMuted
        case .connecting, .reconnecting: return .optaNeonAmber
        case .connected: return .optaNeonGreen
        }
    }
}

enum ClawdbotBotState: String {
    case idle
    case thinking
    case typing
    case toolUse

    var displayText: String {
        switch self {
        case .idle: return "Ready"
        case .thinking: return "Thinking..."
        case .typing: return "Typing..."
        case .toolUse: return "Using tools..."
        }
    }
}

struct ClawdbotMessage: Identifiable, Equatable {
    let id: String
    let role: ClawdbotMessageRole
    let content: String
    let timestamp: Date
}

enum ClawdbotMessageRole: String {
    case user
    case assistant
}

// MARK: - Protocol Types

private struct ProtocolEnvelope<T: Encodable>: Encodable {
    let version: String
    let type: String
    let sequence: Int
    let payload: T
    let serverTimestamp: String
}

private struct ChatMessagePayload: Encodable {
    let messageID: String
    let role: String
    let content: String
    let timestamp: String
}
