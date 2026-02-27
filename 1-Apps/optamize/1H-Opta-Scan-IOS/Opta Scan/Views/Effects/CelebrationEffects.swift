//
//  CelebrationEffects.swift
//  Opta Scan
//
//  Celebration and feedback animations
//  Part of Phase 14: Motion Design
//

import SwiftUI

// MARK: - Confetti Effect

/// Simple confetti burst effect
struct ConfettiBurst: View {
    let isActive: Bool
    let particleCount: Int
    let colors: [Color]

    @State private var particles: [ConfettiParticle] = []

    struct ConfettiParticle: Identifiable {
        let id = UUID()
        var x: CGFloat
        var y: CGFloat
        var rotation: Double
        var scale: CGFloat
        var color: Color
        var opacity: Double
    }

    init(isActive: Bool, particleCount: Int = 30, colors: [Color] = [.optaPurple, .optaGreen, .blue, .orange]) {
        self.isActive = isActive
        self.particleCount = particleCount
        self.colors = colors
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ForEach(particles) { particle in
                    Rectangle()
                        .fill(particle.color)
                        .frame(width: 8, height: 8)
                        .scaleEffect(particle.scale)
                        .rotationEffect(.degrees(particle.rotation))
                        .position(x: particle.x, y: particle.y)
                        .opacity(particle.opacity)
                }
            }
            .onChange(of: isActive) { _, newValue in
                if newValue {
                    burst(in: geometry.size)
                }
            }
        }
        .allowsHitTesting(false)
    }

    private func burst(in size: CGSize) {
        particles = (0..<particleCount).map { _ in
            ConfettiParticle(
                x: size.width / 2,
                y: size.height / 2,
                rotation: Double.random(in: 0...360),
                scale: CGFloat.random(in: 0.5...1.5),
                color: colors.randomElement() ?? .optaPurple,
                opacity: 1
            )
        }

        for index in particles.indices {
            let angle = Double.random(in: 0...(2 * .pi))
            let distance = CGFloat.random(in: 100...200)
            let endX = size.width / 2 + cos(angle) * distance
            let endY = size.height / 2 + sin(angle) * distance - 50

            withAnimation(.easeOut(duration: Double.random(in: 0.8...1.2))) {
                particles[index].x = endX
                particles[index].y = endY
                particles[index].rotation += Double.random(in: 180...540)
                particles[index].opacity = 0
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            particles.removeAll()
        }
    }
}

// MARK: - Shimmer Effect

/// Shimmer loading effect
struct ShimmerModifier: ViewModifier {
    let isActive: Bool
    let color: Color

    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay {
                if isActive {
                    GeometryReader { geometry in
                        LinearGradient(
                            colors: [
                                color.opacity(0),
                                color.opacity(0.3),
                                color.opacity(0)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: geometry.size.width * 2)
                        .offset(x: phase * geometry.size.width * 3 - geometry.size.width)
                    }
                    .mask(content)
                }
            }
            .onAppear {
                guard isActive else { return }
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

extension View {
    /// Apply shimmer loading effect
    func shimmer(isActive: Bool = true, color: Color = .white) -> some View {
        modifier(ShimmerModifier(isActive: isActive, color: color))
    }
}

// MARK: - Bounce Feedback

/// Bounce effect for tap feedback
struct BounceFeedbackModifier: ViewModifier {
    @State private var isPressed = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPressed ? 0.95 : 1)
            .animation(.spring(response: 0.2, dampingFraction: 0.5), value: isPressed)
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in isPressed = true }
                    .onEnded { _ in isPressed = false }
            )
    }
}

extension View {
    /// Apply bounce feedback on tap
    func bounceFeedback() -> some View {
        modifier(BounceFeedbackModifier())
    }
}

// MARK: - Pulse Effect

/// Attention-grabbing pulse effect
struct PulseEffectModifier: ViewModifier {
    let isActive: Bool
    let color: Color

    @State private var isPulsing = false

    func body(content: Content) -> some View {
        content
            .background {
                if isActive {
                    content
                        .foregroundStyle(color)
                        .scaleEffect(isPulsing ? 1.2 : 1)
                        .opacity(isPulsing ? 0 : 0.5)
                }
            }
            .onAppear {
                guard isActive else { return }
                withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: false)) {
                    isPulsing = true
                }
            }
    }
}

extension View {
    /// Apply pulse attention effect
    func pulseEffect(isActive: Bool = true, color: Color = .optaPurple) -> some View {
        modifier(PulseEffectModifier(isActive: isActive, color: color))
    }
}
