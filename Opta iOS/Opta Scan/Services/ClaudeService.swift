//
//  ClaudeService.swift
//  Opta Scan
//
//  Claude API client for optimization analysis
//  Created by Matthew Byrden
//

import Foundation
import UIKit

// MARK: - Claude Service

@MainActor
class ClaudeService: ObservableObject {

    // MARK: - Published Properties

    @Published var isProcessing = false
    @Published var currentResponse = ""
    @Published var questions: [OptimizationQuestion] = []
    @Published var error: ClaudeError?

    // MARK: - Configuration

    private let apiKey: String
    private let baseURL = "https://api.anthropic.com/v1/messages"
    private let model = "claude-sonnet-4-20250514"

    // MARK: - Initialization

    init() {
        // In production, load from secure storage (Keychain)
        // For development, we'll use a placeholder
        self.apiKey = ProcessInfo.processInfo.environment["ANTHROPIC_API_KEY"] ?? ""
    }

    // MARK: - Image Analysis

    /// Analyze an image with a user prompt to generate optimization questions
    func analyzeImage(_ image: UIImage, prompt: String, depth: OptimizationDepth) async throws -> AnalysisResult {
        guard !apiKey.isEmpty else {
            throw ClaudeError.noAPIKey
        }

        isProcessing = true
        currentResponse = ""
        error = nil

        defer { isProcessing = false }

        // Convert image to base64
        guard let imageData = image.jpegData(compressionQuality: 0.8) else {
            throw ClaudeError.imageEncodingFailed
        }
        let base64Image = imageData.base64EncodedString()

        // Build the request
        let systemPrompt = buildSystemPrompt(depth: depth)
        let userContent = buildUserContent(base64Image: base64Image, prompt: prompt)

        let requestBody = ClaudeRequest(
            model: model,
            maxTokens: depth.maxTokens,
            system: systemPrompt,
            messages: [
                ClaudeMessage(role: "user", content: userContent)
            ]
        )

        // Make the request
        var request = URLRequest(url: URL(string: baseURL)!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.httpBody = try JSONEncoder().encode(requestBody)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ClaudeError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            if let errorResponse = try? JSONDecoder().decode(ClaudeErrorResponse.self, from: data) {
                throw ClaudeError.apiError(errorResponse.error.message)
            }
            throw ClaudeError.httpError(httpResponse.statusCode)
        }

        let claudeResponse = try JSONDecoder().decode(ClaudeResponse.self, from: data)

        // Parse the response
        guard let textContent = claudeResponse.content.first(where: { $0.type == "text" }),
              let responseText = textContent.text else {
            throw ClaudeError.noTextContent
        }

        currentResponse = responseText

        // Parse questions from response
        let result = parseAnalysisResult(from: responseText)
        self.questions = result.questions

        return result
    }

    /// Analyze a text-only prompt
    func analyzeText(prompt: String, depth: OptimizationDepth) async throws -> AnalysisResult {
        guard !apiKey.isEmpty else {
            throw ClaudeError.noAPIKey
        }

        isProcessing = true
        currentResponse = ""
        error = nil

        defer { isProcessing = false }

        let systemPrompt = buildSystemPrompt(depth: depth)

        let requestBody = ClaudeRequest(
            model: model,
            maxTokens: depth.maxTokens,
            system: systemPrompt,
            messages: [
                ClaudeMessage(role: "user", content: [
                    ContentBlock(type: "text", text: prompt, source: nil)
                ])
            ]
        )

        var request = URLRequest(url: URL(string: baseURL)!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.httpBody = try JSONEncoder().encode(requestBody)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ClaudeError.invalidResponse
        }

        let claudeResponse = try JSONDecoder().decode(ClaudeResponse.self, from: data)

        guard let textContent = claudeResponse.content.first(where: { $0.type == "text" }),
              let responseText = textContent.text else {
            throw ClaudeError.noTextContent
        }

        currentResponse = responseText
        let result = parseAnalysisResult(from: responseText)
        self.questions = result.questions

        return result
    }

    /// Continue analysis with user's answers to questions
    func continueWithAnswers(_ answers: [String: String], context: AnalysisResult) async throws -> OptimizationResult {
        guard !apiKey.isEmpty else {
            throw ClaudeError.noAPIKey
        }

        isProcessing = true
        error = nil

        defer { isProcessing = false }

        let followUpPrompt = buildFollowUpPrompt(originalContext: context, answers: answers)

        let requestBody = ClaudeRequest(
            model: model,
            maxTokens: 4096,
            system: "You are an optimization assistant. Based on the context and answers provided, give a comprehensive, beautifully formatted optimization recommendation. Use markdown formatting with headers, bullet points, and emphasis where appropriate.",
            messages: [
                ClaudeMessage(role: "user", content: [
                    ContentBlock(type: "text", text: followUpPrompt, source: nil)
                ])
            ]
        )

        var request = URLRequest(url: URL(string: baseURL)!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.httpBody = try JSONEncoder().encode(requestBody)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ClaudeError.invalidResponse
        }

        let claudeResponse = try JSONDecoder().decode(ClaudeResponse.self, from: data)

        guard let textContent = claudeResponse.content.first(where: { $0.type == "text" }),
              let responseText = textContent.text else {
            throw ClaudeError.noTextContent
        }

        return parseOptimizationResult(from: responseText)
    }

    // MARK: - Private Methods

    private func buildSystemPrompt(depth: OptimizationDepth) -> String {
        """
        You are Opta, an optimization assistant that helps users make the best decisions by analyzing images and prompts. Your goal is to understand what the user wants to optimize and ask clarifying questions to provide the most helpful recommendation.

        Depth level: \(depth.rawValue)
        \(depth == .quick ? "Be concise and focus on the most important factors." : "Be thorough and consider all relevant factors.")

        Response format:
        1. First, briefly acknowledge what you see/understand
        2. Then, provide 2-4 clarifying questions in this exact JSON format:

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

        Question types:
        - "single_choice": User picks one option
        - "multi_choice": User can pick multiple options
        - "text": Free-form text input
        - "slider": Numeric value (include "min", "max", "default")
        """
    }

    private func buildUserContent(base64Image: String, prompt: String) -> [ContentBlock] {
        [
            ContentBlock(
                type: "image",
                text: nil,
                source: ImageSource(
                    type: "base64",
                    mediaType: "image/jpeg",
                    data: base64Image
                )
            ),
            ContentBlock(
                type: "text",
                text: "User's optimization request: \(prompt)",
                source: nil
            )
        ]
    }

    private func buildFollowUpPrompt(originalContext: AnalysisResult, answers: [String: String]) -> String {
        var prompt = "Original understanding: \(originalContext.understanding)\n\n"
        prompt += "User's answers to clarifying questions:\n"

        for (questionId, answer) in answers {
            if let question = originalContext.questions.first(where: { $0.id == questionId }) {
                prompt += "- \(question.text): \(answer)\n"
            }
        }

        prompt += "\nBased on this information, provide your optimization recommendation. Format your response with clear sections, rankings if applicable, and actionable advice."

        return prompt
    }

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
        // Extract key points marked with ** or numbered lists
        var highlights: [String] = []
        let lines = text.components(separatedBy: .newlines)

        for line in lines {
            if line.contains("**") {
                // Extract bold text
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
        // Look for numbered recommendations
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

// MARK: - Optimization Depth

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

// MARK: - API Models

private struct ClaudeRequest: Encodable {
    let model: String
    let maxTokens: Int
    let system: String
    let messages: [ClaudeMessage]

    enum CodingKeys: String, CodingKey {
        case model
        case maxTokens = "max_tokens"
        case system
        case messages
    }
}

private struct ClaudeMessage: Encodable {
    let role: String
    let content: [ContentBlock]
}

private struct ContentBlock: Encodable {
    let type: String
    let text: String?
    let source: ImageSource?
}

private struct ImageSource: Encodable {
    let type: String
    let mediaType: String
    let data: String

    enum CodingKeys: String, CodingKey {
        case type
        case mediaType = "media_type"
        case data
    }
}

private struct ClaudeResponse: Decodable {
    let content: [ResponseContent]
}

private struct ResponseContent: Decodable {
    let type: String
    let text: String?
}

private struct ClaudeErrorResponse: Decodable {
    let error: ClaudeAPIError
}

private struct ClaudeAPIError: Decodable {
    let message: String
}

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

struct RankingItem {
    let rank: Int
    let title: String
    let description: String?
}

// MARK: - Errors

enum ClaudeError: LocalizedError {
    case noAPIKey
    case imageEncodingFailed
    case invalidResponse
    case httpError(Int)
    case apiError(String)
    case noTextContent

    var errorDescription: String? {
        switch self {
        case .noAPIKey:
            return "No API key configured. Please add your Anthropic API key in Settings."
        case .imageEncodingFailed:
            return "Failed to encode image for analysis."
        case .invalidResponse:
            return "Received an invalid response from the server."
        case .httpError(let code):
            return "Request failed with status code \(code)."
        case .apiError(let message):
            return message
        case .noTextContent:
            return "No text content in response."
        }
    }
}
