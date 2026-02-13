//
//  PhysicsSpring.swift
//  Opta Scan
//
//  Configurable spring physics for natural motion
//  Part of Phase 11: Physics Animations
//
//  Created by Matthew Byrden
//

import SwiftUI

/// Spring physics configuration with real-world parameters
struct PhysicsSpring {
    /// Mass affects momentum and settling time (default: 1.0)
    let mass: Double
    /// Stiffness affects speed and responsiveness (default: 100)
    let stiffness: Double
    /// Damping affects oscillation decay (default: 10)
    let damping: Double

    /// Calculate response time from physics parameters
    var response: Double {
        2 * .pi / sqrt(stiffness / mass)
    }

    /// Calculate damping fraction from physics parameters
    var dampingFraction: Double {
        damping / (2 * sqrt(stiffness * mass))
    }

    /// Convert to SwiftUI Animation
    var animation: Animation {
        .spring(response: response, dampingFraction: dampingFraction)
    }

    // MARK: - Presets

    /// Quick, snappy response for buttons/toggles
    static let snappy = PhysicsSpring(mass: 1.0, stiffness: 400, damping: 25)

    /// Natural motion for cards/panels
    static let natural = PhysicsSpring(mass: 1.0, stiffness: 200, damping: 20)

    /// Bouncy, playful motion for celebrations
    static let bouncy = PhysicsSpring(mass: 1.0, stiffness: 300, damping: 12)

    /// Slow, gentle motion for large elements
    static let gentle = PhysicsSpring(mass: 1.5, stiffness: 100, damping: 20)

    /// Critically damped - no oscillation
    static let smooth = PhysicsSpring(mass: 1.0, stiffness: 200, damping: 28.28)
}

// MARK: - Spring-Driven Gesture State

/// Manages spring physics for gesture interactions
@Observable
class SpringGestureState {
    var offset: CGSize = .zero
    var velocity: CGSize = .zero
    var isActive = false

    private var spring: PhysicsSpring

    init(spring: PhysicsSpring = .natural) {
        self.spring = spring
    }

    /// Update during gesture
    func update(translation: CGSize, velocity: CGSize) {
        self.offset = translation
        self.velocity = velocity
        self.isActive = true
    }

    /// Release with velocity
    func release(targetOffset: CGSize = .zero) {
        self.isActive = false
        withAnimation(spring.animation) {
            self.offset = targetOffset
        }
    }

    /// Spring animation for current state
    var animation: Animation? {
        isActive ? nil : spring.animation
    }
}

// MARK: - View Extension

extension View {
    /// Apply spring-driven offset from gesture state
    func springOffset(_ state: SpringGestureState) -> some View {
        self.offset(state.offset)
            .animation(state.animation, value: state.offset)
    }
}
