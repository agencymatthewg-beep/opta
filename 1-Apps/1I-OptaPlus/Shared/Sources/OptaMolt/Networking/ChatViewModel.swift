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
    
    public var wsURL: URL? {
        URL(string: "ws://\(host):\(port)")
    }
    
    public init(
        id: String = UUID().uuidString,
        name: String,
        host: String = "127.0.0.1",
        port: Int,
        token: String,
        emoji: String = "🤖",
        sessionKey: String = "main"
    ) {
        self.id = id
        self.name = name
        self.host = host
        self.port = port
        self.token = token
        self.emoji = emoji
        self.sessions = [ChatSession.defaultSynced(botName: name)]
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
    
    // MARK: - Configuration
    
    /// The bot configuration.
    public let botConfig: BotConfig
    
    // MARK: - Sync

    /// Sync coordinator for dual-channel (gateway + Telegram) messaging.
    public var syncCoordinator: SyncCoordinator?


    // MARK: - Private

    private var client: OpenClawClient?
    private var currentIdempotencyKey: String?
    private var cancellables = Set<AnyCancellable>()

    /// Per-session message cache (sessionId → messages)
    private var sessionMessages: [String: [ChatMessage]] = [:]

    /// Per-session streaming state
    private var sessionStreamContent: [String: String] = [:]
    
    /// Offline message queue (FIFO, max 50)
    private var messageQueue: [(text: String, attachments: [ChatAttachment], messageId: String)] = []
    private static let maxQueueSize = 50
    
    /// UserDefaults key prefixes for session persistence
    private var sessionListKey: String { "optaplus.sessions.\(botConfig.id)" }
    private var activeSessionKey: String { "optaplus.activeSession.\(botConfig.id)" }

    // MARK: - Init

    public init(botConfig: BotConfig, syncCoordinator: SyncCoordinator? = nil) {
        self.botConfig = botConfig
        self.syncCoordinator = syncCoordinator
        
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
    }
    
    // MARK: - Connection
    
    /// Connect to the bot's gateway.
    public func connect() {
        guard let wsURL = botConfig.wsURL else {
            errorMessage = "Invalid WebSocket URL"
            return
        }
        
        // Tear down existing connection
        client?.disconnect()
        cancellables.removeAll()
        
        let newClient = OpenClawClient(
            url: wsURL,
            token: botConfig.token,
            clientId: "openclaw-control-ui",
            clientVersion: "0.1.0"
        )
        
        // Use Combine to observe client state changes directly
        newClient.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                NSLog("[OC-VM] State changed: \(state)")
                self?.connectionState = state
                if state == .connected {
                    self?.errorMessage = nil
                    self?.flushMessageQueue()
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
        client?.disconnect()
        client = nil
        connectionState = .disconnected
    }
    
    // MARK: - Session Management
    
    /// Switch to a different session.
    public func switchSession(_ session: ChatSession) {
        // Save current session's messages
        if let current = activeSession {
            sessionMessages[current.id] = messages
            sessionStreamContent[current.id] = streamingContent
        }
        
        activeSession = session
        UserDefaults.standard.set(session.id, forKey: activeSessionKey)
        
        // Restore cached messages or load fresh
        if let cached = sessionMessages[session.id] {
            messages = cached
            streamingContent = sessionStreamContent[session.id] ?? ""
        } else {
            messages = []
            streamingContent = ""
            Task { await loadHistory() }
        }
        
        // Reset bot state for new session view
        if sessionStreamContent[session.id]?.isEmpty ?? true {
            botState = .idle
        }
    }
    
    /// Create a new session.
    public func createSession(name: String, mode: SessionMode) -> ChatSession {
        let sessionKey: String
        switch mode {
        case .synced:
            sessionKey = "main"
        case .direct:
            sessionKey = "main"
        case .isolated:
            sessionKey = "optaplus-\(UUID().uuidString.prefix(8).lowercased())"
        }
        
        let session = ChatSession(
            name: name,
            sessionKey: sessionKey,
            mode: mode
        )
        sessions.append(session)
        persistSessions()
        return session
    }
    
    /// Delete a session (cannot delete the last session).
    public func deleteSession(_ session: ChatSession) {
        guard sessions.count > 1 else { return }
        sessions.removeAll { $0.id == session.id }
        sessionMessages.removeValue(forKey: session.id)
        sessionStreamContent.removeValue(forKey: session.id)
        persistSessions()
        
        // If deleted the active session, switch to first
        if activeSession?.id == session.id {
            if let first = sessions.first {
                switchSession(first)
            }
        }
    }
    
    /// Rename a session.
    public func renameSession(_ session: ChatSession, to name: String) {
        if let idx = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[idx].name = name
            if activeSession?.id == session.id {
                activeSession = sessions[idx]
            }
            persistSessions()
        }
    }
    
    /// Toggle pin state.
    public func togglePin(_ session: ChatSession) {
        if let idx = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[idx].isPinned.toggle()
            if activeSession?.id == session.id {
                activeSession = sessions[idx]
            }
            persistSessions()
        }
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
            
            NSLog("[OC-VM] History loaded: \(history.messages.count) messages (earlier=\(earlier))")
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
            NSLog("[OC-VM] Messages set: \(self.messages.count) total")
        } catch {
            NSLog("[OC-VM] History load FAILED: \(error)")
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

        let displayText = trimmed.isEmpty && !attachments.isEmpty
            ? "[\(attachments.count) file\(attachments.count == 1 ? "" : "s")]"
            : trimmed

        NSLog("[OC-VM] Sending message: '\(displayText.prefix(50))' with \(attachments.count) attachments to session '\(session.sessionKey)' mode=\(session.mode.rawValue) deliver=\(session.mode.shouldDeliver)")

        // Add user message immediately
        let userMessage = ChatMessage(
            content: displayText,
            sender: .user,
            status: connectionState == .connected ? .sent : .pending,
            source: .optaplus,
            attachments: attachments
        )
        messages.append(userMessage)
        sessionMessages[session.id] = messages
        NSLog("[OC-VM] User message appended, total messages: \(messages.count)")

        // If disconnected, queue for later
        guard let client = client, connectionState == .connected else {
            enqueueMessage(text: trimmed, attachments: attachments, messageId: userMessage.id)
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
                message: trimmed,
                deliver: session.mode.shouldDeliver,
                attachments: wireAttachments
            )
            NSLog("[OC-VM] Send success, idempotencyKey: \(key)")
            currentIdempotencyKey = key
            isSending = false
            
            // Update message status to sent
            if let idx = messages.lastIndex(where: { $0.id == userMessage.id }) {
                messages[idx] = ChatMessage(
                    id: userMessage.id,
                    content: userMessage.content,
                    sender: .user,
                    timestamp: userMessage.timestamp,
                    status: .sent,
                    source: .optaplus,
                    attachments: attachments
                )
                sessionMessages[session.id] = messages
            }

            // Dual-channel: mirror to Telegram in synced mode
            if session.mode == .synced, let sync = syncCoordinator {
                sync.registerOutgoing(sender: "user", content: trimmed, timestamp: Date())
                sync.sendViaTelegram(trimmed, gatewayKey: key)
            }
        } catch {
            NSLog("[OC-VM] Send FAILED: \(error)")
            isSending = false
            botState = .idle
            handleError(error, context: "send message")

            // Mark user message as failed
            if let idx = messages.lastIndex(where: { $0.id == userMessage.id }) {
                messages[idx] = ChatMessage(
                    id: userMessage.id,
                    content: userMessage.content,
                    sender: .user,
                    timestamp: userMessage.timestamp,
                    status: .failed,
                    source: .optaplus,
                    attachments: attachments
                )
                sessionMessages[session.id] = messages
            }
        }
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
    
    // MARK: - Telegram Incoming (Stub)

    /// Placeholder for incoming Telegram messages. Will be implemented when TDLibKit is integrated.
    /// For now, messages only flow through the OpenClaw gateway WebSocket.

    // MARK: - Event Handling

    private func handleEvent(_ event: EventFrame) {
        NSLog("[OC-VM] Event received: '\(event.event)' payload keys: \(event.payload?.dict?.keys.sorted().joined(separator: ",") ?? "nil")")
        switch event.event {
        case "chat":
            handleChatEvent(event.payload)
        case "agent":
            handleAgentEvent(event.payload)
        default:
            break
        }
    }
    
    private func handleChatEvent(_ payload: AnyCodable?) {
        guard let dict = payload?.dict else { NSLog("[OC-VM] Chat event: no dict payload"); return }
        
        // Check if this event belongs to the active session
        // Gateway uses qualified keys like "agent:main:main" while we store "main"
        let eventSessionKey = dict["sessionKey"] as? String
        NSLog("[OC-VM] Chat event: sessionKey=\(eventSessionKey ?? "nil") state=\(dict["state"] as? String ?? "nil") activeSession=\(activeSession?.sessionKey ?? "nil")")
        if let eventSessionKey = eventSessionKey,
           let session = activeSession {
            let matches = eventSessionKey == session.sessionKey
                || eventSessionKey.hasSuffix(":\(session.sessionKey)")
                || session.sessionKey.hasSuffix(":\(eventSessionKey)")
            if !matches {
                NSLog("[OC-VM] Chat event for different session (\(eventSessionKey) vs \(session.sessionKey)), ignoring")
                return
            }
        }
        
        let stateStr = dict["state"] as? String ?? ""
        
        switch stateStr {
        case "delta":
            botState = .typing
            
            // Extract accumulated message text
            // The "message" field is an object with {role, content, timestamp}
            // Content can be a string or array of blocks [{type:"text", text:"..."}]
            if let message = dict["message"] {
                let text: String
                if let msgDict = message as? [String: Any], let content = msgDict["content"] {
                    text = extractMessageText(content)
                } else {
                    text = extractMessageText(message)
                }
                NSLog("[OC-VM] Delta: \(text.count) chars (was \(streamingContent.count))")
                if text.count >= streamingContent.count {
                    streamingContent = text
                }
            } else {
                NSLog("[OC-VM] Delta: no 'message' key in payload. Keys: \(dict.keys.sorted())")
            }
            
            // Track run ID
            if let runId = dict["runId"] as? String {
                activeRunId = runId
            }
            
        case "final":
            // Finalize the streaming message
            let finalText: String
            if let message = dict["message"] {
                if let msgDict = message as? [String: Any], let content = msgDict["content"] {
                    finalText = extractMessageText(content)
                } else {
                    finalText = extractMessageText(message)
                }
            } else {
                finalText = streamingContent
            }
            
            NSLog("[OC-VM] Final: \(finalText.count) chars, appending bot message")
            
            if !finalText.isEmpty {
                let botMessage = ChatMessage(
                    content: finalText,
                    sender: .bot(name: botConfig.name),
                    status: .delivered
                )
                messages.append(botMessage)
                if let session = activeSession {
                    sessionMessages[session.id] = messages
                }
            }
            
            resetStreamState()
            
        case "aborted":
            if !streamingContent.isEmpty {
                let partialMessage = ChatMessage(
                    content: streamingContent + "\n\n_(aborted)_",
                    sender: .bot(name: botConfig.name),
                    status: .delivered
                )
                messages.append(partialMessage)
                if let session = activeSession {
                    sessionMessages[session.id] = messages
                }
            }
            resetStreamState()
            
        case "error":
            let errorMsg = dict["errorMessage"] as? String ?? "Chat error"
            errorMessage = errorMsg
            resetStreamState()
            
        default:
            break
        }
    }
    
    private func handleAgentEvent(_ payload: AnyCodable?) {
        guard let dict = payload?.dict else { return }
        
        // Old-style agent state events
        if let state = dict["state"] as? String {
            switch state {
            case "thinking":
                botState = .thinking
            case "responding":
                botState = .typing
            case "idle":
                if activeRunId == nil {
                    botState = .idle
                }
            default:
                break
            }
            return
        }
        
        // New-style agent stream events
        let stream = dict["stream"] as? String ?? "unknown"
        let data = dict["data"] as? [String: Any] ?? [:]
        
        let event = AgentStreamEvent(
            stream: stream,
            phase: data["phase"] as? String,
            text: data["text"] as? String,
            delta: data["delta"] as? String,
            toolName: data["name"] as? String ?? data["toolName"] as? String
        )
        
        // Only keep last 20 events to prevent memory bloat
        if agentEvents.count > 20 {
            agentEvents.removeFirst(agentEvents.count - 15)
        }
        agentEvents.append(event)
        
        // Update bot state from lifecycle
        if stream == "lifecycle" {
            if let phase = data["phase"] as? String {
                switch phase {
                case "start":
                    botState = .thinking
                    activeRunId = dict["runId"] as? String
                case "end":
                    // Don't reset to idle here — wait for chat final event
                    break
                default:
                    break
                }
            }
        }
        
        // Update bot state from assistant stream (means it's typing)
        if stream == "assistant" && data["delta"] != nil {
            botState = .typing
        }
        
        // Track tool calls
        if stream == "tool_call" || stream == "tool" {
            botState = .thinking
        }
    }
    
    // MARK: - Helpers
    
    private func extractMessageText(_ value: Any) -> String {
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
    
    // MARK: - Message Queue (Offline Support)
    
    private func enqueueMessage(text: String, attachments: [ChatAttachment], messageId: String) {
        if messageQueue.count >= Self.maxQueueSize {
            messageQueue.removeFirst()
        }
        messageQueue.append((text: text, attachments: attachments, messageId: messageId))
        queuedMessageCount = messageQueue.count
        NSLog("[OC-VM] Message queued (\(messageQueue.count) in queue)")
    }
    
    private func flushMessageQueue() {
        guard !messageQueue.isEmpty, let client = client, let session = activeSession else { return }
        let queue = messageQueue
        messageQueue.removeAll()
        queuedMessageCount = 0
        
        NSLog("[OC-VM] Flushing \(queue.count) queued messages")
        Task {
            for item in queue {
                let wireAttachments: [ChatSendAttachment]? = item.attachments.isEmpty
                    ? nil
                    : item.attachments.compactMap { ChatSendAttachment(from: $0) }
                do {
                    _ = try await client.chatSend(
                        sessionKey: session.sessionKey,
                        message: item.text,
                        deliver: session.mode.shouldDeliver,
                        attachments: wireAttachments
                    )
                    // Update status from pending to sent
                    if let idx = messages.lastIndex(where: { $0.id == item.messageId }) {
                        let msg = messages[idx]
                        messages[idx] = ChatMessage(
                            id: msg.id, content: msg.content, sender: msg.sender,
                            timestamp: msg.timestamp, status: .sent,
                            source: msg.source, attachments: msg.attachments
                        )
                    }
                } catch {
                    NSLog("[OC-VM] Queued message send failed: \(error)")
                    if let idx = messages.lastIndex(where: { $0.id == item.messageId }) {
                        let msg = messages[idx]
                        messages[idx] = ChatMessage(
                            id: msg.id, content: msg.content, sender: msg.sender,
                            timestamp: msg.timestamp, status: .failed,
                            source: msg.source, attachments: msg.attachments
                        )
                    }
                }
            }
            if let session = activeSession {
                sessionMessages[session.id] = messages
            }
        }
    }
    
    // MARK: - Session Persistence
    
    private func persistSessions() {
        if let data = try? JSONEncoder().encode(sessions) {
            UserDefaults.standard.set(data, forKey: sessionListKey)
        }
        if let activeId = activeSession?.id {
            UserDefaults.standard.set(activeId, forKey: activeSessionKey)
        }
    }
    
    // MARK: - Error Recovery
    
    private func handleError(_ error: Error, context: String) {
        if let ocError = error as? OpenClawError {
            errorMessage = ocError.errorDescription
            if !ocError.isTransient {
                NSLog("[OC-VM] Permanent error in \(context): \(ocError)")
                // Don't auto-retry permanent errors
                return
            }
        } else {
            errorMessage = "\(context) failed: \(error.localizedDescription)"
        }
        NSLog("[OC-VM] Transient error in \(context): \(error)")
    }
    
    // MARK: - Helpers
    
    private func resetStreamState() {
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
}
