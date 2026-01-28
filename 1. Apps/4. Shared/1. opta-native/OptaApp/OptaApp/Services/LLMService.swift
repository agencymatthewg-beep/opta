//
//  LLMService.swift
//  OptaApp
//
//  Protocol for LLM text generation services and shared error types.
//  Enables pluggable local (MLX) and cloud (Claude API) implementations
//  behind a unified streaming interface.
//

import Foundation

// MARK: - LLM Service Protocol

/// Protocol for LLM text generation services.
///
/// Both local (MLX) and cloud (Claude API) services conform to this protocol,
/// enabling the SemanticRouter to dispatch queries transparently.
///
/// Streaming is implemented via AsyncThrowingStream for back-pressure aware
/// character-by-character token delivery.
protocol LLMServiceProtocol {
    /// Generate a streaming response for the given messages.
    ///
    /// - Parameters:
    ///   - messages: Conversation history as ChatMessage array
    ///   - systemPrompt: System instruction for the model
    /// - Returns: Async stream yielding text tokens as they are generated
    func generateStream(
        messages: [ChatMessage],
        systemPrompt: String
    ) -> AsyncThrowingStream<String, Error>

    /// Check if the service is available (model loaded / API reachable)
    var isAvailable: Bool { get async }

    /// Display name for the service
    var modelName: String { get }

    /// Cancel any in-progress generation
    func cancel()
}

// MARK: - LLM Errors

/// Errors specific to LLM operations
enum LLMError: Error, LocalizedError {
    /// Local model has not been loaded into memory
    case modelNotLoaded

    /// API key is missing or invalid
    case apiKeyMissing

    /// Network is unavailable for cloud requests
    case networkUnavailable

    /// Rate limited by the API provider
    case rateLimited(retryAfter: TimeInterval)

    /// Generation was cancelled by the user
    case generationCancelled

    /// Invalid or unparseable response from the service
    case invalidResponse(String)

    /// Input context exceeds model's maximum token limit
    case contextTooLong(maxTokens: Int)

    var errorDescription: String? {
        switch self {
        case .modelNotLoaded:
            return "Local model is not loaded. Please download or load a model first."
        case .apiKeyMissing:
            return "API key is missing. Please configure your Claude API key in settings."
        case .networkUnavailable:
            return "Network is unavailable. Check your internet connection."
        case .rateLimited(let retryAfter):
            return "Rate limited. Please retry after \(Int(retryAfter)) seconds."
        case .generationCancelled:
            return "Generation was cancelled."
        case .invalidResponse(let detail):
            return "Invalid response: \(detail)"
        case .contextTooLong(let maxTokens):
            return "Context too long. Maximum is \(maxTokens) tokens."
        }
    }
}
