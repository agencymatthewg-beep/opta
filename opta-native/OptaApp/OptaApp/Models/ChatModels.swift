//
//  ChatModels.swift
//  OptaApp
//
//  AI Chat message types and view model for the chat interface.
//  Uses @Observable pattern (Swift-side, not Crux) since LLM interactions
//  are platform-specific (MLX local / network cloud).
//

import Foundation

// MARK: - Message Role

/// Role of a chat message participant
enum MessageRole: String, Codable {
    case user = "user"
    case assistant = "assistant"
    case system = "system"
}

// MARK: - Message Metadata

/// Optional metadata attached to assistant responses
struct MessageMetadata: Codable {
    /// Model that generated the response (e.g. "local-mlx" or "claude-sonnet")
    var model: String

    /// Number of tokens used in generation
    var tokensUsed: Int?

    /// Response latency in milliseconds
    var latencyMs: Int?

    /// Whether the request was routed to local model
    var routedLocally: Bool
}

// MARK: - Chat Message

/// A single message in the conversation
struct ChatMessage: Identifiable, Codable {
    /// Unique message identifier
    var id: UUID

    /// Role of the message sender
    var role: MessageRole

    /// Message text content
    var content: String

    /// When the message was created
    var timestamp: Date

    /// Whether the response is still being streamed
    var isStreaming: Bool

    /// Optional generation metadata (model, tokens, latency)
    var metadata: MessageMetadata?

    /// Create a user message
    static func user(_ content: String) -> ChatMessage {
        ChatMessage(
            id: UUID(),
            role: .user,
            content: content,
            timestamp: Date(),
            isStreaming: false,
            metadata: nil
        )
    }

    /// Create an assistant message (optionally streaming)
    static func assistant(_ content: String, streaming: Bool = false) -> ChatMessage {
        ChatMessage(
            id: UUID(),
            role: .assistant,
            content: content,
            timestamp: Date(),
            isStreaming: streaming,
            metadata: nil
        )
    }

    /// Create a system message
    static func system(_ content: String) -> ChatMessage {
        ChatMessage(
            id: UUID(),
            role: .system,
            content: content,
            timestamp: Date(),
            isStreaming: false,
            metadata: nil
        )
    }
}

// MARK: - LLM Model Selection

/// Available LLM routing options
enum LLMModel: String, CaseIterable, Codable {
    case auto = "auto"
    case local = "local"
    case cloud = "cloud"

    /// Display name for the model option
    var displayName: String {
        switch self {
        case .auto: return "Auto"
        case .local: return "Local"
        case .cloud: return "Cloud"
        }
    }

    /// SF Symbol icon for the model option
    var icon: String {
        switch self {
        case .auto: return "sparkles"
        case .local: return "cpu"
        case .cloud: return "cloud"
        }
    }

    /// Description of the routing behavior
    var subtitle: String {
        switch self {
        case .auto: return "Smart routing"
        case .local: return "On-device MLX"
        case .cloud: return "Claude API"
        }
    }
}

// MARK: - Chat View Model

/// Observable view model managing AI Chat conversation state.
///
/// This is a Swift-side ViewModel (not Crux-managed) because LLM interactions
/// are platform-specific. The chat state persists for the app session and
/// can be extended to support persistence in future phases.
///
/// Integrates with ChatService for real LLM routing and streaming.
@Observable
final class ChatViewModel {

    // MARK: - Properties

    /// All messages in the current conversation
    var messages: [ChatMessage] = []

    /// Current text in the input field
    var inputText: String = ""

    /// Whether a response is currently being generated
    var isGenerating: Bool = false

    /// Text being streamed for the current response
    var streamingText: String = ""

    /// Selected LLM model for routing
    var selectedModel: LLMModel = .auto

    /// Telemetry data for system context (set by view on appear)
    var telemetry: OptaViewModel?

    /// Chat service for LLM orchestration
    @ObservationIgnored private let chatService = ChatService.shared

    // MARK: - Methods

    /// Send the current input as a user message and trigger LLM generation.
    ///
    /// Routes through ChatService which handles SemanticRouter dispatch
    /// and streaming response assembly.
    func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isGenerating else { return }

        let systemContext = chatService.buildSystemPrompt(telemetry: telemetry)

        Task { @MainActor in
            await chatService.sendMessage(text, in: self, systemContext: systemContext)
        }
    }

    /// Cancel the current generation
    func cancelGeneration() {
        Task { @MainActor in
            chatService.cancelGeneration(in: self)
        }
    }

    /// Clear all messages and reset conversation
    func clearConversation() {
        messages = []
        streamingText = ""
        isGenerating = false
        inputText = ""
    }
}
