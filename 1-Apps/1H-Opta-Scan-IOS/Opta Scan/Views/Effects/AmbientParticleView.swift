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
