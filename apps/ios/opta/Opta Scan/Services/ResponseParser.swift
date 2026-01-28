//
//  ResponseParser.swift
//  Opta Scan
//
//  Robust response parsing for LLM outputs
//  Handles varied response formats with multiple extraction strategies
//

import Foundation

// MARK: - Response Parser

enum ResponseParser {

    // MARK: - JSON Extraction

    /// Extract JSON from LLM response, trying multiple strategies
    static func extractJSON<T: Decodable>(_ text: String, as type: T.Type) -> T? {
        // Strategy 1: Code block extraction (```json ... ```)
        if let json = extractJSONFromCodeBlock(text) {
            if let decoded = try? JSONDecoder().decode(type, from: json) {
                return decoded
            }
        }

        // Strategy 2: Find first { and last } for object
        if let json = extractJSONBraces(text, isArray: false) {
            if let decoded = try? JSONDecoder().decode(type, from: json) {
                return decoded
            }
        }

        // Strategy 3: Find first [ and last ] for array
        if let json = extractJSONBraces(text, isArray: true) {
            if let decoded = try? JSONDecoder().decode(type, from: json) {
                return decoded
            }
        }

        return nil
    }

    private static func extractJSONFromCodeBlock(_ text: String) -> Data? {
        // Match ```json ... ``` or ``` ... ```
        let patterns = [
            "```json\\s*\\n([\\s\\S]*?)\\n\\s*```",
            "```\\s*\\n([\\s\\S]*?)\\n\\s*```"
        ]

        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: []),
               let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
               let range = Range(match.range(at: 1), in: text) {
                let jsonString = String(text[range]).trimmingCharacters(in: .whitespacesAndNewlines)
                return jsonString.data(using: .utf8)
            }
        }

        return nil
    }

    private static func extractJSONBraces(_ text: String, isArray: Bool) -> Data? {
        let openChar: Character = isArray ? "[" : "{"
        let closeChar: Character = isArray ? "]" : "}"

        guard let startIndex = text.firstIndex(of: openChar) else { return nil }
        guard let endIndex = text.lastIndex(of: closeChar) else { return nil }
        guard startIndex < endIndex else { return nil }

        let jsonString = String(text[startIndex...endIndex])
        return jsonString.data(using: .utf8)
    }

    // MARK: - Analysis Result Parsing

    /// Parse analysis result from LLM response
    static func parseAnalysisResult(from text: String) -> AnalysisResult {
        // Try JSON extraction first
        if let parsed: AnalysisResultDTO = extractJSON(text, as: AnalysisResultDTO.self) {
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

        // Fallback: Extract understanding from first paragraph
        let understanding = extractFirstParagraph(from: text)

        return AnalysisResult(
            understanding: understanding,
            questions: [],
            rawResponse: text
        )
    }

    // MARK: - Optimization Result Parsing

    /// Parse optimization result with highlights and rankings
    static func parseOptimizationResult(from text: String) -> OptimizationResult {
        let highlights = extractHighlights(from: text)
        let rankings = extractRankings(from: text)

        return OptimizationResult(
            markdown: text,
            highlights: highlights,
            rankings: rankings.isEmpty ? nil : rankings
        )
    }

    // MARK: - Highlight Extraction

    /// Extract bold text as highlights (up to 5)
    static func extractHighlights(from text: String) -> [String] {
        var highlights: [String] = []

        // Match **bold** text
        let pattern = "\\*\\*([^*]+)\\*\\*"
        if let regex = try? NSRegularExpression(pattern: pattern) {
            let matches = regex.matches(in: text, range: NSRange(text.startIndex..., in: text))
            for match in matches {
                if let range = Range(match.range(at: 1), in: text) {
                    let highlight = String(text[range]).trimmingCharacters(in: .whitespacesAndNewlines)
                    if !highlight.isEmpty && highlight.count < 100 {
                        highlights.append(highlight)
                    }
                }
            }
        }

        return Array(highlights.prefix(5))
    }

    // MARK: - Ranking Extraction

    /// Extract numbered items as rankings
    static func extractRankings(from text: String) -> [RankingItem] {
        var rankings: [RankingItem] = []
        let lines = text.components(separatedBy: .newlines)

        // Pattern: 1. Title or 1) Title, optionally followed by - or : and description
        let pattern = "^\\s*(\\d+)[.\\)]\\s+(.+?)(?:\\s*[-–:]\\s*(.+))?$"
        if let regex = try? NSRegularExpression(pattern: pattern) {
            for line in lines {
                if let match = regex.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)),
                   let rankRange = Range(match.range(at: 1), in: line),
                   let titleRange = Range(match.range(at: 2), in: line) {
                    let rank = Int(line[rankRange]) ?? 0
                    let title = String(line[titleRange]).trimmingCharacters(in: .whitespaces)

                    var description: String? = nil
                    if match.range(at: 3).location != NSNotFound,
                       let descRange = Range(match.range(at: 3), in: line) {
                        description = String(line[descRange]).trimmingCharacters(in: .whitespaces)
                    }

                    // Skip if title looks like a header or is too short
                    if title.count >= 3 && !title.hasPrefix("#") {
                        rankings.append(RankingItem(rank: rank, title: title, description: description))
                    }
                }
            }
        }

        // Return consecutive rankings starting from 1, limit to 10
        return rankings.filter { $0.rank <= 10 }
    }

    // MARK: - Helpers

    private static func extractFirstParagraph(from text: String) -> String {
        let lines = text.components(separatedBy: .newlines)
        var paragraph: [String] = []

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty {
                if !paragraph.isEmpty { break }
            } else if !trimmed.hasPrefix("#") && !trimmed.hasPrefix("```") {
                paragraph.append(trimmed)
            }
        }

        let result = paragraph.joined(separator: " ")
        return result.isEmpty ? String(text.prefix(500)) : result
    }
}

// MARK: - DTOs for Parsing

private struct AnalysisResultDTO: Decodable {
    let understanding: String
    let questions: [QuestionDTO]
}

private struct QuestionDTO: Decodable {
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
