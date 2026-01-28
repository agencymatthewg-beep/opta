//
//  SettingsView.swift
//  Opta Scan
//
//  Settings screen with local model management
//  All AI processing is on-device - no cloud APIs
//  Created by Matthew Byrden
//

import SwiftUI

struct SettingsView: View {
    @State private var selectedModelId: String? = nil
    @State private var downloadError: String? = nil
    @State private var showDownloadError = false
    @State private var showingClearConfirmation = false

    private var downloadManager: ModelDownloadManager {
        ModelDownloadManager.shared
    }

    private var storageManager: StorageManager {
        StorageManager.shared
    }

    private var networkMonitor: NetworkMonitor {
        NetworkMonitor.shared
    }

    private var hasDownloadedModel: Bool {
        OptaModelConfiguration.all.contains { model in
            downloadManager.isModelDownloaded(model)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaBackground
                    .ignoresSafeArea()

                List {
                    // Offline Indicator (when offline)
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

                    // On-Device AI Section (Primary)
                    Section {
                        // Active download progress
                        if let activeId = downloadManager.activeDownloadId,
                           let model = OptaModelConfiguration.all.first(where: { $0.id == activeId }) {
                            ModelDownloadProgressView(
                                model: model,
                                progress: downloadManager.downloadProgress,
                                onCancel: {
                                    downloadManager.cancelDownload()
                                }
                            )
                            .listRowBackground(Color.clear)
                            .listRowInsets(EdgeInsets())
                            .padding(.horizontal, OptaDesign.Spacing.md)
                            .padding(.vertical, OptaDesign.Spacing.xs)
                        }

                        // Model selection cards with swipe-to-delete
                        ForEach(OptaModelConfiguration.all) { model in
                            let state = downloadManager.state(for: model)

                            ModelSelectionCard(
                                model: model,
                                state: state,
                                isSelected: selectedModelId == model.id,
                                onSelect: { selectModel(model) },
                                onDownload: { downloadModel(model) }
                            )
                            .listRowBackground(Color.clear)
                            .listRowInsets(EdgeInsets())
                            .padding(.horizontal, OptaDesign.Spacing.md)
                            .padding(.vertical, OptaDesign.Spacing.xs)
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
                    } header: {
                        Text("On-Device AI")
                    } footer: {
                        VStack(alignment: .leading, spacing: OptaDesign.Spacing.xxs) {
                            Text("All processing happens locally on your device.")
                            Text("No data is sent to any server.")
                        }
                        .optaLabelStyle()
                    }

                    // Storage Section
                    Section {
                        StorageInfoView(
                            modelStorage: storageManager.modelStorageString,
                            availableStorage: storageManager.availableStorageString,
                            onClearAll: {
                                showingClearConfirmation = true
                            }
                        )
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                    } header: {
                        Text("Storage")
                    }

                    // Preferences Section
                    Section {
                        BatteryModeRow()

                        SettingsRow(
                            icon: "wand.and.stars",
                            title: "Optimization Depth",
                            subtitle: "How thorough to analyze"
                        )

                        SettingsRow(
                            icon: "icloud",
                            title: "Sync",
                            subtitle: "iCloud backup"
                        )
                    } header: {
                        Text("Preferences")
                    }

                    // Support Section
                    Section {
                        SettingsRow(
                            icon: "questionmark.circle",
                            title: "Help & Support",
                            subtitle: nil
                        )

                        SettingsRow(
                            icon: "info.circle",
                            title: "About",
                            subtitle: nil
                        )
                    } header: {
                        Text("Support")
                    }

                    // Version footer
                    Section {
                        HStack {
                            Spacer()
                            VStack(spacing: OptaDesign.Spacing.xxs) {
                                Text("Opta Scan")
                                    .optaCaptionStyle()
                                Text("Version 2.0.0")
                                    .optaLabelStyle()
                            }
                            Spacer()
                        }
                        .listRowBackground(Color.clear)
                    }
                }
                .scrollContentBackground(.hidden)
                .listStyle(.insetGrouped)
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.optaBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .task {
                await loadSettings()
                await storageManager.refresh()
            }
            .alert("Download Failed", isPresented: $showDownloadError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(downloadError ?? "An error occurred.")
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
        }
    }

    // MARK: - Methods

    private func loadSettings() async {
        // Load saved selected model
        if let savedModelId = UserDefaults.standard.string(forKey: "opta.selectedModelId") {
            selectedModelId = savedModelId
        } else {
            // Default to first downloaded model, or nil
            for model in OptaModelConfiguration.all {
                if downloadManager.isModelDownloaded(model) {
                    selectedModelId = model.id
                    break
                }
            }
        }
    }

    private func selectModel(_ model: OptaModelConfiguration) {
        selectedModelId = model.id
        UserDefaults.standard.set(model.id, forKey: "opta.selectedModelId")
        OptaHaptics.shared.selectionChanged()
    }

    private func downloadModel(_ model: OptaModelConfiguration) {
        Task {
            do {
                try await downloadManager.downloadModel(model)
                OptaHaptics.shared.success()
                // Auto-select newly downloaded model
                selectModel(model)
            } catch {
                downloadError = error.localizedDescription
                showDownloadError = true
                OptaHaptics.shared.error()
            }
        }
    }

    private func deleteModel(_ model: OptaModelConfiguration) {
        Task {
            try? await storageManager.deleteModel(model)
            // Clear selection if this was the selected model
            if selectedModelId == model.id {
                selectedModelId = nil
            }
            OptaHaptics.shared.tap()
        }
    }

    private func clearAllModels() {
        Task {
            try? await storageManager.clearAllModels()
            selectedModelId = nil
            OptaHaptics.shared.success()
        }
    }
}

// MARK: - Battery Mode Row Component

private struct BatteryModeRow: View {
    private var performanceManager: PerformanceManager { PerformanceManager.shared }

    @State private var showingPicker = false

    var body: some View {
        Button {
            showingPicker = true
            OptaHaptics.shared.tap()
        } label: {
            HStack(spacing: OptaDesign.Spacing.md) {
                Image(systemName: performanceManager.currentBatteryMode.iconName)
                    .font(.system(size: 20))
                    .foregroundStyle(Color.optaPurple)
                    .frame(width: 28)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Battery Mode")
                        .optaBodyStyle()
                        .foregroundStyle(Color.optaTextPrimary)

                    Text(performanceManager.currentBatteryMode.description)
                        .optaLabelStyle()
                }

                Spacer()

                Text(performanceManager.currentBatteryMode.rawValue)
                    .optaCaptionStyle()
                    .foregroundStyle(Color.optaTextSecondary)

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.optaTextMuted)
            }
            .padding(.vertical, OptaDesign.Spacing.xxs)
        }
        .listRowBackground(Color.optaSurface)
        .sheet(isPresented: $showingPicker) {
            BatteryModePickerSheet()
        }
    }
}

// MARK: - Battery Mode Picker Sheet

private struct BatteryModePickerSheet: View {
    @Environment(\.dismiss) private var dismiss

    private var performanceManager: PerformanceManager { PerformanceManager.shared }

    var body: some View {
        NavigationStack {
            List {
                ForEach(BatteryMode.allCases, id: \.self) { mode in
                    BatteryModeOption(
                        mode: mode,
                        isSelected: performanceManager.currentBatteryMode == mode,
                        onSelect: {
                            performanceManager.currentBatteryMode = mode
                            OptaHaptics.shared.selectionChanged()
                            dismiss()
                        }
                    )
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.optaBackground)
            .navigationTitle("Battery Mode")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundStyle(Color.optaPurple)
                }
            }
            .toolbarBackground(Color.optaBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}

// MARK: - Battery Mode Option

private struct BatteryModeOption: View {
    let mode: BatteryMode
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: OptaDesign.Spacing.md) {
                Image(systemName: mode.iconName)
                    .font(.system(size: 24))
                    .foregroundStyle(isSelected ? Color.optaPurple : Color.optaTextSecondary)
                    .frame(width: 32)

                VStack(alignment: .leading, spacing: 4) {
                    Text(mode.rawValue)
                        .font(.optaBody)
                        .fontWeight(isSelected ? .semibold : .regular)
                        .foregroundStyle(Color.optaTextPrimary)

                    Text(mode.description)
                        .font(.optaCaption)
                        .foregroundStyle(Color.optaTextSecondary)

                    Text("Target: \(mode.maxTokensPerSecondTarget) tok/s")
                        .font(.optaLabel)
                        .foregroundStyle(Color.optaTextMuted)
                }

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(Color.optaPurple)
                }
            }
            .padding(.vertical, OptaDesign.Spacing.sm)
        }
        .listRowBackground(isSelected ? Color.optaSurface : Color.clear)
    }
}

// MARK: - Settings Row Component

private struct SettingsRow: View {
    let icon: String
    let title: String
    let subtitle: String?

    var body: some View {
        HStack(spacing: OptaDesign.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(Color.optaPurple)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .optaBodyStyle()
                    .foregroundStyle(Color.optaTextPrimary)

                if let subtitle = subtitle {
                    Text(subtitle)
                        .optaLabelStyle()
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.optaTextMuted)
        }
        .padding(.vertical, OptaDesign.Spacing.xxs)
        .listRowBackground(Color.optaSurface)
    }
}

// MARK: - Preview

#Preview {
    SettingsView()
}
