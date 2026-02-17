//
//  ChatViewModel.swift
//  OptaMolt
//
//  High-level chat view model that bridges OpenClawClient to SwiftUI views.
//  Manages message history, streaming state, multi-session switching, and session routing.
//

import Foundation
import SwiftUI
import Combine
import os.log

// MARK: - Agent Stream Event

/// An event from the agent's processing pipeline.
public struct AgentStreamEvent: Identifiable, Equatable {
    public let id = UUID()
    public let timestamp: Date
    public let stream: String
    public let phase: String?
    public let text: String?
    public let delta: String?
    public let toolName: String?
    
    public init(stream: String, phase: String? = nil, text: String? = nil, delta: String? = nil, toolName: String? = nil) {
        self.timestamp = Date()
        self.stream = stream
        self.phase = phase
        self.text = text
        self.delta = delta
        self.toolName = toolName
    }
    
    public static func == (lhs: AgentStreamEvent, rhs: AgentStreamEvent) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Bot Configuration

/// Configuration for a bot connection.
public struct BotConfig: Identifiable, Codable, Sendable, Hashable {
    public let id: String
    public var name: String
    public var host: String
    public var port: Int
    public var token: String
    public var emoji: String
    public var sessions: [ChatSession]

    // Remote access
    public var remoteURL: String?
    public var connectionMode: ConnectionMode

    public enum ConnectionMode: String, Codable, Sendable, Hashable, CaseIterable {
        case auto     // Try LAN first (200ms probe), fall back to remote
        case lan      // Force LAN only (current behavior)
        case remote   // Force remote only
    }

    public var lanURL: URL? {
        URL(string: "ws://\(host):\(port)")
    }

    public var remoteAccessURL: URL? {
        remoteURL.flatMap { URL(string: $0) }
    }

    /// Backwards-compatible: returns LAN URL (used by legacy callers).
    public var wsURL: URL? { lanURL }

    public init(
        id: String = UUID().uuidString,
        name: String,
        host: String = "127.0.0.1",
        port: Int,
        token: String,
        emoji: String = "🤖",
        sessionKey: String = "main",
        remoteURL: String? = nil,
        connectionMode: ConnectionMode = .auto
    ) {
        self.id = id
        self.name = name
        self.host = host
        self.port = port
        self.token = token
        self.emoji = emoji
        self.sessions = [ChatSession.defaultSynced(botName: name)]
        self.remoteURL = remoteURL
        self.connectionMode = connectionMode
    }

    // Codable migration: handle missing remoteURL/connectionMode from old configs
    enum CodingKeys: String, CodingKey {
        case id, name, host, port, token, emoji, sessions, remoteURL, connectionMode
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        host = try container.decode(String.self, forKey: .host)
        port = try container.decode(Int.self, forKey: .port)
        token = try container.decode(String.self, forKey: .token)
        emoji = try container.decode(String.self, forKey: .emoji)
        sessions = try container.decode([ChatSession].self, forKey: .sessions)
        remoteURL = try container.decodeIfPresent(String.self, forKey: .remoteURL)
        connectionMode = try container.decodeIfPresent(ConnectionMode.self, forKey: .connectionMode) ?? .auto
    }

    /// Create a BotConfig from a BotNode and its pairing token.
    /// Used as a bridge during migration from the old BotConfig model
    /// to the new BotNode + PairingToken pairing system.
    public init(botNode: BotNode, token: String) {
        self.init(
            id: botNode.botId,
            name: botNode.name,
            host: botNode.gatewayHost ?? "127.0.0.1",
            port: botNode.gatewayPort ?? 3000,
            token: token,
            emoji: botNode.emoji,
            remoteURL: botNode.remoteURL,
            connectionMode: botNode.connectionMode
        )
    }
}

// MARK: - Chat View Model

/// Main view model for a single bot connection managing multiple chat sessions.
///
/// Handles:
/// - WebSocket connection lifecycle (one connection per bot)
/// - Multiple sessions with independent histories
/// - Session routing (synced/direct/isolated modes)
/// - Streaming event dispatch to the correct session
/// - Bot state tracking (idle/thinking/typing)
@MainActor
public final class ChatViewModel: ObservableObject {

    static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "ChatVM")

    // MARK: - Published State
    
    /// All messages in the active session.
    @Published public var messages: [ChatMessage] = []
    
    /// Current bot activity state.
    @Published public var botState: BotState = .idle
    
    /// Current streaming content (accumulated delta text).
    @Published public var streamingContent: String = ""
    
    /// Whether we're loading history.
    @Published public var isLoading = false
    
    /// Whether a message is being sent.
    @Published public var isSending = false
    
    /// Whether earlier messages are being loaded (pagination).
    @Published public var isLoadingEarlier = false
    
    /// Whether there are more messages to load.
    @Published public var hasEarlierMessages = true
    
    /// Number of queued (offline) messages waiting to send.
    @Published public var queuedMessageCount: Int = 0
    
    /// Connection state.
    @Published public var connectionState: ConnectionState = .disconnected
    
    /// Last error message.
    @Published public var errorMessage: String?

    /// Uptime tracking: when the current connection was established.
    @Published public var connectedSince: Date?

    /// Total accumulated uptime across all connections.
    @Published public var totalUptimeSeconds: TimeInterval = 0

    /// Bot health score.
    @Published public var health: BotHealth = .unknown

    /// Reconnect count for health tracking.
    @Published public var reconnectCount: Int = 0

    /// Error count for health tracking.
    @Published public var errorCount: Int = 0
    
    /// Active run ID for the current generation.
    @Published public var activeRunId: String?
    
    /// Thinking/agent event log for the current run.
    @Published public var agentEvents: [AgentStreamEvent] = []
    
    /// Context files from the gateway hello payload.
    @Published public var contextFiles: [[String: Any]] = []
    
    /// All sessions for this bot.
    @Published public var sessions: [ChatSession] = []
    
    /// Currently active session.
    @Published public var activeSession: ChatSession?
    
    /// Whether the session drawer is open.
    @Published public var isSessionDrawerOpen = false

    /// Message currently being replied to (shown above input bar).
    @Published public var replyingTo: ChatMessage? = nil

    /// Current connection route (LAN vs Remote).
    @Published public var connectionRoute: NetworkEnvironment.ConnectionType = .unknown

    /// Countdown (in seconds) until the next automatic reconnect attempt.
    /// `nil` when not actively counting down (e.g. connected or manually disconnected).
    @Published public var reconnectCountdown: Int? = nil

    // MARK: - Configuration

    /// The bot configuration.
    public let botConfig: BotConfig

    // MARK: - Sync

    /// Sync coordinator for dual-channel (gateway + Telegram) messaging.
    public var syncCoordinator: SyncCoordinator?

    // MARK: - Network Environment

    private let networkEnv: NetworkEnvironment

    // MARK: - Private

    var client: OpenClawClient?
    private var currentIdempotencyKey: String?
    private var cancellables = Set<AnyCancellable>()

    /// Task tracking the reconnect countdown timer.
    private var reconnectCountdownTask: Task<Void, Never>?

    /// Per-session message cache (sessionId -> messages)
    var sessionMessages: [String: [ChatMessage]] = [:]

    /// Per-session streaming state
    var sessionStreamContent: [String: String] = [:]

    /// Message stats for this bot
    var messageStats: BotMessageStats

    /// Timestamp when user sent last message (for response time tracking)
    var lastSendTime: Date?
    
    /// Persistent offline message queue.
    public let offlineQueue: OfflineQueue

    /// UserDefaults key prefixes for session persistence
    var sessionListKey: String { "optaplus.sessions.\(botConfig.id)" }
    var activeSessionKey: String { "optaplus.activeSession.\(botConfig.id)" }

    // MARK: - Init

    /// Whether a clear chat confirmation alert should be shown.
    @Published public var showClearConfirmation = false

    public init(botConfig: BotConfig, syncCoordinator: SyncCoordinator? = nil, networkEnv: NetworkEnvironment? = nil) {
        self.botConfig = botConfig
        self.syncCoordinator = syncCoordinator
        self.networkEnv = networkEnv ?? NetworkEnvironment()
        self.messageStats = MessageStatsManager.load(botId: botConfig.id)
        self.offlineQueue = OfflineQueue(botId: botConfig.id)

        // Restore persisted sessions or use defaults
        if let data = UserDefaults.standard.data(forKey: "optaplus.sessions.\(botConfig.id)"),
           let saved = try? JSONDecoder().decode([ChatSession].self, from: data),
           !saved.isEmpty {
            self.sessions = saved
        } else {
            self.sessions = botConfig.sessions
        }
        
        // Restore active session
        if let activeId = UserDefaults.standard.string(forKey: "optaplus.activeSession.\(botConfig.id)"),
           let match = sessions.first(where: { $0.id == activeId }) {
            self.activeSession = match
        } else {
            self.activeSession = sessions.first
        }

        // Sync queued message count from persistent queue
        queuedMessageCount = offlineQueue.count
        offlineQueue.$messages
            .map(\.count)
            .receive(on: DispatchQueue.main)
            .assign(to: &$queuedMessageCount)

        // Load locally persisted messages
        Task {
            let stored = await MessageStore.shared.loadMessages(botId: botConfig.id)
            if !stored.isEmpty && self.messages.isEmpty {
                self.messages = stored
                if let session = self.activeSession {
                    self.sessionMessages[session.id] = stored
                }
            }
        }
    }

    // MARK: - Message Stats (Public)

    /// Current bot message statistics.
    public var stats: BotMessageStats { messageStats }

    // MARK: - Clear Chat

    /// Clear messages with local persistence cleanup.
    public func clearChat() {
        messages.removeAll()
        offlineQueue.clear()
        if let session = activeSession {
            sessionMessages[session.id] = []
        }
        Task { await MessageStore.shared.clearMessages(botId: botConfig.id) }
    }
    
    // MARK: - Connection
    
    /// Connect to the bot's gateway, using NetworkEnvironment to resolve LAN vs remote.
    public func connect() {
        // Tear down existing connection
        client?.disconnect()
        cancellables.removeAll()

        Task {
            guard let url = await networkEnv.resolveURL(for: botConfig) else {
                errorMessage = "No connection URL available"
                return
            }
            connectionRoute = networkEnv.connectionType

            let newClient = OpenClawClient(
                url: url,
                token: botConfig.token,
                clientId: "openclaw-control-ui",
                clientVersion: "0.1.0"
            )
            self.wireUpClient(newClient)
        }
    }

    /// Wire up Combine observations and callbacks on a new client, then connect.
    private func wireUpClient(_ newClient: OpenClawClient) {
        
        // Use Combine to observe client state changes directly
        newClient.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                Self.logger.debug("State changed: \(String(describing: state))")
                let oldState = self?.connectionState
                self?.connectionState = state
                if state == .connected {
                    self?.stopReconnectCountdown()
                    self?.errorMessage = nil
                    // Uptime tracking
                    if oldState != .connected {
                        if self?.connectedSince != nil {
                            self?.reconnectCount += 1
                        }
                        self?.connectedSince = Date()
                        self?.updateHealth()
                        ActivityFeedManager.shared.addEvent(
                            botName: self?.botConfig.name ?? "Bot",
                            botEmoji: self?.botConfig.emoji ?? "🤖",
                            message: "connected",
                            kind: .connected
                        )
                    }
                    self?.flushMessageQueue()
                } else if state == .reconnecting {
                    // Start a countdown based on reconnect attempts (exponential backoff estimate)
                    let attempt = self?.reconnectCount ?? 0
                    let estimatedSeconds = max(1, min(15, Int(pow(1.7, Double(attempt)))))
                    self?.startReconnectCountdown(seconds: estimatedSeconds)
                } else if state == .disconnected, oldState == .connected {
                    // Accumulate uptime
                    if let since = self?.connectedSince {
                        self?.totalUptimeSeconds += Date().timeIntervalSince(since)
                    }
                    self?.connectedSince = nil
                    self?.updateHealth()
                    ActivityFeedManager.shared.addEvent(
                        botName: self?.botConfig.name ?? "Bot",
                        botEmoji: self?.botConfig.emoji ?? "🤖",
                        message: "disconnected",
                        kind: .disconnected
                    )
                }
            }
            .store(in: &cancellables)
        
        newClient.onHello = { [weak self] hello in
            Task { @MainActor in
                // Extract context/workspace files from hello payload
                if let sessions = hello["sessions"] as? [[String: Any]],
                   let mainSession = sessions.first(where: { ($0["key"] as? String) == "main" || ($0["sessionKey"] as? String) == "main" }) {
                    self?.contextFiles = (mainSession["contextFiles"] as? [[String: Any]]) ?? []
                }
                // Also try top-level context
                if let ctx = hello["context"] as? [[String: Any]] {
                    self?.contextFiles = ctx
                }
                await self?.loadHistory()
            }
        }
        
        newClient.onEvent = { [weak self] event in
            Task { @MainActor in
                self?.handleEvent(event)
            }
        }
        
        self.client = newClient
        newClient.connect()
    }
    
    /// Disconnect from the bot.
    public func disconnect() {
        // Accumulate uptime before disconnecting
        if let since = connectedSince {
            totalUptimeSeconds += Date().timeIntervalSince(since)
            connectedSince = nil
        }
        stopReconnectCountdown()
        client?.disconnect()
        client = nil
        connectionState = .disconnected
        updateHealth()
    }

    /// Force an immediate reconnection attempt, cancelling any pending backoff countdown.
    public func reconnect() {
        stopReconnectCountdown()
        disconnect()
        connect()
    }
    
    // MARK: - Chat Actions
    
    /// Load chat history from the gateway for the active session.
    /// - Parameter earlier: If true, load earlier messages (pagination). Otherwise load latest.
    public func loadHistory(earlier: Bool = false) async {
        guard let client = client, let session = activeSession else { return }
        
        if earlier {
            guard !isLoadingEarlier, hasEarlierMessages else { return }
            isLoadingEarlier = true
        } else {
            isLoading = true
        }
        defer {
            if earlier { isLoadingEarlier = false } else { isLoading = false }
        }
        
        let pageSize = 50
        let beforeId: String? = earlier ? messages.first?.id : nil
        
        do {
            let history = try await client.chatHistory(
                sessionKey: session.sessionKey,
                limit: pageSize,
                before: beforeId
            )
            
            Self.logger.info("History loaded: \(history.messages.count) messages (earlier=\(earlier))")
            let loadedMessages = history.messages.map { msg in
                ChatMessage(
                    id: msg.id,
                    content: msg.content,
                    sender: msg.role == "user" ? .user : .bot(name: botConfig.name),
                    timestamp: msg.timestamp ?? Date(),
                    status: .delivered
                )
            }
            
            if earlier {
                // Prepend older messages
                let existingIds = Set(messages.map(\.id))
                let newMessages = loadedMessages.filter { !existingIds.contains($0.id) }
                messages.insert(contentsOf: newMessages, at: 0)
                hasEarlierMessages = loadedMessages.count >= pageSize
            } else {
                messages = loadedMessages
                hasEarlierMessages = loadedMessages.count >= pageSize
            }
            
            sessionMessages[session.id] = messages
            Self.logger.debug("Messages set: \(self.messages.count) total")
        } catch {
            Self.logger.error("History load failed: \(error.localizedDescription)")
            handleError(error, context: "load history")
        }
    }
    
    /// Load earlier messages (pagination trigger).
    public func loadEarlierMessages() async {
        await loadHistory(earlier: true)
    }
    
    /// Send a message to the bot via the active session.
    /// If disconnected, queues the message for later delivery.
    public func send(_ text: String, attachments: [ChatAttachment] = []) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty || !attachments.isEmpty,
              let session = activeSession else { return }

        // Prepend device identity tag if configured
        let deviceName = UserDefaults.standard.string(forKey: "optaplus.deviceName") ?? ""
        let wireText = deviceName.isEmpty ? trimmed : "[via: \(deviceName)] \(trimmed)"

        let displayText = trimmed.isEmpty && !attachments.isEmpty
            ? "[\(attachments.count) file\(attachments.count == 1 ? "" : "s")]"
            : trimmed

        Self.logger.info("Sending message: '\(displayText.prefix(50))' with \(attachments.count) attachments to session '\(session.sessionKey)' mode=\(session.mode.rawValue) deliver=\(session.resolvedShouldDeliver)")

        // Capture and clear reply state
        let replyId = replyingTo?.id
        replyingTo = nil

        // Add user message immediately
        let userMessage = ChatMessage(
            content: displayText,
            sender: .user,
            status: connectionState == .connected ? .sent : .pending,
            source: .optaplus,
            attachments: attachments,
            replyTo: replyId
        )
        messages.append(userMessage)
        sessionMessages[session.id] = messages
        messageStats.recordSent(at: userMessage.timestamp)
        lastSendTime = Date()
        persistStats()
        schedulePersist()
        Self.logger.debug("User message appended, total messages: \(self.messages.count)")

        // If disconnected, queue for later
        guard let client = client, connectionState == .connected else {
            enqueueMessage(text: wireText, attachments: attachments, messageId: userMessage.id)
            return
        }

        isSending = true
        botState = .thinking
        streamingContent = ""

        // Convert attachments to wire format (base64)
        let wireAttachments: [ChatSendAttachment]? = attachments.isEmpty
            ? nil
            : attachments.compactMap { ChatSendAttachment(from: $0) }

        do {
            let key = try await client.chatSend(
                sessionKey: session.sessionKey,
                message: wireText,
                deliver: session.resolvedShouldDeliver,
                attachments: wireAttachments
            )
            Self.logger.info("Send success, idempotencyKey: \(key)")
            currentIdempotencyKey = key
            isSending = false
            
            // Update message status to sent
            if let idx = messages.lastIndex(where: { $0.id == userMessage.id }) {
                messages[idx].status = .sent
                sessionMessages[session.id] = messages
            }

            // Dual-channel: mirror to Telegram in synced mode
            if session.mode == .synced, let sync = syncCoordinator {
                sync.registerOutgoing(sender: "user", content: trimmed, timestamp: Date())
                sync.sendViaTelegram(trimmed, gatewayKey: key)
            }
        } catch {
            Self.logger.error("Send failed: \(error.localizedDescription)")
            isSending = false
            botState = .idle
            handleError(error, context: "send message")

            // Mark user message as failed
            if let idx = messages.lastIndex(where: { $0.id == userMessage.id }) {
                messages[idx].status = .failed
                sessionMessages[session.id] = messages
            }
        }
    }
    
    /// Call any gateway method and return the raw result.
    /// Used by History, Automations, and Debug pages.
    public func call(_ method: String, params: [String: Any] = [:]) async throws -> AnyCodable? {
        guard let client = client else { throw OpenClawError.notConnected }
        let anyCodable = params.isEmpty ? nil : AnyCodable(params)
        return try await client.request(method, params: anyCodable)
    }

    /// Ping latency from the underlying WebSocket client (ping/pong).
    public var pingLatencyMs: Double? { client?.latencyMs }

    /// Whether the client is connected and ready for method calls.
    public var isGatewayReady: Bool {
        client != nil && connectionState == .connected
    }

    /// Abort the current generation.
    public func abort() async {
        guard let client = client, let session = activeSession else { return }
        do {
            try await client.chatAbort(sessionKey: session.sessionKey)
        } catch {
            errorMessage = "Abort failed: \(error.localizedDescription)"
        }
    }

    /// Send a reaction command to the bot.
    /// Note: Visual toggle of ReactionStore is handled at the UI layer (ReactionBar / ReactiveMessageWrapper).
    /// This method only sends the command text to the gateway.
    public func sendReaction(_ action: ReactionAction, for messageId: String) async {
        await send(action.commandText)
    }

    // MARK: - Telegram Incoming (Stub)

    /// Placeholder for incoming Telegram messages. Will be implemented when TDLibKit is integrated.
    /// For now, messages only flow through the OpenClaw gateway WebSocket.

    // MARK: - Helpers

    func extractMessageText(_ value: Any) -> String {
        if let text = value as? String {
            return text
        }
        if let blocks = value as? [[String: Any]] {
            return blocks.compactMap { block -> String? in
                if block["type"] as? String == "text" {
                    return block["text"] as? String
                }
                return nil
            }.joined()
        }
        return ""
    }

    // MARK: - Error Recovery
    
    func handleError(_ error: Error, context: String) {
        if let ocError = error as? OpenClawError {
            errorMessage = ocError.errorDescription
            if !ocError.isTransient {
                Self.logger.error("Permanent error in \(context): \(ocError.localizedDescription)")
                // Don't auto-retry permanent errors
                return
            }
        } else {
            errorMessage = "\(context) failed: \(error.localizedDescription)"
        }
        Self.logger.error("Transient error in \(context): \(error.localizedDescription)")
        errorCount += 1
        updateHealth()
        ActivityFeedManager.shared.addEvent(
            botName: botConfig.name,
            botEmoji: botConfig.emoji,
            message: "error: \(context)",
            kind: .error
        )
    }
    
    // MARK: - Helpers
    
    // MARK: - Persistence Helpers

    func schedulePersist() {
        let msgs = messages
        let botId = botConfig.id
        Task { await MessageStore.shared.saveMessages(msgs, botId: botId) }
    }

    func persistStats() {
        MessageStatsManager.save(messageStats, botId: botConfig.id)
    }

    // MARK: - Uptime & Health

    /// Current uptime including active session.
    public var currentUptimeSeconds: TimeInterval {
        var total = totalUptimeSeconds
        if let since = connectedSince {
            total += Date().timeIntervalSince(since)
        }
        return total
    }

    /// Formatted uptime string (e.g. "2h 34m").
    public var formattedUptime: String {
        UptimeFormatter.format(currentUptimeSeconds)
    }

    /// Last message preview text for dashboard display.
    public var lastMessagePreview: String? {
        messages.last?.content.prefix(80).description
    }

    /// Total message count.
    public var totalMessageCount: Int {
        messageStats.totalSent + messageStats.totalReceived
    }

    private func updateHealth() {
        health = BotHealth(
            reconnectCount: reconnectCount,
            errorCount: errorCount,
            averageLatency: messageStats.averageResponseTime,
            uptimeSeconds: currentUptimeSeconds
        )
    }

    func resetStreamState() {
        botState = .idle
        streamingContent = ""
        activeRunId = nil
        currentIdempotencyKey = nil
        // Keep last few agent events for fade-out, clear after delay
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000) // 3s
            if botState == .idle {
                agentEvents.removeAll()
            }
        }
    }

    // MARK: - Reconnect Countdown

    /// Start a countdown from `seconds` that ticks every second, updating `reconnectCountdown`.
    private func startReconnectCountdown(seconds: Int) {
        stopReconnectCountdown()
        reconnectCountdown = seconds
        reconnectCountdownTask = Task { [weak self] in
            for remaining in stride(from: seconds, through: 1, by: -1) {
                guard !Task.isCancelled else { return }
                self?.reconnectCountdown = remaining
                try? await Task.sleep(nanoseconds: 1_000_000_000)
            }
            if !Task.isCancelled {
                self?.reconnectCountdown = nil
            }
        }
    }

    /// Cancel any active countdown timer.
    private func stopReconnectCountdown() {
        reconnectCountdownTask?.cancel()
        reconnectCountdownTask = nil
        reconnectCountdown = nil
    }

    /// Retry sending a specific failed message by content. Marks the original as pending and re-sends.
    public func retrySend(_ message: ChatMessage) async {
        // Mark the failed message as pending
        if let idx = messages.lastIndex(where: { $0.id == message.id }) {
            messages[idx].status = .pending
            if let session = activeSession {
                sessionMessages[session.id] = messages
            }
        }
        // Re-send the message content
        await send(message.content, attachments: message.attachments)
    }
}
