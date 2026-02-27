# Plan 18-01: Model Download System

## Overview

Implement model downloading from Hugging Face Hub with progress tracking and user-friendly UI.

**Phase**: 18 - Model Management
**Milestone**: v2.0 Local Intelligence
**Depends on**: Phase 17 (MLX Foundation) complete

## Research Summary

Based on MLX Swift LM exploration:
- **Primary API**: `LLMModelFactory.shared.loadContainer(configuration:progressHandler:)`
- **Progress**: `progress.fractionCompleted` (0.0-1.0) via handler
- **Storage**: Auto-managed in Documents directory by HubApi
- **Model ID**: Hugging Face format `{org}/{model-name}`

## Scope

| Aspect | Details |
|--------|---------|
| **Effort** | Medium (2 sessions) |
| **Risk** | Low (using established MLX APIs) |
| **Files** | ~4 new/modified |

## Tasks

### Task 1: Create ModelDownloadManager

**Goal**: Service to manage model downloads with progress tracking

**File**: `Opta Scan/Services/ModelDownloadManager.swift` (new)

```swift
//
//  ModelDownloadManager.swift
//  Opta Scan
//
//  Manages MLX model downloads from Hugging Face Hub
//

import Foundation
import SwiftUI

#if canImport(MLX) && canImport(MLXLLM)
import MLX
import MLXLLM
#endif

// MARK: - Model Download Manager

@MainActor
@Observable
final class ModelDownloadManager {
    static let shared = ModelDownloadManager()

    // MARK: - State

    private(set) var downloadStates: [String: ModelDownloadState] = [:]
    private(set) var activeDownloadId: String?
    private(set) var downloadProgress: Double = 0

    // MARK: - Download State Per Model

    func state(for model: OptaModelConfiguration) -> ModelDownloadState {
        downloadStates[model.id] ?? .notDownloaded
    }

    // MARK: - Download

    func downloadModel(_ config: OptaModelConfiguration) async throws {
        guard activeDownloadId == nil else {
            throw ModelDownloadError.downloadInProgress
        }

        guard config.isCompatibleWithDevice() else {
            throw ModelDownloadError.insufficientMemory(required: config.minimumRAM)
        }

        // Check available storage
        let requiredBytes = Int64(config.sizeGB * 1024 * 1024 * 1024)
        guard hasAvailableStorage(bytes: requiredBytes) else {
            throw ModelDownloadError.insufficientStorage(required: config.sizeGB)
        }

        activeDownloadId = config.id
        downloadProgress = 0
        downloadStates[config.id] = .downloading(progress: 0)

        do {
            #if canImport(MLX) && canImport(MLXLLM)
            // Set GPU cache limit
            GPU.set(cacheLimit: 20 * 1024 * 1024)

            // Load model (downloads if not cached)
            let modelConfig = ModelConfiguration(id: config.name)

            let container = try await LLMModelFactory.shared.loadContainer(
                configuration: modelConfig
            ) { [weak self] progress in
                Task { @MainActor in
                    self?.downloadProgress = progress.fractionCompleted
                    self?.downloadStates[config.id] = .downloading(progress: progress.fractionCompleted)
                }
            }

            // Store reference for later use
            await ModelCache.shared.store(container: container, for: config)
            #endif

            downloadStates[config.id] = .downloaded
            saveDownloadedModelId(config.id)

        } catch {
            downloadStates[config.id] = .failed(error.localizedDescription)
            throw error
        }

        activeDownloadId = nil
        downloadProgress = 0
    }

    // MARK: - Cancel

    func cancelDownload() {
        // Note: MLX doesn't provide native cancellation
        // This resets state but download may continue in background
        if let id = activeDownloadId {
            downloadStates[id] = .notDownloaded
        }
        activeDownloadId = nil
        downloadProgress = 0
    }

    // MARK: - Storage Validation

    private func hasAvailableStorage(bytes: Int64) -> Bool {
        let fileManager = FileManager.default
        guard let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else {
            return false
        }

        do {
            let values = try documentsURL.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
            if let available = values.volumeAvailableCapacityForImportantUsage {
                // Require 20% buffer
                return available > Int64(Double(bytes) * 1.2)
            }
        } catch {
            print("Storage check failed: \(error)")
        }

        return false
    }

    // MARK: - Persistence

    private func saveDownloadedModelId(_ id: String) {
        var downloaded = UserDefaults.standard.stringArray(forKey: "downloadedModels") ?? []
        if !downloaded.contains(id) {
            downloaded.append(id)
            UserDefaults.standard.set(downloaded, forKey: "downloadedModels")
        }
    }

    func loadDownloadedModels() {
        let downloaded = UserDefaults.standard.stringArray(forKey: "downloadedModels") ?? []
        for id in downloaded {
            downloadStates[id] = .downloaded
        }
    }

    func isModelDownloaded(_ config: OptaModelConfiguration) -> Bool {
        downloadStates[config.id]?.isDownloaded ?? false
    }
}

// MARK: - Model Cache

actor ModelCache {
    static let shared = ModelCache()

    #if canImport(MLX) && canImport(MLXLLM)
    private var containers: [String: ModelContainer] = [:]

    func store(container: ModelContainer, for config: OptaModelConfiguration) {
        containers[config.id] = container
    }

    func retrieve(for config: OptaModelConfiguration) -> ModelContainer? {
        containers[config.id]
    }

    func remove(for config: OptaModelConfiguration) {
        containers.removeValue(forKey: config.id)
    }
    #else
    func store(container: Any, for config: OptaModelConfiguration) {}
    func retrieve(for config: OptaModelConfiguration) -> Any? { nil }
    func remove(for config: OptaModelConfiguration) {}
    #endif
}

// MARK: - Errors

enum ModelDownloadError: LocalizedError {
    case downloadInProgress
    case insufficientMemory(required: Int)
    case insufficientStorage(required: Double)
    case networkError(String)
    case modelNotFound(String)

    var errorDescription: String? {
        switch self {
        case .downloadInProgress:
            return "A download is already in progress."
        case .insufficientMemory(let required):
            return "This model requires \(required) GB RAM. Your device may not support it."
        case .insufficientStorage(let required):
            return "Not enough storage. \(String(format: "%.1f", required)) GB required."
        case .networkError(let reason):
            return "Network error: \(reason)"
        case .modelNotFound(let name):
            return "Model not found: \(name)"
        }
    }
}
```

### Task 2: Create Download Progress View

**Goal**: SwiftUI view showing download progress with cancel option

**File**: `Opta Scan/Views/Components/ModelDownloadProgressView.swift` (new)

```swift
//
//  ModelDownloadProgressView.swift
//  Opta Scan
//
//  Download progress indicator with cancel button
//

import SwiftUI

struct ModelDownloadProgressView: View {
    let model: OptaModelConfiguration
    let progress: Double
    let onCancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Downloading")
                        .optaCaptionStyle()
                        .foregroundStyle(Color.optaTextMuted)

                    Text(model.displayName)
                        .optaBodyStyle()
                        .foregroundStyle(Color.optaTextPrimary)
                }

                Spacer()

                Button(action: onCancel) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(Color.optaTextMuted)
                }
                .accessibilityLabel("Cancel download")
            }

            // Progress bar
            VStack(alignment: .leading, spacing: OptaDesign.Spacing.xxs) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        // Background
                        Capsule()
                            .fill(Color.optaSurface)
                            .frame(height: 8)

                        // Progress
                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [Color.optaPurple, Color.optaCyan],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: geo.size.width * progress, height: 8)
                            .animation(.optaSpring, value: progress)
                    }
                }
                .frame(height: 8)

                // Progress text
                HStack {
                    Text("\(Int(progress * 100))%")
                        .optaCaptionStyle()
                        .foregroundStyle(Color.optaTextMuted)

                    Spacer()

                    Text(model.sizeString)
                        .optaCaptionStyle()
                        .foregroundStyle(Color.optaTextMuted)
                }
            }
        }
        .padding(OptaDesign.Spacing.md)
        .background(Color.optaSurface)
        .cornerRadius(OptaDesign.Radius.md)
    }
}

#Preview {
    ModelDownloadProgressView(
        model: .llama32_11B_Vision,
        progress: 0.45,
        onCancel: {}
    )
    .padding()
    .background(Color.optaBackground)
}
```

### Task 3: Create Model Selection Card

**Goal**: Card component for selecting and downloading models

**File**: `Opta Scan/Views/Components/ModelSelectionCard.swift` (new)

```swift
//
//  ModelSelectionCard.swift
//  Opta Scan
//
//  Model selection card with download status
//

import SwiftUI

struct ModelSelectionCard: View {
    let model: OptaModelConfiguration
    let state: ModelDownloadState
    let isSelected: Bool
    let onSelect: () -> Void
    let onDownload: () -> Void

    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Button(action: handleTap) {
            HStack(spacing: OptaDesign.Spacing.md) {
                // Icon
                ZStack {
                    Circle()
                        .fill(iconBackgroundColor)
                        .frame(width: 44, height: 44)

                    Image(systemName: iconName)
                        .font(.system(size: 20))
                        .foregroundStyle(iconColor)
                }

                // Content
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(model.displayName)
                            .optaBodyStyle()
                            .foregroundStyle(Color.optaTextPrimary)

                        if model.supportsVision {
                            Text("Vision")
                                .font(.caption2.bold())
                                .foregroundStyle(Color.optaCyan)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.optaCyan.opacity(0.15))
                                .cornerRadius(4)
                        }
                    }

                    Text(model.description)
                        .optaCaptionStyle()
                        .foregroundStyle(Color.optaTextMuted)

                    HStack(spacing: OptaDesign.Spacing.sm) {
                        Label(model.sizeString, systemImage: "arrow.down.circle")
                        Label(model.ramRequirementString, systemImage: "memorychip")
                    }
                    .optaLabelStyle()
                    .foregroundStyle(Color.optaTextMuted)
                }

                Spacer()

                // Status indicator
                statusView
            }
            .padding(OptaDesign.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: OptaDesign.Radius.md)
                    .fill(Color.optaSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: OptaDesign.Radius.md)
                            .stroke(isSelected ? Color.optaPurple : Color.clear, lineWidth: 2)
                    )
            )
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled || !model.isCompatibleWithDevice())
        .opacity(model.isCompatibleWithDevice() ? 1 : 0.5)
    }

    // MARK: - Computed Properties

    private var iconName: String {
        switch state {
        case .notDownloaded: return "arrow.down.circle"
        case .downloading: return "arrow.down.circle.dotted"
        case .downloaded: return "checkmark.circle.fill"
        case .failed: return "exclamationmark.circle"
        }
    }

    private var iconColor: Color {
        switch state {
        case .notDownloaded: return .optaTextMuted
        case .downloading: return .optaPurple
        case .downloaded: return .optaGreen
        case .failed: return .optaRed
        }
    }

    private var iconBackgroundColor: Color {
        switch state {
        case .downloaded: return .optaGreen.opacity(0.15)
        case .downloading: return .optaPurple.opacity(0.15)
        default: return .optaSurface
        }
    }

    @ViewBuilder
    private var statusView: some View {
        switch state {
        case .notDownloaded:
            Image(systemName: "arrow.down.circle")
                .foregroundStyle(Color.optaPurple)

        case .downloading(let progress):
            ProgressView()
                .progressViewStyle(.circular)
                .scaleEffect(0.8)

        case .downloaded:
            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color.optaPurple)
            } else {
                Image(systemName: "circle")
                    .foregroundStyle(Color.optaTextMuted)
            }

        case .failed:
            Image(systemName: "exclamationmark.circle")
                .foregroundStyle(Color.optaRed)
        }
    }

    // MARK: - Actions

    private func handleTap() {
        switch state {
        case .notDownloaded, .failed:
            onDownload()
        case .downloaded:
            onSelect()
        case .downloading:
            break // Do nothing while downloading
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        ModelSelectionCard(
            model: .llama32_11B_Vision,
            state: .notDownloaded,
            isSelected: false,
            onSelect: {},
            onDownload: {}
        )

        ModelSelectionCard(
            model: .llama32_3B,
            state: .downloaded,
            isSelected: true,
            onSelect: {},
            onDownload: {}
        )

        ModelSelectionCard(
            model: .llama32_1B,
            state: .downloading(progress: 0.6),
            isSelected: false,
            onSelect: {},
            onDownload: {}
        )
    }
    .padding()
    .background(Color.optaBackground)
}
```

### Task 4: Update MLXService for ModelCache Integration

**Goal**: MLXService should use ModelCache to load already-downloaded models

**File**: `Opta Scan/Services/MLXService.swift`

**Changes**:
```swift
// Update loadModel to check cache first
func loadModel(_ config: OptaModelConfiguration) async throws {
    guard isDeviceSupported else {
        throw MLXError.deviceNotSupported
    }

    #if canImport(MLX) && canImport(MLXLLM)
    GPU.set(cacheLimit: 20 * 1024 * 1024)

    // Check if model is already in cache
    if let cached = await ModelCache.shared.retrieve(for: config) {
        modelContainer = cached
        loadedModelConfig = config
        isModelLoaded = true
        return
    }

    // Otherwise load (downloads if needed)
    let modelConfig = ModelConfiguration(id: config.name)

    let container = try await LLMModelFactory.shared.loadContainer(
        configuration: modelConfig
    )

    modelContainer = container
    await ModelCache.shared.store(container: container, for: config)
    #endif

    loadedModelConfig = config
    isModelLoaded = true
}
```

### Task 5: Update SettingsView with Model Management

**Goal**: Integrate model cards and download UI into Settings

**File**: `Opta Scan/Views/SettingsView.swift`

**Changes**:
- Import ModelDownloadManager
- Show model selection cards
- Display download progress when active
- Handle download actions

Key updates to make:
```swift
// Add state
@State private var selectedModelId: String? = OptaModelConfiguration.default.id

// In body, AI Model section:
Section {
    // Active download progress
    if let activeId = ModelDownloadManager.shared.activeDownloadId,
       let model = OptaModelConfiguration.all.first(where: { $0.id == activeId }) {
        ModelDownloadProgressView(
            model: model,
            progress: ModelDownloadManager.shared.downloadProgress,
            onCancel: { ModelDownloadManager.shared.cancelDownload() }
        )
    }

    // Model cards
    ForEach(OptaModelConfiguration.all) { model in
        ModelSelectionCard(
            model: model,
            state: ModelDownloadManager.shared.state(for: model),
            isSelected: selectedModelId == model.id,
            onSelect: { selectModel(model) },
            onDownload: { downloadModel(model) }
        )
    }
} header: {
    Text("AI Model")
}
```

### Task 6: Verify Build and Test Download Flow

**Goal**: Ensure all components compile and wire together correctly

**Steps**:
1. Build project for device
2. Verify ModelDownloadManager compiles
3. Verify UI components render
4. Check Settings shows model cards

## Checkpoints

- [ ] **Checkpoint 1**: ModelDownloadManager created
- [ ] **Checkpoint 2**: Progress view and selection card created
- [ ] **Checkpoint 3**: MLXService updated for cache
- [ ] **Checkpoint 4**: SettingsView integrated
- [ ] **Checkpoint 5**: Build succeeds

## Verification

```bash
# Build
xcodebuild -project "Opta Scan.xcodeproj" \
  -scheme "Opta Scan" \
  -destination "generic/platform=iOS" \
  build

# Check files created
ls -la "Opta Scan/Services/ModelDownloadManager.swift"
ls -la "Opta Scan/Views/Components/ModelDownloadProgressView.swift"
ls -la "Opta Scan/Views/Components/ModelSelectionCard.swift"
```

## Dependencies

**Existing files modified**:
- `Opta Scan/Services/MLXService.swift`
- `Opta Scan/Views/SettingsView.swift`

**New files created**:
- `Opta Scan/Services/ModelDownloadManager.swift`
- `Opta Scan/Views/Components/ModelDownloadProgressView.swift`
- `Opta Scan/Views/Components/ModelSelectionCard.swift`

---

*Plan created: 2026-01-22*
*Phase: 18 - Model Management*
*Milestone: v2.0 Local Intelligence*
