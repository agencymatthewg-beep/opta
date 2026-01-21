//
//  MLXService.swift
//  Opta Scan
//
//  MLX Swift service for on-device Llama 3.2 11B Vision inference
//  Local-only AI - all processing happens on device
//
//  Note: This service requires adaptation to the specific mlx-swift-lm API
//  once integration testing begins on a physical device.
//

import Foundation
import UIKit

#if canImport(MLX) && canImport(MLXLLM) && !targetEnvironment(simulator)
import MLX
import MLXLLM
import MLXLMCommon  // Required for generate() API
#endif

// MARK: - Cancellation Token

/// Thread-safe cancellation token for cross-boundary communication
private final class CancellationToken: @unchecked Sendable {
    private let lock = NSLock()
    private var _isCancelled = false

    var isCancelled: Bool {
        lock.lock()
        defer { lock.unlock() }
        return _isCancelled
    }

    func cancel() {
        lock.lock()
        defer { lock.unlock() }
        _isCancelled = true
    }
}

// MARK: - MLX Service

/// On-device LLM provider using Apple's MLX framework
actor MLXService {

    // MARK: - Properties

    let name = "On-Device (Llama 3.2)"

    var supportsVision: Bool {
        loadedModelConfig?.supportsVision ?? false
    }

    // MARK: - State

    private var isModelLoaded = false
    private var loadedModelConfig: OptaModelConfiguration?
    private var isGenerating = false
    private var cancellationToken: CancellationToken?
    private(set) var generationProgress: Int = 0  // Token count for UI feedback

    #if canImport(MLX) && canImport(MLXLLM) && !targetEnvironment(simulator)
    private var modelContainer: ModelContainer? = nil
    #endif

    /// Current generation progress (token count) for UI display
    var currentGenerationProgress: Int {
        generationProgress
    }

    /// Whether generation is currently in progress
    var isCurrentlyGenerating: Bool {
        isGenerating
    }

    // MARK: - Generation Control

    /// Cancel current generation if in progress
    func cancelGeneration() {
        guard isGenerating else { return }
        cancellationToken?.cancel()
    }

    // MARK: - Device Support

    private var isDeviceSupported: Bool {
        #if targetEnvironment(simulator)
        return false
        #else
        if #available(iOS 17.2, *) {
            return true
        }
        return false
        #endif
    }

    // MARK: - Public Interface

    var isAvailable: Bool {
        isModelLoaded && isDeviceSupported
    }

    // MARK: - Model Loading

    /// Load a model configuration
    /// Checks ModelCache first, then downloads if needed
    func loadModel(_ config: OptaModelConfiguration) async throws {
        guard isDeviceSupported else {
            throw MLXError.deviceNotSupported
        }

        #if canImport(MLX) && canImport(MLXLLM) && !targetEnvironment(simulator)
        // Set GPU cache limit for memory management
        GPU.set(cacheLimit: 20 * 1024 * 1024)

        // Check if model is already in cache
        if let cached = await ModelCache.shared.retrieve(for: config) {
            modelContainer = cached
            loadedModelConfig = config
            isModelLoaded = true
            return
        }

        // Load model from Hugging Face Hub (downloads if not cached)
        let modelConfig = ModelConfiguration(id: config.name)

        let container = try await LLMModelFactory.shared.loadContainer(
            configuration: modelConfig
        )

        modelContainer = container
        await ModelCache.shared.store(container: container, for: config)
        #endif

        loadedModelConfig = config
        isModelLoaded = true
    }

    /// Unload the current model to free memory
    func unloadModel() {
        #if canImport(MLX) && canImport(MLXLLM) && !targetEnvironment(simulator)
        modelContainer = nil
        // Note: Model remains in ModelCache for quick reload
        // Call ModelCache.shared.remove(for:) to fully remove from memory
        #endif

        loadedModelConfig = nil
        isModelLoaded = false
    }

    // MARK: - Analysis Methods

    func analyzeImage(_ image: UIImage, prompt: String, depth: OptimizationDepth) async throws -> AnalysisResult {
        guard isModelLoaded else {
            throw MLXError.modelNotLoaded
        }

        guard loadedModelConfig?.supportsVision == true else {
            throw MLXError.visionNotSupported
        }

        // Prepare image for vision model
        let resizedImage = prepareImage(image)

        // Generate with vision prompt
        let systemPrompt = buildSystemPrompt(depth: depth)
        let fullPrompt = "\(systemPrompt)\n\nUser's optimization request: \(prompt)"

        let response = try await generate(
            prompt: fullPrompt,
            image: resizedImage,
            maxTokens: depth.maxTokens
        )

        return parseAnalysisResult(from: response)
    }

    func analyzeText(prompt: String, depth: OptimizationDepth) async throws -> AnalysisResult {
        guard isModelLoaded else {
            throw MLXError.modelNotLoaded
        }

        let systemPrompt = buildSystemPrompt(depth: depth)
        let fullPrompt = "\(systemPrompt)\n\nUser's optimization request: \(prompt)"

        let response = try await generate(
            prompt: fullPrompt,
            image: nil,
            maxTokens: depth.maxTokens
        )

        return parseAnalysisResult(from: response)
    }

    func continueWithAnswers(_ answers: [String: String], context: AnalysisResult) async throws -> OptimizationResult {
        guard isModelLoaded else {
            throw MLXError.modelNotLoaded
        }

        let followUpPrompt = buildFollowUpPrompt(context: context, answers: answers)
        let systemPrompt = "You are Opta, an optimization assistant. Provide comprehensive recommendations with clear sections, rankings if applicable, and actionable advice. Use markdown formatting."

        let fullPrompt = "\(systemPrompt)\n\n\(followUpPrompt)"

        let response = try await generate(
            prompt: fullPrompt,
            image: nil,
            maxTokens: 4096
        )

        return parseOptimizationResult(from: response)
    }

    // MARK: - Private Generation

    private func generate(
        prompt: String,
        image: UIImage?,
        maxTokens: Int
    ) async throws -> String {
        guard !isGenerating else {
            throw MLXError.alreadyGenerating
        }

        isGenerating = true
        generationProgress = 0
        let token = CancellationToken()
        cancellationToken = token
        defer {
            isGenerating = false
            generationProgress = 0
            cancellationToken = nil
        }

        #if canImport(MLX) && canImport(MLXLLM) && !targetEnvironment(simulator)
        guard let container = modelContainer else {
            throw MLXError.modelNotLoaded
        }

        // Set GPU cache limit based on model size
        // 11B Vision model needs more cache than smaller models
        let cacheLimit: Int
        if loadedModelConfig?.id == OptaModelConfiguration.llama32_11B_Vision.id {
            cacheLimit = 100 * 1024 * 1024  // 100MB for 11B
        } else {
            cacheLimit = 20 * 1024 * 1024   // 20MB for smaller models
        }
        GPU.set(cacheLimit: cacheLimit)

        // Ensure cache is cleared after generation
        defer {
            GPU.clearCache()
        }

        // Get current quality tier for adaptive preprocessing
        let tier = await MainActor.run { PerformanceManager.shared.effectiveQuality }

        // Build UserInput with optional image
        // Note: UserInput.Image uses .url() for file-based images
        // For in-memory data, we save to temp file first using ImagePreprocessor
        var tempImageURL: URL? = nil
        let input: UserInput

        if let image = image, let imageData = ImagePreprocessor.preprocess(image, tier: tier) {
            // Save quality-adapted preprocessed image to temporary file for MLX processing
            tempImageURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpg")
            try imageData.write(to: tempImageURL!)

            input = UserInput(
                prompt: prompt,
                images: [.url(tempImageURL!)]
            )
        } else if let image = image, let imageData = image.visionModelData {
            // Fallback to default preprocessing if tier-based fails
            tempImageURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpg")
            try imageData.write(to: tempImageURL!)

            input = UserInput(
                prompt: prompt,
                images: [.url(tempImageURL!)]
            )
        } else {
            input = UserInput(prompt: prompt)
        }

        // Cleanup temp file when done
        defer {
            if let tempURL = tempImageURL {
                try? FileManager.default.removeItem(at: tempURL)
            }
        }

        // Generate parameters
        let parameters = GenerateParameters(
            maxTokens: maxTokens,
            temperature: 0.7,
            topP: 0.9
        )

        // Perform generation within model context
        // The MLX generate callback receives token IDs, not strings
        let output = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
            Task {
                do {
                    let result = try await container.perform { context in
                        // Prepare input (tokenize prompt + encode image)
                        let prepared = try await context.processor.prepare(input: input)

                        // Generate tokens
                        var allTokens: [Int] = []

                        // Use the streaming generate API
                        // Callback receives token IDs (integers), not decoded strings
                        _ = try await MLXLMCommon.generate(
                            input: prepared,
                            parameters: parameters,
                            context: context
                        ) { (tokenIds: [Int]) -> GenerateDisposition in
                            // Check for cancellation
                            if token.isCancelled {
                                return .stop
                            }

                            allTokens.append(contentsOf: tokenIds)
                            return .more
                        }

                        // Decode tokens to string using the processor's tokenizer
                        let decodedOutput = context.tokenizer.decode(tokens: allTokens)
                        return decodedOutput
                    }
                    continuation.resume(returning: result)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }

        // Update progress
        generationProgress += 1
        return output
        #else
        throw MLXError.deviceNotSupported
        #endif
    }

    // MARK: - Image Preparation

    private func prepareImage(_ image: UIImage) -> UIImage {
        ImagePreprocessor.prepare(image)
    }

    // MARK: - Prompt Building

    private func buildSystemPrompt(depth: OptimizationDepth) -> String {
        """
        You are Opta, an optimization assistant that helps users make the best decisions by analyzing images and prompts. Your goal is to understand what the user wants to optimize and ask clarifying questions to provide the most helpful recommendation.

        Depth level: \(depth.rawValue)
        \(depth == .quick ? "Be concise and focus on the most important factors." : "Be thorough and consider all relevant factors.")

        Response format - JSON:
        ```json
        {
            "understanding": "Brief summary of what the user wants to optimize",
            "questions": [
                {
                    "id": "q1",
                    "text": "Question text here?",
                    "type": "single_choice",
                    "options": ["Option 1", "Option 2", "Option 3"]
                },
                {
                    "id": "q2",
                    "text": "Another question?",
                    "type": "text",
                    "placeholder": "Enter your answer..."
                }
            ]
        }
        ```

        Question types: single_choice, multi_choice, text, slider (with min, max, default)
        """
    }

    private func buildFollowUpPrompt(context: AnalysisResult, answers: [String: String]) -> String {
        var prompt = "Original understanding: \(context.understanding)\n\nUser's answers to clarifying questions:\n"
        for (questionId, answer) in answers {
            if let question = context.questions.first(where: { $0.id == questionId }) {
                prompt += "- \(question.text): \(answer)\n"
            }
        }
        prompt += "\nBased on this information, provide your optimization recommendation."
        return prompt
    }

    // MARK: - Response Parsing

    private func parseAnalysisResult(from text: String) -> AnalysisResult {
        // Try to extract JSON from the response
        if let jsonStart = text.range(of: "```json"),
           let jsonEnd = text.range(of: "```", range: jsonStart.upperBound..<text.endIndex) {
            let jsonString = String(text[jsonStart.upperBound..<jsonEnd.lowerBound])
            if let data = jsonString.data(using: .utf8),
               let parsed = try? JSONDecoder().decode(AnalysisResultJSON.self, from: data) {
                return AnalysisResult(
                    understanding: parsed.understanding,
                    questions: parsed.questions.map { q in
                        OptimizationQuestion(
                            id: q.id,
                            text: q.text,
                            type: QuestionType(rawValue: q.type) ?? .text,
                            options: q.options,
                            placeholder: q.placeholder,
                            min: q.min,
                            max: q.max,
                            defaultValue: q.defaultValue
                        )
                    },
                    rawResponse: text
                )
            }
        }

        // Fallback: return raw text as understanding
        return AnalysisResult(
            understanding: text,
            questions: [],
            rawResponse: text
        )
    }

    private func parseOptimizationResult(from text: String) -> OptimizationResult {
        OptimizationResult(
            markdown: text,
            highlights: extractHighlights(from: text),
            rankings: extractRankings(from: text)
        )
    }

    private func extractHighlights(from text: String) -> [String] {
        var highlights: [String] = []
        let lines = text.components(separatedBy: .newlines)

        for line in lines {
            if line.contains("**") {
                let pattern = "\\*\\*([^*]+)\\*\\*"
                if let regex = try? NSRegularExpression(pattern: pattern),
                   let match = regex.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)),
                   let range = Range(match.range(at: 1), in: line) {
                    highlights.append(String(line[range]))
                }
            }
        }

        return Array(highlights.prefix(5))
    }

    private func extractRankings(from text: String) -> [RankingItem]? {
        var rankings: [RankingItem] = []
        let lines = text.components(separatedBy: .newlines)

        for line in lines {
            let pattern = "^\\s*(\\d+)[.\\)]\\s*(.+)"
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)),
               let rankRange = Range(match.range(at: 1), in: line),
               let titleRange = Range(match.range(at: 2), in: line) {
                let rank = Int(line[rankRange]) ?? 0
                let title = String(line[titleRange])
                rankings.append(RankingItem(rank: rank, title: title, description: nil))
            }
        }

        return rankings.isEmpty ? nil : rankings
    }
}

// MARK: - Private Parsing Models

private struct AnalysisResultJSON: Decodable {
    let understanding: String
    let questions: [QuestionJSON]
}

private struct QuestionJSON: Decodable {
    let id: String
    let text: String
    let type: String
    let options: [String]?
    let placeholder: String?
    let min: Double?
    let max: Double?
    let defaultValue: Double?

    enum CodingKeys: String, CodingKey {
        case id, text, type, options, placeholder, min, max
        case defaultValue = "default"
    }
}

// MARK: - MLX Errors

enum MLXError: LocalizedError {
    case deviceNotSupported
    case modelNotLoaded
    case alreadyGenerating
    case generationCancelled
    case visionNotSupported
    case imageProcessingFailed
    case downloadFailed(String)

    var errorDescription: String? {
        switch self {
        case .deviceNotSupported:
            return "Requires iPhone with A14+ chip running iOS 17.2+"
        case .modelNotLoaded:
            return "Model not loaded. Download in Settings."
        case .alreadyGenerating:
            return "Generation in progress."
        case .generationCancelled:
            return "Generation was cancelled."
        case .visionNotSupported:
            return "Vision model not loaded."
        case .imageProcessingFailed:
            return "Failed to process image."
        case .downloadFailed(let reason):
            return "Download failed: \(reason)"
        }
    }
}
