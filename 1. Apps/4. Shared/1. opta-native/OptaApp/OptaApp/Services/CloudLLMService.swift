//
//  CloudLLMService.swift
//  OptaApp
//
//  Cloud LLM service using Anthropic's Claude API with Server-Sent Events
//  streaming. Implements LLMServiceProtocol for transparent routing via
//  SemanticRouter.
//

import Foundation

// MARK: - CloudLLMService

/// Cloud LLM implementation using Anthropic Claude API.
///
/// Features:
/// - SSE streaming for real-time token delivery
/// - API key storage via UserDefaults (Keychain migration path noted)
/// - Automatic error handling (401, 429, network errors)
/// - Cancellation support via URLSession task management
///
/// Usage:
/// ```swift
/// let stream = CloudLLMService.shared.generateStream(
///     messages: conversation,
///     systemPrompt: "You are Opta..."
/// )
/// for try await token in stream {
///     print(token, terminator: "")
/// }
/// ```
@Observable
final class CloudLLMService: LLMServiceProtocol {

    // MARK: - Singleton

    /// Shared instance for app-wide access
    static let shared = CloudLLMService()

    // MARK: - Constants

    /// Anthropic Messages API endpoint
    private let apiEndpoint = "https://api.anthropic.com/v1/messages"

    /// Model to use for generation
    private let model = "claude-sonnet-4-20250514"

    /// Maximum tokens to generate
    private let maxTokens = 2048

    /// API version header value
    private let apiVersion = "2023-06-01"

    /// UserDefaults key for API key storage
    private static let apiKeyStorageKey = "com.opta.claude-api-key"

    // MARK: - State

    /// Current URLSession data task (for cancellation)
    private var currentTask: URLSessionDataTask?

    /// Whether generation is in progress
    private(set) var isGeneratingResponse: Bool = false

    /// Flag to signal cancellation to the stream
    private var isCancelled: Bool = false

    // MARK: - API Key Management

    /// Stored API key. Returns nil if not set.
    /// TODO: Migrate to Keychain for production security
    var apiKey: String? {
        UserDefaults.standard.string(forKey: Self.apiKeyStorageKey)
    }

    /// Store the API key in UserDefaults.
    /// - Parameter key: The Anthropic API key string
    func setApiKey(_ key: String) {
        UserDefaults.standard.set(key, forKey: Self.apiKeyStorageKey)
        print("[CloudLLMService] API key updated")
    }

    /// Remove the stored API key
    func clearApiKey() {
        UserDefaults.standard.removeObject(forKey: Self.apiKeyStorageKey)
        print("[CloudLLMService] API key cleared")
    }

    // MARK: - LLMServiceProtocol

    /// Display name for this service
    var modelName: String { "Claude Sonnet" }

    /// Whether the service is available (has API key)
    var isAvailable: Bool {
        get async {
            apiKey != nil && !apiKey!.isEmpty
        }
    }

    /// Generate a streaming response using Claude API with SSE.
    ///
    /// Builds a Messages API request, sends it with `stream: true`,
    /// and parses Server-Sent Events to yield text deltas.
    ///
    /// - Parameters:
    ///   - messages: Conversation history
    ///   - systemPrompt: System instruction
    /// - Returns: AsyncThrowingStream of text tokens
    func generateStream(
        messages: [ChatMessage],
        systemPrompt: String
    ) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task { [weak self] in
                guard let self = self else {
                    continuation.finish()
                    return
                }

                self.isCancelled = false
                self.isGeneratingResponse = true

                defer {
                    self.isGeneratingResponse = false
                }

                // Validate API key
                guard let key = self.apiKey, !key.isEmpty else {
                    continuation.finish(throwing: LLMError.apiKeyMissing)
                    return
                }

                // Build request
                let request: URLRequest
                do {
                    request = try self.buildRequest(messages: messages, systemPrompt: systemPrompt, apiKey: key)
                } catch {
                    continuation.finish(throwing: error)
                    return
                }

                // Execute streaming request
                do {
                    let (bytes, response) = try await URLSession.shared.bytes(for: request)

                    // Check HTTP status
                    if let httpResponse = response as? HTTPURLResponse {
                        switch httpResponse.statusCode {
                        case 200:
                            break // Success
                        case 401:
                            continuation.finish(throwing: LLMError.apiKeyMissing)
                            return
                        case 429:
                            let retryAfter = Double(httpResponse.value(forHTTPHeaderField: "retry-after") ?? "60") ?? 60
                            continuation.finish(throwing: LLMError.rateLimited(retryAfter: retryAfter))
                            return
                        default:
                            continuation.finish(throwing: LLMError.invalidResponse("HTTP \(httpResponse.statusCode)"))
                            return
                        }
                    }

                    // Parse SSE stream
                    var buffer = ""
                    for try await line in bytes.lines {
                        // Check cancellation
                        if self.isCancelled {
                            continuation.finish(throwing: LLMError.generationCancelled)
                            return
                        }

                        // SSE format: lines starting with "data: "
                        if line.hasPrefix("data: ") {
                            let data = String(line.dropFirst(6))

                            // Skip [DONE] signal
                            if data == "[DONE]" {
                                break
                            }

                            // Parse JSON event
                            if let text = self.parseSSEEvent(data) {
                                buffer += text
                                continuation.yield(text)
                            }
                        }
                    }

                    continuation.finish()
                } catch {
                    if self.isCancelled {
                        continuation.finish(throwing: LLMError.generationCancelled)
                    } else if (error as NSError).code == NSURLErrorNotConnectedToInternet ||
                              (error as NSError).code == NSURLErrorNetworkConnectionLost {
                        continuation.finish(throwing: LLMError.networkUnavailable)
                    } else {
                        continuation.finish(throwing: error)
                    }
                }
            }
        }
    }

    /// Cancel any in-progress generation
    func cancel() {
        isCancelled = true
        currentTask?.cancel()
        currentTask = nil
        isGeneratingResponse = false
        print("[CloudLLMService] Generation cancelled")
    }

    // MARK: - Private Helpers

    /// Build the URLRequest for the Claude Messages API.
    private func buildRequest(
        messages: [ChatMessage],
        systemPrompt: String,
        apiKey: String
    ) throws -> URLRequest {
        guard let url = URL(string: apiEndpoint) else {
            throw LLMError.invalidResponse("Invalid API endpoint URL")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue(apiVersion, forHTTPHeaderField: "anthropic-version")

        // Convert ChatMessages to API format
        let apiMessages = messages
            .filter { $0.role != .system }
            .map { message -> [String: String] in
                return [
                    "role": message.role.rawValue,
                    "content": message.content
                ]
            }

        // Build request body
        let body: [String: Any] = [
            "model": model,
            "max_tokens": maxTokens,
            "stream": true,
            "system": systemPrompt,
            "messages": apiMessages
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return request
    }

    /// Parse an SSE event JSON to extract text content.
    ///
    /// Handles `content_block_delta` events with `text_delta` type.
    private func parseSSEEvent(_ jsonString: String) -> String? {
        guard let data = jsonString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        // Handle content_block_delta events
        let eventType = json["type"] as? String
        if eventType == "content_block_delta" {
            if let delta = json["delta"] as? [String: Any],
               let deltaType = delta["type"] as? String,
               deltaType == "text_delta",
               let text = delta["text"] as? String {
                return text
            }
        }

        return nil
    }

    // MARK: - Initialization

    private init() {
        print("[CloudLLMService] Initialized (model: \(model))")
    }
}
