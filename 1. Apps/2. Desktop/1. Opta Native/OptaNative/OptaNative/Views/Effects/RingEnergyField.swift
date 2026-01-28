//
//  RingEnergyField.swift
//  OptaNative
//
//  Energy field particle effect that orbits around the Opta Ring.
//  Responds to optimization activity and system state.
//  Created for Opta Native macOS - Plan 99-01 (v12.0)
//

import SwiftUI

// MARK: - Ring Energy Field View

struct RingEnergyField: View {
    /// The center point of the ring (relative coordinates 0-1)
    let ringCenter: CGPoint

    /// Ring radius in points
    let ringRadius: CGFloat

    /// Activity level (0-1) affects particle count and speed
    var activityLevel: Double = 0.5

    /// Whether the effect is enabled
    var isActive: Bool = true

    /// Color theme based on optimization state
    var colorTheme: EnergyFieldTheme = .neutral

    // MARK: - State

    @State private var particles: [EnergyParticle] = []
    @State private var lastUpdate: Date = Date()
    @State private var viewSize: CGSize = .zero
    @State private var pulsePhase: Double = 0

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // MARK: - Constants

    private var maxParticles: Int {
        reduceMotion ? 15 : Int(30 + 50 * activityLevel)
    }

    private var orbitSpeed: Double {
        0.3 + activityLevel * 0.4
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Pulsing glow behind particles
                if isActive && !reduceMotion {
                    pulsingGlow(in: geometry.size)
                }

                // Particle layer
                TimelineView(.animation(minimumInterval: reduceMotion ? 0.1 : nil)) { timeline in
                    Canvas { context, size in
                        renderParticles(context: context, size: size)
                    }
                    .onChange(of: timeline.date) { _, newDate in
                        updateParticles(currentDate: newDate, size: geometry.size)
                    }
                }
            }
            .onAppear {
                viewSize = geometry.size
            }
            .onChange(of: geometry.size) { _, newSize in
                viewSize = newSize
            }
        }
        .allowsHitTesting(false)
    }

    // MARK: - Pulsing Glow

    private func pulsingGlow(in size: CGSize) -> some View {
        let center = absoluteCenter(in: size)
        let glowRadius = ringRadius * 1.2

        return Circle()
            .fill(
                RadialGradient(
                    colors: [
                        colorTheme.primaryColor.opacity(0.2 + pulsePhase * 0.1),
                        colorTheme.primaryColor.opacity(0.05),
                        Color.clear
                    ],
                    center: .center,
                    startRadius: ringRadius * 0.5,
                    endRadius: glowRadius * 1.5
                )
            )
            .frame(width: glowRadius * 2, height: glowRadius * 2)
            .position(center)
            .onAppear {
                withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
                    pulsePhase = 1.0
                }
            }
    }

    // MARK: - Coordinate Helpers

    private func absoluteCenter(in size: CGSize) -> CGPoint {
        CGPoint(
            x: ringCenter.x * size.width,
            y: ringCenter.y * size.height
        )
    }

    // MARK: - Particle Physics

    private func updateParticles(currentDate: Date, size: CGSize) {
        guard isActive else {
            particles.removeAll()
            return
        }

        let deltaTime = currentDate.timeIntervalSince(lastUpdate)
        lastUpdate = currentDate

        if reduceMotion && deltaTime < 0.08 { return }

        let center = absoluteCenter(in: size)

        // Remove expired particles
        particles.removeAll { p in
            currentDate.timeIntervalSince(p.creationDate) > p.lifespan
        }

        // Update existing particles
        for i in particles.indices {
            // Orbital motion
            particles[i].angle += particles[i].angularVelocity * deltaTime * orbitSpeed

            // Update position based on angle and orbit radius
            let radius = ringRadius + particles[i].orbitOffset
            particles[i].position = CGPoint(
                x: center.x + cos(particles[i].angle) * radius,
                y: center.y + sin(particles[i].angle) * radius
            )

            // Slight radial oscillation
            let oscillation = sin(currentDate.timeIntervalSinceReferenceDate * 2 + particles[i].phaseOffset) * 5
            particles[i].position.x += CGFloat(cos(particles[i].angle)) * oscillation
            particles[i].position.y += CGFloat(sin(particles[i].angle)) * oscillation

            // Age-based fade
            let age = currentDate.timeIntervalSince(particles[i].creationDate)
            let lifeProgress = age / particles[i].lifespan

            // Fade in at start, fade out at end
            if lifeProgress < 0.2 {
                particles[i].opacity = lifeProgress / 0.2
            } else if lifeProgress > 0.8 {
                particles[i].opacity = (1.0 - lifeProgress) / 0.2
            } else {
                particles[i].opacity = 1.0
            }

            // Pulse size
            particles[i].scale = 1.0 + 0.2 * CGFloat(sin(age * 3 + particles[i].phaseOffset))
        }

        // Emit new particles
        if particles.count < maxParticles {
            emitParticle(center: center)
        }
    }

    private func emitParticle(center: CGPoint) {
        let angle = Double.random(in: 0...2 * .pi)
        let orbitOffset = CGFloat.random(in: -15...25)
        let radius = ringRadius + orbitOffset

        let particle = EnergyParticle(
            position: CGPoint(
                x: center.x + CGFloat(cos(angle)) * radius,
                y: center.y + CGFloat(sin(angle)) * radius
            ),
            angle: angle,
            angularVelocity: Double.random(in: 0.5...1.5) * (Bool.random() ? 1 : -1),
            orbitOffset: orbitOffset,
            color: colorTheme.particleColors.randomElement() ?? colorTheme.primaryColor,
            size: CGFloat.random(in: 2...5),
            creationDate: Date(),
            lifespan: Double.random(in: 3...6),
            phaseOffset: Double.random(in: 0...2 * .pi)
        )
        particles.append(particle)
    }

    // MARK: - Rendering

    private func renderParticles(context: GraphicsContext, size: CGSize) {
        for particle in particles {
            let actualSize = particle.size * particle.scale

            var particleContext = context
            particleContext.opacity = particle.opacity

            // Draw with soft glow
            let rect = CGRect(
                x: particle.position.x - actualSize / 2,
                y: particle.position.y - actualSize / 2,
                width: actualSize,
                height: actualSize
            )

            // Glow
            let glowRect = rect.insetBy(dx: -actualSize * 0.5, dy: -actualSize * 0.5)
            particleContext.fill(
                Path(ellipseIn: glowRect),
                with: .color(particle.color.opacity(0.3))
            )

            // Core
            particleContext.fill(
                Path(ellipseIn: rect),
                with: .color(particle.color)
            )
        }
    }
}

// MARK: - Energy Particle Model

private struct EnergyParticle: Identifiable {
    let id = UUID()
    var position: CGPoint
    var angle: Double
    var angularVelocity: Double
    var orbitOffset: CGFloat
    var color: Color
    var size: CGFloat
    var scale: CGFloat = 1.0
    var opacity: Double = 0.0
    var creationDate: Date
    var lifespan: TimeInterval
    var phaseOffset: Double
}

// MARK: - Energy Field Theme

enum EnergyFieldTheme {
    case neutral
    case optimizing
    case success
    case warning
    case gaming

    var primaryColor: Color {
        switch self {
        case .neutral:
            return Color.optaNeonPurple
        case .optimizing:
            return Color.optaElectricBlue
        case .success:
            return Color.optaSuccess
        case .warning:
            return Color.optaWarning
        case .gaming:
            return Color(red: 255/255, green: 100/255, blue: 150/255)
        }
    }

    var particleColors: [Color] {
        switch self {
        case .neutral:
            return [
                Color.optaNeonPurple.opacity(0.9),
                Color.optaElectricBlue.opacity(0.7),
                Color.white.opacity(0.5)
            ]
        case .optimizing:
            return [
                Color.optaElectricBlue.opacity(0.9),
                Color.optaNeonPurple.opacity(0.6),
                Color(red: 100/255, green: 200/255, blue: 255/255).opacity(0.8)
            ]
        case .success:
            return [
                Color.optaSuccess.opacity(0.9),
                Color(red: 150/255, green: 255/255, blue: 150/255).opacity(0.7),
                Color.white.opacity(0.5)
            ]
        case .warning:
            return [
                Color.optaWarning.opacity(0.9),
                Color(red: 255/255, green: 200/255, blue: 100/255).opacity(0.7),
                Color.white.opacity(0.4)
            ]
        case .gaming:
            return [
                Color(red: 255/255, green: 100/255, blue: 150/255).opacity(0.9),
                Color.optaNeonPurple.opacity(0.7),
                Color(red: 255/255, green: 150/255, blue: 200/255).opacity(0.6)
            ]
        }
    }
}

// MARK: - Ring Energy Field Modifier

extension View {
    /// Adds energy field particles around a ring
    func ringEnergyField(
        center: CGPoint,
        radius: CGFloat,
        activityLevel: Double = 0.5,
        theme: EnergyFieldTheme = .neutral,
        isActive: Bool = true
    ) -> some View {
        ZStack {
            self
            RingEnergyField(
                ringCenter: center,
                ringRadius: radius,
                activityLevel: activityLevel,
                isActive: isActive,
                colorTheme: theme
            )
        }
    }
}

// MARK: - Preview

#Preview("Neutral Energy Field") {
    ZStack {
        Color.optaVoid

        // Simulated ring
        Circle()
            .strokeBorder(Color.optaNeonPurple, lineWidth: 8)
            .frame(width: 200, height: 200)

        RingEnergyField(
            ringCenter: CGPoint(x: 0.5, y: 0.5),
            ringRadius: 100,
            activityLevel: 0.7,
            isActive: true,
            colorTheme: .neutral
        )
    }
    .frame(width: 400, height: 400)
}

#Preview("Gaming Energy Field") {
    ZStack {
        Color.optaVoid

        Circle()
            .strokeBorder(
                LinearGradient(
                    colors: [Color.optaNeonPurple, Color(red: 255/255, green: 100/255, blue: 150/255)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                lineWidth: 8
            )
            .frame(width: 200, height: 200)

        RingEnergyField(
            ringCenter: CGPoint(x: 0.5, y: 0.5),
            ringRadius: 100,
            activityLevel: 1.0,
            isActive: true,
            colorTheme: .gaming
        )
    }
    .frame(width: 400, height: 400)
}
