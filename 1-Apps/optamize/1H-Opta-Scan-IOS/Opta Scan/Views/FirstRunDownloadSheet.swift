//
//  FirstRunDownloadSheet.swift
//  Opta Scan
//
//  First-run modal prompting user to download AI model
//  Created by Matthew Byrden
//

import SwiftUI

struct FirstRunDownloadSheet: View {
    @Environment(\.dismiss) private var dismiss

    @State private var isDownloading = false
    @State private var downloadError: String?
    @State private var selectedModel: OptaModelConfiguration = .llama32_11B_Vision

    private var downloadManager: ModelDownloadManager {
        ModelDownloadManager.shared
    }

    private var networkMonitor: NetworkMonitor {
        NetworkMonitor.shared
    }

    private var availableModels: [OptaModelConfiguration] {
        OptaModelConfiguration.all
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

                    // Model Selection
                    VStack(spacing: OptaDesign.Spacing.sm) {
                        ForEach(availableModels) { model in
                            ModelOptionCard(
                                model: model,
                                isSelected: selectedModel.id == model.id,
                                onSelect: { selectedModel = model }
                            )
                        }
                    }
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
                try await downloadManager.downloadModel(selectedModel)
                // Auto-select the model
                UserDefaults.standard.set(selectedModel.id, forKey: "opta.selectedModelId")
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

// MARK: - Model Option Card

private struct ModelOptionCard: View {
    let model: OptaModelConfiguration
    let isSelected: Bool
    let onSelect: () -> Void

    private var isCompatible: Bool {
        model.isCompatibleWithDevice()
    }

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: OptaDesign.Spacing.md) {
                // Selection indicator
                ZStack {
                    Circle()
                        .stroke(isSelected ? Color.optaPurple : Color.optaSurface, lineWidth: 2)
                        .frame(width: 24, height: 24)

                    if isSelected {
                        Circle()
                            .fill(Color.optaPurple)
                            .frame(width: 14, height: 14)
                    }
                }

                // Model info
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(model.displayName)
                            .font(.optaBody)
                            .fontWeight(.medium)
                            .foregroundStyle(Color.optaTextPrimary)

                        if model.supportsVision {
                            Image(systemName: "eye.fill")
                                .font(.system(size: 12))
                                .foregroundStyle(Color.optaGreen)
                        }

                        Spacer()

                        Text(model.sizeString)
                            .font(.optaCaption)
                            .foregroundStyle(Color.optaTextMuted)
                    }

                    Text(model.description)
                        .font(.optaCaption)
                        .foregroundStyle(Color.optaTextSecondary)

                    if !isCompatible {
                        Text("Requires \(model.ramRequirementString)")
                            .font(.optaLabel)
                            .foregroundStyle(.orange)
                    }
                }
            }
            .padding(OptaDesign.Spacing.md)
            .background(isSelected ? Color.optaPurple.opacity(0.1) : Color.optaSurface)
            .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium))
            .overlay(
                RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium)
                    .stroke(isSelected ? Color.optaPurple : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
        .opacity(isCompatible ? 1.0 : 0.6)
    }
}

#Preview {
    FirstRunDownloadSheet()
}
