//
//  LLMProvider.swift
//  Opta Scan
//
//  Protocol defining LLM provider interface for multi-provider support
//  Enables both cloud (Claude) and local (MLX/llama.cpp) inference
//

import Foundation
import UIKit

// MARK: - LLM Provider Protocol

/// Protocol for LLM providers (cloud or local)
protocol LLMProvider: Actor {
    /// Provider identifier
    var id: LLMProviderType { get }

    /// Display name
    var name: String { get }

    /// Whether the provider is currently available
    var isAvailable: Bool { get async }

    /// Whether the provider requires an API key
    var requiresAPIKey: Bool { get }

    /// Whether the provider supports vision (image analysis)
    var supportsVision: Bool { get }

    /// Analyze an image with a prompt
    func analyzeImage(_ image: UIImage, prompt: String, depth: OptimizationDepth) async throws -> AnalysisResult

    /// Analyze text-only prompt
    func analyzeText(prompt: String, depth: OptimizationDepth) async throws -> AnalysisResult

    /// Continue with user answers
    func continueWithAnswers(_ answers: [String: String], context: AnalysisResult) async throws -> OptimizationResult
}

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

/// Manages multiple LLM providers and routes requests
@MainActor
@Observable
final class LLMServiceManager {
    static let shared = LLMServiceManager()

    // MARK: - State

    private(set) var currentProvider: LLMProviderType = .claude
    private(set) var isProcessing = false
    private(set) var error: Error?

    // MARK: - Providers

    private var providers: [LLMProviderType: any LLMProvider] = [:]

    // MARK: - Initialization

    private init() {
        // Load preferred provider from UserDefaults (Keychain used for API keys only)
        if let saved = UserDefaults.standard.string(forKey: "opta.preferredProvider"),
           let type = LLMProviderType(rawValue: saved) {
            currentProvider = type
        }
    }

    // MARK: - Provider Registration

    nonisolated func register(_ provider: any LLMProvider) async {
        let providerId = await provider.id
        await MainActor.run {
            providers[providerId] = provider
        }
    }

    func setCurrentProvider(_ type: LLMProviderType) {
        currentProvider = type
        UserDefaults.standard.set(type.rawValue, forKey: "opta.preferredProvider")
    }

    // MARK: - Provider Access

    func provider(for type: LLMProviderType) -> (any LLMProvider)? {
        providers[type]
    }

    var activeProvider: (any LLMProvider)? {
        providers[currentProvider]
    }

    // MARK: - Availability

    func isProviderAvailable(_ type: LLMProviderType) async -> Bool {
        guard let provider = providers[type] else { return false }
        return await provider.isAvailable
    }

    // MARK: - Analysis Methods

    func analyzeImage(_ image: UIImage, prompt: String, depth: OptimizationDepth) async throws -> AnalysisResult {
        guard let provider = activeProvider else {
            throw LLMServiceError.noProviderConfigured
        }

        guard await provider.supportsVision else {
            throw LLMServiceError.visionNotSupported
        }

        isProcessing = true
        error = nil

        defer { isProcessing = false }

        do {
            return try await provider.analyzeImage(image, prompt: prompt, depth: depth)
        } catch {
            self.error = error
            throw error
        }
    }

    func analyzeText(prompt: String, depth: OptimizationDepth) async throws -> AnalysisResult {
        guard let provider = activeProvider else {
            throw LLMServiceError.noProviderConfigured
        }

        isProcessing = true
        error = nil

        defer { isProcessing = false }

        do {
            return try await provider.analyzeText(prompt: prompt, depth: depth)
        } catch {
            self.error = error
            throw error
        }
    }

    func continueWithAnswers(_ answers: [String: String], context: AnalysisResult) async throws -> OptimizationResult {
        guard let provider = activeProvider else {
            throw LLMServiceError.noProviderConfigured
        }

        isProcessing = true
        error = nil

        defer { isProcessing = false }

        do {
            return try await provider.continueWithAnswers(answers, context: context)
        } catch {
            self.error = error
            throw error
        }
    }
}

// MARK: - LLM Service Error

enum LLMServiceError: LocalizedError {
    case noProviderConfigured
    case providerNotAvailable
    case visionNotSupported
    case localModelNotLoaded

    var errorDescription: String? {
        switch self {
        case .noProviderConfigured:
            return "No LLM provider configured. Please select a provider in Settings."
        case .providerNotAvailable:
            return "The selected provider is not available."
        case .visionNotSupported:
            return "The selected provider does not support image analysis."
        case .localModelNotLoaded:
            return "Local model is not loaded. Please download a model in Settings."
        }
    }
}
