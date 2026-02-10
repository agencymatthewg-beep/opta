# Plan 12-01: Particle System

## Goal

Create a subtle ambient particle system using CAEmitterLayer for premium floating particle effects that enhance the obsidian aesthetic.

## Context

This adds ambient visual polish through:
- Subtle floating particles in backgrounds
- Processing/loading particle effects
- Success celebration particles
- Respects reduce motion accessibility

## Implementation

### Step 1: Create Particle Emitter View

Create `Opta Scan/Views/Effects/ParticleEmitterView.swift`:

```swift
//
//  ParticleEmitterView.swift
//  Opta Scan
//
//  CAEmitterLayer-based particle system for ambient effects
//  Part of Phase 12: Visual Effects
//

import SwiftUI
import UIKit

/// Configuration for particle appearance and behavior
struct ParticleConfig {
    let birthRate: Float
    let lifetime: Float
    let velocity: CGFloat
    let velocityRange: CGFloat
    let scale: CGFloat
    let scaleRange: CGFloat
    let scaleSpeed: CGFloat
    let alphaSpeed: Float
    let color: UIColor
    let emissionRange: CGFloat

    static let ambient = ParticleConfig(
        birthRate: 3,
        lifetime: 8,
        velocity: 20,
        velocityRange: 10,
        scale: 0.02,
        scaleRange: 0.01,
        scaleSpeed: -0.002,
        alphaSpeed: -0.1,
        color: UIColor(Color.optaPurple.opacity(0.3)),
        emissionRange: .pi * 2
    )

    static let processing = ParticleConfig(
        birthRate: 8,
        lifetime: 4,
        velocity: 40,
        velocityRange: 20,
        scale: 0.03,
        scaleRange: 0.02,
        scaleSpeed: -0.005,
        alphaSpeed: -0.2,
        color: UIColor(Color.optaPurple.opacity(0.5)),
        emissionRange: .pi * 2
    )

    static let celebration = ParticleConfig(
        birthRate: 50,
        lifetime: 3,
        velocity: 100,
        velocityRange: 50,
        scale: 0.05,
        scaleRange: 0.03,
        scaleSpeed: 0,
        alphaSpeed: -0.3,
        color: UIColor(Color.optaGreen.opacity(0.6)),
        emissionRange: .pi / 4
    )
}

/// UIKit view wrapping CAEmitterLayer
class ParticleEmitterUIView: UIView {
    private var emitterLayer: CAEmitterLayer?
    private var config: ParticleConfig

    init(config: ParticleConfig) {
        self.config = config
        super.init(frame: .zero)
        setupEmitter()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupEmitter() {
        let emitter = CAEmitterLayer()
        emitter.emitterShape = .point
        emitter.renderMode = .additive

        let cell = CAEmitterCell()
        cell.birthRate = config.birthRate
        cell.lifetime = config.lifetime
        cell.velocity = config.velocity
        cell.velocityRange = config.velocityRange
        cell.scale = config.scale
        cell.scaleRange = config.scaleRange
        cell.scaleSpeed = config.scaleSpeed
        cell.alphaSpeed = config.alphaSpeed
        cell.color = config.color.cgColor
        cell.emissionRange = config.emissionRange
        cell.contents = createParticleImage()

        emitter.emitterCells = [cell]
        layer.addSublayer(emitter)
        emitterLayer = emitter
    }

    private func createParticleImage() -> CGImage? {
        let size = CGSize(width: 20, height: 20)
        UIGraphicsBeginImageContextWithOptions(size, false, 0)
        guard let context = UIGraphicsGetCurrentContext() else { return nil }

        // Create soft circle gradient
        let colors = [UIColor.white.cgColor, UIColor.clear.cgColor]
        let gradient = CGGradient(
            colorsSpace: CGColorSpaceCreateDeviceRGB(),
            colors: colors as CFArray,
            locations: [0, 1]
        )!

        context.drawRadialGradient(
            gradient,
            startCenter: CGPoint(x: 10, y: 10),
            startRadius: 0,
            endCenter: CGPoint(x: 10, y: 10),
            endRadius: 10,
            options: []
        )

        let image = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()
        return image?.cgImage
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        emitterLayer?.frame = bounds
        emitterLayer?.emitterPosition = CGPoint(x: bounds.midX, y: bounds.midY)
    }

    func updateBirthRate(_ rate: Float) {
        emitterLayer?.emitterCells?.first?.birthRate = rate
    }
}

/// SwiftUI wrapper for particle emitter
struct ParticleEmitterView: UIViewRepresentable {
    let config: ParticleConfig
    let isActive: Bool

    func makeUIView(context: Context) -> ParticleEmitterUIView {
        ParticleEmitterUIView(config: config)
    }

    func updateUIView(_ uiView: ParticleEmitterUIView, context: Context) {
        uiView.updateBirthRate(isActive ? config.birthRate : 0)
    }
}
```

### Step 2: Create Particle View Modifiers

Add to ParticleEmitterView.swift:

```swift
// MARK: - View Modifiers

extension View {
    /// Add ambient floating particles in background
    func ambientParticles(_ isActive: Bool = true) -> some View {
        self.background {
            if !UIAccessibility.isReduceMotionEnabled && isActive {
                ParticleEmitterView(config: .ambient, isActive: isActive)
                    .allowsHitTesting(false)
            }
        }
    }

    /// Add processing particles while loading
    func processingParticles(_ isProcessing: Bool) -> some View {
        self.overlay {
            if !UIAccessibility.isReduceMotionEnabled && isProcessing {
                ParticleEmitterView(config: .processing, isActive: isProcessing)
                    .allowsHitTesting(false)
            }
        }
    }

    /// Burst celebration particles
    func celebrationParticles(trigger: Bool) -> some View {
        self.overlay {
            if !UIAccessibility.isReduceMotionEnabled && trigger {
                ParticleEmitterView(config: .celebration, isActive: trigger)
                    .allowsHitTesting(false)
            }
        }
    }
}
```

### Step 3: Create Configurable Particle Container

Create `Opta Scan/Views/Effects/AmbientParticleView.swift`:

```swift
//
//  AmbientParticleView.swift
//  Opta Scan
//
//  Convenient ambient particle background component
//  Part of Phase 12: Visual Effects
//

import SwiftUI

/// Animated ambient particle background
struct AmbientParticleView: View {
    let isActive: Bool
    let color: Color
    let intensity: ParticleIntensity

    enum ParticleIntensity {
        case subtle, normal, intense

        var config: ParticleConfig {
            switch self {
            case .subtle:
                return ParticleConfig(
                    birthRate: 2,
                    lifetime: 10,
                    velocity: 15,
                    velocityRange: 5,
                    scale: 0.015,
                    scaleRange: 0.01,
                    scaleSpeed: -0.001,
                    alphaSpeed: -0.08,
                    color: .white,
                    emissionRange: .pi * 2
                )
            case .normal:
                return .ambient
            case .intense:
                return ParticleConfig(
                    birthRate: 6,
                    lifetime: 6,
                    velocity: 30,
                    velocityRange: 15,
                    scale: 0.025,
                    scaleRange: 0.015,
                    scaleSpeed: -0.003,
                    alphaSpeed: -0.12,
                    color: .white,
                    emissionRange: .pi * 2
                )
            }
        }
    }

    init(
        isActive: Bool = true,
        color: Color = .optaPurple,
        intensity: ParticleIntensity = .normal
    ) {
        self.isActive = isActive
        self.color = color
        self.intensity = intensity
    }

    var body: some View {
        if !UIAccessibility.isReduceMotionEnabled {
            ParticleEmitterView(
                config: intensity.config,
                isActive: isActive
            )
            .colorMultiply(color)
        }
    }
}
```

### Step 4: Add Files to Xcode Project

Add:
- ParticleEmitterView.swift to Views/Effects group
- AmbientParticleView.swift to Views/Effects group

Create Effects folder if needed.

## Files to Create/Modify

| File | Action |
|------|--------|
| `Opta Scan/Views/Effects/ParticleEmitterView.swift` | Create |
| `Opta Scan/Views/Effects/AmbientParticleView.swift` | Create |
| `Opta Scan.xcodeproj/project.pbxproj` | Modify - add new files |

## Verification

1. Build succeeds
2. Ambient particles float subtly in background
3. Processing particles animate during loading
4. Particles respect reduce motion setting

## Dependencies

- Phase 11 complete
- CAEmitterLayer (UIKit)
