//
//  StorageInfoView.swift
//  Opta Scan
//
//  Storage usage indicator for Settings
//  Follows Opta iOS Aesthetic Guide for styling
//
//  Created by Matthew Byrden
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
                    .font(.system(size: 20))
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

            // Clear button (only show if models are downloaded)
            if modelStorage != "Zero KB" && modelStorage != "0 bytes" {
                Button(action: {
                    OptaHaptics.shared.tap()
                    onClearAll()
                }) {
                    HStack(spacing: OptaDesign.Spacing.xs) {
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
        .cornerRadius(OptaDesign.CornerRadius.medium)
    }
}

// MARK: - Preview

#Preview {
    OptaPreviewContainer {
        VStack(spacing: OptaDesign.Spacing.md) {
            StorageInfoView(
                modelStorage: "6.5 GB",
                availableStorage: "42.3 GB",
                onClearAll: {}
            )

            StorageInfoView(
                modelStorage: "Zero KB",
                availableStorage: "48.8 GB",
                onClearAll: {}
            )
        }
        .padding()
    }
}
