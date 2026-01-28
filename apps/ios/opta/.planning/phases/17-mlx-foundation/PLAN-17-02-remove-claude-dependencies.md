# Plan 17-02: Remove Claude Dependencies

## Overview

Remove all Claude API dependencies to make Opta a **local-only** application. No cloud AI - fully private, offline operation.

**Phase**: 17 - MLX Foundation
**Milestone**: v2.0 Local Intelligence
**Depends on**: Plan 17-01 (MLX Package Integration)

## Rationale

User requirement: "Remove claude and have Opta Only use Local LLMS"

Benefits:
- **Privacy**: No data leaves the device
- **Offline**: Works without internet
- **Cost**: No API fees
- **Speed**: No network latency

## Scope

| Aspect | Details |
|--------|---------|
| **Effort** | Low-Medium (1-2 focused sessions) |
| **Risk** | Low (straightforward removal) |
| **Files** | ~6 modified, 1 deleted |

## Tasks

### Task 1: Delete ClaudeService.swift

**Goal**: Remove Claude API client entirely

**Action**: Delete file
- `Opta Scan/Services/ClaudeService.swift`

**Steps**:
1. Remove file from Xcode project navigator
2. Delete from disk
3. Clean up any references

### Task 2: Update LLMProviderType

**Goal**: Remove Claude from provider enum

**File**: `Opta Scan/Services/LLMProvider.swift`

**Before**:
```swift
enum LLMProviderType: String, CaseIterable, Identifiable, Codable {
    case claude = "claude"
    case local = "local"
    // ...
}
```

**After**:
```swift
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
```

### Task 3: Simplify LLMServiceManager

**Goal**: Remove provider switching since only local exists

**File**: `Opta Scan/Services/LLMProvider.swift`

**Changes**:
```swift
@MainActor
@Observable
final class LLMServiceManager {
    static let shared = LLMServiceManager()

    // MARK: - State

    private(set) var isProcessing = false
    private(set) var error: Error?

    // MARK: - Provider (Local Only)

    private let localService = MLXService()

    // MARK: - Initialization

    private init() {
        // No provider preference needed - always local
    }

    // MARK: - Provider Access

    var provider: MLXService {
        localService
    }

    var isAvailable: Bool {
        get async {
            await localService.isAvailable
        }
    }

    var supportsVision: Bool {
        get async {
            await localService.supportsVision
        }
    }

    // MARK: - Model Management

    func loadModel(_ config: ModelConfiguration) async throws {
        try await localService.loadModel(config)
    }

    func unloadModel() async {
        await localService.unloadModel()
    }

    // MARK: - Analysis Methods

    func analyzeImage(_ image: UIImage, prompt: String, depth: OptimizationDepth) async throws -> AnalysisResult {
        guard await localService.isAvailable else {
            throw LLMServiceError.localModelNotLoaded
        }

        guard await localService.supportsVision else {
            throw LLMServiceError.visionNotSupported
        }

        isProcessing = true
        error = nil
        defer { isProcessing = false }

        do {
            return try await localService.analyzeImage(image, prompt: prompt, depth: depth)
        } catch {
            self.error = error
            throw error
        }
    }

    func analyzeText(prompt: String, depth: OptimizationDepth) async throws -> AnalysisResult {
        guard await localService.isAvailable else {
            throw LLMServiceError.localModelNotLoaded
        }

        isProcessing = true
        error = nil
        defer { isProcessing = false }

        do {
            return try await localService.analyzeText(prompt: prompt, depth: depth)
        } catch {
            self.error = error
            throw error
        }
    }

    func continueWithAnswers(_ answers: [String: String], context: AnalysisResult) async throws -> OptimizationResult {
        guard await localService.isAvailable else {
            throw LLMServiceError.localModelNotLoaded
        }

        isProcessing = true
        error = nil
        defer { isProcessing = false }

        do {
            return try await localService.continueWithAnswers(answers, context: context)
        } catch {
            self.error = error
            throw error
        }
    }
}

// MARK: - Simplified Errors

enum LLMServiceError: LocalizedError {
    case localModelNotLoaded
    case visionNotSupported

    var errorDescription: String? {
        switch self {
        case .localModelNotLoaded:
            return "Model not loaded. Download a model in Settings."
        case .visionNotSupported:
            return "Vision model required for image analysis."
        }
    }
}
```

### Task 4: Update SettingsView

**Goal**: Remove API key UI, show only local model management

**File**: `Opta Scan/Views/SettingsView.swift`

**Remove**:
- Provider selection (ForEach for LLMProviderType)
- Claude API key section
- `selectedProvider` state
- `apiKey` state
- `isAPIKeyVisible` state
- `apiKeySaveStatus` state

**Keep/Update**:
- Local Model section (make primary)
- Model download/management UI
- Model status display

**New Structure**:
```swift
struct SettingsView: View {
    @State private var modelStatus: ModelStatus = .notDownloaded
    @State private var downloadProgress: Double = 0

    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaBackground
                    .ignoresSafeArea()

                List {
                    // AI Model Section (Primary)
                    Section {
                        ModelStatusRow(
                            status: $modelStatus,
                            progress: $downloadProgress
                        )

                        // Model selection
                        ForEach(ModelConfiguration.all) { config in
                            ModelRow(config: config, isSelected: isModelSelected(config))
                        }
                    } header: {
                        Text("On-Device AI")
                    } footer: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("All processing happens locally on your device.")
                            Text("No data is sent to any server.")
                        }
                        .optaLabelStyle()
                    }

                    // Preferences Section (unchanged)
                    // Support Section (unchanged)
                    // Version footer (update to 2.0.0)
                }
            }
            .navigationTitle("Settings")
        }
    }
}
```

### Task 5: Update KeychainService Keys

**Goal**: Remove Claude-specific keys

**File**: `Opta Scan/Services/KeychainService.swift`

**Before**:
```swift
enum Key: String {
    case claudeAPIKey = "claude_api_key"
    case localModelPath = "local_model_path"
    case preferredProvider = "preferred_provider"
}
```

**After**:
```swift
enum Key: String {
    case downloadedModelId = "downloaded_model_id"
    case modelCachePath = "model_cache_path"
}
```

### Task 6: Delete LocalLLMService.swift (Replaced by MLXService)

**Goal**: Remove placeholder service

**Action**: Delete file
- `Opta Scan/Services/LocalLLMService.swift`

The new `MLXService.swift` from Plan 17-01 replaces this file with real implementation.

### Task 7: Update App Initialization

**Goal**: Initialize local model on app launch

**File**: `Opta Scan/Opta_ScanApp.swift`

**Add**:
```swift
@main
struct Opta_ScanApp: App {
    init() {
        // Check for downloaded model and load if available
        Task {
            await initializeLocalModel()
        }
    }

    private func initializeLocalModel() async {
        // Check if model was previously downloaded
        if let modelId = try? await KeychainService.shared.retrieve(.downloadedModelId),
           let config = ModelConfiguration.all.first(where: { $0.id == modelId }) {
            do {
                try await LLMServiceManager.shared.loadModel(config)
            } catch {
                // Model loading failed - user needs to re-download
                print("Failed to load model: \(error)")
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

### Task 8: Update Info.plist Descriptions

**Goal**: Update privacy descriptions for local-only operation

**File**: `Opta Scan/Info.plist`

**Update descriptions** to reflect local processing:
```xml
<key>NSCameraUsageDescription</key>
<string>Opta uses your camera to capture images for on-device optimization analysis. Images are processed locally and never leave your device.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Opta accesses your photos for on-device optimization analysis. All processing happens locally on your device.</string>
```

### Task 9: Verify Build and Test

**Goal**: Ensure app builds and functions without Claude

**Steps**:
1. Build project
2. Fix any missing reference errors
3. Run on simulator (model won't load, but UI should work)
4. Verify Settings shows model management only

## Checkpoints

- [ ] **Checkpoint 1**: ClaudeService.swift deleted
- [ ] **Checkpoint 2**: LLMProvider simplified
- [ ] **Checkpoint 3**: SettingsView updated
- [ ] **Checkpoint 4**: Build succeeds
- [ ] **Checkpoint 5**: Settings shows local-only UI

## Verification

```bash
# Build
xcodebuild -project "Opta Scan.xcodeproj" \
  -scheme "Opta Scan" \
  -destination "platform=iOS Simulator,name=iPhone 17 Pro" \
  build

# Should have NO references to:
grep -r "claude" "Opta Scan/" --include="*.swift" | grep -v "// Removed"
# Expected: No results
```

## Files Summary

**Deleted**:
- `Opta Scan/Services/ClaudeService.swift`
- `Opta Scan/Services/LocalLLMService.swift`

**Modified**:
- `Opta Scan/Services/LLMProvider.swift` (simplified)
- `Opta Scan/Services/KeychainService.swift` (updated keys)
- `Opta Scan/Views/SettingsView.swift` (local-only UI)
- `Opta Scan/Opta_ScanApp.swift` (model initialization)
- `Opta Scan/Info.plist` (updated descriptions)

## Migration Notes

- Users with existing Claude API keys: Key will be orphaned (not deleted, just unused)
- No data migration needed - local model is new functionality
- First launch after update will prompt model download

---

*Plan created: 2026-01-21*
*Phase: 17 - MLX Foundation*
*Milestone: v2.0 Local Intelligence*
