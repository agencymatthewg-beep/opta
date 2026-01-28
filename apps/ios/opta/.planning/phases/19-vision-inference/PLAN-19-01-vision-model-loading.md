# Plan 19-01: Vision Model Loading

## Overview

Implement actual vision model loading and generation using MLX Swift LM APIs.

**Phase**: 19 - Vision Inference
**Milestone**: v2.0 Local Intelligence
**Depends on**: Phase 18 (Model Management) complete

## Research Summary

Based on MLX Vision exploration:
- **VLM Factory**: Use `VLMModelFactory` or `LLMModelFactory` (both work for Llama 3.2 Vision)
- **Image Input**: `UserInput(prompt:images:)` with `.url()` or `.data()` image sources
- **Generation**: `MLXLMCommon.generate()` with async token streaming callback
- **Processor**: `context.processor.prepare(input:)` for tokenization

## Scope

| Aspect | Details |
|--------|---------|
| **Effort** | Medium (2 sessions) |
| **Risk** | Medium (real device testing required) |
| **Files** | ~2 modified |

## Tasks

### Task 1: Add MLXLMCommon Import

**Goal**: Import required modules for generation

**File**: `Opta Scan/Services/MLXService.swift`

**Update imports**:
```swift
#if canImport(MLX) && canImport(MLXLLM) && !targetEnvironment(simulator)
import MLX
import MLXLLM
import MLXLMCommon  // Add this for generate() API
#endif
```

### Task 2: Implement generate() Method

**Goal**: Replace placeholder with actual MLX generation

**File**: `Opta Scan/Services/MLXService.swift`

**Replace generate() method (lines 175-209)**:
```swift
private func generate(
    prompt: String,
    image: UIImage?,
    maxTokens: Int
) async throws -> String {
    guard !isGenerating else {
        throw MLXError.alreadyGenerating
    }

    isGenerating = true
    defer { isGenerating = false }

    #if canImport(MLX) && canImport(MLXLLM) && !targetEnvironment(simulator)
    guard let container = modelContainer else {
        throw MLXError.modelNotLoaded
    }

    // Build UserInput with optional image
    var input: UserInput
    if let image = image, let imageData = image.jpegData(compressionQuality: 0.9) {
        input = UserInput(
            prompt: prompt,
            images: [.data(imageData)]
        )
    } else {
        input = UserInput(prompt: prompt)
    }

    // Generate parameters
    let parameters = GenerateParameters(
        maxTokens: maxTokens,
        temperature: 0.7,
        topP: 0.9
    )

    // Perform generation within model context
    let result = try await container.perform { [input, parameters] context in
        // Prepare input (tokenize prompt + encode image)
        let prepared = try await context.processor.prepare(input: input)

        // Stream generation
        var output = ""
        var tokenCount = 0

        try await MLXLMCommon.generate(
            input: prepared,
            parameters: parameters,
            context: context
        ) { token in
            output += token
            tokenCount += 1
            // Continue until maxTokens or natural end
            return tokenCount < parameters.maxTokens ? .more : .stop
        }

        return output
    }

    return result
    #else
    throw MLXError.deviceNotSupported
    #endif
}
```

### Task 3: Add Generation State Tracking

**Goal**: Track generation progress for UI feedback

**File**: `Opta Scan/Services/MLXService.swift`

**Add state property**:
```swift
// MARK: - State
private var isModelLoaded = false
private var loadedModelConfig: OptaModelConfiguration?
private var isGenerating = false
private(set) var generationProgress: Int = 0  // Token count

// Public accessor for UI
var currentGenerationProgress: Int {
    generationProgress
}
```

**Update generate() to track progress**:
```swift
try await MLXLMCommon.generate(
    input: prepared,
    parameters: parameters,
    context: context
) { [weak self] token in
    output += token
    tokenCount += 1

    // Update progress (actor-safe)
    Task { @MainActor in
        // Note: This requires a separate mechanism for actor isolation
        // Consider using AsyncStream for progress updates
    }

    return tokenCount < parameters.maxTokens ? .more : .stop
}
```

### Task 4: Handle Generation Cancellation

**Goal**: Support cancelling long-running generations

**File**: `Opta Scan/Services/MLXService.swift`

**Add cancellation support**:
```swift
// MARK: - State
private var generationTask: Task<String, Error>?

/// Cancel current generation
func cancelGeneration() {
    generationTask?.cancel()
    generationTask = nil
    isGenerating = false
}

// Update generate() to check for cancellation
try await MLXLMCommon.generate(...) { token in
    // Check for cancellation
    if Task.isCancelled {
        return .stop
    }

    output += token
    tokenCount += 1
    return tokenCount < parameters.maxTokens ? .more : .stop
}
```

### Task 5: Add Memory Management

**Goal**: Manage GPU memory during generation

**File**: `Opta Scan/Services/MLXService.swift`

**Add memory cleanup in generate()**:
```swift
private func generate(...) async throws -> String {
    // ... existing code ...

    #if canImport(MLX) && canImport(MLXLLM) && !targetEnvironment(simulator)
    // Set appropriate cache limit based on model
    let cacheLimit: Int
    if loadedModelConfig?.id == OptaModelConfiguration.llama32_11B_Vision.id {
        cacheLimit = 100 * 1024 * 1024  // 100MB for 11B
    } else {
        cacheLimit = 20 * 1024 * 1024   // 20MB for smaller models
    }
    GPU.set(cacheLimit: cacheLimit)

    defer {
        // Cleanup after generation
        GPU.clearCache()
    }

    // ... generation code ...
    #endif
}
```

### Task 6: Verify Build on Device Target

**Goal**: Ensure generation compiles for device

**Steps**:
1. Build for iOS device target (not simulator)
2. Verify `MLXLMCommon.generate` is available
3. Check no compilation errors
4. Document any API differences found

## Checkpoints

- [ ] **Checkpoint 1**: MLXLMCommon imported
- [ ] **Checkpoint 2**: generate() implemented
- [ ] **Checkpoint 3**: Progress tracking added
- [ ] **Checkpoint 4**: Cancellation support added
- [ ] **Checkpoint 5**: Memory management added
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

**Modified files**:
- `Opta Scan/Services/MLXService.swift`

**Required packages** (already added in Phase 17):
- mlx-swift >= 0.29.1
- mlx-swift-lm

## Notes

- Actual generation requires physical device testing
- API may differ slightly from research - adapt as needed
- Memory limits critical for 11B model stability
- Thermal throttling from Phase 15 still applies

---

*Plan created: 2026-01-22*
*Phase: 19 - Vision Inference*
*Milestone: v2.0 Local Intelligence*
