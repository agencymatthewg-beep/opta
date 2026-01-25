//
//  ParticleEffectView.swift
//  OptaNative
//
//  High-performance particle system using SwiftUI Canvas and TimelineView.
//  Replaces the planned 'wgpu' implementation with native Core Graphics/Metal.
//  Created for Opta Native macOS - Plan 99-01 (v12.0)
//

import SwiftUI

// MARK: - Models

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
}

enum ParticleEffect {
    case confetti
    case fireworks
    case snow
    case energyField
}

// MARK: - View

struct ParticleEffectView: View {
    let effect: ParticleEffect
    @State private var particles: [Particle] = []
    @State private var lastUpdate: Date = Date()
    
    // Config
    var isActive: Bool = true
    
    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                for particle in particles {
                    let rect = CGRect(
                        x: particle.position.x - (particle.size * particle.scale) / 2,
                        y: particle.position.y - (particle.size * particle.scale) / 2,
                        width: particle.size * particle.scale,
                        height: particle.size * particle.scale
                    )
                    
                    var pContext = context
                    pContext.opacity = particle.opacity
                    pContext.translateBy(x: rect.midX, y: rect.midY)
                    pContext.rotate(by: .degrees(particle.rotation))
                    pContext.translateBy(x: -rect.midX, y: -rect.midY)
                    
                    let shape = Path(ellipseIn: rect)
                    pContext.fill(shape, with: .color(particle.color))
                }
            }
            .onChange(of: timeline.date) { oldValue, newDate in
                updateParticles(currentDate: newDate, size: UIScreen.main.bounds.size) // approximate size
            }
        }
        .allowsHitTesting(false)
        .ignoresSafeArea()
    }
    
    // MARK: - Logic
    
    private func updateParticles(currentDate: Date, size: CGSize) {
        let deltaTime = currentDate.timeIntervalSince(lastUpdate)
        lastUpdate = currentDate
        
        // Remove dead particles
        particles.removeAll { particle in
            currentDate.timeIntervalSince(particle.creationDate) > particle.lifespan
        }
        
        // Update existing
        for i in particles.indices {
            // Physics
            particles[i].position.x += particles[i].velocity.dx * CGFloat(deltaTime)
            particles[i].position.y += particles[i].velocity.dy * CGFloat(deltaTime)
            particles[i].rotation += particles[i].rotationSpeed * deltaTime * 100
            
            // Gravity / Drag
            let age = currentDate.timeIntervalSince(particles[i].creationDate)
            
            switch effect {
            case .confetti:
                particles[i].velocity.dy += 200 * CGFloat(deltaTime) // Gravity
                particles[i].velocity.dx *= 0.98 // Air resistance
                particles[i].rotationSpeed *= 0.99
                
            case .fireworks:
                particles[i].velocity.dy += 150 * CGFloat(deltaTime) // Gravity
                particles[i].scale = max(0, 1.0 - CGFloat(age / particles[i].lifespan))
                
            case .snow:
                particles[i].velocity.dx += CGFloat.random(in: -10...10) * CGFloat(deltaTime) // Wind
                
            case .energyField:
                // Orbit center
                let center = CGPoint(x: 400, y: 300) // approximate
                let dx = center.x - particles[i].position.x
                let dy = center.y - particles[i].position.y
                particles[i].velocity.dx += dx * 0.5 * CGFloat(deltaTime)
                particles[i].velocity.dy += dy * 0.5 * CGFloat(deltaTime)
            }
        }
        
        // Emit new particles
        if isActive {
            emitParticles()
        }
    }
    
    private func emitParticles() {
        switch effect {
        case .confetti:
            // Burst logic would be external, this is continuous stream
            if Double.random(in: 0...1) < 0.2 { // Spawn rate
                let p = Particle(
                    position: CGPoint(x: CGFloat.random(in: 0...1000), y: -50),
                    velocity: CGVector(dx: CGFloat.random(in: -50...50), dy: CGFloat.random(in: 100...300)),
                    color: [.red, .blue, .green, .yellow, .purple, .orange].randomElement()!,
                    size: CGFloat.random(in: 6...12),
                    rotationSpeed: Double.random(in: -5...5),
                    lifespan: 5.0
                )
                particles.append(p)
            }
            
        case .fireworks:
            // This usually requires a trigger
            break
            
        case .energyField:
            if particles.count < 100 {
                let p = Particle(
                    position: CGPoint(x: 400, y: 300),
                    velocity: CGVector(dx: CGFloat.random(in: -200...200), dy: CGFloat.random(in: -200...200)),
                    color: .purple.opacity(0.6),
                    size: 4,
                    lifespan: 2.0
                )
                particles.append(p)
            }
            
        default: break
        }
    }
    
    // MARK: - Public Triggers
    
    func convertToPlatformSize(_ size: CGSize) -> CGSize {
        return size // No-op on macos currently in this context
    }
    
    /// Call this to explode confetti from a point
    func explode(at point: CGPoint) {
        for _ in 0..<50 {
            let p = Particle(
                position: point,
                velocity: CGVector(dx: CGFloat.random(in: -300...300), dy: CGFloat.random(in: -500...100)),
                color: [.red, .blue, .green, .yellow, .purple, .orange].randomElement()!,
                size: CGFloat.random(in: 6...12),
                rotationSpeed: Double.random(in: -5...5),
                lifespan: 3.0
            )
            particles.append(p)
        }
    }
}

// MARK: - Compatibility Helper

// Need to define UIScreen for macOS compatibility stub
struct UIScreen {
    static let main = Screen()
    struct Screen {
        var bounds: CGRect {
            // Hardcoded fallback for now, in real app use GeometryReader
            CGRect(x: 0, y: 0, width: 1920, height: 1080)
        }
    }
}

#Preview {
    ZStack {
        Color.black
        ParticleEffectView(effect: .confetti)
    }
}
