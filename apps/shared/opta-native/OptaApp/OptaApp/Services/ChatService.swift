//
//  ChatService.swift
//  OptaApp
//
//  Orchestrates AI chat conversations by routing messages through
//  SemanticRouter to the appropriate LLM service (local or cloud).
//  Manages streaming responses and system context assembly.
//

import Foundation

// MARK: - ChatService

/// Central orchestration layer for AI chat conversations.
///
/// Coordinates between SemanticRouter, CloudLLMService, and LocalLLMService
/// to deliver streaming responses into ChatViewModel.
///
/// Responsibilities:
/// - Assemble system prompts with current telemetry context
/// - Route queries via SemanticRouter
/// - Stream responses into ChatViewModel messages
/// - Handle cancellation and error states
///
/// Usage:
/// ```swift
/// await ChatService.shared.sendMessage(
///     "Optimize my CPU",
///     in: viewModel,
///     systemContext: buildSystemPrompt()
/// )
/// ```
@Observable
final class ChatService {

    // MARK: - Singleton

    /// Shared instance for app-wide access
    static let shared = ChatService()

    // MARK: - Dependencies

    /// Semantic router for query classification
    private let router = SemanticRouter.shared

    /// Cloud LLM service (Claude API)
    private let cloudService = CloudLLMService.shared

    /// Local LLM service (MLX)
    private let localService = LocalLLMService.shared

    // MARK: - State

    /// Current generation task (for cancellation)
    private var currentGenerationTask: Task<Void, Never>?

    /// Whether a generation is in progress
    private(set) var isProcessing: Bool = false

    // MARK: - Core Method

    /// Send a message and stream the response into the view model.
    ///
    /// This is the main entry point for the chat pipeline:
    /// 1. Creates user message
    /// 2. Routes via SemanticRouter
    /// 3. Streams response from appropriate service
    /// 4. Updates view model in real-time
    ///
    /// - Parameters:
    ///   - text: User's message text
    ///   - viewModel: ChatViewModel to update
    ///   - systemContext: System prompt with telemetry data
    @MainActor
    func sendMessage(
        _ text: String,
        in viewModel: ChatViewModel,
        systemContext: String
    ) async {
        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty, !isProcessing else { return }

        // Add user message
        let userMessage = ChatMessage.user(trimmedText)
        viewModel.messages.append(userMessage)
        viewModel.inputText = ""

        // Determine routing
        let context = RouterContext(
            networkAvailable: true, // TODO: Use NWPathMonitor for real check
            localModelLoaded: await localService.isAvailable,
            thermalState: .nominal, // TODO: Read from ThermalStateManager
            batteryLevel: nil,
            userPreference: viewModel.selectedModel
        )
        let route = router.route(query: trimmedText, context: context)

        // Select service
        let service: LLMServiceProtocol = (route == .local) ? localService : cloudService

        // Create streaming assistant message
        let assistantMessage = ChatMessage.assistant("", streaming: true)
        viewModel.messages.append(assistantMessage)
        let messageId = assistantMessage.id

        // Start generation
        isProcessing = true
        viewModel.isGenerating = true
        viewModel.streamingText = ""
        let startTime = Date()

        currentGenerationTask = Task {
            var fullText = ""

            do {
                let stream = service.generateStream(
                    messages: viewModel.messages.filter { $0.role != .system && $0.id != messageId },
                    systemPrompt: systemContext
                )

                for try await token in stream {
                    if Task.isCancelled { break }

                    fullText += token
                    viewModel.streamingText = fullText

                    // Update message content
                    if let index = viewModel.messages.firstIndex(where: { $0.id == messageId }) {
                        viewModel.messages[index].content = fullText
                    }
                }

                // Finalize message
                finalizeMessage(
                    id: messageId,
                    in: viewModel,
                    model: route,
                    startTime: startTime,
                    routedLocally: route == .local
                )
            } catch let error as LLMError {
                handleError(error, messageId: messageId, in: viewModel)
            } catch {
                handleError(
                    LLMError.invalidResponse(error.localizedDescription),
                    messageId: messageId,
                    in: viewModel
                )
            }

            isProcessing = false
            viewModel.isGenerating = false
            viewModel.streamingText = ""
        }
    }

    /// Cancel any in-progress generation.
    ///
    /// Cancels the generation task and underlying service,
    /// marks the current streaming message as cancelled.
    @MainActor
    func cancelGeneration(in viewModel: ChatViewModel) {
        currentGenerationTask?.cancel()
        currentGenerationTask = nil

        cloudService.cancel()
        localService.cancel()

        // Mark last streaming message as cancelled
        if let lastIndex = viewModel.messages.indices.last,
           viewModel.messages[lastIndex].isStreaming {
            viewModel.messages[lastIndex].isStreaming = false
            if viewModel.messages[lastIndex].content.isEmpty {
                viewModel.messages[lastIndex].content = "[Generation cancelled]"
            }
        }

        isProcessing = false
        viewModel.isGenerating = false
        viewModel.streamingText = ""
        print("[ChatService] Generation cancelled")
    }

    // MARK: - System Prompt Builder

    /// Build a system prompt including current telemetry data.
    ///
    /// - Parameter telemetry: Current OptaViewModel with system state
    /// - Returns: System prompt string with context
    func buildSystemPrompt(telemetry: OptaViewModel? = nil) -> String {
        var prompt = """
        You are Opta, a system optimization AI assistant built into a native macOS application.
        You help users understand and improve their Mac's performance through intelligent analysis.

        Your capabilities:
        - Monitor CPU, memory, and GPU usage in real-time
        - Detect and manage resource-heavy processes
        - Provide optimization recommendations
        - Analyze game performance and suggest settings
        - Monitor thermal state and prevent throttling

        Personality: Concise, knowledgeable, proactive. You give actionable advice.
        Format: Use bullet points for recommendations. Keep responses focused and practical.
        """

        if let data = telemetry {
            prompt += "\n\nCurrent System State:"
            prompt += "\n- CPU Usage: \(Int(data.cpuUsage))%"
            prompt += "\n- Memory Usage: \(Int(data.memoryUsage))%"
            if let gpu = data.gpuUsage {
                prompt += "\n- GPU Usage: \(Int(gpu))%"
            }
            prompt += "\n- Thermal State: \(data.thermalState.rawValue)"
            prompt += "\n- Memory Pressure: \(data.memoryPressure.rawValue)"
        }

        return prompt
    }

    // MARK: - Private Helpers

    /// Finalize a completed message with metadata.
    @MainActor
    private func finalizeMessage(
        id: UUID,
        in viewModel: ChatViewModel,
        model: LLMModel,
        startTime: Date,
        routedLocally: Bool
    ) {
        guard let index = viewModel.messages.firstIndex(where: { $0.id == id }) else { return }

        let latencyMs = Int(Date().timeIntervalSince(startTime) * 1000)
        let tokenEstimate = viewModel.messages[index].content.split(separator: " ").count * 2

        viewModel.messages[index].isStreaming = false
        viewModel.messages[index].metadata = MessageMetadata(
            model: routedLocally ? "local-mlx" : "claude-sonnet",
            tokensUsed: tokenEstimate,
            latencyMs: latencyMs,
            routedLocally: routedLocally
        )
    }

    /// Handle LLM errors by updating the message with error text.
    @MainActor
    private func handleError(
        _ error: LLMError,
        messageId: UUID,
        in viewModel: ChatViewModel
    ) {
        guard let index = viewModel.messages.firstIndex(where: { $0.id == messageId }) else { return }

        let errorMessage: String
        switch error {
        case .apiKeyMissing:
            errorMessage = "Please configure your Claude API key in settings to use Cloud mode."
        case .networkUnavailable:
            errorMessage = "Network unavailable. Try switching to Local mode or check your connection."
        case .rateLimited(let retryAfter):
            errorMessage = "Rate limited. Please try again in \(Int(retryAfter)) seconds."
        case .generationCancelled:
            errorMessage = viewModel.messages[index].content.isEmpty
                ? "[Generation cancelled]"
                : viewModel.messages[index].content
        case .modelNotLoaded:
            errorMessage = "Local model not loaded. Please download the model first or switch to Cloud mode."
        default:
            errorMessage = "An error occurred: \(error.localizedDescription)"
        }

        viewModel.messages[index].content = errorMessage
        viewModel.messages[index].isStreaming = false
    }

    // MARK: - Initialization

    private init() {
        print("[ChatService] Initialized")
    }
}
