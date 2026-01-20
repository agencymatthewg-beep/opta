//
//  ProcessingView.swift
//  Opta Scan
//
//  Animated processing state while Claude analyzes
//  Created by Matthew Byrden
//

import SwiftUI

struct ProcessingView: View {

    let prompt: String
    @State private var dotCount = 0
    @State private var pulseScale: CGFloat = 1.0
    @State private var rotation: Double = 0
    @State private var isVisible = false

    private let timer = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            Color.optaBackground
                .ignoresSafeArea()

            VStack(spacing: OptaDesign.Spacing.xl) {
                Spacer()

                // Animated Opta logo
                ZStack {
                    // Outer glow with rotation
                    Circle()
                        .fill(Color.optaPurpleGlow)
                        .frame(width: 120, height: 120)
                        .blur(radius: 30)
                        .scaleEffect(pulseScale)

                    // Rotating ring
                    Circle()
                        .trim(from: 0, to: 0.7)
                        .stroke(
                            AngularGradient(
                                colors: [Color.optaPurple.opacity(0), Color.optaPurple, Color.optaBlue],
                                center: .center
                            ),
                            style: StrokeStyle(lineWidth: 3, lineCap: .round)
                        )
                        .frame(width: 95, height: 95)
                        .rotationEffect(.degrees(rotation))

                    // Inner circle
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color.optaPurple, Color.optaBlue],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 80, height: 80)

                    // Sparkle icon
                    Image(systemName: "sparkles")
                        .font(.system(size: 32, weight: .medium))
                        .foregroundStyle(.white)
                        .symbolEffect(.pulse.byLayer, options: .repeating)
                }
                .opacity(isVisible ? 1 : 0)
                .scaleEffect(isVisible ? 1 : 0.8)

                // Processing text
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
                .opacity(isVisible ? 1 : 0)
                .offset(y: isVisible ? 0 : 20)

                Spacer()

                // Tip text
                Text("Opta is analyzing your request and preparing clarifying questions...")
                    .font(.optaLabel)
                    .foregroundStyle(Color.optaTextMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, OptaDesign.Spacing.xl)
                    .padding(.bottom, OptaDesign.Spacing.xxl)
                    .opacity(isVisible ? 1 : 0)
            }
        }
        .onAppear {
            // Haptic feedback on processing start
            OptaHaptics.shared.processingStart()

            // Animate in
            withAnimation(.optaSpringGentle) {
                isVisible = true
            }

            // Pulse animation
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                pulseScale = 1.2
            }

            // Rotation animation
            withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                rotation = 360
            }
        }
        .onReceive(timer) { _ in
            withAnimation(.optaSpring) {
                dotCount = (dotCount + 1) % 4
            }
        }
        .accessibilityLabel("Processing your optimization request")
        .accessibilityHint("Please wait while Opta analyzes: \(prompt)")
    }
}

#Preview {
    ProcessingView(prompt: "best value for money")
}
