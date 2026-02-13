//
//  CelebrationOverlay.swift
//  OptaNative
//
//  Global overlay view for displaying celebration effects throughout the app.
//  Responds to CelebrationService events and shows particle effects.
//  Created for Opta Native macOS - Plan 99-01 (v12.0)
//

import SwiftUI

// MARK: - Celebration Overlay

struct CelebrationOverlay: View {
    @State private var celebrationService = CelebrationService.shared
    @State private var particles: [BurstParticle] = []
    @State private var lastUpdate: Date = Date()

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Particle canvas layer
                if !particles.isEmpty {
                    TimelineView(.animation(minimumInterval: reduceMotion ? 0.1 : nil)) { timeline in
                        Canvas { context, size in
                            renderParticles(context: context, size: size)
                        }
                        .onChange(of: timeline.date) { _, newDate in
                            updateParticles(currentDate: newDate)
                        }
                    }
                    .allowsHitTesting(false)
                }

                // Achievement badge overlay
                if let effect = celebrationService.activeEffect {
                    CelebrationBadge(effect: effect)
                        .position(badgePosition(in: geometry.size, for: effect))
                        .transition(.asymmetric(
                            insertion: .scale(scale: 0.5).combined(with: .opacity),
                            removal: .opacity
                        ))
                }
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .onChange(of: celebrationService.activeEffect) { oldEffect, newEffect in
            if let effect = newEffect {
                triggerBurst(for: effect)
            }
        }
    }

    // MARK: - Badge Positioning

    private func badgePosition(in size: CGSize, for effect: CelebrationEffect) -> CGPoint {
        if let pos = effect.position {
            return CGPoint(x: pos.x * size.width, y: pos.y * size.height)
        }
        // Default to top center
        return CGPoint(x: size.width / 2, y: 100)
    }

    // MARK: - Burst Trigger

    private func triggerBurst(for effect: CelebrationEffect) {
        guard !reduceMotion else { return }

        let burstCount = Int(50 * effect.intensity)
        let centerX = (effect.position?.x ?? 0.5)
        let centerY = (effect.position?.y ?? 0.3)

        // Get the view size from the geometry (approximation)
        let estimatedWidth: CGFloat = 600
        let estimatedHeight: CGFloat = 800
        let center = CGPoint(x: centerX * estimatedWidth, y: centerY * estimatedHeight)

        let palette = colorPalette(for: effect.style)

        for _ in 0..<burstCount {
            let angle = Double.random(in: 0...2 * .pi)
            let speed = CGFloat.random(in: 150...400)

            let particle = BurstParticle(
                position: center,
                velocity: CGVector(
                    dx: CGFloat(cos(angle)) * speed,
                    dy: CGFloat(sin(angle)) * speed - 80
                ),
                color: palette.randomElement() ?? .white,
                size: CGFloat.random(in: 5...12),
                rotation: Double.random(in: 0...360),
                rotationSpeed: Double.random(in: -8...8),
                creationDate: Date(),
                lifespan: effect.duration,
                shape: randomShape(for: effect.style)
            )
            particles.append(particle)
        }
    }

    private func colorPalette(for style: CelebrationEffectStyle) -> [Color] {
        switch style {
        case .confetti, .fireworks:
            return ParticleColorPalette.obsidian
        case .sparkles:
            return ParticleColorPalette.sparkle
        case .flames:
            return ParticleColorPalette.fire
        case .snow:
            return ParticleColorPalette.snow
        case .energyBurst:
            return ParticleColorPalette.energy
        }
    }

    private func randomShape(for style: CelebrationEffectStyle) -> Particle.ParticleShape {
        switch style {
        case .confetti:
            return [.square, .diamond].randomElement()!
        case .fireworks, .energyBurst:
            return .circle
        case .sparkles:
            return .star
        case .flames:
            return .circle
        case .snow:
            return .circle
        }
    }

    // MARK: - Particle Physics

    private func updateParticles(currentDate: Date) {
        let deltaTime = currentDate.timeIntervalSince(lastUpdate)
        lastUpdate = currentDate

        // Remove expired
        particles.removeAll { p in
            currentDate.timeIntervalSince(p.creationDate) > p.lifespan
        }

        // Update physics
        for i in particles.indices {
            particles[i].position.x += particles[i].velocity.dx * CGFloat(deltaTime)
            particles[i].position.y += particles[i].velocity.dy * CGFloat(deltaTime)
            particles[i].velocity.dy += 250 * CGFloat(deltaTime) // Gravity
            particles[i].velocity.dx *= 0.98
            particles[i].rotation += particles[i].rotationSpeed * deltaTime * 100

            let age = currentDate.timeIntervalSince(particles[i].creationDate)
            let lifeProgress = age / particles[i].lifespan
            particles[i].opacity = max(0, 1.0 - pow(lifeProgress, 1.5))
            particles[i].scale = max(0.2, 1.0 - CGFloat(lifeProgress * 0.4))
        }
    }

    // MARK: - Rendering

    private func renderParticles(context: GraphicsContext, size: CGSize) {
        for particle in particles {
            let actualSize = particle.size * particle.scale

            var particleContext = context
            particleContext.opacity = particle.opacity

            let center = particle.position
            particleContext.translateBy(x: center.x, y: center.y)
            particleContext.rotate(by: .degrees(particle.rotation))
            particleContext.translateBy(x: -center.x, y: -center.y)

            let rect = CGRect(
                x: particle.position.x - actualSize / 2,
                y: particle.position.y - actualSize / 2,
                width: actualSize,
                height: actualSize
            )

            switch particle.shape {
            case .circle:
                let path = Path(ellipseIn: rect)
                particleContext.fill(path, with: .color(particle.color))

            case .square:
                let path = Path(rect)
                particleContext.fill(path, with: .color(particle.color))

            case .diamond:
                var path = Path()
                path.move(to: CGPoint(x: rect.midX, y: rect.minY))
                path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
                path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
                path.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
                path.closeSubpath()
                particleContext.fill(path, with: .color(particle.color))

            case .star:
                let path = starPath(in: rect)
                particleContext.fill(path, with: .color(particle.color))
            }
        }
    }

    private func starPath(in rect: CGRect) -> Path {
        var path = Path()
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let outerRadius = rect.width / 2
        let innerRadius = outerRadius * 0.4
        let points = 5

        for i in 0..<points * 2 {
            let radius = i.isMultiple(of: 2) ? outerRadius : innerRadius
            let angle = Double(i) * .pi / Double(points) - .pi / 2
            let point = CGPoint(
                x: center.x + CGFloat(cos(angle)) * radius,
                y: center.y + CGFloat(sin(angle)) * radius
            )

            if i == 0 {
                path.move(to: point)
            } else {
                path.addLine(to: point)
            }
        }
        path.closeSubpath()
        return path
    }
}

// MARK: - Burst Particle Model

private struct BurstParticle: Identifiable {
    let id = UUID()
    var position: CGPoint
    var velocity: CGVector
    var color: Color
    var size: CGFloat
    var scale: CGFloat = 1.0
    var opacity: Double = 1.0
    var rotation: Double
    var rotationSpeed: Double
    var creationDate: Date
    var lifespan: TimeInterval
    var shape: Particle.ParticleShape
}

// MARK: - Celebration Badge

struct CelebrationBadge: View {
    let effect: CelebrationEffect

    @State private var isVisible = false
    @State private var pulseScale: CGFloat = 1.0

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: OptaSpacing.sm) {
            // Icon
            ZStack {
                // Glow background
                Circle()
                    .fill(badgeColor.opacity(0.3))
                    .frame(width: 80, height: 80)
                    .blur(radius: 20)

                // Main badge
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [badgeColor, badgeColor.opacity(0.7)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 60, height: 60)
                    .overlay(
                        Circle()
                            .strokeBorder(Color.white.opacity(0.3), lineWidth: 2)
                    )
                    .scaleEffect(pulseScale)

                Image(systemName: effect.type.icon)
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(.white)
            }

            // Title
            Text(effect.type.displayTitle)
                .font(.optaBodyMedium)
                .foregroundStyle(Color.optaTextPrimary)
                .multilineTextAlignment(.center)
        }
        .padding(OptaSpacing.lg)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.optaSurface.opacity(0.9))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(badgeColor.opacity(0.5), lineWidth: 1)
                )
        )
        .shadow(color: badgeColor.opacity(0.4), radius: 20, y: 10)
        .scaleEffect(isVisible ? 1.0 : 0.7)
        .opacity(isVisible ? 1.0 : 0)
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                isVisible = true
            }

            if !reduceMotion {
                withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) {
                    pulseScale = 1.08
                }
            }
        }
    }

    private var badgeColor: Color {
        switch effect.style {
        case .confetti, .fireworks:
            return Color.optaNeonPurple
        case .sparkles, .energyBurst:
            return Color.optaElectricBlue
        case .flames:
            return Color(red: 255/255, green: 120/255, blue: 50/255)
        case .snow:
            return Color(red: 100/255, green: 180/255, blue: 255/255)
        }
    }
}

// MARK: - View Modifier for Easy Integration

extension View {
    /// Adds celebration overlay to this view
    func celebrationOverlay() -> some View {
        ZStack {
            self
            CelebrationOverlay()
        }
    }
}

// MARK: - Preview

#Preview("Celebration Badge") {
    ZStack {
        Color.optaVoid

        CelebrationBadge(effect: CelebrationEffect(
            type: .badgeUnlock("First Blood"),
            intensity: 1.0
        ))
    }
    .frame(width: 400, height: 300)
}

#Preview("Full Overlay") {
    ZStack {
        Color.optaVoid

        VStack {
            Text("Main Content")
                .foregroundStyle(.white)

            Button("Celebrate!") {
                CelebrationService.shared.celebrate(.achievement("Test Achievement"))
            }
            .buttonStyle(.borderedProminent)
        }
    }
    .celebrationOverlay()
    .frame(width: 600, height: 400)
}
