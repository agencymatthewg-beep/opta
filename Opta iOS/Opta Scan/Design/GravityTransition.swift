//
//  GravityTransition.swift
//  Opta Scan
//
//  Gravity-based transition effects
//  Part of Phase 11: Physics Animations
//
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Gravity Direction

/// Gravity direction for transitions
enum GravityDirection {
    case down, up, left, right

    var offset: CGSize {
        switch self {
        case .down: return CGSize(width: 0, height: 1000)
        case .up: return CGSize(width: 0, height: -1000)
        case .left: return CGSize(width: -1000, height: 0)
        case .right: return CGSize(width: 1000, height: 0)
        }
    }
}

// MARK: - Gravity Drop Transition

/// Gravity drop transition
struct GravityDropTransition: ViewModifier {
    let isPresented: Bool
    let direction: GravityDirection
    let spring: PhysicsSpring

    func body(content: Content) -> some View {
        content
            .offset(isPresented ? .zero : direction.offset)
            .opacity(isPresented ? 1 : 0)
            .animation(spring.animation, value: isPresented)
    }
}

extension View {
    /// Apply gravity-based appear/disappear transition
    func gravityTransition(
        isPresented: Bool,
        direction: GravityDirection = .down,
        spring: PhysicsSpring = .bouncy
    ) -> some View {
        modifier(GravityDropTransition(
            isPresented: isPresented,
            direction: direction,
            spring: spring
        ))
    }
}

// MARK: - Settle Animation

/// Settling animation that bounces before resting
struct SettleModifier: ViewModifier {
    let isSettled: Bool
    let bounceHeight: CGFloat

    func body(content: Content) -> some View {
        content
            .offset(y: isSettled ? 0 : -bounceHeight)
            .animation(.optaBouncy, value: isSettled)
    }
}

extension View {
    /// Apply settling bounce animation
    func settleAnimation(isSettled: Bool, bounceHeight: CGFloat = 20) -> some View {
        modifier(SettleModifier(isSettled: isSettled, bounceHeight: bounceHeight))
    }
}
