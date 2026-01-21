//
//  ProcessingView.swift
//  Opta Scan
//
//  Animated processing state while Opta analyzes the user's request
//  Local AI processing - no cloud dependencies
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Processing View

/// Full-screen loading view displayed during on-device AI analysis
struct ProcessingView: View {

    // MARK: - Properties

    let prompt: String

    // MARK: - Animation State

    @State private var dotCount = 0
    @State private var pulseScale: CGFloat = 1.0
    @State private var rotation: Double = 0
    @State private var isVisible = false

    // MARK: - Constants

    private enum Animation {
        static let dotInterval: TimeInterval = 0.5
        static let maxDots = 4
        static let pulseMaxScale: CGFloat = 1.2
        static let rotationDegrees: Double = 360
    }

    private enum Layout {
        static let glowSize: CGFloat = 120
        static let glowBlur: CGFloat = 30
        static let ringSize: CGFloat = 95
        static let ringLineWidth: CGFloat = 3
        static let innerCircleSize: CGFloat = 80
        static let sparkleSize: CGFloat = 32
    }

    private let timer = Timer.publish(every: Animation.dotInterval, on: .main, in: .common).autoconnect()

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.optaBackground
                .ignoresSafeArea()

            VStack(spacing: OptaDesign.Spacing.xl) {
                Spacer()

                // Animated Opta Logo
                animatedLogo
                    .opacity(isVisible ? 1 : 0)
                    .scaleEffect(isVisible ? 1 : 0.8)

                // Processing Text
                processingText
                    .opacity(isVisible ? 1 : 0)
                    .offset(y: isVisible ? 0 : 20)

                Spacer()

                // Tip Text
                tipText
                    .opacity(isVisible ? 1 : 0)
            }
        }
        .onAppear(perform: startAnimations)
        .onReceive(timer) { _ in
            withAnimation(.optaSpring) {
                dotCount = (dotCount + 1) % Animation.maxDots
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Processing your optimization request")
        .accessibilityHint("Please wait while Opta analyzes: \(prompt)")
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

    private var processingText: some View {
        VStack(spacing: OptaDesign.Spacing.sm) {
            Text("Optimizing\(String(repeating: ".", count: dotCount))")
                .font(.optaHeadline)
                .foregroundStyle(Color.optaTextPrimary)
                .contentTransition(.numericText())

            Text(prompt)
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
        }
    }

    private var tipText: some View {
        Text("Opta is analyzing your request and preparing clarifying questions...")
            .font(.optaLabel)
            .foregroundStyle(Color.optaTextMuted)
            .multilineTextAlignment(.center)
            .padding(.horizontal, OptaDesign.Spacing.xl)
            .padding(.bottom, OptaDesign.Spacing.xxl)
    }

    // MARK: - Private Methods

    private func startAnimations() {
        // Haptic feedback on processing start
        OptaHaptics.shared.processingStart()

        // Animate in
        withAnimation(.optaSpringGentle) {
            isVisible = true
        }

        // Pulse animation (using spring-based timing)
        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            pulseScale = Animation.pulseMaxScale
        }

        // Rotation animation
        withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
            rotation = Animation.rotationDegrees
        }
    }
}

#Preview {
    ProcessingView(prompt: "best value for money")
}
