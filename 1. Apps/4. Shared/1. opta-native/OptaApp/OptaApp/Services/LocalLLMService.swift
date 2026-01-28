//
//  LocalLLMService.swift
//  OptaApp
//
//  Local LLM service for on-device inference using MLX Swift.
//  Structured for MLX integration with graceful fallback when model
//  is not downloaded. Reports isAvailable = false until model loaded.
//

import Foundation

// MARK: - LocalLLMService

/// Local on-device LLM service using MLX Swift framework.
///
/// Provides private, low-latency inference for simple queries.
/// Falls back gracefully when model is not downloaded or loaded.
///
/// Model storage: ~/Library/Application Support/OptaApp/Models/
///
/// TODO: MLX Integration
/// - Import MLX, MLXRandom, MLXLLM when package dependency added
/// - Replace mock generation with actual MLX pipeline
/// - Support model quantization levels (Q4, Q8)
///
/// Usage:
/// ```swift
/// if await LocalLLMService.shared.isAvailable {
///     let stream = LocalLLMService.shared.generateStream(...)
/// }
/// ```
@Observable
final class LocalLLMService: LLMServiceProtocol {

    // MARK: - Singleton

    static let shared = LocalLLMService()

    // MARK: - State

    /// Whether the model is loaded into memory
    private(set) var modelLoaded: Bool = false

    /// Whether model download is in progress
    private(set) var isDownloading: Bool = false

    /// Download progress (0.0 - 1.0)
    private(set) var downloadProgress: Double = 0.0

    /// Path to local model files
    private(set) var modelPath: URL?

    /// Current generation task (for cancellation)
    private var generationTask: Task<Void, Never>?

    /// Flag to signal cancellation
    private var isCancelled: Bool = false

    // MARK: - Configuration

    /// Generation temperature (randomness)
    private let temperature: Float = 0.7

    /// Top-p nucleus sampling
    private let topP: Float = 0.9

    /// Maximum tokens for local generation (resource conscious)
    private let maxTokens: Int = 512

    /// Model directory name
    private static let modelDirectoryName = "Models"

    /// Default model identifier
    private static let defaultModelId = "mlx-community/Llama-3.2-1B-Instruct-4bit"

    // MARK: - LLMServiceProtocol

    /// Display name for this service
    var modelName: String { "Local MLX" }

    /// Whether the service is available (model loaded)
    var isAvailable: Bool {
        get async {
            modelLoaded
        }
    }

    /// Generate a streaming response using local model.
    ///
    /// If the model is loaded, uses the MLX generation pipeline.
    /// If not, returns an informative message about downloading.
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
            self.generationTask = Task { [weak self] in
                guard let self = self else {
                    continuation.finish()
                    return
                }

                self.isCancelled = false

                if self.modelLoaded {
                    // TODO: MLX Integration
                    // Replace this mock with actual MLX generation:
                    // let pipeline = try MLXLMPipeline(modelPath: self.modelPath!)
                    // for try await token in pipeline.generate(prompt: ...) {
                    //     continuation.yield(token)
                    // }
                    await self.mockLocalGeneration(
                        query: messages.last?.content ?? "",
                        continuation: continuation
                    )
                } else {
                    // Model not loaded - provide helpful response
                    let message = "I'm running in local mode but the on-device model hasn't been downloaded yet. "
                        + "The local model provides fast, private responses for simple queries. "
                        + "For now, try switching to Cloud mode for full AI capabilities, "
                        + "or I can help you download the local model."

                    // Stream the message character by character
                    for char in message {
                        if self.isCancelled {
                            continuation.finish(throwing: LLMError.generationCancelled)
                            return
                        }
                        continuation.yield(String(char))
                        try? await Task.sleep(nanoseconds: 15_000_000) // 15ms per char
                    }
                    continuation.finish()
                }
            }
        }
    }

    /// Cancel any in-progress generation
    func cancel() {
        isCancelled = true
        generationTask?.cancel()
        generationTask = nil
        print("[LocalLLMService] Generation cancelled")
    }

    // MARK: - Model Management

    /// Load model from disk into memory.
    ///
    /// Checks model directory for weight files and loads them.
    /// TODO: MLX Integration - Use MLXModel.load(from:) when available
    func loadModel() async throws {
        guard let path = modelPath, FileManager.default.fileExists(atPath: path.path) else {
            throw LLMError.modelNotLoaded
        }

        // TODO: MLX Integration
        // let model = try await MLXModel.load(from: path)
        // self.loadedModel = model

        print("[LocalLLMService] Model loaded from: \(path.path)")
        modelLoaded = true
    }

    /// Download the quantized model to local storage.
    ///
    /// Downloads model weights from the configured repository.
    /// TODO: Implement actual download with progress tracking
    func downloadModel() async throws {
        guard !isDownloading else { return }

        isDownloading = true
        downloadProgress = 0.0

        defer {
            isDownloading = false
        }

        // Create model directory
        let modelsDir = Self.modelsDirectory
        try FileManager.default.createDirectory(at: modelsDir, withIntermediateDirectories: true)

        // TODO: Implement actual model download
        // For now, simulate progress
        for i in 0...10 {
            try? await Task.sleep(nanoseconds: 100_000_000) // 100ms steps
            downloadProgress = Double(i) / 10.0
        }

        modelPath = modelsDir.appendingPathComponent("model")
        print("[LocalLLMService] Model download complete (placeholder)")
    }

    /// Check if model files exist on disk
    func isModelAvailable() -> Bool {
        guard let path = modelPath else { return false }
        return FileManager.default.fileExists(atPath: path.path)
    }

    // MARK: - Private Helpers

    /// Models directory in Application Support
    private static var modelsDirectory: URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return appSupport
            .appendingPathComponent("OptaApp")
            .appendingPathComponent(modelDirectoryName)
    }

    /// Mock local generation providing system-aware responses.
    ///
    /// Streams a helpful response character by character to simulate
    /// local model behavior until MLX integration is complete.
    private func mockLocalGeneration(
        query: String,
        continuation: AsyncThrowingStream<String, Error>.Continuation
    ) async {
        let lowered = query.lowercased()
        let response: String

        if lowered.contains("status") || lowered.contains("current") {
            response = "Your system is running normally. CPU usage is moderate, memory pressure is stable, and thermal state is nominal. No immediate optimization needed."
        } else if lowered.contains("what is") || lowered.contains("how much") {
            response = "Based on current telemetry, your system resources are within expected ranges. I can provide more detailed analysis if you switch to Cloud mode for complex queries."
        } else {
            response = "I can help with quick system status checks and simple queries locally. For deeper analysis and optimization recommendations, the Cloud model provides more comprehensive responses."
        }

        for char in response {
            if isCancelled {
                continuation.finish(throwing: LLMError.generationCancelled)
                return
            }
            continuation.yield(String(char))
            try? await Task.sleep(nanoseconds: 10_000_000) // 10ms per char
        }
        continuation.finish()
    }

    // MARK: - Initialization

    private init() {
        // Check if model was previously downloaded
        let modelsDir = Self.modelsDirectory
        let modelDir = modelsDir.appendingPathComponent("model")
        if FileManager.default.fileExists(atPath: modelDir.path) {
            modelPath = modelDir
        }
        print("[LocalLLMService] Initialized (model available: \(isModelAvailable()))")
    }
}
