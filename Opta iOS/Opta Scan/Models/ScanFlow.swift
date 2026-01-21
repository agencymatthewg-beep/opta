//
//  ScanFlow.swift
//  Opta Scan
//
//  Navigation state for the scan-to-optimization flow
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Scan Flow State

@MainActor
class ScanFlowState: ObservableObject {

    // MARK: - Published Properties

    @Published var currentStep: ScanStep = .capture
    @Published var capturedImage: UIImage?
    @Published var prompt: String = ""
    @Published var depth: OptimizationDepth = .quick
    @Published var analysisResult: AnalysisResult?
    @Published var questionAnswers: [String: String] = [:]
    @Published var optimizationResult: OptimizationResult?
    @Published var error: Error?

    // MARK: - Services

    private var llmManager: LLMServiceManager { LLMServiceManager.shared }

    // MARK: - Navigation

    func startOptimization() {
        guard !prompt.isEmpty else { return }
        currentStep = .processing
        OptaHaptics.shared.processingStart()

        Task {
            do {
                if let image = capturedImage {
                    analysisResult = try await llmManager.analyzeImage(image, prompt: prompt, depth: depth)
                } else {
                    analysisResult = try await llmManager.analyzeText(prompt: prompt, depth: depth)
                }
                currentStep = .questions
                OptaHaptics.shared.success()
            } catch {
                self.error = error
                currentStep = .capture
                OptaHaptics.shared.error()
            }
        }
    }

    func submitAnswers() {
        guard let analysis = analysisResult else { return }
        currentStep = .processing
        OptaHaptics.shared.processingStart()

        Task {
            do {
                optimizationResult = try await llmManager.continueWithAnswers(questionAnswers, context: analysis)
                currentStep = .result
                OptaHaptics.shared.success()
            } catch {
                self.error = error
                currentStep = .questions
                OptaHaptics.shared.error()
            }
        }
    }

    func reset() {
        currentStep = .capture
        capturedImage = nil
        prompt = ""
        depth = .quick
        analysisResult = nil
        questionAnswers = [:]
        optimizationResult = nil
        error = nil
    }

    func goBack() {
        switch currentStep {
        case .capture:
            break
        case .processing:
            break // Can't go back during processing
        case .questions:
            currentStep = .capture
        case .result:
            currentStep = .questions
        }
    }
}

// MARK: - Scan Steps

enum ScanStep {
    case capture
    case processing
    case questions
    case result
}

// MARK: - Scan Item

/// Represents a completed scan for history
struct ScanItem: Identifiable, Codable {
    let id: UUID
    let prompt: String
    let imageData: Data?
    let result: String
    let highlights: [String]
    let createdAt: Date

    init(prompt: String, imageData: Data?, result: String, highlights: [String]) {
        self.id = UUID()
        self.prompt = prompt
        self.imageData = imageData
        self.result = result
        self.highlights = highlights
        self.createdAt = Date()
    }
}
