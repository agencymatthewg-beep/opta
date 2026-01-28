# Plan 20-02: Response Parsing and Error Handling

## Overview

Enhance response parsing with better JSON extraction, error recovery, and robust fallbacks.

**Phase**: 20 - Generation Pipeline
**Milestone**: v2.0 Local Intelligence
**Depends on**: Plan 20-01 (Streaming Generation)

## Scope

| Aspect | Details |
|--------|---------|
| **Effort** | Low-Medium (1 session) |
| **Risk** | Low (improving existing parsing) |
| **Files** | ~2 modified |

## Tasks

### Task 1: Create ResponseParser Utility

**Goal**: Centralized, robust response parsing with multiple extraction strategies

**File**: `Opta Scan/Services/ResponseParser.swift` (new)

```swift
//
//  ResponseParser.swift
//  Opta Scan
//
//  Robust response parsing for LLM outputs
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

        // Pattern: 1. Title or 1) Title
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

        // Return consecutive rankings starting from 1
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
        return result.isEmpty ? text.prefix(500).description : result
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
```

### Task 2: Update MLXService to Use ResponseParser

**Goal**: Replace inline parsing with centralized ResponseParser

**File**: `Opta Scan/Services/MLXService.swift`

**Update parseAnalysisResult**:
```swift
private func parseAnalysisResult(from text: String) -> AnalysisResult {
    ResponseParser.parseAnalysisResult(from: text)
}

private func parseOptimizationResult(from text: String) -> OptimizationResult {
    ResponseParser.parseOptimizationResult(from: text)
}
```

**Remove the duplicate private parsing structs** (AnalysisResultJSON, QuestionJSON) since they're now in ResponseParser.

### Task 3: Add Generation Error Types

**Goal**: Comprehensive error types for generation failures

**File**: `Opta Scan/Services/MLXService.swift`

**Expand MLXError enum**:
```swift
enum MLXError: LocalizedError {
    case deviceNotSupported
    case modelNotLoaded
    case alreadyGenerating
    case generationCancelled
    case generationFailed(String)
    case parsingFailed(String)
    case visionNotSupported
    case imageProcessingFailed
    case downloadFailed(String)
    case outOfMemory
    case thermalThrottled

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
        case .generationFailed(let reason):
            return "Generation failed: \(reason)"
        case .parsingFailed(let reason):
            return "Failed to parse response: \(reason)"
        case .visionNotSupported:
            return "Vision model not loaded."
        case .imageProcessingFailed:
            return "Failed to process image."
        case .downloadFailed(let reason):
            return "Download failed: \(reason)"
        case .outOfMemory:
            return "Not enough memory. Try closing other apps."
        case .thermalThrottled:
            return "Device too hot. Please wait and try again."
        }
    }

    /// Whether this error is recoverable by retry
    var isRecoverable: Bool {
        switch self {
        case .generationCancelled, .alreadyGenerating, .thermalThrottled:
            return true
        case .outOfMemory:
            return true // After clearing cache
        default:
            return false
        }
    }
}
```

### Task 4: Add Error Recovery in Generate

**Goal**: Handle errors gracefully with recovery hints

**File**: `Opta Scan/Services/MLXService.swift`

**Wrap generation in error handling**:
```swift
// Inside generate() method, around the MLXLMCommon.generate call:
do {
    let result = try await container.perform { context in
        // ... existing code ...
    }
    continuation.resume(returning: result)
} catch let error as NSError {
    // Map common errors to MLXError
    if error.domain == "MLX" {
        if error.localizedDescription.contains("memory") {
            continuation.resume(throwing: MLXError.outOfMemory)
        } else {
            continuation.resume(throwing: MLXError.generationFailed(error.localizedDescription))
        }
    } else {
        continuation.resume(throwing: error)
    }
}
```

**Check thermal state before generation**:
```swift
// At the start of generate()
#if !targetEnvironment(simulator)
if ProcessInfo.processInfo.thermalState == .critical {
    throw MLXError.thermalThrottled
}
#endif
```

### Task 5: Add Retry Support to LLMServiceManager

**Goal**: Simple retry mechanism for recoverable errors

**File**: `Opta Scan/Services/LLMProvider.swift`

**Add retry helper**:
```swift
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
            // Brief pause before retry
            try await Task.sleep(nanoseconds: 500_000_000) // 0.5s
            continue
        } catch {
            throw error
        }
    }

    throw lastError ?? LLMServiceError.localModelNotLoaded
}
```

**Use in analysis methods** (optional enhancement):
```swift
func analyzeImage(...) async throws -> AnalysisResult {
    // ... guard checks ...

    return try await withRetry {
        try await localService.analyzeImage(...)
    }
}
```

### Task 6: Build Verification

**Goal**: Ensure parsing and error handling compiles

**Steps**:
1. Build project for iOS device target
2. Verify ResponseParser compiles
3. Verify MLXService updates compile
4. Check error types are consistent
5. Document any API adjustments

## Checkpoints

- [ ] **Checkpoint 1**: ResponseParser created
- [ ] **Checkpoint 2**: MLXService uses ResponseParser
- [ ] **Checkpoint 3**: Error types expanded
- [ ] **Checkpoint 4**: Error recovery added
- [ ] **Checkpoint 5**: Retry support added
- [ ] **Checkpoint 6**: Build succeeds

## Verification

```bash
# Build for device
xcodebuild -project "Opta Scan.xcodeproj" \
  -scheme "Opta Scan" \
  -destination "generic/platform=iOS" \
  build
```

## Dependencies

**New files created**:
- `Opta Scan/Services/ResponseParser.swift`

**Existing files modified**:
- `Opta Scan/Services/MLXService.swift`
- `Opta Scan/Services/LLMProvider.swift`

## Notes

- Multiple JSON extraction strategies handle varied LLM outputs
- Fallback parsing ensures graceful degradation
- Error types distinguish recoverable vs fatal errors
- Retry only for recoverable errors to avoid infinite loops
- Thermal check prevents generation during critical thermal state

---

*Plan created: 2026-01-22*
*Phase: 20 - Generation Pipeline*
*Milestone: v2.0 Local Intelligence*
