//
//  ModelDownloadProgressView.swift
//  Opta Scan
//
//  Download progress indicator with cancel button
//  Follows Opta iOS Aesthetic Guide for styling
//
//  Created by Matthew Byrden
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

                Button(action: {
                    OptaHaptics.shared.tap()
                    onCancel()
                }) {
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
                                    colors: [Color.optaPurple, Color.optaBlue],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: max(geo.size.width * progress, 8), height: 8)
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
        .cornerRadius(OptaDesign.CornerRadius.medium)
    }
}

// MARK: - Preview

#Preview {
    OptaPreviewContainer {
        VStack(spacing: OptaDesign.Spacing.md) {
            ModelDownloadProgressView(
                model: .llama32_11B_Vision,
                progress: 0.0,
                onCancel: {}
            )

            ModelDownloadProgressView(
                model: .llama32_11B_Vision,
                progress: 0.45,
                onCancel: {}
            )

            ModelDownloadProgressView(
                model: .llama32_3B,
                progress: 0.85,
                onCancel: {}
            )
        }
        .padding()
    }
}
