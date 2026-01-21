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
    @State private var modelStatus: ModelDownloadState = .notDownloaded
    @State private var downloadProgress: Double = 0
    @State private var selectedModelId: String? = nil

    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaBackground
                    .ignoresSafeArea()

                List {
                    // On-Device AI Section (Primary)
                    Section {
                        // Model Status
                        ModelStatusRow(
                            status: $modelStatus,
                            progress: $downloadProgress
                        )

                        // Model Selection
                        ForEach(OptaModelConfiguration.all) { config in
                            ModelConfigurationRow(
                                config: config,
                                isSelected: selectedModelId == config.id,
                                onSelect: {
                                    selectedModelId = config.id
                                    OptaHaptics.shared.selectionChanged()
                                }
                            )
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
        }
    }

    // MARK: - Methods

    private func loadSettings() async {
        // Load downloaded model ID from UserDefaults
        if let savedModelId = UserDefaults.standard.string(forKey: "opta.downloadedModelId") {
            selectedModelId = savedModelId
            modelStatus = .downloaded
        }
    }
}

// MARK: - Model Status Row

private struct ModelStatusRow: View {
    @Binding var status: ModelDownloadState
    @Binding var progress: Double
    @State private var isDeviceSupported = false

    var body: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
            HStack {
                Image(systemName: statusIcon)
                    .foregroundStyle(statusColor)

                Text(statusText)
                    .optaBodyStyle()

                Spacer()
            }

            if !isDeviceSupported {
                Text("Your device does not support on-device inference. Requires A14 chip or newer with iOS 17.2+.")
                    .optaCaptionStyle()
                    .foregroundStyle(Color.optaAmber)
            } else if case .downloading(let progress) = status {
                ProgressView(value: progress)
                    .tint(Color.optaPurple)
            } else if case .notDownloaded = status {
                Button("Download Model") {
                    // TODO: Implement model download
                    OptaHaptics.shared.tap()
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.optaPurple)
            }
        }
        .listRowBackground(Color.optaSurface)
        .onAppear {
            checkDeviceSupport()
        }
    }

    private var statusIcon: String {
        switch status {
        case .notDownloaded: return "arrow.down.circle"
        case .downloading: return "arrow.down.circle.dotted"
        case .downloaded: return "checkmark.circle.fill"
        case .failed: return "exclamationmark.circle.fill"
        }
    }

    private var statusColor: Color {
        switch status {
        case .notDownloaded: return .optaTextMuted
        case .downloading: return .optaPurple
        case .downloaded: return .optaGreen
        case .failed: return .optaRed
        }
    }

    private var statusText: String {
        switch status {
        case .notDownloaded: return "No model downloaded"
        case .downloading: return "Downloading..."
        case .downloaded: return "Model ready"
        case .failed: return "Download failed"
        }
    }

    private func checkDeviceSupport() {
        #if targetEnvironment(simulator)
        isDeviceSupported = false
        #else
        if #available(iOS 17.2, *) {
            isDeviceSupported = true
        } else {
            isDeviceSupported = false
        }
        #endif
    }
}

// MARK: - Model Configuration Row

private struct ModelConfigurationRow: View {
    let config: OptaModelConfiguration
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        HStack(spacing: OptaDesign.Spacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(config.displayName)
                        .optaBodyStyle()
                        .foregroundStyle(Color.optaTextPrimary)

                    if config.supportsVision {
                        Image(systemName: "eye.fill")
                            .font(.caption2)
                            .foregroundStyle(Color.optaPurple)
                    }
                }

                Text(config.description)
                    .optaLabelStyle()

                HStack(spacing: OptaDesign.Spacing.sm) {
                    Text(config.sizeString)
                        .optaCaptionStyle()
                        .foregroundStyle(Color.optaTextMuted)

                    Text(config.ramRequirementString)
                        .optaCaptionStyle()
                        .foregroundStyle(Color.optaTextMuted)
                }
            }

            Spacer()

            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color.optaPurple)
            }
        }
        .padding(.vertical, OptaDesign.Spacing.xxs)
        .listRowBackground(Color.optaSurface)
        .contentShape(Rectangle())
        .onTapGesture {
            onSelect()
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
