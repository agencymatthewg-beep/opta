# Plan 21-01: Settings and Model Management UI

## Overview

Enhance Settings UI with offline indicators, model status badges, first-run download flow, and network connectivity awareness.

**Phase**: 21 - Local-First Polish
**Milestone**: v2.0 Local Intelligence
**Depends on**: Phase 20 (Generation Pipeline) complete

## Scope

| Aspect | Details |
|--------|---------|
| **Effort** | Medium (1 session) |
| **Risk** | Low (UI enhancements) |
| **Files** | ~5 modified/created |

## Tasks

### Task 1: Create NetworkMonitor Service

**Goal**: Track network connectivity state for download availability

**File**: `Opta Scan/Services/NetworkMonitor.swift` (new)

```swift
//
//  NetworkMonitor.swift
//  Opta Scan
//
//  Monitors network connectivity for model download availability
//

import Foundation
import Network

@MainActor
@Observable
final class NetworkMonitor {
    static let shared = NetworkMonitor()

    // MARK: - State

    private(set) var isConnected = false
    private(set) var isExpensive = false  // Cellular
    private(set) var connectionType: ConnectionType = .unknown

    // MARK: - Connection Type

    enum ConnectionType {
        case wifi
        case cellular
        case ethernet
        case unknown
    }

    // MARK: - Private

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "opta.networkmonitor")

    // MARK: - Initialization

    private init() {
        startMonitoring()
    }

    // MARK: - Methods

    private func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.updateState(from: path)
            }
        }
        monitor.start(queue: queue)
    }

    private func updateState(from path: NWPath) {
        isConnected = path.status == .satisfied
        isExpensive = path.isExpensive

        if path.usesInterfaceType(.wifi) {
            connectionType = .wifi
        } else if path.usesInterfaceType(.cellular) {
            connectionType = .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            connectionType = .ethernet
        } else {
            connectionType = .unknown
        }
    }

    func stopMonitoring() {
        monitor.cancel()
    }
}
```

### Task 2: Create ModelStatusBadge Component

**Goal**: Visual badge showing model state (downloaded, downloading, available, error)

**File**: `Opta Scan/Views/Components/ModelStatusBadge.swift` (new)

```swift
//
//  ModelStatusBadge.swift
//  Opta Scan
//
//  Visual badge showing model download and readiness status
//

import SwiftUI

struct ModelStatusBadge: View {
    let state: ModelDownloadState

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: iconName)
                .font(.system(size: 10, weight: .medium))

            Text(text)
                .font(.system(size: 11, weight: .medium))
        }
        .foregroundStyle(foregroundColor)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(backgroundColor)
        .clipShape(Capsule())
    }

    private var iconName: String {
        switch state {
        case .notDownloaded:
            return "arrow.down.circle"
        case .downloading:
            return "arrow.down.circle"
        case .downloaded:
            return "checkmark.circle.fill"
        case .error:
            return "exclamationmark.circle"
        }
    }

    private var text: String {
        switch state {
        case .notDownloaded:
            return "Available"
        case .downloading:
            return "Downloading"
        case .downloaded:
            return "Ready"
        case .error:
            return "Error"
        }
    }

    private var foregroundColor: Color {
        switch state {
        case .notDownloaded:
            return .optaTextSecondary
        case .downloading:
            return .optaBlue
        case .downloaded:
            return .optaGreen
        case .error:
            return .red
        }
    }

    private var backgroundColor: Color {
        switch state {
        case .notDownloaded:
            return .optaSurface
        case .downloading:
            return .optaBlue.opacity(0.15)
        case .downloaded:
            return .optaGreen.opacity(0.15)
        case .error:
            return .red.opacity(0.15)
        }
    }
}

#Preview {
    VStack(spacing: 12) {
        ModelStatusBadge(state: .notDownloaded)
        ModelStatusBadge(state: .downloading(progress: 0.5))
        ModelStatusBadge(state: .downloaded)
        ModelStatusBadge(state: .error(message: "Failed"))
    }
    .padding()
    .background(Color.optaBackground)
}
```

### Task 3: Create OfflineIndicator Component

**Goal**: Banner showing offline status and model readiness

**File**: `Opta Scan/Views/Components/OfflineIndicator.swift` (new)

```swift
//
//  OfflineIndicator.swift
//  Opta Scan
//
//  Shows offline status and model availability
//

import SwiftUI

struct OfflineIndicator: View {
    let isOffline: Bool
    let hasModel: Bool

    var body: some View {
        if isOffline && hasModel {
            // Offline but ready
            HStack(spacing: 8) {
                Image(systemName: "wifi.slash")
                    .font(.system(size: 14, weight: .medium))
                Text("Offline Mode")
                    .font(.optaCaption)
                Spacer()
                Text("Ready")
                    .font(.optaCaption)
                    .foregroundStyle(.optaGreen)
            }
            .foregroundStyle(.optaTextSecondary)
            .padding(.horizontal, OptaDesign.Spacing.md)
            .padding(.vertical, OptaDesign.Spacing.sm)
            .background(Color.optaSurface)
        } else if isOffline && !hasModel {
            // Offline and no model
            HStack(spacing: 8) {
                Image(systemName: "wifi.slash")
                    .font(.system(size: 14, weight: .medium))
                Text("Offline - Model Required")
                    .font(.optaCaption)
                Spacer()
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
            }
            .foregroundStyle(.optaTextSecondary)
            .padding(.horizontal, OptaDesign.Spacing.md)
            .padding(.vertical, OptaDesign.Spacing.sm)
            .background(Color.orange.opacity(0.1))
        }
        // Online: no indicator shown
    }
}

#Preview {
    VStack(spacing: 0) {
        OfflineIndicator(isOffline: true, hasModel: true)
        OfflineIndicator(isOffline: true, hasModel: false)
        OfflineIndicator(isOffline: false, hasModel: true)
    }
    .background(Color.optaBackground)
}
```

### Task 4: Create FirstRunDownloadSheet

**Goal**: Modal sheet for first-time users to download a model

**File**: `Opta Scan/Views/FirstRunDownloadSheet.swift` (new)

```swift
//
//  FirstRunDownloadSheet.swift
//  Opta Scan
//
//  First-run modal prompting user to download AI model
//

import SwiftUI

struct FirstRunDownloadSheet: View {
    @Environment(\.dismiss) private var dismiss

    @State private var isDownloading = false
    @State private var downloadError: String?

    private var downloadManager: ModelDownloadManager {
        ModelDownloadManager.shared
    }

    private var networkMonitor: NetworkMonitor {
        NetworkMonitor.shared
    }

    // Recommended model for first-time download
    private var recommendedModel: OptaModelConfiguration {
        OptaModelConfiguration.all.first ?? OptaModelConfiguration.all[0]
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaBackground
                    .ignoresSafeArea()

                VStack(spacing: OptaDesign.Spacing.xl) {
                    Spacer()

                    // Icon
                    ZStack {
                        Circle()
                            .fill(Color.optaPurple.opacity(0.15))
                            .frame(width: 100, height: 100)

                        Image(systemName: "cpu.fill")
                            .font(.system(size: 40, weight: .medium))
                            .foregroundStyle(Color.optaPurple)
                    }

                    // Title & Description
                    VStack(spacing: OptaDesign.Spacing.sm) {
                        Text("Download AI Model")
                            .font(.optaTitle)
                            .foregroundStyle(Color.optaTextPrimary)

                        Text("Opta requires an AI model for on-device processing. Download once, use offline forever.")
                            .font(.optaBody)
                            .foregroundStyle(Color.optaTextSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, OptaDesign.Spacing.lg)
                    }

                    // Model Info Card
                    VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
                        HStack {
                            Text(recommendedModel.displayName)
                                .font(.optaHeadline)
                                .foregroundStyle(Color.optaTextPrimary)

                            Spacer()

                            Text(recommendedModel.sizeDescription)
                                .font(.optaCaption)
                                .foregroundStyle(Color.optaTextMuted)
                        }

                        Text(recommendedModel.description)
                            .font(.optaCaption)
                            .foregroundStyle(Color.optaTextSecondary)

                        if recommendedModel.supportsVision {
                            HStack(spacing: 4) {
                                Image(systemName: "eye.fill")
                                Text("Supports image analysis")
                            }
                            .font(.optaLabel)
                            .foregroundStyle(Color.optaGreen)
                        }
                    }
                    .padding(OptaDesign.Spacing.md)
                    .background(Color.optaSurface)
                    .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium))
                    .padding(.horizontal, OptaDesign.Spacing.lg)

                    // Download Progress
                    if isDownloading {
                        VStack(spacing: OptaDesign.Spacing.sm) {
                            ProgressView(value: downloadManager.downloadProgress)
                                .tint(Color.optaPurple)

                            Text("\(Int(downloadManager.downloadProgress * 100))% downloaded")
                                .font(.optaCaption)
                                .foregroundStyle(Color.optaTextMuted)
                        }
                        .padding(.horizontal, OptaDesign.Spacing.lg)
                    }

                    // Error Message
                    if let error = downloadError {
                        Text(error)
                            .font(.optaCaption)
                            .foregroundStyle(.red)
                            .padding(.horizontal, OptaDesign.Spacing.lg)
                    }

                    Spacer()

                    // Buttons
                    VStack(spacing: OptaDesign.Spacing.sm) {
                        // Download Button
                        Button {
                            startDownload()
                        } label: {
                            HStack {
                                if isDownloading {
                                    ProgressView()
                                        .progressViewStyle(.circular)
                                        .tint(.white)
                                } else {
                                    Image(systemName: "arrow.down.circle.fill")
                                }
                                Text(isDownloading ? "Downloading..." : "Download Model")
                            }
                            .font(.optaBody)
                            .fontWeight(.semibold)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, OptaDesign.Spacing.md)
                            .background(
                                networkMonitor.isConnected
                                    ? Color.optaPurple
                                    : Color.optaSurface
                            )
                            .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium))
                        }
                        .disabled(!networkMonitor.isConnected || isDownloading)

                        // Skip/Later Button
                        Button {
                            dismiss()
                        } label: {
                            Text(isDownloading ? "Download in Background" : "Later")
                                .font(.optaCaption)
                                .foregroundStyle(Color.optaTextMuted)
                        }
                        .disabled(isDownloading && downloadManager.downloadProgress < 0.1)
                    }
                    .padding(.horizontal, OptaDesign.Spacing.lg)
                    .padding(.bottom, OptaDesign.Spacing.xxl)

                    // Network Warning
                    if !networkMonitor.isConnected {
                        HStack(spacing: 8) {
                            Image(systemName: "wifi.slash")
                            Text("Connect to the internet to download")
                        }
                        .font(.optaCaption)
                        .foregroundStyle(Color.optaTextMuted)
                        .padding(.bottom, OptaDesign.Spacing.lg)
                    } else if networkMonitor.isExpensive {
                        HStack(spacing: 8) {
                            Image(systemName: "antenna.radiowaves.left.and.right")
                            Text("Using cellular data")
                        }
                        .font(.optaCaption)
                        .foregroundStyle(.orange)
                        .padding(.bottom, OptaDesign.Spacing.lg)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Color.optaTextMuted)
                    }
                }
            }
        }
        .interactiveDismissDisabled(isDownloading)
    }

    // MARK: - Methods

    private func startDownload() {
        isDownloading = true
        downloadError = nil

        Task {
            do {
                try await downloadManager.downloadModel(recommendedModel)
                // Auto-select the model
                UserDefaults.standard.set(recommendedModel.id, forKey: "opta.selectedModelId")
                OptaHaptics.shared.success()
                dismiss()
            } catch {
                downloadError = error.localizedDescription
                isDownloading = false
                OptaHaptics.shared.error()
            }
        }
    }
}

#Preview {
    FirstRunDownloadSheet()
}
```

### Task 5: Update SettingsView with Badges and Indicators

**Goal**: Integrate new components into SettingsView

**File**: `Opta Scan/Views/SettingsView.swift`

**Add offline indicator at top of list**:
```swift
// At the top of List, before On-Device AI section
if !networkMonitor.isConnected {
    Section {
        OfflineIndicator(
            isOffline: true,
            hasModel: hasDownloadedModel
        )
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
    }
}
```

**Add NetworkMonitor property**:
```swift
private var networkMonitor: NetworkMonitor {
    NetworkMonitor.shared
}

private var hasDownloadedModel: Bool {
    OptaModelConfiguration.all.contains { model in
        downloadManager.isModelDownloaded(model)
    }
}
```

**Add status badge to model cards** - Update ModelSelectionCard usage:
```swift
ModelSelectionCard(
    model: model,
    state: state,
    isSelected: selectedModelId == model.id,
    showStatusBadge: true,  // Add this parameter
    onSelect: { selectModel(model) },
    onDownload: { downloadModel(model) }
)
```

### Task 6: Update App Entry Point for First-Run Flow

**Goal**: Show FirstRunDownloadSheet on first launch

**File**: `Opta Scan/Opta_ScanApp.swift`

**Add state and sheet**:
```swift
@AppStorage("opta.hasCompletedFirstRun") private var hasCompletedFirstRun = false
@State private var showFirstRunDownload = false

// In body, after onboarding check
.onAppear {
    // Check if model needed after onboarding
    if hasCompletedOnboarding && !hasCompletedFirstRun {
        let hasModel = OptaModelConfiguration.all.contains { model in
            ModelDownloadManager.shared.isModelDownloaded(model)
        }
        if !hasModel {
            showFirstRunDownload = true
        } else {
            hasCompletedFirstRun = true
        }
    }
}
.sheet(isPresented: $showFirstRunDownload, onDismiss: {
    // Mark as completed even if skipped
    hasCompletedFirstRun = true
}) {
    FirstRunDownloadSheet()
}
```

## Checkpoints

- [ ] **Checkpoint 1**: NetworkMonitor created
- [ ] **Checkpoint 2**: ModelStatusBadge created
- [ ] **Checkpoint 3**: OfflineIndicator created
- [ ] **Checkpoint 4**: FirstRunDownloadSheet created
- [ ] **Checkpoint 5**: SettingsView updated
- [ ] **Checkpoint 6**: App entry point updated
- [ ] **Checkpoint 7**: Build succeeds

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
- `Opta Scan/Services/NetworkMonitor.swift`
- `Opta Scan/Views/Components/ModelStatusBadge.swift`
- `Opta Scan/Views/Components/OfflineIndicator.swift`
- `Opta Scan/Views/FirstRunDownloadSheet.swift`

**Existing files modified**:
- `Opta Scan/Views/SettingsView.swift`
- `Opta Scan/Opta_ScanApp.swift`

## Notes

- NetworkMonitor uses NWPathMonitor for accurate connectivity status
- First-run download sheet only appears once per installation
- Offline indicator only shows when truly offline
- Status badges provide at-a-glance model state
- Cellular data warning helps users manage large downloads

---

*Plan created: 2026-01-22*
*Phase: 21 - Local-First Polish*
*Milestone: v2.0 Local Intelligence*
