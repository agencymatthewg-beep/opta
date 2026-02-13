# Plan 19-02: Image Preprocessing Pipeline

## Overview

Optimize image preprocessing for Llama 3.2 Vision model input with memory-efficient handling.

**Phase**: 19 - Vision Inference
**Milestone**: v2.0 Local Intelligence
**Depends on**: Plan 19-01 (Vision Model Loading)

## Research Summary

Based on MLX Vision model requirements:
- **Input Format**: JPEG data via `UserInput.Image.data()`
- **Resolution**: 560x560 or 336x336 typical for vision models
- **Compression**: JPEG at 0.9 quality balances size vs quality
- **Memory**: Process images before passing to model to avoid OOM

## Scope

| Aspect | Details |
|--------|---------|
| **Effort** | Low (1 session) |
| **Risk** | Low (standard image processing) |
| **Files** | ~1 modified |

## Tasks

### Task 1: Create ImagePreprocessor Utility

**Goal**: Centralize image preprocessing logic

**File**: `Opta Scan/Services/ImagePreprocessor.swift` (new)

```swift
//
//  ImagePreprocessor.swift
//  Opta Scan
//
//  Image preprocessing for vision model input
//

import UIKit

// MARK: - Image Preprocessor

enum ImagePreprocessor {

    // MARK: - Configuration

    /// Target size for vision model input
    static let targetSize = CGSize(width: 560, height: 560)

    /// JPEG compression quality (0.0-1.0)
    static let compressionQuality: CGFloat = 0.9

    /// Maximum dimension before downscaling
    static let maxDimension: CGFloat = 2048

    // MARK: - Preprocessing

    /// Prepare image for vision model
    /// - Parameter image: Original UIImage
    /// - Returns: Preprocessed UIImage at target size
    static func prepare(_ image: UIImage) -> UIImage {
        // Step 1: Downscale if too large (memory safety)
        let safeImage = constrainSize(image, maxDimension: maxDimension)

        // Step 2: Resize to target dimensions
        let resized = resize(safeImage, to: targetSize)

        return resized
    }

    /// Convert image to JPEG data for model input
    /// - Parameter image: Preprocessed UIImage
    /// - Returns: JPEG data or nil if conversion fails
    static func toJPEGData(_ image: UIImage) -> Data? {
        image.jpegData(compressionQuality: compressionQuality)
    }

    /// Full pipeline: prepare and convert to data
    /// - Parameter image: Original UIImage
    /// - Returns: Preprocessed JPEG data ready for model
    static func preprocess(_ image: UIImage) -> Data? {
        let prepared = prepare(image)
        return toJPEGData(prepared)
    }

    // MARK: - Private Helpers

    private static func constrainSize(_ image: UIImage, maxDimension: CGFloat) -> UIImage {
        let size = image.size
        let maxSide = max(size.width, size.height)

        guard maxSide > maxDimension else {
            return image
        }

        let scale = maxDimension / maxSide
        let newSize = CGSize(
            width: size.width * scale,
            height: size.height * scale
        )

        return resize(image, to: newSize)
    }

    private static func resize(_ image: UIImage, to targetSize: CGSize) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1.0  // Exact pixel dimensions
        format.opaque = true  // No alpha channel needed

        let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)

        return renderer.image { context in
            // Use high-quality interpolation
            context.cgContext.interpolationQuality = .high

            // Calculate aspect-fill rect (center crop)
            let rect = aspectFillRect(for: image.size, in: targetSize)
            image.draw(in: rect)
        }
    }

    private static func aspectFillRect(for sourceSize: CGSize, in targetSize: CGSize) -> CGRect {
        let sourceAspect = sourceSize.width / sourceSize.height
        let targetAspect = targetSize.width / targetSize.height

        var drawSize = targetSize
        var origin = CGPoint.zero

        if sourceAspect > targetAspect {
            // Source is wider - fit height, crop width
            drawSize.width = targetSize.height * sourceAspect
            origin.x = (targetSize.width - drawSize.width) / 2
        } else {
            // Source is taller - fit width, crop height
            drawSize.height = targetSize.width / sourceAspect
            origin.y = (targetSize.height - drawSize.height) / 2
        }

        return CGRect(origin: origin, size: drawSize)
    }
}

// MARK: - UIImage Extension

extension UIImage {
    /// Preprocessed version ready for vision model
    var preprocessedForVision: UIImage {
        ImagePreprocessor.prepare(self)
    }

    /// JPEG data ready for vision model input
    var visionModelData: Data? {
        ImagePreprocessor.preprocess(self)
    }
}
```

### Task 2: Update MLXService to Use ImagePreprocessor

**Goal**: Replace inline image preparation with preprocessor

**File**: `Opta Scan/Services/MLXService.swift`

**Update prepareImage() method (lines 213-226)**:
```swift
private func prepareImage(_ image: UIImage) -> UIImage {
    ImagePreprocessor.prepare(image)
}
```

**Update generate() to use preprocessor for data conversion**:
```swift
// In generate() method, replace inline jpegData call:
if let image = image, let imageData = image.visionModelData {
    input = UserInput(
        prompt: prompt,
        images: [.data(imageData)]
    )
}
```

### Task 3: Add Memory-Safe Image Loading

**Goal**: Handle large images without memory pressure

**File**: `Opta Scan/Services/ImagePreprocessor.swift`

**Add async loading for PhotosUI results**:
```swift
// MARK: - Async Loading

extension ImagePreprocessor {
    /// Load and preprocess from PhotosPickerItem
    /// - Parameter item: PhotosPicker selection
    /// - Returns: Preprocessed image or nil
    @available(iOS 16.0, *)
    static func load(from item: PhotosPickerItem) async -> UIImage? {
        guard let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data) else {
            return nil
        }

        // Preprocess immediately to release original data
        return prepare(image)
    }
}
```

### Task 4: Add Image Quality Tiers

**Goal**: Adapt preprocessing based on performance tier

**File**: `Opta Scan/Services/ImagePreprocessor.swift`

**Add quality tier support**:
```swift
// MARK: - Quality Tiers

extension ImagePreprocessor {
    /// Target size based on quality tier
    static func targetSize(for tier: QualityTier) -> CGSize {
        switch tier {
        case .ultra, .high:
            return CGSize(width: 560, height: 560)
        case .medium:
            return CGSize(width: 448, height: 448)
        case .low:
            return CGSize(width: 336, height: 336)
        }
    }

    /// Compression quality based on quality tier
    static func compressionQuality(for tier: QualityTier) -> CGFloat {
        switch tier {
        case .ultra, .high:
            return 0.9
        case .medium:
            return 0.85
        case .low:
            return 0.8
        }
    }

    /// Prepare image with quality tier adaptation
    static func prepare(_ image: UIImage, tier: QualityTier) -> UIImage {
        let safeImage = constrainSize(image, maxDimension: maxDimension)
        let size = targetSize(for: tier)
        return resize(safeImage, to: size)
    }

    /// Full pipeline with quality tier
    static func preprocess(_ image: UIImage, tier: QualityTier) -> Data? {
        let prepared = prepare(image, tier: tier)
        let quality = compressionQuality(for: tier)
        return prepared.jpegData(compressionQuality: quality)
    }
}
```

### Task 5: Update MLXService for Quality-Aware Preprocessing

**Goal**: Use PerformanceManager tier for image preprocessing

**File**: `Opta Scan/Services/MLXService.swift`

**Update generate() method**:
```swift
private func generate(
    prompt: String,
    image: UIImage?,
    maxTokens: Int
) async throws -> String {
    // ... existing guard clauses ...

    #if canImport(MLX) && canImport(MLXLLM) && !targetEnvironment(simulator)
    // Get current quality tier
    let tier = await MainActor.run { PerformanceManager.shared.effectiveQuality }

    // Build UserInput with quality-adapted image
    var input: UserInput
    if let image = image,
       let imageData = ImagePreprocessor.preprocess(image, tier: tier) {
        input = UserInput(
            prompt: prompt,
            images: [.data(imageData)]
        )
    } else if let image = image {
        // Fallback to default preprocessing
        input = UserInput(
            prompt: prompt,
            images: image.visionModelData.map { [.data($0)] } ?? []
        )
    } else {
        input = UserInput(prompt: prompt)
    }

    // ... rest of generation code ...
    #endif
}
```

### Task 6: Verify Build

**Goal**: Ensure preprocessing compiles

**Steps**:
1. Build project
2. Verify ImagePreprocessor compiles
3. Verify MLXService updates compile
4. Check no warnings

## Checkpoints

- [ ] **Checkpoint 1**: ImagePreprocessor created
- [ ] **Checkpoint 2**: MLXService uses preprocessor
- [ ] **Checkpoint 3**: Async loading added
- [ ] **Checkpoint 4**: Quality tiers added
- [ ] **Checkpoint 5**: Build succeeds

## Verification

```bash
# Build for device
xcodebuild -project "Opta Scan.xcodeproj" \
  -scheme "Opta Scan" \
  -destination "generic/platform=iOS" \
  build

# Check new file
ls -la "Opta Scan/Services/ImagePreprocessor.swift"
```

## Dependencies

**New files created**:
- `Opta Scan/Services/ImagePreprocessor.swift`

**Existing files modified**:
- `Opta Scan/Services/MLXService.swift`

**Internal dependencies**:
- `PerformanceManager.shared.effectiveQuality` (from Phase 15)
- `QualityTier` enum (from Phase 15)

## Notes

- Aspect-fill cropping ensures no letterboxing
- Quality tiers reduce memory on thermal pressure
- JPEG compression significant for 11B model memory
- PhotosUI async loading prevents main thread blocking

---

*Plan created: 2026-01-22*
*Phase: 19 - Vision Inference*
*Milestone: v2.0 Local Intelligence*
