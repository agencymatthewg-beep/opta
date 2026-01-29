//
//  ClawdbotAnimations.swift
//  ClawdbotKit
//
//  Spring physics presets ported from Opta iOS design system.
//  CRITICAL: Never use duration-based animations. All motion uses spring physics.
//
//  Created by Matthew Byrden
//

import SwiftUI
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

// MARK: - Reduce Motion Support

/// Reduce Motion compliance utilities
///
/// All animations should respect iOS Accessibility > Motion > Reduce Motion setting.
/// Use ClawdbotMotion methods to conditionally apply animations.
public enum ClawdbotMotion {
    /// Check if reduce motion is enabled in system accessibility settings
    public static var isReduceMotionEnabled: Bool {
        #if os(iOS)
        return UIAccessibility.isReduceMotionEnabled
        #elseif os(macOS)
        return NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        #else
        return false
        #endif
    }

    /// Returns animation or nil if reduce motion is enabled
    /// Use when animation is purely decorative
    public static func animation(_ animation: Animation) -> Animation? {
        isReduceMotionEnabled ? nil : animation
    }

    /// Returns animation or instant if reduce motion is enabled
    /// Use when state change needs to happen but animation is optional
    public static func safeAnimation(_ animation: Animation) -> Animation {
        isReduceMotionEnabled ? .linear(duration: 0) : animation
    }
}

// MARK: - Conditional Animation Modifier

public extension View {
    /// Apply animation only if reduce motion is disabled
    /// Animation becomes nil when reduce motion is enabled
    func clawdbotAnimation<V: Equatable>(_ animation: Animation, value: V) -> some View {
        self.animation(ClawdbotMotion.animation(animation), value: value)
    }

    /// Apply animation with reduce motion fallback (instant transition)
    func clawdbotAnimationSafe<V: Equatable>(_ animation: Animation, value: V) -> some View {
        self.animation(ClawdbotMotion.safeAnimation(animation), value: value)
    }
}

// MARK: - Spring Animation Presets

public extension Animation {
    /// Quick, responsive interactions (buttons, toggles)
    /// response: 0.3, dampingFraction: 0.7
    static let clawdbotSpring = Animation.spring(
        response: 0.3,
        dampingFraction: 0.7,
        blendDuration: 0
    )

    /// Gentle transitions (page changes, reveals)
    /// response: 0.5, dampingFraction: 0.8
    static let clawdbotSpringGentle = Animation.spring(
        response: 0.5,
        dampingFraction: 0.8,
        blendDuration: 0
    )

    /// Large movements (sheets, full-screen transitions)
    /// response: 0.6, dampingFraction: 0.85
    static let clawdbotSpringPage = Animation.spring(
        response: 0.6,
        dampingFraction: 0.85,
        blendDuration: 0
    )

    /// Bouncy feedback (success states, celebrations)
    /// response: 0.4, dampingFraction: 0.5
    static let clawdbotSpringBounce = Animation.spring(
        response: 0.4,
        dampingFraction: 0.5,
        blendDuration: 0
    )
}

// MARK: - Staggered Animation Modifier

/// ViewModifier for staggered appearance animations
public struct ClawdbotStaggeredAppear: ViewModifier {
    public let index: Int
    public let isVisible: Bool

    public init(index: Int, isVisible: Bool) {
        self.index = index
        self.isVisible = isVisible
    }

    public func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .offset(y: isVisible ? 0 : 16)
            .animation(
                .clawdbotSpringGentle.delay(Double(index) * 0.04),
                value: isVisible
            )
    }
}

public extension View {
    /// Apply staggered appearance animation based on index
    /// - Parameters:
    ///   - index: Position in sequence for delay calculation
    ///   - isVisible: Whether the content should be visible
    func staggeredAppear(index: Int, isVisible: Bool) -> some View {
        modifier(ClawdbotStaggeredAppear(index: index, isVisible: isVisible))
    }
}

// MARK: - Physics Spring Extensions

public extension Animation {
    /// Create animation from PhysicsSpring configuration
    static func physicsSpring(_ spring: PhysicsSpring) -> Animation {
        spring.animation
    }

    /// Snappy spring for immediate feedback
    static let clawdbotSnappy = PhysicsSpring.snappy.animation

    /// Bouncy spring for playful effects
    static let clawdbotBouncy = PhysicsSpring.bouncy.animation

    /// Smooth spring with no oscillation
    static let clawdbotSmooth = PhysicsSpring.smooth.animation
}

// MARK: - Spring Gesture Modifiers

public extension View {
    /// Apply spring scale effect during press
    func springScale(isPressed: Bool, scale: CGFloat = 0.95) -> some View {
        self.scaleEffect(isPressed ? scale : 1.0)
            .animation(.clawdbotSnappy, value: isPressed)
    }

    /// Apply spring offset with optional velocity
    func springOffset(
        x: CGFloat = 0,
        y: CGFloat = 0,
        spring: PhysicsSpring = .natural
    ) -> some View {
        self.offset(x: x, y: y)
            .animation(spring.animation, value: x)
            .animation(spring.animation, value: y)
    }
}

// MARK: - Usage Examples Reference
/*
 // Button press
 Button(action: capture) {
     CaptureButton(isActive: isCapturing)
 }
 .scaleEffect(isPressed ? 0.95 : 1.0)
 .animation(.clawdbotSpring, value: isPressed)

 // Card appearance
 ResultCard(result: result)
     .opacity(isVisible ? 1 : 0)
     .offset(y: isVisible ? 0 : 20)
     .animation(.clawdbotSpringGentle.delay(Double(index) * 0.05), value: isVisible)

 // Sheet presentation
 .sheet(isPresented: $showResults) {
     ResultsView()
         .transition(.move(edge: .bottom).combined(with: .opacity))
 }
 .animation(.clawdbotSpringPage, value: showResults)

 // Physics spring examples
 .animation(.physicsSpring(.bouncy), value: someValue)
 .springScale(isPressed: isPressed)
 .springOffset(x: dragOffset, spring: .snappy)
 */
