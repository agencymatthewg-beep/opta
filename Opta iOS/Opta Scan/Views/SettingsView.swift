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

    private var downloadManager: ModelDownloadManager {
        ModelDownloadManager.shared
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaBackground
                    .ignoresSafeArea()

                List {
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

                        // Model selection cards
                        ForEach(OptaModelConfiguration.all) { model in
                            ModelSelectionCard(
                                model: model,
                                state: downloadManager.state(for: model),
                                isSelected: selectedModelId == model.id,
                                onSelect: { selectModel(model) },
                                onDownload: { downloadModel(model) }
                            )
                            .listRowBackground(Color.clear)
                            .listRowInsets(EdgeInsets())
                            .padding(.horizontal, OptaDesign.Spacing.md)
                            .padding(.vertical, OptaDesign.Spacing.xs)
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

                    // Preferences Section
                    Section {
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
            }
            .alert("Download Failed", isPresented: $showDownloadError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(downloadError ?? "An error occurred.")
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
