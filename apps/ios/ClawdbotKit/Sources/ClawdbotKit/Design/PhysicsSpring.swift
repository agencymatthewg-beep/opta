//
//  PhysicsSpring.swift
//  ClawdbotKit
//
//  Configurable spring physics for natural motion.
//  Ported from Opta iOS design system.
//
//  Created by Matthew Byrden
//

import SwiftUI

/// Spring physics configuration with real-world parameters
public struct PhysicsSpring {
    /// Mass affects momentum and settling time (default: 1.0)
    public let mass: Double
    /// Stiffness affects speed and responsiveness (default: 100)
    public let stiffness: Double
    /// Damping affects oscillation decay (default: 10)
    public let damping: Double

    public init(mass: Double, stiffness: Double, damping: Double) {
        self.mass = mass
        self.stiffness = stiffness
        self.damping = damping
    }

    /// Calculate response time from physics parameters
    public var response: Double {
        2 * .pi / sqrt(stiffness / mass)
    }

    /// Calculate damping fraction from physics parameters
    public var dampingFraction: Double {
        damping / (2 * sqrt(stiffness * mass))
    }

    /// Convert to SwiftUI Animation
    public var animation: Animation {
        .spring(response: response, dampingFraction: dampingFraction)
    }

    // MARK: - Presets

    /// Quick, snappy response for buttons/toggles
    public static let snappy = PhysicsSpring(mass: 1.0, stiffness: 400, damping: 25)

    /// Natural motion for cards/panels
    public static let natural = PhysicsSpring(mass: 1.0, stiffness: 200, damping: 20)

    /// Bouncy, playful motion for celebrations
    public static let bouncy = PhysicsSpring(mass: 1.0, stiffness: 300, damping: 12)

    /// Slow, gentle motion for large elements
    public static let gentle = PhysicsSpring(mass: 1.5, stiffness: 100, damping: 20)

    /// Critically damped - no oscillation
    public static let smooth = PhysicsSpring(mass: 1.0, stiffness: 200, damping: 28.28)
}

// MARK: - Spring-Driven Gesture State

/// Manages spring physics for gesture interactions
@Observable
public class SpringGestureState {
    public var offset: CGSize = .zero
    public var velocity: CGSize = .zero
    public var isActive = false

    private var spring: PhysicsSpring

    public init(spring: PhysicsSpring = .natural) {
        self.spring = spring
    }

    /// Update during gesture
    public func update(translation: CGSize, velocity: CGSize) {
        self.offset = translation
        self.velocity = velocity
        self.isActive = true
    }

    /// Release with velocity
    public func release(targetOffset: CGSize = .zero) {
        self.isActive = false
        withAnimation(spring.animation) {
            self.offset = targetOffset
        }
    }

    /// Spring animation for current state
    public var animation: Animation? {
        isActive ? nil : spring.animation
    }
}

// MARK: - View Extension

public extension View {
    /// Apply spring-driven offset from gesture state
    func springOffset(_ state: SpringGestureState) -> some View {
        self.offset(state.offset)
            .animation(state.animation, value: state.offset)
    }
}
