//
//  ModelSelectionCard.swift
//  Opta Scan
//
//  Model selection card with download status indicator
//  Follows Opta iOS Aesthetic Guide for styling
//
//  Created by Matthew Byrden
//

import SwiftUI

struct ModelSelectionCard: View {
    let model: OptaModelConfiguration
    let state: ModelDownloadState
    let isSelected: Bool
    let onSelect: () -> Void
    let onDownload: () -> Void

    @Environment(\.isEnabled) private var isEnabled

    private var isCompatible: Bool {
        model.isCompatibleWithDevice()
    }

    var body: some View {
        Button(action: handleTap) {
            HStack(spacing: OptaDesign.Spacing.md) {
                // Status icon
                statusIcon
                    .frame(width: 44, height: 44)

                // Content
                VStack(alignment: .leading, spacing: 2) {
                    // Title row with vision badge
                    HStack(spacing: OptaDesign.Spacing.xs) {
                        Text(model.displayName)
                            .optaHeadlineStyle()

                        if model.supportsVision {
                            visionBadge
                        }
                    }

                    // Description
                    Text(model.description)
                        .optaCaptionStyle()
                        .foregroundStyle(Color.optaTextMuted)

                    // Specs row
                    HStack(spacing: OptaDesign.Spacing.sm) {
                        Label(model.sizeString, systemImage: "arrow.down.circle")
                        Label(model.ramRequirementString, systemImage: "memorychip")
                    }
                    .font(.optaLabel)
                    .foregroundStyle(Color.optaTextMuted)
                }

                Spacer()

                // Selection/download indicator
                trailingIndicator
            }
            .padding(OptaDesign.Spacing.md)
            .background(cardBackground)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled || !isCompatible)
        .opacity(isCompatible ? 1 : 0.5)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint(accessibilityHint)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    // MARK: - Subviews

    @ViewBuilder
    private var statusIcon: some View {
        ZStack {
            Circle()
                .fill(iconBackgroundColor)

            Image(systemName: iconName)
                .font(.system(size: 20))
                .foregroundStyle(iconColor)
        }
    }

    private var visionBadge: some View {
        Text("Vision")
            .font(.caption2.bold())
            .foregroundStyle(Color.optaBlue)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color.optaBlue.opacity(0.15))
            .cornerRadius(4)
    }

    @ViewBuilder
    private var trailingIndicator: some View {
        switch state {
        case .notDownloaded:
            Image(systemName: "arrow.down.circle")
                .font(.system(size: 22))
                .foregroundStyle(Color.optaPurple)

        case .downloading:
            ProgressView()
                .progressViewStyle(.circular)
                .scaleEffect(0.8)
                .tint(Color.optaPurple)

        case .downloaded:
            Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 22))
                .foregroundStyle(isSelected ? Color.optaPurple : Color.optaTextMuted)

        case .failed:
            Image(systemName: "exclamationmark.circle")
                .font(.system(size: 22))
                .foregroundStyle(Color.optaRed)
        }
    }

    private var cardBackground: some View {
        RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium)
            .fill(Color.optaSurface)
            .overlay(
                RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium)
                    .stroke(
                        isSelected ? Color.optaPurple : Color.clear,
                        lineWidth: 2
                    )
            )
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
        default: return .optaSurfaceElevated
        }
    }

    // MARK: - Accessibility

    private var accessibilityLabel: String {
        var label = model.displayName
        if model.supportsVision {
            label += ", vision capable"
        }
        label += ", \(model.sizeString)"

        switch state {
        case .notDownloaded:
            label += ", not downloaded"
        case .downloading(let progress):
            label += ", downloading \(Int(progress * 100)) percent"
        case .downloaded:
            label += isSelected ? ", selected" : ", downloaded"
        case .failed(let error):
            label += ", download failed: \(error)"
        }

        if !isCompatible {
            label += ", not compatible with this device"
        }

        return label
    }

    private var accessibilityHint: String {
        switch state {
        case .notDownloaded, .failed:
            return "Double tap to download"
        case .downloading:
            return "Download in progress"
        case .downloaded:
            return isSelected ? "Currently selected" : "Double tap to select"
        }
    }

    // MARK: - Actions

    private func handleTap() {
        switch state {
        case .notDownloaded, .failed:
            OptaHaptics.shared.tap()
            onDownload()
        case .downloaded:
            OptaHaptics.shared.tap()
            onSelect()
        case .downloading:
            break // Do nothing while downloading
        }
    }
}

// MARK: - Preview

#Preview {
    OptaPreviewContainer {
        VStack(spacing: OptaDesign.Spacing.md) {
            ModelSelectionCard(
                model: .llama32_11B_Vision,
                state: .notDownloaded,
                isSelected: false,
                onSelect: {},
                onDownload: {}
            )

            ModelSelectionCard(
                model: .llama32_3B,
                state: .downloading(progress: 0.6),
                isSelected: false,
                onSelect: {},
                onDownload: {}
            )

            ModelSelectionCard(
                model: .llama32_11B_Vision,
                state: .downloaded,
                isSelected: true,
                onSelect: {},
                onDownload: {}
            )

            ModelSelectionCard(
                model: .llama32_1B,
                state: .downloaded,
                isSelected: false,
                onSelect: {},
                onDownload: {}
            )

            ModelSelectionCard(
                model: .llama32_1B,
                state: .failed("Network error"),
                isSelected: false,
                onSelect: {},
                onDownload: {}
            )
        }
        .padding()
    }
}
