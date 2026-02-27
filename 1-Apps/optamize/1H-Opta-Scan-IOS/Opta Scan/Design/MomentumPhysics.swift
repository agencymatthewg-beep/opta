//
//  MomentumPhysics.swift
//  Opta Scan
//
//  Momentum and deceleration physics for natural motion
//  Part of Phase 11: Physics Animations
//
//  Created by Matthew Byrden
//

import SwiftUI

/// Momentum physics configuration
struct MomentumConfig {
    /// Deceleration rate (points/second²)
    let deceleration: CGFloat
    /// Minimum velocity to continue animating
    let minimumVelocity: CGFloat
    /// Velocity multiplier for initial throw
    let velocityMultiplier: CGFloat

    static let `default` = MomentumConfig(
        deceleration: 1000,
        minimumVelocity: 10,
        velocityMultiplier: 1.0
    )

    static let fast = MomentumConfig(
        deceleration: 800,
        minimumVelocity: 5,
        velocityMultiplier: 1.2
    )

    static let heavy = MomentumConfig(
        deceleration: 1500,
        minimumVelocity: 20,
        velocityMultiplier: 0.8
    )

    /// Calculate final position from velocity
    func projectedEndPosition(from position: CGFloat, velocity: CGFloat) -> CGFloat {
        let adjustedVelocity = velocity * velocityMultiplier
        let direction: CGFloat = adjustedVelocity >= 0 ? 1 : -1
        let distance = (adjustedVelocity * adjustedVelocity) / (2 * deceleration)
        return position + (distance * direction)
    }

    /// Calculate duration to decelerate to stop
    func decelerationDuration(from velocity: CGFloat) -> TimeInterval {
        let adjustedVelocity = abs(velocity * velocityMultiplier)
        return TimeInterval(adjustedVelocity / deceleration)
    }
}

// MARK: - Rubber Band Effect

/// Rubber band stretch at boundaries
struct RubberBandConfig {
    /// Maximum stretch distance
    let maxStretch: CGFloat
    /// Resistance factor (0-1, lower = more resistance)
    let resistance: CGFloat
    /// Spring to return to boundary
    let returnSpring: PhysicsSpring

    static let `default` = RubberBandConfig(
        maxStretch: 100,
        resistance: 0.55,
        returnSpring: .snappy
    )

    static let tight = RubberBandConfig(
        maxStretch: 50,
        resistance: 0.3,
        returnSpring: .smooth
    )

    /// Calculate stretched position with rubber band resistance
    func stretchedPosition(offset: CGFloat) -> CGFloat {
        guard offset != 0 else { return 0 }

        let sign: CGFloat = offset >= 0 ? 1 : -1
        let absOffset = abs(offset)

        // Asymptotic approach to maxStretch
        let stretched = maxStretch * (1 - exp(-absOffset * resistance / maxStretch))
        return stretched * sign
    }
}

// MARK: - View Modifier

extension View {
    /// Apply rubber band effect beyond boundaries
    func rubberBand(
        offset: CGFloat,
        config: RubberBandConfig = .default
    ) -> some View {
        let stretchedOffset = config.stretchedPosition(offset: offset)
        return self.offset(y: stretchedOffset)
    }
}

// MARK: - Scroll Bounce Modifier

/// Enhanced bounce effect for scroll boundaries
struct ScrollBounceModifier: ViewModifier {
    let bounceFactor: CGFloat
    let isEnabled: Bool

    func body(content: Content) -> some View {
        content
            .scrollBounceBehavior(isEnabled ? .always : .basedOnSize)
    }
}

extension View {
    /// Apply enhanced scroll bounce
    func enhancedScrollBounce(_ isEnabled: Bool = true) -> some View {
        modifier(ScrollBounceModifier(bounceFactor: 1.0, isEnabled: isEnabled))
    }
}
