//
//  VisualEffects.swift
//  OptaNative
//
//  Visual effect helpers including momentum-based animated borders,
//  glow effects, and additional visual utilities for the popover UI.
//  Created for Opta Native macOS - Plan 20-09
//

import SwiftUI
import AppKit

// MARK: - Momentum Border View

/// Animated border that rotates with speed based on system momentum.
/// Creates a dynamic visual indicator of system activity.
struct MomentumBorderView: View {
    let momentum: MomentumState
    let cornerRadius: CGFloat

    @State private var rotationAngle: Double = 0

    init(momentum: MomentumState, cornerRadius: CGFloat = 12) {
        self.momentum = momentum
        self.cornerRadius = cornerRadius
    }

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .strokeBorder(
                AngularGradient(
                    gradient: Gradient(colors: gradientColors),
                    center: .center,
                    startAngle: .degrees(rotationAngle),
                    endAngle: .degrees(rotationAngle + 360)
                ),
                lineWidth: 2
            )
            .onAppear {
                startRotation()
            }
            .onChange(of: momentum.rotationSpeed) { _, _ in
                startRotation()
            }
    }

    private var gradientColors: [Color] {
        switch momentum.color {
        case .idle:
            return [
                Color.optaPrimary.opacity(0.2),
                Color.optaPrimary.opacity(0.8),
                Color.optaPrimary.opacity(0.2),
                Color.optaPrimary.opacity(0.05)
            ]
        case .active:
            return [
                Color.optaAccent.opacity(0.2),
                Color.optaAccent.opacity(0.8),
                Color.cyan.opacity(0.8),
                Color.optaAccent.opacity(0.2)
            ]
        case .critical:
            return [
                Color.optaDanger.opacity(0.2),
                Color.optaDanger.opacity(0.9),
                Color.optaWarning.opacity(0.8),
                Color.optaDanger.opacity(0.2)
            ]
        }
    }

    private func startRotation() {
        let duration = 3.0 / momentum.rotationSpeed
        withAnimation(
            .linear(duration: duration)
            .repeatForever(autoreverses: false)
        ) {
            rotationAngle = 360
        }
    }
}

// MARK: - Pulsing Glow Border

/// A border that pulses with a glow effect
struct PulsingGlowBorder: View {
    let color: Color
    let cornerRadius: CGFloat
    let lineWidth: CGFloat

    @State private var glowIntensity: Double = 0.3

    init(color: Color = Color.optaPrimary, cornerRadius: CGFloat = 12, lineWidth: CGFloat = 2) {
        self.color = color
        self.cornerRadius = cornerRadius
        self.lineWidth = lineWidth
    }

    var body: some View {
        ZStack {
            // Outer glow
            RoundedRectangle(cornerRadius: cornerRadius)
                .stroke(color.opacity(glowIntensity), lineWidth: lineWidth + 4)
                .blur(radius: 4)

            // Inner border
            RoundedRectangle(cornerRadius: cornerRadius)
                .stroke(color.opacity(glowIntensity + 0.3), lineWidth: lineWidth)
        }
        .onAppear {
            withAnimation(
                .easeInOut(duration: 1.5)
                .repeatForever(autoreverses: true)
            ) {
                glowIntensity = 0.7
            }
        }
    }
}

// MARK: - Breathing Glow

/// A subtle breathing glow effect for backgrounds
struct BreathingGlow: View {
    let color: Color
    @State private var scale: CGFloat = 1.0
    @State private var opacity: Double = 0.3

    init(color: Color = Color.optaPrimary) {
        self.color = color
    }

    var body: some View {
        Circle()
            .fill(color)
            .blur(radius: 60)
            .scaleEffect(scale)
            .opacity(opacity)
            .onAppear {
                withAnimation(
                    .easeInOut(duration: 3.0)
                    .repeatForever(autoreverses: true)
                ) {
                    scale = 1.3
                    opacity = 0.5
                }
            }
    }
}

// MARK: - Neon Text Effect

/// Text with a neon glow effect
struct NeonText: View {
    let text: String
    let font: Font
    let color: Color
    let glowRadius: CGFloat

    init(_ text: String, font: Font = .optaH3, color: Color = Color.optaPrimary, glowRadius: CGFloat = 8) {
        self.text = text
        self.font = font
        self.color = color
        self.glowRadius = glowRadius
    }

    var body: some View {
        ZStack {
            // Glow layer
            Text(text)
                .font(font)
                .foregroundStyle(color)
                .blur(radius: glowRadius)

            // Main text
            Text(text)
                .font(font)
                .foregroundStyle(color)
        }
    }
}

// MARK: - Scanning Line Effect

/// A horizontal scanning line animation
struct ScanningLine: View {
    @State private var offset: CGFloat = -1

    var body: some View {
        GeometryReader { geometry in
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [
                            Color.clear,
                            Color.optaPrimary.opacity(0.1),
                            Color.optaPrimary.opacity(0.3),
                            Color.optaPrimary.opacity(0.1),
                            Color.clear
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(height: 2)
                .offset(y: offset * geometry.size.height)
        }
        .onAppear {
            withAnimation(
                .linear(duration: 2.0)
                .repeatForever(autoreverses: false)
            ) {
                offset = 1
            }
        }
    }
}

// MARK: - Particle Field

/// Floating particles for ambient background effect
struct ParticleField: View {
    let particleCount: Int
    let color: Color

    init(particleCount: Int = 20, color: Color = Color.optaPrimary) {
        self.particleCount = particleCount
        self.color = color
    }

    var body: some View {
        GeometryReader { geometry in
            ForEach(0..<particleCount, id: \.self) { index in
                ParticleView(
                    color: color,
                    containerSize: geometry.size,
                    index: index
                )
            }
        }
    }
}

private struct ParticleView: View {
    let color: Color
    let containerSize: CGSize
    let index: Int

    @State private var position: CGPoint = .zero
    @State private var opacity: Double = 0

    private var particleSize: CGFloat {
        CGFloat.random(in: 2...4)
    }

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: particleSize, height: particleSize)
            .blur(radius: 1)
            .position(position)
            .opacity(opacity)
            .onAppear {
                position = CGPoint(
                    x: CGFloat.random(in: 0...containerSize.width),
                    y: CGFloat.random(in: 0...containerSize.height)
                )

                let duration = Double.random(in: 3...6)
                let delay = Double(index) * 0.1

                withAnimation(
                    .easeInOut(duration: duration)
                    .repeatForever(autoreverses: true)
                    .delay(delay)
                ) {
                    opacity = Double.random(in: 0.2...0.6)
                    position = CGPoint(
                        x: position.x + CGFloat.random(in: -30...30),
                        y: position.y + CGFloat.random(in: -30...30)
                    )
                }
            }
    }
}

// MARK: - Status Indicator

/// A small status dot with optional pulsing animation
struct StatusIndicator: View {
    let status: StatusType
    let size: CGFloat
    let isPulsing: Bool

    @State private var pulseScale: CGFloat = 1.0

    enum StatusType {
        case idle
        case active
        case warning
        case critical

        var color: Color {
            switch self {
            case .idle: return Color.optaMutedForeground
            case .active: return Color.optaSuccess
            case .warning: return Color.optaWarning
            case .critical: return Color.optaDanger
            }
        }
    }

    init(status: StatusType, size: CGFloat = 8, isPulsing: Bool = false) {
        self.status = status
        self.size = size
        self.isPulsing = isPulsing
    }

    var body: some View {
        ZStack {
            // Glow/pulse layer
            if isPulsing {
                Circle()
                    .fill(status.color.opacity(0.5))
                    .frame(width: size * 2, height: size * 2)
                    .scaleEffect(pulseScale)
                    .blur(radius: 3)
            }

            // Main indicator
            Circle()
                .fill(status.color)
                .frame(width: size, height: size)
                .shadow(color: status.color.opacity(0.5), radius: 3)
        }
        .onAppear {
            if isPulsing {
                withAnimation(
                    .easeInOut(duration: 1.0)
                    .repeatForever(autoreverses: true)
                ) {
                    pulseScale = 1.5
                }
            }
        }
    }
}

// MARK: - Preview

#Preview("Visual Effects") {
    ZStack {
        Color.optaBackground
            .ignoresSafeArea()

        VStack(spacing: 24) {
            // Momentum Border
            Text("Momentum Border")
                .font(.optaSmall)
                .foregroundStyle(Color.optaMutedForeground)

            RoundedRectangle(cornerRadius: 12)
                .fill(Color.optaMuted)
                .frame(width: 200, height: 60)
                .overlay(
                    MomentumBorderView(
                        momentum: MomentumState(color: .active, rotationSpeed: 2.0),
                        cornerRadius: 12
                    )
                )

            // Pulsing Glow Border
            Text("Pulsing Glow")
                .font(.optaSmall)
                .foregroundStyle(Color.optaMutedForeground)

            RoundedRectangle(cornerRadius: 12)
                .fill(Color.optaMuted)
                .frame(width: 200, height: 60)
                .overlay(
                    PulsingGlowBorder(color: Color.optaAccent, cornerRadius: 12)
                )

            // Neon Text
            NeonText("OPTA", font: .optaH2, color: Color.optaPrimary, glowRadius: 10)

            // Status Indicators
            HStack(spacing: 16) {
                StatusIndicator(status: .idle)
                StatusIndicator(status: .active, isPulsing: true)
                StatusIndicator(status: .warning, isPulsing: true)
                StatusIndicator(status: .critical, isPulsing: true)
            }
        }
        .padding()
    }
    .frame(width: 300, height: 400)
}
