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

    /// System prompt context for the conversation
    var conversationContext: String = "You are Opta, an AI assistant specialized in system optimization. You help users understand and improve their Mac's performance, manage processes, optimize games, and maintain system health."

    // MARK: - Methods

    /// Send the current input as a user message and trigger generation
    func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isGenerating else { return }

        // Add user message
        let userMessage = ChatMessage.user(text)
        messages.append(userMessage)
        inputText = ""

        // Start generation
        isGenerating = true
        streamingText = ""

        // Create placeholder streaming assistant message
        let assistantMessage = ChatMessage.assistant("", streaming: true)
        messages.append(assistantMessage)

        // Simulate a response (placeholder until LLM integration in future phase)
        simulateResponse(for: text, messageId: assistantMessage.id)
    }

    /// Cancel the current generation
    func cancelGeneration() {
        guard isGenerating else { return }
        isGenerating = false

        // Finalize the streaming message with current text
        if let lastIndex = messages.indices.last,
           messages[lastIndex].isStreaming {
            messages[lastIndex].isStreaming = false
            if messages[lastIndex].content.isEmpty {
                messages[lastIndex].content = "[Generation cancelled]"
            }
        }
        streamingText = ""
    }

    /// Clear all messages and reset conversation
    func clearConversation() {
        messages = []
        streamingText = ""
        isGenerating = false
        inputText = ""
    }

    /// Update the system context prompt
    func addSystemContext(_ context: String) {
        conversationContext = context
    }

    // MARK: - Private

    /// Simulate a streaming response (placeholder for real LLM integration)
    private func simulateResponse(for query: String, messageId: UUID) {
        let response = generatePlaceholderResponse(for: query)
        let characters = Array(response)
        var currentIndex = 0

        // Stream characters with delay
        Timer.scheduledTimer(withTimeInterval: 0.02, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }

            guard self.isGenerating, currentIndex < characters.count else {
                timer.invalidate()
                self.finalizeResponse(messageId: messageId, model: self.selectedModel)
                return
            }

            currentIndex += 1
            let text = String(characters.prefix(currentIndex))
            self.streamingText = text

            if let index = self.messages.firstIndex(where: { $0.id == messageId }) {
                self.messages[index].content = text
            }
        }
    }

    /// Finalize a streaming response
    private func finalizeResponse(messageId: UUID, model: LLMModel) {
        isGenerating = false

        if let index = messages.firstIndex(where: { $0.id == messageId }) {
            messages[index].isStreaming = false
            messages[index].metadata = MessageMetadata(
                model: model == .local ? "local-mlx" : "claude-sonnet",
                tokensUsed: Int.random(in: 50...200),
                latencyMs: Int.random(in: 200...1500),
                routedLocally: model == .local || (model == .auto && Bool.random())
            )
        }
        streamingText = ""
    }

    /// Generate a placeholder response based on the query
    private func generatePlaceholderResponse(for query: String) -> String {
        let lowered = query.lowercased()

        if lowered.contains("cpu") || lowered.contains("processor") {
            return "Your CPU usage is currently within normal range. I can see a few background processes consuming more resources than expected. Would you like me to identify the top consumers and suggest optimizations?"
        } else if lowered.contains("memory") || lowered.contains("ram") {
            return "Looking at your memory usage, you have several applications holding onto cached memory that could be freed. The largest consumers are browser tabs and background services. I can help you reclaim some of that memory if you'd like."
        } else if lowered.contains("fan") || lowered.contains("noise") || lowered.contains("thermal") || lowered.contains("heat") {
            return "Your thermal state is currently nominal. To reduce fan noise, I can suggest reducing background workload, adjusting quality settings for resource-intensive apps, or enabling the low-power optimization profile."
        } else if lowered.contains("game") || lowered.contains("fps") || lowered.contains("performance") {
            return "For gaming performance, I recommend closing unnecessary background processes, ensuring your power settings are optimized for high performance, and checking that your GPU drivers are up to date. Would you like me to run a quick optimization pass?"
        } else if lowered.contains("optimize") || lowered.contains("speed") || lowered.contains("faster") {
            return "I can help optimize your system! Here's what I'd suggest:\n\n1. Close unused background processes\n2. Free up cached memory\n3. Adjust energy settings for performance\n4. Check for thermal throttling\n\nWould you like me to proceed with any of these?"
        } else {
            return "I can help you with system optimization, process management, game performance tuning, and thermal management. What specific aspect of your Mac's performance would you like to improve?"
        }
    }
}
