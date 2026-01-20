//
//  CaptureView.swift
//  Opta Scan
//
//  Primary capture screen - photo capture will be added in Phase 2
//  Created by Matthew Byrden
//

import SwiftUI

struct CaptureView: View {
    var body: some View {
        ZStack {
            Color.optaBackground
                .ignoresSafeArea()

            VStack(spacing: OptaDesign.Spacing.xl) {
                Spacer()

                // Camera icon
                Image(systemName: "camera.fill")
                    .font(.system(size: 64, weight: .light))
                    .foregroundStyle(Color.optaPurple)

                // Tagline
                VStack(spacing: OptaDesign.Spacing.xs) {
                    Text("Capture anything,")
                        .optaTitleStyle()

                    GradientText(text: "optimize everything")
                        .font(.optaTitle)
                }

                // Hint text
                Text("Tap to scan a photo or enter a prompt")
                    .optaCaptionStyle()
                    .multilineTextAlignment(.center)
                    .padding(.top, OptaDesign.Spacing.md)

                Spacer()
                Spacer()
            }
            .padding(.horizontal, OptaDesign.Spacing.lg)
        }
    }
}

#Preview {
    CaptureView()
}
