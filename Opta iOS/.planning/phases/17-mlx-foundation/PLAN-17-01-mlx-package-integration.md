# Plan 17-01: MLX Package Integration

## Overview

Add MLX Swift framework and establish on-device LLM infrastructure for Llama 3.2 11B Vision.

**Phase**: 17 - MLX Foundation
**Milestone**: v2.0 Local Intelligence
**Depends on**: v1.2 Premium Polish (complete)

## Research Summary

Based on MLX Swift exploration:
- **Repository**: ml-explore/mlx-swift (core) + ml-explore/mlx-swift-lm (LLM support)
- **iOS Requirement**: iOS 17.2+ on physical device (simulator not supported)
- **Target Model**: Llama 3.2 11B Vision 4-bit (~8-12 GB memory)
- **Device Target**: iPhone 15 Pro+ (12GB RAM) or iPad Pro M1+

## Scope

| Aspect | Details |
|--------|---------|
| **Effort** | Medium (2-3 focused sessions) |
| **Risk** | Medium (new framework, memory constraints) |
| **Files** | ~5 new/modified |

## Tasks

### Task 1: Add MLX Swift Packages

**Goal**: Integrate MLX Swift and MLX Swift LM via Swift Package Manager

**Steps**:
1. Open `Opta Scan.xcodeproj` in Xcode
2. Add Swift Package dependencies:
   - `https://github.com/ml-explore/mlx-swift` (from: "0.10.0")
   - `https://github.com/ml-explore/mlx-swift-lm` (branch: main)
3. Link targets: `MLX`, `MLXNN`, `MLXLLM`
4. Verify build succeeds

**Verification**:
```swift
import MLX
import MLXLLM
// Should compile without errors
```

### Task 2: Configure Entitlements

**Goal**: Add required capabilities for MLX operation

**File**: `Opta Scan/Opta Scan.entitlements`

**Add**:
```xml
<key>com.apple.developer.network.client</key>
<true/>
<key>com.apple.developer.kernel.increased-memory-limit</key>
<true/>
```

**Rationale**:
- Network client: Download models from Hugging Face
- Increased memory limit: 11B model requires ~12GB unified memory

### Task 3: Update iOS Deployment Target

**Goal**: Ensure iOS 17.2+ minimum for MLX compatibility

**File**: `Opta Scan.xcodeproj/project.pbxproj`

**Change**:
- `IPHONEOS_DEPLOYMENT_TARGET` from `17.0` to `17.2`

**Impact**: Drops support for iOS 17.0-17.1 (minimal user impact)

### Task 4: Create MLX Service Foundation

**Goal**: Build production MLX service replacing placeholder

**File**: `Opta Scan/Services/MLXService.swift` (new)

```swift
//
//  MLXService.swift
//  Opta Scan
//
//  MLX Swift service for on-device Llama 3.2 11B Vision inference
//

import Foundation
import UIKit
import MLX
import MLXLLM

// MARK: - MLX Service

actor MLXService: LLMProvider {

    // MARK: - LLMProvider Properties

    let id: LLMProviderType = .local
    let name = "On-Device (Llama 3.2)"
    let requiresAPIKey = false
    var supportsVision: Bool { loadedModel?.supportsVision ?? false }

    var isAvailable: Bool {
        get async {
            return loadedModel != nil && isDeviceSupported
        }
    }

    // MARK: - State

    private var loadedModel: LoadedModel?
    private var isGenerating = false

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

    // MARK: - Model Loading

    func loadModel(_ config: ModelConfiguration) async throws {
        guard isDeviceSupported else {
            throw MLXError.deviceNotSupported
        }

        // Set GPU cache limit for memory management
        MLX.GPU.set(cacheLimit: 20 * 1024 * 1024)

        // Load model using mlx-swift-lm
        let container = try await LLMModelFactory.shared.loadContainer(
            configuration: config
        )

        loadedModel = LoadedModel(
            container: container,
            config: config,
            supportsVision: config.name.contains("Vision")
        )
    }

    func unloadModel() {
        loadedModel = nil
        // Force memory cleanup
        MLX.GPU.synchronize()
    }

    // MARK: - LLMProvider Methods

    func analyzeImage(_ image: UIImage, prompt: String, depth: OptimizationDepth) async throws -> AnalysisResult {
        guard let model = loadedModel, model.supportsVision else {
            throw MLXError.visionNotSupported
        }

        // Prepare image for vision model
        let imageData = try prepareImage(image)

        // Generate with vision prompt
        let systemPrompt = buildSystemPrompt(depth: depth)
        let response = try await generate(
            systemPrompt: systemPrompt,
            userPrompt: prompt,
            imageData: imageData,
            maxTokens: depth.maxTokens
        )

        return parseAnalysisResult(from: response)
    }

    func analyzeText(prompt: String, depth: OptimizationDepth) async throws -> AnalysisResult {
        guard loadedModel != nil else {
            throw MLXError.modelNotLoaded
        }

        let systemPrompt = buildSystemPrompt(depth: depth)
        let response = try await generate(
            systemPrompt: systemPrompt,
            userPrompt: prompt,
            imageData: nil,
            maxTokens: depth.maxTokens
        )

        return parseAnalysisResult(from: response)
    }

    func continueWithAnswers(_ answers: [String: String], context: AnalysisResult) async throws -> OptimizationResult {
        guard loadedModel != nil else {
            throw MLXError.modelNotLoaded
        }

        let followUpPrompt = buildFollowUpPrompt(context: context, answers: answers)
        let response = try await generate(
            systemPrompt: "You are Opta, an optimization assistant. Provide comprehensive recommendations.",
            userPrompt: followUpPrompt,
            imageData: nil,
            maxTokens: 4096
        )

        return parseOptimizationResult(from: response)
    }

    // MARK: - Private Generation

    private func generate(
        systemPrompt: String,
        userPrompt: String,
        imageData: Data?,
        maxTokens: Int
    ) async throws -> String {
        guard let model = loadedModel else {
            throw MLXError.modelNotLoaded
        }

        guard !isGenerating else {
            throw MLXError.alreadyGenerating
        }

        isGenerating = true
        defer { isGenerating = false }

        // Build input for model
        var input = LLMInput(
            systemPrompt: systemPrompt,
            userPrompt: userPrompt
        )

        if let imageData = imageData {
            input.images = [imageData]
        }

        // Generate tokens
        var output = ""
        let generateParams = GenerateParameters(
            maxTokens: maxTokens,
            temperature: 0.7,
            topP: 0.9
        )

        for try await token in model.container.generate(input: input, parameters: generateParams) {
            output += token
        }

        return output
    }

    // MARK: - Image Preparation

    private func prepareImage(_ image: UIImage) throws -> Data {
        // Resize to model's expected input size (typically 336x336 or 560x560)
        let targetSize = CGSize(width: 560, height: 560)

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1.0

        let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)
        let resized = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }

        guard let data = resized.jpegData(compressionQuality: 0.9) else {
            throw MLXError.imageProcessingFailed
        }

        return data
    }

    // MARK: - Prompt Building (same as before)

    private func buildSystemPrompt(depth: OptimizationDepth) -> String {
        """
        You are Opta, an optimization assistant that helps users make the best decisions.

        Depth: \(depth.rawValue)

        Response format - JSON:
        ```json
        {
            "understanding": "Brief summary",
            "questions": [
                {"id": "q1", "text": "Question?", "type": "single_choice", "options": ["A", "B", "C"]}
            ]
        }
        ```
        """
    }

    private func buildFollowUpPrompt(context: AnalysisResult, answers: [String: String]) -> String {
        var prompt = "Original: \(context.understanding)\n\nAnswers:\n"
        for (qid, answer) in answers {
            if let q = context.questions.first(where: { $0.id == qid }) {
                prompt += "- \(q.text): \(answer)\n"
            }
        }
        prompt += "\nProvide optimization recommendation with rankings and highlights."
        return prompt
    }

    // MARK: - Response Parsing (reuse existing)

    private func parseAnalysisResult(from text: String) -> AnalysisResult {
        // JSON extraction logic (same as LocalLLMService)
        if let jsonRange = text.range(of: "```json"),
           let endRange = text.range(of: "```", range: jsonRange.upperBound..<text.endIndex) {
            let json = String(text[jsonRange.upperBound..<endRange.lowerBound])
            if let data = json.data(using: .utf8),
               let parsed = try? JSONDecoder().decode(AnalysisJSON.self, from: data) {
                return AnalysisResult(
                    understanding: parsed.understanding,
                    questions: parsed.questions.map { q in
                        OptimizationQuestion(
                            id: q.id, text: q.text,
                            type: QuestionType(rawValue: q.type) ?? .text,
                            options: q.options, placeholder: q.placeholder,
                            min: q.min, max: q.max, defaultValue: q.defaultValue
                        )
                    },
                    rawResponse: text
                )
            }
        }
        return AnalysisResult(understanding: text, questions: [], rawResponse: text)
    }

    private func parseOptimizationResult(from text: String) -> OptimizationResult {
        OptimizationResult(
            markdown: text,
            highlights: extractHighlights(from: text),
            rankings: extractRankings(from: text)
        )
    }

    private func extractHighlights(from text: String) -> [String] {
        // Same implementation as before
        []
    }

    private func extractRankings(from text: String) -> [RankingItem]? {
        // Same implementation as before
        nil
    }
}

// MARK: - Supporting Types

private struct LoadedModel {
    let container: ModelContainer
    let config: ModelConfiguration
    let supportsVision: Bool
}

private struct AnalysisJSON: Decodable {
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
        case .visionNotSupported:
            return "Vision model not loaded."
        case .imageProcessingFailed:
            return "Failed to process image."
        case .downloadFailed(let reason):
            return "Download failed: \(reason)"
        }
    }
}
```

### Task 5: Create Model Configuration

**Goal**: Define available model configurations

**File**: `Opta Scan/Models/ModelConfiguration.swift` (new)

```swift
//
//  ModelConfiguration.swift
//  Opta Scan
//
//  MLX model configurations for Opta
//

import Foundation

struct ModelConfiguration: Identifiable, Codable {
    let id: String
    let name: String
    let displayName: String
    let description: String
    let sizeGB: Double
    let contextLength: Int
    let supportsVision: Bool
    let minimumRAM: Int // GB

    // MARK: - Available Models

    static let llama32_11B_Vision = ModelConfiguration(
        id: "llama-3.2-11b-vision",
        name: "mlx-community/Llama-3.2-11B-Vision-Instruct-4bit",
        displayName: "Llama 3.2 11B Vision",
        description: "Full vision capabilities with image understanding",
        sizeGB: 6.5,
        contextLength: 8192,
        supportsVision: true,
        minimumRAM: 12
    )

    static let llama32_3B = ModelConfiguration(
        id: "llama-3.2-3b",
        name: "mlx-community/Llama-3.2-3B-Instruct-4bit",
        displayName: "Llama 3.2 3B",
        description: "Compact model for faster responses",
        sizeGB: 2.0,
        contextLength: 4096,
        supportsVision: false,
        minimumRAM: 6
    )

    static let all: [ModelConfiguration] = [
        .llama32_11B_Vision,
        .llama32_3B
    ]

    static let `default` = llama32_11B_Vision
}
```

### Task 6: Verify Build

**Goal**: Ensure project builds with MLX packages

**Steps**:
1. Clean build folder (Cmd+Shift+K)
2. Build for device (iPhone 15 Pro or later)
3. Resolve any import/linking issues
4. Verify `import MLX` and `import MLXLLM` work

**Expected**: Build succeeds without errors

## Checkpoints

- [ ] **Checkpoint 1**: MLX packages added to project
- [ ] **Checkpoint 2**: Entitlements configured
- [ ] **Checkpoint 3**: MLXService compiles
- [ ] **Checkpoint 4**: Build succeeds on device target

## Verification

```bash
# Build for device
xcodebuild -project "Opta Scan.xcodeproj" \
  -scheme "Opta Scan" \
  -destination "generic/platform=iOS" \
  build
```

## Notes

- MLX doesn't work in simulator - always build for device
- First-time package resolution may take a few minutes
- Memory limits only apply on actual device execution
- Vision model requires 12GB+ RAM (iPhone 15 Pro Max, iPad Pro M1+)

## Dependencies

**Packages**:
- `ml-explore/mlx-swift` >= 0.10.0
- `ml-explore/mlx-swift-lm` (main branch)

**Files Modified**:
- `Opta Scan.xcodeproj/project.pbxproj`
- `Opta Scan/Opta Scan.entitlements`

**Files Created**:
- `Opta Scan/Services/MLXService.swift`
- `Opta Scan/Models/ModelConfiguration.swift`

---

*Plan created: 2026-01-21*
*Phase: 17 - MLX Foundation*
*Milestone: v2.0 Local Intelligence*
