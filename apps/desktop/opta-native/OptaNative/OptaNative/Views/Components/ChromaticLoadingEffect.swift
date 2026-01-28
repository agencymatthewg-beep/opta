//
//  ChromaticLoadingEffect.swift
//  OptaNative
//
//  Premium loading effect with chromatic aberration-inspired visual feedback.
//  Creates a pulsing RGB channel separation effect for a holographic feel.
//  Created for Opta Native macOS - Plan 20-09
//

import SwiftUI

// MARK: - Chromatic Loading Effect

/// A premium loading indicator with chromatic aberration-inspired visuals.
/// Creates a pulsing effect with RGB channel separation for a holographic feel.
struct ChromaticLoadingEffect: View {
    @State private var phase: CGFloat = 0
    @State private var isAnimating = false

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Red channel offset layer
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.red.opacity(pulsingOpacity * 0.3), lineWidth: 1)
                    .offset(x: chromaticOffset, y: 0)
                    .blur(radius: 1)

                // Blue channel offset layer
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.blue.opacity(pulsingOpacity * 0.3), lineWidth: 1)
                    .offset(x: -chromaticOffset, y: 0)
                    .blur(radius: 1)

                // Cyan glow layer
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.cyan.opacity(pulsingOpacity * 0.5), lineWidth: 2)
                    .blur(radius: 3)

                // Scanning line effect
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.clear,
                                Color.cyan.opacity(0.3),
                                Color.white.opacity(0.5),
                                Color.cyan.opacity(0.3),
                                Color.clear
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: 40)
                    .offset(x: scanLineOffset(in: geometry.size.width))
                    .mask(
                        RoundedRectangle(cornerRadius: 10)
                    )
            }
        }
        .onAppear {
            isAnimating = true
            withAnimation(
                .linear(duration: 2.0)
                .repeatForever(autoreverses: false)
            ) {
                phase = 1.0
            }
        }
        .onDisappear {
            isAnimating = false
        }
    }

    /// Pulsing opacity based on animation phase
    private var pulsingOpacity: Double {
        let pulse = sin(phase * .pi * 4)
        return 0.3 + pulse * 0.2
    }

    /// Chromatic aberration offset based on animation phase
    private var chromaticOffset: CGFloat {
        let pulse = sin(phase * .pi * 2)
        return 2 + pulse * 1.5
    }

    /// Scan line position based on container width
    private func scanLineOffset(in width: CGFloat) -> CGFloat {
        let normalizedPhase = phase.truncatingRemainder(dividingBy: 1.0)
        return (normalizedPhase * (width + 80)) - 40 - (width / 2)
    }
}

// MARK: - Chromatic Ring Loader

/// A circular chromatic loading indicator with spinning RGB rings
struct ChromaticRingLoader: View {
    let size: CGFloat
    @State private var rotation: Double = 0

    init(size: CGFloat = 40) {
        self.size = size
    }

    var body: some View {
        ZStack {
            // Red ring
            Circle()
                .stroke(Color.red.opacity(0.5), lineWidth: 2)
                .frame(width: size, height: size)
                .offset(x: 1, y: 0)
                .blur(radius: 0.5)

            // Blue ring
            Circle()
                .stroke(Color.blue.opacity(0.5), lineWidth: 2)
                .frame(width: size, height: size)
                .offset(x: -1, y: 0)
                .blur(radius: 0.5)

            // Main spinning arc
            Circle()
                .trim(from: 0, to: 0.7)
                .stroke(
                    AngularGradient(
                        gradient: Gradient(colors: [
                            Color.cyan.opacity(0.1),
                            Color.cyan,
                            Color.white,
                            Color.cyan,
                            Color.cyan.opacity(0.1)
                        ]),
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: 3, lineCap: .round)
                )
                .frame(width: size - 4, height: size - 4)
                .rotationEffect(.degrees(rotation))
                .shadow(color: Color.cyan.opacity(0.5), radius: 4)
        }
        .onAppear {
            withAnimation(
                .linear(duration: 1.0)
                .repeatForever(autoreverses: false)
            ) {
                rotation = 360
            }
        }
    }
}

// MARK: - Holographic Shimmer

/// A holographic shimmer effect overlay for loading states
struct HolographicShimmer: View {
    @State private var shimmerOffset: CGFloat = -1

    var body: some View {
        GeometryReader { geometry in
            Rectangle()
                .fill(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color.clear,
                            Color.white.opacity(0.1),
                            Color.cyan.opacity(0.2),
                            Color.purple.opacity(0.2),
                            Color.white.opacity(0.1),
                            Color.clear
                        ]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(width: geometry.size.width * 0.5)
                .offset(x: shimmerOffset * geometry.size.width)
                .blur(radius: 2)
        }
        .mask(Rectangle())
        .onAppear {
            withAnimation(
                .linear(duration: 1.5)
                .repeatForever(autoreverses: false)
            ) {
                shimmerOffset = 1.5
            }
        }
    }
}

// MARK: - Loading Pulse Dots

/// Animated loading dots with chromatic effect
struct ChromaticLoadingDots: View {
    @State private var dotScales: [CGFloat] = [1, 1, 1]

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<3, id: \.self) { index in
                ZStack {
                    // Red offset
                    Circle()
                        .fill(Color.red.opacity(0.3))
                        .frame(width: 8, height: 8)
                        .offset(x: 1)

                    // Blue offset
                    Circle()
                        .fill(Color.blue.opacity(0.3))
                        .frame(width: 8, height: 8)
                        .offset(x: -1)

                    // Main dot
                    Circle()
                        .fill(Color.cyan)
                        .frame(width: 8, height: 8)
                        .shadow(color: Color.cyan.opacity(0.5), radius: 3)
                }
                .scaleEffect(dotScales[index])
            }
        }
        .onAppear {
            animateDots()
        }
    }

    private func animateDots() {
        for index in 0..<3 {
            withAnimation(
                .easeInOut(duration: 0.4)
                .repeatForever(autoreverses: true)
                .delay(Double(index) * 0.15)
            ) {
                dotScales[index] = 1.3
            }
        }
    }
}

// MARK: - Preview

#Preview("Chromatic Loading Effect") {
    ZStack {
        Color.optaBackground

        VStack(spacing: 32) {
            // Box effect
            Text("Chromatic Box Effect")
                .font(.optaSmall)
                .foregroundStyle(Color.optaMutedForeground)

            RoundedRectangle(cornerRadius: 10)
                .fill(Color.optaMuted)
                .frame(width: 200, height: 60)
                .overlay(
                    ChromaticLoadingEffect()
                )

            Divider()
                .background(Color.optaBorder)
                .padding(.horizontal, 40)

            // Ring loader
            Text("Chromatic Ring Loader")
                .font(.optaSmall)
                .foregroundStyle(Color.optaMutedForeground)

            ChromaticRingLoader(size: 50)

            Divider()
                .background(Color.optaBorder)
                .padding(.horizontal, 40)

            // Shimmer effect
            Text("Holographic Shimmer")
                .font(.optaSmall)
                .foregroundStyle(Color.optaMutedForeground)

            RoundedRectangle(cornerRadius: 8)
                .fill(Color.optaMuted)
                .frame(width: 200, height: 40)
                .overlay(
                    HolographicShimmer()
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                )

            Divider()
                .background(Color.optaBorder)
                .padding(.horizontal, 40)

            // Loading dots
            Text("Chromatic Dots")
                .font(.optaSmall)
                .foregroundStyle(Color.optaMutedForeground)

            ChromaticLoadingDots()
        }
        .padding()
    }
    .frame(width: 300, height: 500)
}
