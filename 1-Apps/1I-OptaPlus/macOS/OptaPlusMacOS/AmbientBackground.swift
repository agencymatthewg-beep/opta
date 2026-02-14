//
//  AmbientBackground.swift
//  OptaPlusMacOS
//
//  Cinematic Void ambient background — lives behind all chat content.
//  Renders floating gradient orbs and a subtle particle field on a pure
//  void (#050505) base. Responds to bot state (thinking/typing pulses
//  brighter) and connection state (disconnected dims everything).
//
//  Uses Canvas + TimelineView for maximum rendering performance.
//
//  Usage:
//  ```swift
//  ZStack {
//      AmbientBackground(
//          botAccentColor: .optaCoral,
//          botState: .idle,
//          isConnected: true
//      )
//      ChatContentView()
//  }
//  ```
//

import SwiftUI
import OptaMolt

// MARK: - Bot State

/// Current activity state of the active bot.
public enum BotActivityState: Sendable {
    case idle
    case thinking
    case typing
}

// MARK: - Ambient Background

/// A performant ambient background that renders behind all chat content.
///
/// Features:
/// - Pure `Color.optaVoid` base
/// - 3 floating gradient orbs using the bot's accent color (5-10% opacity, ~200px blur)
/// - ~40 particle dots (white at 3-5% opacity, slowly drifting)
/// - Bot state reactivity: thinking/typing → orbs pulse brighter
/// - Connection state: disconnected → everything dims
public struct AmbientBackground: View {
    /// The active bot's accent color for orb tinting.
    let botAccentColor: Color
    /// Current bot activity state.
    let botState: BotActivityState
    /// Whether the client is connected.
    let isConnected: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(
        botAccentColor: Color = .optaPrimary,
        botState: BotActivityState = .idle,
        isConnected: Bool = true
    ) {
        self.botAccentColor = botAccentColor
        self.botState = botState
        self.isConnected = isConnected
    }

    /// Base opacity multiplier based on connection state.
    private var globalDim: Double {
        isConnected ? 1.0 : 0.3
    }

    /// Orb brightness boost when bot is active.
    private var orbBoost: Double {
        switch botState {
        case .idle: return 1.0
        case .thinking: return 1.6
        case .typing: return 1.4
        }
    }

    public var body: some View {
        // Static ambient background — rendered once, no continuous animation.
        // Drops idle CPU from ~30% to <2%.
        staticBackground
            .opacity(globalDim)
            .animation(.easeInOut(duration: 0.5), value: isConnected)
    }

    // MARK: - Static Fallback

    @ViewBuilder
    private var staticBackground: some View {
        ZStack {
            Color.optaVoid
            // Lightweight radial gradients instead of blur() — 50x cheaper
            RadialGradient(
                colors: [botAccentColor.opacity(0.06 * globalDim), .clear],
                center: UnitPoint(x: 0.25, y: 0.3),
                startRadius: 0,
                endRadius: 300
            )
            RadialGradient(
                colors: [botAccentColor.opacity(0.04 * globalDim), .clear],
                center: UnitPoint(x: 0.75, y: 0.7),
                startRadius: 0,
                endRadius: 250
            )
        }
        .ignoresSafeArea()
        .drawingGroup() // Flatten to single GPU texture
    }

    // MARK: - Orb Rendering

    /// Orb parameters — 3 orbs with different drift patterns.
    private struct Orb {
        let xPhase: Double
        let yPhase: Double
        let xPeriod: Double
        let yPeriod: Double
        let baseOpacity: Double
        let radius: CGFloat
    }

    private let orbs: [Orb] = [
        Orb(xPhase: 0.0, yPhase: 0.3, xPeriod: 23, yPeriod: 19, baseOpacity: 0.08, radius: 220),
        Orb(xPhase: 2.1, yPhase: 1.4, xPeriod: 29, yPeriod: 31, baseOpacity: 0.06, radius: 180),
        Orb(xPhase: 4.5, yPhase: 3.7, xPeriod: 37, yPeriod: 23, baseOpacity: 0.05, radius: 200),
    ]

    private func drawOrbs(context: GraphicsContext, size: CGSize, time: Double) {
        for orb in orbs {
            let x = size.width * 0.5 + sin((time + orb.xPhase) / orb.xPeriod * .pi * 2) * size.width * 0.25
            let y = size.height * 0.5 + cos((time + orb.yPhase) / orb.yPeriod * .pi * 2) * size.height * 0.2

            // Pulse when active
            let pulseT = sin(time * 1.5) * 0.5 + 0.5
            let activeBoost = botState == .idle ? 0.0 : pulseT * 0.03
            let opacity = (orb.baseOpacity + activeBoost) * orbBoost * globalDim

            let rect = CGRect(
                x: x - orb.radius,
                y: y - orb.radius,
                width: orb.radius * 2,
                height: orb.radius * 2
            )

            var context = context
            context.opacity = opacity
            context.addFilter(.blur(radius: 200))

            let gradient = Gradient(colors: [botAccentColor, .clear])
            context.fill(
                Ellipse().path(in: rect),
                with: .radialGradient(
                    gradient,
                    center: CGPoint(x: x, y: y),
                    startRadius: 0,
                    endRadius: orb.radius
                )
            )
        }
    }

    // MARK: - Particle Rendering

    /// Seeded particle positions (deterministic from index).
    private func drawParticles(context: GraphicsContext, size: CGSize, time: Double) {
        let count = 40
        for i in 0..<count {
            let seed = Double(i)
            // Deterministic base position from seed
            let baseX = fmod(seed * 137.508, 1.0) // golden angle distribution
            let baseY = fmod(seed * 97.331, 1.0)

            // Slow drift
            let driftX = sin(time * 0.05 + seed * 0.7) * 0.02
            let driftY = cos(time * 0.04 + seed * 1.3) * 0.015

            let x = (baseX + driftX).truncatingRemainder(dividingBy: 1.0) * size.width
            let y = (baseY + driftY).truncatingRemainder(dividingBy: 1.0) * size.height

            // Varying opacity 3-5%
            let particleOpacity = (0.03 + fmod(seed * 0.47, 0.02)) * globalDim

            var context = context
            context.opacity = particleOpacity

            let dotSize: CGFloat = 1.5
            let rect = CGRect(x: x - dotSize / 2, y: y - dotSize / 2, width: dotSize, height: dotSize)
            context.fill(Circle().path(in: rect), with: .color(.white))
        }
    }
}

// MARK: - Preview

#if DEBUG
#Preview("Ambient Background — Idle") {
    AmbientBackground(botAccentColor: .optaPrimary, botState: .idle, isConnected: true)
        .frame(width: 800, height: 600)
}

#Preview("Ambient Background — Thinking") {
    AmbientBackground(botAccentColor: .optaCoral, botState: .thinking, isConnected: true)
        .frame(width: 800, height: 600)
}

#Preview("Ambient Background — Disconnected") {
    AmbientBackground(botAccentColor: .optaPrimary, botState: .idle, isConnected: false)
        .frame(width: 800, height: 600)
}
#endif
