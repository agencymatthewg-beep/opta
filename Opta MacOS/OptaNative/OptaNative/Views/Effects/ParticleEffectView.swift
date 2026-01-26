//
//  ParticleEffectView.swift
//  OptaNative
//
//  High-performance particle system using SwiftUI Canvas and TimelineView.
//  Enhanced with proper macOS support, GeometryReader, reduced motion,
//  and Obsidian color palette integration.
//  Created for Opta Native macOS - Plan 99-01 (v12.0)
//

import SwiftUI

// MARK: - Particle Model

struct Particle: Identifiable {
    let id = UUID()
    var position: CGPoint
    var velocity: CGVector
    var color: Color
    var size: CGFloat
    var scale: CGFloat = 1.0
    var opacity: Double = 1.0
    var rotation: Double = 0
    var rotationSpeed: Double = 0
    var creationDate: Date = Date()
    var lifespan: TimeInterval
    var shape: ParticleShape = .circle

    enum ParticleShape {
        case circle
        case square
        case star
        case diamond
    }
}

// MARK: - Particle Effect Type

enum ParticleEffect: Equatable {
    case confetti
    case fireworks
    case sparkles
    case snow
    case energyField(center: CGPoint)
    case flames
    case burst(origin: CGPoint, count: Int)

    static func == (lhs: ParticleEffect, rhs: ParticleEffect) -> Bool {
        switch (lhs, rhs) {
        case (.confetti, .confetti),
             (.fireworks, .fireworks),
             (.sparkles, .sparkles),
             (.snow, .snow),
             (.flames, .flames):
            return true
        case (.energyField(let c1), .energyField(let c2)):
            return c1 == c2
        case (.burst(let o1, let n1), .burst(let o2, let n2)):
            return o1 == o2 && n1 == n2
        default:
            return false
        }
    }
}

// MARK: - Obsidian Color Palettes

struct ParticleColorPalette {
    /// Obsidian-themed celebration colors
    static let obsidian: [Color] = [
        Color.optaNeonPurple,
        Color.optaElectricBlue,
        Color(red: 168/255, green: 85/255, blue: 247/255),   // Light violet
        Color(red: 124/255, green: 58/255, blue: 237/255),   // Medium violet
        Color.white.opacity(0.9)
    ]

    /// Fire colors for flames/streaks
    static let fire: [Color] = [
        Color(red: 255/255, green: 100/255, blue: 50/255),   // Orange-red
        Color(red: 255/255, green: 180/255, blue: 50/255),   // Golden
        Color(red: 255/255, green: 220/255, blue: 100/255),  // Yellow
        Color(red: 255/255, green: 80/255, blue: 80/255)     // Red
    ]

    /// Subtle sparkle colors
    static let sparkle: [Color] = [
        Color.white.opacity(0.9),
        Color.optaNeonPurple.opacity(0.8),
        Color.optaElectricBlue.opacity(0.8),
        Color(red: 200/255, green: 200/255, blue: 255/255).opacity(0.7)
    ]

    /// Snow/ice colors
    static let snow: [Color] = [
        Color.white.opacity(0.9),
        Color.white.opacity(0.7),
        Color(red: 200/255, green: 220/255, blue: 255/255).opacity(0.8),
        Color.optaElectricBlue.opacity(0.3)
    ]

    /// Energy field colors
    static let energy: [Color] = [
        Color.optaNeonPurple.opacity(0.7),
        Color.optaElectricBlue.opacity(0.6),
        Color(red: 150/255, green: 100/255, blue: 255/255).opacity(0.5)
    ]
}

// MARK: - Particle Effect View

struct ParticleEffectView: View {
    let effect: ParticleEffect

    /// Whether effect is actively emitting new particles
    var isActive: Bool = true

    /// Maximum particle count for performance
    var maxParticles: Int = 150

    /// Intensity multiplier (affects particle count and spread)
    var intensity: Double = 1.0

    // MARK: - State

    @State private var particles: [Particle] = []
    @State private var lastUpdate: Date = Date()
    @State private var viewSize: CGSize = .zero

    // MARK: - Environment

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geometry in
            TimelineView(.animation(minimumInterval: reduceMotion ? 0.1 : nil)) { timeline in
                Canvas { context, size in
                    renderParticles(context: context, size: size)
                }
                .onChange(of: timeline.date) { _, newDate in
                    updateParticles(currentDate: newDate, size: geometry.size)
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
        .ignoresSafeArea()
    }

    // MARK: - Rendering

    private func renderParticles(context: GraphicsContext, size: CGSize) {
        for particle in particles {
            let actualSize = particle.size * particle.scale

            var particleContext = context
            particleContext.opacity = particle.opacity

            // Apply rotation
            let center = particle.position
            particleContext.translateBy(x: center.x, y: center.y)
            particleContext.rotate(by: .degrees(particle.rotation))
            particleContext.translateBy(x: -center.x, y: -center.y)

            // Draw based on shape
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

    // MARK: - Physics Update

    private func updateParticles(currentDate: Date, size: CGSize) {
        let deltaTime = currentDate.timeIntervalSince(lastUpdate)
        lastUpdate = currentDate

        // Skip if reduced motion and interval too short
        if reduceMotion && deltaTime < 0.08 { return }

        // Remove expired particles
        particles.removeAll { particle in
            currentDate.timeIntervalSince(particle.creationDate) > particle.lifespan
        }

        // Update existing particles
        for i in particles.indices {
            updateSingleParticle(at: i, deltaTime: deltaTime, currentDate: currentDate, size: size)
        }

        // Emit new particles
        if isActive && particles.count < maxParticles {
            emitParticles(size: size)
        }
    }

    private func updateSingleParticle(at index: Int, deltaTime: TimeInterval, currentDate: Date, size: CGSize) {
        // Physics
        particles[index].position.x += particles[index].velocity.dx * CGFloat(deltaTime)
        particles[index].position.y += particles[index].velocity.dy * CGFloat(deltaTime)
        particles[index].rotation += particles[index].rotationSpeed * deltaTime * 100

        // Age-based effects
        let age = currentDate.timeIntervalSince(particles[index].creationDate)
        let lifeProgress = age / particles[index].lifespan

        switch effect {
        case .confetti:
            particles[index].velocity.dy += 200 * CGFloat(deltaTime) // Gravity
            particles[index].velocity.dx *= 0.98 // Air resistance
            particles[index].rotationSpeed *= 0.99
            particles[index].opacity = max(0, 1.0 - pow(lifeProgress, 2))

        case .fireworks:
            particles[index].velocity.dy += 150 * CGFloat(deltaTime)
            particles[index].scale = max(0.1, 1.0 - CGFloat(lifeProgress))
            particles[index].opacity = max(0, 1.0 - lifeProgress)

        case .sparkles:
            // Gentle float and fade
            particles[index].velocity.dy -= 20 * CGFloat(deltaTime) // Float up
            particles[index].scale = 1.0 + 0.3 * CGFloat(sin(age * 5)) // Pulse
            particles[index].opacity = max(0, 1.0 - pow(lifeProgress, 1.5))

        case .snow:
            particles[index].velocity.dx += CGFloat.random(in: -15...15) * CGFloat(deltaTime)
            particles[index].velocity.dy = min(particles[index].velocity.dy + 10 * CGFloat(deltaTime), 100)
            particles[index].rotation += 30 * deltaTime

        case .energyField(let center):
            let dx = center.x - particles[index].position.x
            let dy = center.y - particles[index].position.y
            particles[index].velocity.dx += dx * 0.5 * CGFloat(deltaTime)
            particles[index].velocity.dy += dy * 0.5 * CGFloat(deltaTime)
            // Speed limiting for orbit
            let speed = sqrt(pow(particles[index].velocity.dx, 2) + pow(particles[index].velocity.dy, 2))
            if speed > 150 {
                particles[index].velocity.dx *= 150 / speed
                particles[index].velocity.dy *= 150 / speed
            }

        case .flames:
            particles[index].velocity.dy -= 100 * CGFloat(deltaTime) // Rise
            particles[index].velocity.dx += CGFloat.random(in: -20...20) * CGFloat(deltaTime)
            particles[index].scale = max(0.1, 1.0 - CGFloat(lifeProgress * 0.8))
            particles[index].opacity = max(0, 1.0 - pow(lifeProgress, 1.2))

        case .burst:
            particles[index].velocity.dy += 300 * CGFloat(deltaTime) // Gravity
            particles[index].velocity.dx *= 0.97
            particles[index].velocity.dy *= 0.97
            particles[index].opacity = max(0, 1.0 - pow(lifeProgress, 1.5))
            particles[index].scale = max(0.2, 1.0 - CGFloat(lifeProgress * 0.5))
        }
    }

    // MARK: - Emission

    private func emitParticles(size: CGSize) {
        let spawnRate = reduceMotion ? 0.05 : 0.15 * intensity

        switch effect {
        case .confetti:
            if Double.random(in: 0...1) < spawnRate {
                let p = Particle(
                    position: CGPoint(x: CGFloat.random(in: 0...size.width), y: -20),
                    velocity: CGVector(
                        dx: CGFloat.random(in: -50...50) * CGFloat(intensity),
                        dy: CGFloat.random(in: 100...300) * CGFloat(intensity)
                    ),
                    color: ParticleColorPalette.obsidian.randomElement()!,
                    size: CGFloat.random(in: 6...12),
                    rotationSpeed: Double.random(in: -5...5),
                    lifespan: 4.0,
                    shape: [.square, .diamond].randomElement()!
                )
                particles.append(p)
            }

        case .fireworks:
            // Fireworks typically need a burst trigger, not continuous
            break

        case .sparkles:
            if Double.random(in: 0...1) < spawnRate * 0.5 {
                let p = Particle(
                    position: CGPoint(
                        x: CGFloat.random(in: 0...size.width),
                        y: CGFloat.random(in: size.height * 0.3...size.height)
                    ),
                    velocity: CGVector(
                        dx: CGFloat.random(in: -10...10),
                        dy: CGFloat.random(in: -30 ... -10)
                    ),
                    color: ParticleColorPalette.sparkle.randomElement()!,
                    size: CGFloat.random(in: 2...6),
                    lifespan: 3.0,
                    shape: .star
                )
                particles.append(p)
            }

        case .snow:
            if Double.random(in: 0...1) < spawnRate {
                let p = Particle(
                    position: CGPoint(x: CGFloat.random(in: 0...size.width), y: -10),
                    velocity: CGVector(
                        dx: CGFloat.random(in: -20...20),
                        dy: CGFloat.random(in: 30...80)
                    ),
                    color: ParticleColorPalette.snow.randomElement()!,
                    size: CGFloat.random(in: 3...8),
                    rotationSpeed: Double.random(in: -2...2),
                    lifespan: 8.0,
                    shape: .circle
                )
                particles.append(p)
            }

        case .energyField(let center):
            if particles.count < Int(80 * intensity) {
                let angle = Double.random(in: 0...2 * .pi)
                let radius = CGFloat.random(in: 30...60)
                let p = Particle(
                    position: CGPoint(
                        x: center.x + CGFloat(cos(angle)) * radius,
                        y: center.y + CGFloat(sin(angle)) * radius
                    ),
                    velocity: CGVector(
                        dx: CGFloat.random(in: -100...100),
                        dy: CGFloat.random(in: -100...100)
                    ),
                    color: ParticleColorPalette.energy.randomElement()!,
                    size: CGFloat.random(in: 3...6),
                    lifespan: 2.5,
                    shape: .circle
                )
                particles.append(p)
            }

        case .flames:
            if Double.random(in: 0...1) < spawnRate {
                let p = Particle(
                    position: CGPoint(
                        x: size.width / 2 + CGFloat.random(in: -30...30),
                        y: size.height
                    ),
                    velocity: CGVector(
                        dx: CGFloat.random(in: -30...30),
                        dy: CGFloat.random(in: -150 ... -80)
                    ),
                    color: ParticleColorPalette.fire.randomElement()!,
                    size: CGFloat.random(in: 4...10),
                    lifespan: 1.5,
                    shape: .circle
                )
                particles.append(p)
            }

        case .burst:
            // Burst is one-time, handled by burst() method
            break
        }
    }

    // MARK: - Public Burst Trigger

    /// Trigger a burst of particles from a specific point
    mutating func burst(at point: CGPoint, count: Int = 50) {
        let actualCount = reduceMotion ? count / 3 : count

        for _ in 0..<actualCount {
            let angle = Double.random(in: 0...2 * .pi)
            let speed = CGFloat.random(in: 150...400)

            let p = Particle(
                position: point,
                velocity: CGVector(
                    dx: cos(angle) * speed,
                    dy: sin(angle) * speed - 100 // Slight upward bias
                ),
                color: ParticleColorPalette.obsidian.randomElement()!,
                size: CGFloat.random(in: 5...12),
                rotationSpeed: Double.random(in: -8...8),
                lifespan: 2.5,
                shape: [.square, .diamond, .star].randomElement()!
            )
            particles.append(p)
        }
    }
}

// MARK: - Particle Manager (for external triggering)

@Observable
@MainActor
final class ParticleManager {
    static let shared = ParticleManager()

    var pendingBurst: (point: CGPoint, count: Int)?
    var activeEffect: ParticleEffect?

    private init() {}

    func triggerBurst(at point: CGPoint, count: Int = 50) {
        pendingBurst = (point, count)
    }

    func setEffect(_ effect: ParticleEffect?) {
        activeEffect = effect
    }

    func clearBurst() {
        pendingBurst = nil
    }
}

// MARK: - Preview

#Preview("Confetti") {
    ZStack {
        Color.optaVoid
        ParticleEffectView(effect: .confetti, isActive: true, intensity: 1.2)
    }
}

#Preview("Energy Field") {
    ZStack {
        Color.optaVoid
        ParticleEffectView(effect: .energyField(center: CGPoint(x: 200, y: 200)), isActive: true)
    }
}

#Preview("Sparkles") {
    ZStack {
        Color.optaVoid
        ParticleEffectView(effect: .sparkles, isActive: true)
    }
}
