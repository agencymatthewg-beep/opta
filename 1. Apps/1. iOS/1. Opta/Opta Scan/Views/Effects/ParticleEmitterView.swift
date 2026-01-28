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
