//
//  ProcessingView.swift
//  Opta Scan
//
//  Real-time processing view with token streaming progress
//  Local AI processing - no cloud dependencies
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Processing View

/// Full-screen loading view displayed during on-device AI analysis
/// Shows real-time token progress, text preview, and cancel button
struct ProcessingView: View {

    // MARK: - Properties

    let prompt: String
    let generationStream: GenerationStream
    let onCancel: () -> Void

    // MARK: - Animation State

    @State private var pulseScale: CGFloat = 1.0
    @State private var rotation: Double = 0
    @State private var isVisible = false

    // MARK: - Constants

    private enum Layout {
        static let glowSize: CGFloat = 120
        static let glowBlur: CGFloat = 30
        static let ringSize: CGFloat = 95
        static let ringLineWidth: CGFloat = 3
        static let innerCircleSize: CGFloat = 80
        static let sparkleSize: CGFloat = 32
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.optaBackground
                .ignoresSafeArea()

            VStack(spacing: OptaDesign.Spacing.xl) {
                Spacer()

                // Animated Opta Logo with Progress Ring
                animatedLogo
                    .opacity(isVisible ? 1 : 0)
                    .scaleEffect(isVisible ? 1 : 0.8)

                // Progress Section
                progressSection
                    .opacity(isVisible ? 1 : 0)
                    .offset(y: isVisible ? 0 : 20)

                // Text Preview
                if !generationStream.currentText.isEmpty {
                    textPreview
                        .opacity(isVisible ? 1 : 0)
                }

                Spacer()

                // Cancel Button
                cancelButton
                    .opacity(isVisible ? 1 : 0)
            }
        }
        .onAppear(perform: startAnimations)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Processing: \(Int(generationStream.progress * 100))% complete")
    }

    // MARK: - Subviews

    private var animatedLogo: some View {
        ZStack {
            // Outer Glow
            Circle()
                .fill(Color.optaPurpleGlow)
                .frame(width: Layout.glowSize, height: Layout.glowSize)
                .blur(radius: Layout.glowBlur)
                .scaleEffect(pulseScale)

            // Rotating Ring
            Circle()
                .trim(from: 0, to: 0.7)
                .stroke(
                    AngularGradient(
                        colors: [Color.optaPurple.opacity(0), Color.optaPurple, Color.optaBlue],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: Layout.ringLineWidth, lineCap: .round)
                )
                .frame(width: Layout.ringSize, height: Layout.ringSize)
                .rotationEffect(.degrees(rotation))

            // Progress Ring
            Circle()
                .trim(from: 0, to: generationStream.progress)
                .stroke(Color.optaGreen, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .frame(width: Layout.ringSize + 10, height: Layout.ringSize + 10)
                .rotationEffect(.degrees(-90))
                .animation(.optaSpring, value: generationStream.progress)

            // Inner Circle
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Color.optaPurple, Color.optaBlue],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: Layout.innerCircleSize, height: Layout.innerCircleSize)

            // Sparkle Icon
            Image(systemName: "sparkles")
                .font(.system(size: Layout.sparkleSize, weight: .medium))
                .foregroundStyle(.white)
                .symbolEffect(.pulse.byLayer, options: .repeating)
        }
        .accessibilityHidden(true)
    }

    private var progressSection: some View {
        VStack(spacing: OptaDesign.Spacing.sm) {
            // Progress Percentage
            Text("\(Int(generationStream.progress * 100))%")
                .font(.system(size: 48, weight: .bold, design: .rounded))
                .foregroundStyle(Color.optaTextPrimary)
                .contentTransition(.numericText())
                .animation(.optaSpring, value: generationStream.progress)

            // Token Count
            Text("\(generationStream.tokenCount) tokens generated")
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)

            // Prompt
            Text(prompt)
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextMuted)
                .multilineTextAlignment(.center)
                .lineLimit(2)
        }
    }

    private var textPreview: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.xs) {
            Text("Generating...")
                .font(.optaLabel)
                .foregroundStyle(Color.optaTextMuted)

            Text(String(generationStream.currentText.suffix(200)))
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)
                .lineLimit(4)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(OptaDesign.Spacing.md)
        .background(Color.optaSurface)
        .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.small))
        .padding(.horizontal, OptaDesign.Spacing.lg)
    }

    private var cancelButton: some View {
        Button {
            OptaHaptics.shared.tap()
            onCancel()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "xmark.circle.fill")
                Text("Cancel")
            }
            .font(.optaCaption)
            .foregroundStyle(Color.optaTextMuted)
        }
        .padding(.bottom, OptaDesign.Spacing.xxl)
        .accessibilityLabel("Cancel generation")
    }

    // MARK: - Private Methods

    private func startAnimations() {
        OptaHaptics.shared.processingStart()

        withAnimation(.optaSpringGentle) {
            isVisible = true
        }

        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            pulseScale = 1.2
        }

        withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
            rotation = 360
        }
    }
}

// MARK: - Preview

#Preview {
    ProcessingView(
        prompt: "best value for money",
        generationStream: {
            let stream = GenerationStream()
            Task { @MainActor in
                stream.start(maxTokens: 100)
                stream.update(text: "Analyzing your request...", tokenCount: 25)
            }
            return stream
        }(),
        onCancel: {}
    )
}
