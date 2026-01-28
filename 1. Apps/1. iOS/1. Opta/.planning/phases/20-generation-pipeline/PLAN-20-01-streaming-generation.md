# Plan 20-01: Streaming Text Generation

## Overview

Add real-time token streaming to the generation pipeline with UI progress feedback and improved cancellation.

**Phase**: 20 - Generation Pipeline
**Milestone**: v2.0 Local Intelligence
**Depends on**: Phase 19 (Vision Inference) complete

## Scope

| Aspect | Details |
|--------|---------|
| **Effort** | Medium (1-2 sessions) |
| **Risk** | Low (building on existing generate()) |
| **Files** | ~3 modified |

## Tasks

### Task 1: Create GenerationStream Observable

**Goal**: Real-time streaming state for UI consumption

**File**: `Opta Scan/Services/GenerationStream.swift` (new)

```swift
//
//  GenerationStream.swift
//  Opta Scan
//
//  Observable generation state for streaming UI updates
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
```

### Task 2: Add Streaming Callback to MLXService

**Goal**: Update generate() to call streaming callbacks

**File**: `Opta Scan/Services/MLXService.swift`

**Update the generate() method signature and implementation**:

Add parameter for streaming callback:
```swift
private func generate(
    prompt: String,
    image: UIImage?,
    maxTokens: Int,
    onProgress: ((String, Int) -> Void)? = nil
) async throws -> String
```

Inside the generate callback, update progress:
```swift
_ = try await MLXLMCommon.generate(
    input: prepared,
    parameters: parameters,
    context: context
) { [weak self] (tokenIds: [Int]) -> GenerateDisposition in
    // Check for cancellation
    if token.isCancelled {
        return .stop
    }

    allTokens.append(contentsOf: tokenIds)

    // Decode partial output for progress callback
    if let onProgress = onProgress {
        let partialText = context.tokenizer.decode(tokens: allTokens)
        // Call on main actor for UI safety
        Task { @MainActor in
            onProgress(partialText, allTokens.count)
        }
    }

    return .more
}
```

**Update public methods to accept streaming callback**:
```swift
func analyzeImage(
    _ image: UIImage,
    prompt: String,
    depth: OptimizationDepth,
    onProgress: ((String, Int) -> Void)? = nil
) async throws -> AnalysisResult

func analyzeText(
    prompt: String,
    depth: OptimizationDepth,
    onProgress: ((String, Int) -> Void)? = nil
) async throws -> AnalysisResult

func continueWithAnswers(
    _ answers: [String: String],
    context: AnalysisResult,
    onProgress: ((String, Int) -> Void)? = nil
) async throws -> OptimizationResult
```

### Task 3: Update LLMServiceManager for Streaming

**Goal**: Expose streaming through the service manager

**File**: `Opta Scan/Services/LLMProvider.swift`

**Add GenerationStream property**:
```swift
@MainActor
@Observable
final class LLMServiceManager {
    static let shared = LLMServiceManager()

    // MARK: - State

    private(set) var isProcessing = false
    private(set) var error: Error?
    let generationStream = GenerationStream()  // Add this

    // ... existing code ...
}
```

**Update analysis methods to use stream**:
```swift
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
        return try await localService.analyzeImage(
            image,
            prompt: prompt,
            depth: depth,
            onProgress: { [generationStream] text, count in
                generationStream.update(text: text, tokenCount: count)
            }
        )
    } catch {
        generationStream.fail(with: error)
        self.error = error
        throw error
    }
}
```

Apply same pattern to `analyzeText` and `continueWithAnswers`.

### Task 4: Add Cancel Method to LLMServiceManager

**Goal**: Expose cancellation through service manager

**File**: `Opta Scan/Services/LLMProvider.swift`

**Add cancel method**:
```swift
func cancelGeneration() async {
    await localService.cancelGeneration()
    generationStream.reset()
    isProcessing = false
}
```

### Task 5: Update ScanFlowState for Streaming UI

**Goal**: Connect streaming to ScanFlowState for ProcessingView

**File**: `Opta Scan/Models/ScanFlow.swift`

**Add stream observation**:
```swift
@MainActor
class ScanFlowState: ObservableObject {
    // ... existing properties ...

    // Add computed property for easy access
    var generationStream: GenerationStream {
        llmManager.generationStream
    }

    // Add cancel method
    func cancelProcessing() {
        Task {
            await llmManager.cancelGeneration()
            currentStep = .capture
            OptaHaptics.shared.tap()
        }
    }
}
```

### Task 6: Build Verification

**Goal**: Ensure streaming compiles

**Steps**:
1. Build project for iOS device target
2. Verify no compilation errors
3. Check all updated files compile
4. Document any API adjustments needed

## Checkpoints

- [ ] **Checkpoint 1**: GenerationStream created
- [ ] **Checkpoint 2**: MLXService streaming callbacks added
- [ ] **Checkpoint 3**: LLMServiceManager updated
- [ ] **Checkpoint 4**: Cancel method exposed
- [ ] **Checkpoint 5**: ScanFlowState connected
- [ ] **Checkpoint 6**: Build succeeds

## Verification

```bash
# Build for device (not simulator)
xcodebuild -project "Opta Scan.xcodeproj" \
  -scheme "Opta Scan" \
  -destination "generic/platform=iOS" \
  build
```

## Dependencies

**New files created**:
- `Opta Scan/Services/GenerationStream.swift`

**Existing files modified**:
- `Opta Scan/Services/MLXService.swift`
- `Opta Scan/Services/LLMProvider.swift`
- `Opta Scan/Models/ScanFlow.swift`

## Notes

- Streaming callback runs on main actor for UI safety
- Progress estimation based on tokenCount/maxTokens
- Cancel propagates through CancellationToken pattern from Phase 19
- Physical device testing required for actual streaming behavior

---

*Plan created: 2026-01-22*
*Phase: 20 - Generation Pipeline*
*Milestone: v2.0 Local Intelligence*
