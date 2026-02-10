//
//  GenerationStream.swift
//  Opta Scan
//
//  Observable generation state for streaming UI updates
//  Provides real-time token streaming feedback
//

import Foundation

// MARK: - Generation Stream

@MainActor
@Observable
final class GenerationStream {

    // MARK: - State

    private(set) var isGenerating = false
    private(set) var tokenCount = 0
    private(set) var currentText = ""
    private(set) var error: Error?

    // MARK: - Progress

    /// Estimated progress (0.0-1.0) based on maxTokens
    var progress: Double {
        guard maxTokens > 0 else { return 0 }
        return min(1.0, Double(tokenCount) / Double(maxTokens))
    }

    private var maxTokens = 0

    // MARK: - Callbacks for MLXService

    /// Called when generation starts
    func start(maxTokens: Int) {
        self.isGenerating = true
        self.maxTokens = maxTokens
        self.tokenCount = 0
        self.currentText = ""
        self.error = nil
    }

    /// Called for each token batch
    func update(text: String, tokenCount: Int) {
        self.currentText = text
        self.tokenCount = tokenCount
    }

    /// Called when generation completes
    func complete(finalText: String) {
        self.currentText = finalText
        self.isGenerating = false
    }

    /// Called on error
    func fail(with error: Error) {
        self.error = error
        self.isGenerating = false
    }

    /// Reset state
    func reset() {
        isGenerating = false
        tokenCount = 0
        currentText = ""
        error = nil
        maxTokens = 0
    }
}
