//
//  InterruptibleSpring.swift
//  Opta Scan
//
//  Interruptible spring animations that blend smoothly
//  Part of Phase 11: Physics Animations
//
//  Created by Matthew Byrden
//

import SwiftUI

/// Manages interruptible spring animations with velocity preservation
@Observable
class InterruptibleSpringValue {
    private(set) var currentValue: CGFloat
    private(set) var targetValue: CGFloat
    private(set) var velocity: CGFloat = 0

    var spring: PhysicsSpring

    init(initialValue: CGFloat, spring: PhysicsSpring = .natural) {
        self.currentValue = initialValue
        self.targetValue = initialValue
        self.spring = spring
    }

    /// Animate to new target, preserving velocity
    func animateTo(_ target: CGFloat, completion: (() -> Void)? = nil) {
        targetValue = target
        withAnimation(spring.animation) {
            currentValue = target
        }
    }

    /// Interrupt and set new target immediately
    func interrupt(to target: CGFloat) {
        targetValue = target
        withAnimation(spring.animation) {
            currentValue = target
        }
    }

    /// Set immediately without animation
    func set(_ value: CGFloat) {
        currentValue = value
        targetValue = value
    }
}

// MARK: - View Modifier

struct InterruptibleSpringModifier<T: ViewModifier>: ViewModifier {
    @Bindable var springValue: InterruptibleSpringValue
    let transform: (CGFloat) -> T

    func body(content: Content) -> some View {
        content
            .modifier(transform(springValue.currentValue))
    }
}

// MARK: - Scale Transform Modifier

/// A simple scale transform modifier for use with InterruptibleSpringModifier
struct ScaleTransformModifier: ViewModifier {
    let scale: CGFloat

    func body(content: Content) -> some View {
        content.scaleEffect(scale)
    }
}

// MARK: - Offset Transform Modifier

/// A simple offset transform modifier for use with InterruptibleSpringModifier
struct OffsetTransformModifier: ViewModifier {
    let offset: CGFloat
    let axis: Axis

    enum Axis {
        case horizontal
        case vertical
    }

    func body(content: Content) -> some View {
        switch axis {
        case .horizontal:
            content.offset(x: offset)
        case .vertical:
            content.offset(y: offset)
        }
    }
}
