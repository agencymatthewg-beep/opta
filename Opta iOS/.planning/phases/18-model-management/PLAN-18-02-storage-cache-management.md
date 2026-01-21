# Plan 18-02: Storage and Cache Management

## Overview

Manage downloaded model storage, implement deletion, and validate available space.

**Phase**: 18 - Model Management
**Milestone**: v2.0 Local Intelligence
**Depends on**: Plan 18-01 (Model Download System)

## Scope

| Aspect | Details |
|--------|---------|
| **Effort** | Low-Medium (1-2 sessions) |
| **Risk** | Low (file system operations) |
| **Files** | ~3 new/modified |

## Tasks

### Task 1: Create StorageManager

**Goal**: Service to track storage usage and manage model files

**File**: `Opta Scan/Services/StorageManager.swift` (new)

```swift
//
//  StorageManager.swift
//  Opta Scan
//
//  Manages model storage space and cleanup
//

import Foundation

// MARK: - Storage Manager

@MainActor
@Observable
final class StorageManager {
    static let shared = StorageManager()

    // MARK: - State

    private(set) var totalStorageBytes: Int64 = 0
    private(set) var availableStorageBytes: Int64 = 0
    private(set) var modelStorageBytes: Int64 = 0

    // MARK: - Computed

    var availableStorageGB: Double {
        Double(availableStorageBytes) / (1024 * 1024 * 1024)
    }

    var modelStorageGB: Double {
        Double(modelStorageBytes) / (1024 * 1024 * 1024)
    }

    var availableStorageString: String {
        ByteCountFormatter.string(fromByteCount: availableStorageBytes, countStyle: .file)
    }

    var modelStorageString: String {
        ByteCountFormatter.string(fromByteCount: modelStorageBytes, countStyle: .file)
    }

    // MARK: - URLs

    private var modelCacheURL: URL? {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?
            .appendingPathComponent("huggingface", isDirectory: true)
    }

    // MARK: - Refresh

    func refresh() async {
        await updateStorageInfo()
        await calculateModelStorage()
    }

    private func updateStorageInfo() async {
        guard let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            return
        }

        do {
            let values = try documentsURL.resourceValues(forKeys: [
                .volumeTotalCapacityKey,
                .volumeAvailableCapacityForImportantUsageKey
            ])

            if let total = values.volumeTotalCapacity {
                totalStorageBytes = Int64(total)
            }

            if let available = values.volumeAvailableCapacityForImportantUsage {
                availableStorageBytes = available
            }
        } catch {
            print("Failed to get storage info: \(error)")
        }
    }

    private func calculateModelStorage() async {
        guard let cacheURL = modelCacheURL else {
            modelStorageBytes = 0
            return
        }

        modelStorageBytes = directorySize(at: cacheURL)
    }

    private func directorySize(at url: URL) -> Int64 {
        let fileManager = FileManager.default
        var size: Int64 = 0

        guard let enumerator = fileManager.enumerator(
            at: url,
            includingPropertiesForKeys: [.fileSizeKey, .isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            return 0
        }

        for case let fileURL as URL in enumerator {
            do {
                let values = try fileURL.resourceValues(forKeys: [.fileSizeKey, .isDirectoryKey])
                if values.isDirectory == false, let fileSize = values.fileSize {
                    size += Int64(fileSize)
                }
            } catch {
                continue
            }
        }

        return size
    }

    // MARK: - Validation

    func canDownloadModel(_ config: OptaModelConfiguration) -> (Bool, String?) {
        let requiredBytes = Int64(config.sizeGB * 1024 * 1024 * 1024 * 1.2) // 20% buffer

        if availableStorageBytes < requiredBytes {
            let needed = ByteCountFormatter.string(fromByteCount: requiredBytes, countStyle: .file)
            let available = availableStorageString
            return (false, "Need \(needed), only \(available) available")
        }

        return (true, nil)
    }

    // MARK: - Cleanup

    func deleteModel(_ config: OptaModelConfiguration) async throws {
        // Remove from ModelCache
        await ModelCache.shared.remove(for: config)

        // Remove from download states
        ModelDownloadManager.shared.removeDownloadState(for: config)

        // Remove from UserDefaults
        var downloaded = UserDefaults.standard.stringArray(forKey: "downloadedModels") ?? []
        downloaded.removeAll { $0 == config.id }
        UserDefaults.standard.set(downloaded, forKey: "downloadedModels")

        // Note: Actual file deletion is managed by HubApi cache
        // Files are stored in ~/Documents/huggingface/hub/
        // For now, we just clear our tracking. Full file deletion would require
        // iterating the hub cache directory.

        await refresh()
    }

    func clearAllModels() async throws {
        guard let cacheURL = modelCacheURL else { return }

        let fileManager = FileManager.default

        if fileManager.fileExists(atPath: cacheURL.path) {
            try fileManager.removeItem(at: cacheURL)
        }

        // Clear all states
        for config in OptaModelConfiguration.all {
            await ModelCache.shared.remove(for: config)
            ModelDownloadManager.shared.removeDownloadState(for: config)
        }

        UserDefaults.standard.removeObject(forKey: "downloadedModels")
        UserDefaults.standard.removeObject(forKey: "selectedModelId")

        await refresh()
    }
}
```

### Task 2: Update ModelDownloadManager with Removal

**Goal**: Add method to remove download state

**File**: `Opta Scan/Services/ModelDownloadManager.swift`

**Add method**:
```swift
func removeDownloadState(for config: OptaModelConfiguration) {
    downloadStates.removeValue(forKey: config.id)
}
```

### Task 3: Create Storage Info View

**Goal**: UI component showing storage usage

**File**: `Opta Scan/Views/Components/StorageInfoView.swift` (new)

```swift
//
//  StorageInfoView.swift
//  Opta Scan
//
//  Storage usage indicator for Settings
//

import SwiftUI

struct StorageInfoView: View {
    let modelStorage: String
    let availableStorage: String
    let onClearAll: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
            // Header
            HStack {
                Image(systemName: "internaldrive")
                    .foregroundStyle(Color.optaPurple)

                Text("Storage")
                    .optaBodyStyle()
                    .foregroundStyle(Color.optaTextPrimary)

                Spacer()
            }

            // Stats
            HStack(spacing: OptaDesign.Spacing.lg) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Models")
                        .optaCaptionStyle()
                        .foregroundStyle(Color.optaTextMuted)

                    Text(modelStorage)
                        .optaBodyStyle()
                        .foregroundStyle(Color.optaTextPrimary)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Available")
                        .optaCaptionStyle()
                        .foregroundStyle(Color.optaTextMuted)

                    Text(availableStorage)
                        .optaBodyStyle()
                        .foregroundStyle(Color.optaGreen)
                }

                Spacer()
            }

            // Clear button
            if modelStorage != "Zero KB" {
                Button(action: onClearAll) {
                    HStack {
                        Image(systemName: "trash")
                        Text("Clear All Models")
                    }
                    .optaCaptionStyle()
                    .foregroundStyle(Color.optaRed)
                }
                .padding(.top, OptaDesign.Spacing.xs)
            }
        }
        .padding(OptaDesign.Spacing.md)
        .background(Color.optaSurface)
        .cornerRadius(OptaDesign.Radius.md)
    }
}

#Preview {
    StorageInfoView(
        modelStorage: "6.5 GB",
        availableStorage: "42.3 GB",
        onClearAll: {}
    )
    .padding()
    .background(Color.optaBackground)
}
```

### Task 4: Add Delete Swipe Action to Model Cards

**Goal**: Allow swipe-to-delete on downloaded models

**File**: `Opta Scan/Views/Components/ModelSelectionCard.swift`

**Update**: Wrap in SwipeActions when state is .downloaded

```swift
// In SettingsView, wrap ModelSelectionCard:
ForEach(OptaModelConfiguration.all) { model in
    let state = ModelDownloadManager.shared.state(for: model)

    ModelSelectionCard(
        model: model,
        state: state,
        isSelected: selectedModelId == model.id,
        onSelect: { selectModel(model) },
        onDownload: { downloadModel(model) }
    )
    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
        if state.isDownloaded {
            Button(role: .destructive) {
                deleteModel(model)
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}
```

### Task 5: Integrate Storage UI into Settings

**Goal**: Add storage info section to SettingsView

**File**: `Opta Scan/Views/SettingsView.swift`

**Add section**:
```swift
// After AI Model section
Section {
    StorageInfoView(
        modelStorage: StorageManager.shared.modelStorageString,
        availableStorage: StorageManager.shared.availableStorageString,
        onClearAll: {
            showingClearConfirmation = true
        }
    )
    .listRowInsets(EdgeInsets())
    .listRowBackground(Color.clear)
} header: {
    Text("Storage")
}
.confirmationDialog(
    "Clear All Models",
    isPresented: $showingClearConfirmation,
    titleVisibility: .visible
) {
    Button("Clear All", role: .destructive) {
        clearAllModels()
    }
    Button("Cancel", role: .cancel) {}
} message: {
    Text("This will delete all downloaded models. You'll need to re-download them to use Opta.")
}
```

**Add state and methods**:
```swift
@State private var showingClearConfirmation = false

private func clearAllModels() {
    Task {
        try? await StorageManager.shared.clearAllModels()
        OptaHaptics.shared.success()
    }
}

private func deleteModel(_ model: OptaModelConfiguration) {
    Task {
        try? await StorageManager.shared.deleteModel(model)
        OptaHaptics.shared.tap()
    }
}
```

**Add task to refresh storage**:
```swift
.task {
    await StorageManager.shared.refresh()
}
```

### Task 6: Verify Build and Storage Flow

**Goal**: Ensure storage management compiles and functions

**Steps**:
1. Build project
2. Verify StorageManager compiles
3. Verify StorageInfoView renders
4. Check Settings shows storage section
5. Verify delete flow works

## Checkpoints

- [ ] **Checkpoint 1**: StorageManager created
- [ ] **Checkpoint 2**: StorageInfoView created
- [ ] **Checkpoint 3**: Delete swipe action added
- [ ] **Checkpoint 4**: SettingsView integrated
- [ ] **Checkpoint 5**: Build succeeds

## Verification

```bash
# Build
xcodebuild -project "Opta Scan.xcodeproj" \
  -scheme "Opta Scan" \
  -destination "generic/platform=iOS" \
  build

# Check files
ls -la "Opta Scan/Services/StorageManager.swift"
ls -la "Opta Scan/Views/Components/StorageInfoView.swift"
```

## Dependencies

**Existing files modified**:
- `Opta Scan/Services/ModelDownloadManager.swift`
- `Opta Scan/Views/SettingsView.swift`

**New files created**:
- `Opta Scan/Services/StorageManager.swift`
- `Opta Scan/Views/Components/StorageInfoView.swift`

---

*Plan created: 2026-01-22*
*Phase: 18 - Model Management*
*Milestone: v2.0 Local Intelligence*
