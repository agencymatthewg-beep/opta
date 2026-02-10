//
//  LLMProvider.swift
//  Opta Scan
//
//  Local-only LLM service using MLX for on-device inference
//  All processing happens locally - no cloud APIs
//

import Foundation
import UIKit

// MARK: - Provider Type

/// Available LLM provider types (local-only)
enum LLMProviderType: String, CaseIterable, Identifiable, Codable {
    case local = "local"

    var id: String { rawValue }

    var displayName: String {
        "On-Device AI"
    }

    var description: String {
        "Private, offline inference using Llama 3.2"
    }

    var icon: String {
        "iphone"
    }
}

// MARK: - LLM Service Manager

/// Manages on-device LLM inference (local-only)
@MainActor
@Observable
final class LLMServiceManager {
    static let shared = LLMServiceManager()

    // MARK: - State

    private(set) var isProcessing = false
    private(set) var error: Error?
    let generationStream = GenerationStream()

    // MARK: - Provider (Local Only)

    private let localService = MLXService()

    // MARK: - Initialization

    private init() {
        // No provider preference needed - always local
    }

    // MARK: - Provider Access

    var provider: MLXService {
        localService
    }

    var isAvailable: Bool {
        get async {
            await localService.isAvailable
        }
    }

    var supportsVision: Bool {
        get async {
            await localService.supportsVision
        }
    }

    // MARK: - Model Management

    func loadModel(_ config: OptaModelConfiguration) async throws {
        try await localService.loadModel(config)
    }

    func unloadModel() async {
        await localService.unloadModel()
    }

    // MARK: - Generation Control

    /// Cancel current generation and reset stream state
    func cancelGeneration() async {
        await localService.cancelGeneration()
        generationStream.reset()
        isProcessing = false
    }

    // MARK: - Retry Support

    /// Execute an operation with automatic retry for recoverable errors
    /// - Parameters:
    ///   - maxAttempts: Maximum number of attempts (default 2)
    ///   - operation: The async throwing operation to execute
    /// - Returns: The result of the operation
    private func withRetry<T>(
        maxAttempts: Int = 2,
        operation: () async throws -> T
    ) async throws -> T {
        var lastError: Error?

        for attempt in 1...maxAttempts {
            do {
                return try await operation()
            } catch let error as MLXError where error.isRecoverable && attempt < maxAttempts {
                lastError = error
                // Brief pause before retry (0.5 seconds)
                try await Task.sleep(nanoseconds: 500_000_000)
                continue
            } catch {
                throw error
            }
        }

        throw lastError ?? LLMServiceError.localModelNotLoaded
    }

    // MARK: - Analysis Methods

    func analyzeImage(_ image: UIImage, prompt: String, depth: OptimizationDepth) async throws -> AnalysisResult {
        guard await localService.isAvailable else {
            throw LLMServiceError.localModelNotLoaded
        }

        guard await localService.supportsVision else {
            throw LLMServiceError.visionNotSupported
        }

        isProcessing = true
        error = nil
        generationStream.start(maxTokens: depth.maxTokens)
        defer { isProcessing = false }

        do {
            let result = try await localService.analyzeImage(
                image,
                prompt: prompt,
                depth: depth,
                onProgress: { [generationStream] text, count in
                    generationStream.update(text: text, tokenCount: count)
                }
            )
            generationStream.complete(finalText: result.rawResponse)
            return result
        } catch {
            generationStream.fail(with: error)
            self.error = error
            throw error
        }
    }

    func analyzeText(prompt: String, depth: OptimizationDepth) async throws -> AnalysisResult {
        guard await localService.isAvailable else {
            throw LLMServiceError.localModelNotLoaded
        }

        isProcessing = true
        error = nil
        generationStream.start(maxTokens: depth.maxTokens)
        defer { isProcessing = false }

        do {
            let result = try await localService.analyzeText(
                prompt: prompt,
                depth: depth,
                onProgress: { [generationStream] text, count in
                    generationStream.update(text: text, tokenCount: count)
                }
            )
            generationStream.complete(finalText: result.rawResponse)
            return result
        } catch {
            generationStream.fail(with: error)
            self.error = error
            throw error
        }
    }

    func continueWithAnswers(_ answers: [String: String], context: AnalysisResult) async throws -> OptimizationResult {
        guard await localService.isAvailable else {
            throw LLMServiceError.localModelNotLoaded
        }

        isProcessing = true
        error = nil
        // Use 4096 max tokens for optimization results
        generationStream.start(maxTokens: 4096)
        defer { isProcessing = false }

        do {
            let result = try await localService.continueWithAnswers(
                answers,
                context: context,
                onProgress: { [generationStream] text, count in
                    generationStream.update(text: text, tokenCount: count)
                }
            )
            generationStream.complete(finalText: result.markdown)
            return result
        } catch {
            generationStream.fail(with: error)
            self.error = error
            throw error
        }
    }
}

// MARK: - Simplified Errors

enum LLMServiceError: LocalizedError {
    case localModelNotLoaded
    case visionNotSupported

    var errorDescription: String? {
        switch self {
        case .localModelNotLoaded:
            return "Model not loaded. Download a model in Settings."
        case .visionNotSupported:
            return "Vision model required for image analysis."
        }
    }
}

// MARK: - Optimization Depth

/// Defines the analysis depth for optimization queries
enum OptimizationDepth: String, CaseIterable {
    case quick = "Quick"
    case thorough = "Thorough"

    var maxTokens: Int {
        switch self {
        case .quick: return 1024
        case .thorough: return 4096
        }
    }

    var description: String {
        switch self {
        case .quick: return "Fast analysis, key factors only"
        case .thorough: return "Deep analysis, all factors considered"
        }
    }
}

// MARK: - Result Models

struct AnalysisResult {
    let understanding: String
    let questions: [OptimizationQuestion]
    let rawResponse: String
}

struct OptimizationQuestion: Identifiable {
    let id: String
    let text: String
    let type: QuestionType
    let options: [String]?
    let placeholder: String?
    let min: Double?
    let max: Double?
    let defaultValue: Double?
}

enum QuestionType: String {
    case singleChoice = "single_choice"
    case multiChoice = "multi_choice"
    case text
    case slider
}

struct OptimizationResult {
    let markdown: String
    let highlights: [String]
    let rankings: [RankingItem]?
}

struct RankingItem: Codable {
    let rank: Int
    let title: String
    let description: String?
}
