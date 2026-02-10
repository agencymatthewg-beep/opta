//
//  ViewModifiers.swift
//  OptaMolt
//
//  Opta design system view modifiers — glassmorphism effects and ignition
//  entrance animations. Provides the signature Obsidian Glassmorphism look.
//
//  Usage:
//  ```swift
//  VStack { ... }
//      .glassSubtle()
//
//  MessageBubble(message: msg)
//      .staggeredIgnition(index: 3, isVisible: true)
//  ```
//

import SwiftUI

// MARK: - Glassmorphism Modifiers

/// Subtle glassmorphism — thin material with a faint border and rounded corners.
///
/// Use on secondary containers such as table headers, chart panels, and
/// card surfaces that sit above `.optaBackground`.
public struct GlassSubtleModifier: ViewModifier {
    public func body(content: Content) -> some View {
        content
            .background {
                #if os(iOS)
                RoundedRectangle(cornerRadius: 12)
                    .fill(.ultraThinMaterial)
                #elseif os(macOS)
                RoundedRectangle(cornerRadius: 12)
                    .fill(.ultraThinMaterial)
                #endif
            }
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.optaBorder.opacity(0.25), lineWidth: 0.5)
            )
    }
}

/// Standard glassmorphism — regular material with moderate border.
///
/// Use on primary containers like message bubbles, dialogs, and modal panels.
public struct GlassModifier: ViewModifier {
    public func body(content: Content) -> some View {
        content
            .background {
                #if os(iOS)
                RoundedRectangle(cornerRadius: 16)
                    .fill(.thinMaterial)
                #elseif os(macOS)
                RoundedRectangle(cornerRadius: 16)
                    .fill(.thinMaterial)
                #endif
            }
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.optaBorder.opacity(0.4), lineWidth: 1)
            )
    }
}

/// Strong glassmorphism — thicker material with prominent border and shadow.
///
/// Use sparingly on hero elements, popovers, and elements that need maximum
/// depth separation from the background.
public struct GlassStrongModifier: ViewModifier {
    public func body(content: Content) -> some View {
        content
            .background {
                #if os(iOS)
                RoundedRectangle(cornerRadius: 20)
                    .fill(.regularMaterial)
                #elseif os(macOS)
                RoundedRectangle(cornerRadius: 20)
                    .fill(.regularMaterial)
                #endif
            }
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.optaBorder.opacity(0.6), lineWidth: 1.5)
            )
            .shadow(color: .black.opacity(0.25), radius: 16, y: 8)
    }
}

// MARK: - Glass View Extension

public extension View {

    /// Apply subtle glassmorphism (thin material, faint border, 12pt corners).
    func glassSubtle() -> some View {
        modifier(GlassSubtleModifier())
    }

    /// Apply standard glassmorphism (thin material, moderate border, 16pt corners).
    func glass() -> some View {
        modifier(GlassModifier())
    }

    /// Apply strong glassmorphism (regular material, prominent border + shadow, 20pt corners).
    func glassStrong() -> some View {
        modifier(GlassStrongModifier())
    }
}

// MARK: - Ignition Entrance Animation

/// A wake-from-darkness entrance modifier.
///
/// Elements start fully transparent and translated downward, then spring into
/// position. Respects the system Reduce Motion accessibility setting.
///
/// Parameters:
/// - `delay`: Seconds before the animation starts (default 0).
///
/// Usage:
/// ```swift
/// view.ignition()
/// view.ignition(delay: 0.15)
/// ```
public struct IgnitionModifier: ViewModifier {
    /// Delay before the entrance animation starts.
    let delay: Double

    /// Whether the element has finished animating in.
    @State private var isVisible: Bool = false

    /// Accessibility: skip animation if Reduce Motion is enabled.
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(delay: Double = 0) {
        self.delay = delay
    }

    public func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .offset(y: isVisible ? 0 : 12)
            .onAppear {
                if reduceMotion {
                    isVisible = true
                } else {
                    withAnimation(.optaSpring.delay(delay)) {
                        isVisible = true
                    }
                }
            }
    }
}

/// A staggered version of the ignition modifier for use in lists.
///
/// Each item receives a progressively longer delay based on its index,
/// creating a cascading entrance effect.
///
/// Parameters:
/// - `index`: The item's position in the list (0-based).
/// - `isVisible`: External visibility flag (e.g. from a parent `onAppear`).
/// - `staggerInterval`: Seconds between each item's entrance (default 0.05).
///
/// Usage:
/// ```swift
/// ForEach(items.indices, id: \.self) { i in
///     ItemView(items[i])
///         .staggeredIgnition(index: i, isVisible: true)
/// }
/// ```
public struct StaggeredIgnitionModifier: ViewModifier {
    /// The item's position in the list.
    let index: Int
    /// External visibility trigger.
    let isVisible: Bool
    /// Seconds between each successive item's entrance.
    let staggerInterval: Double

    /// Internal animated state.
    @State private var appeared: Bool = false

    /// Accessibility: skip animation if Reduce Motion is enabled.
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(index: Int, isVisible: Bool, staggerInterval: Double = 0.05) {
        self.index = index
        self.isVisible = isVisible
        self.staggerInterval = staggerInterval
    }

    public func body(content: Content) -> some View {
        content
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 16)
            .onChange(of: isVisible) { _, visible in
                guard visible else { return }
                let delay = Double(index) * staggerInterval
                if reduceMotion {
                    appeared = true
                } else {
                    withAnimation(.optaSpring.delay(delay)) {
                        appeared = true
                    }
                }
            }
            .onAppear {
                guard isVisible else { return }
                let delay = Double(index) * staggerInterval
                if reduceMotion {
                    appeared = true
                } else {
                    withAnimation(.optaSpring.delay(delay)) {
                        appeared = true
                    }
                }
            }
    }
}

// MARK: - Ignition View Extension

public extension View {

    /// Apply the ignition entrance animation (fade + slide up with spring).
    ///
    /// - Parameter delay: Seconds before the animation starts (default 0).
    /// - Returns: Modified view with entrance animation.
    func ignition(delay: Double = 0) -> some View {
        modifier(IgnitionModifier(delay: delay))
    }

    /// Apply staggered ignition for list items (cascading entrance).
    ///
    /// - Parameters:
    ///   - index: The item's position in the list (0-based).
    ///   - isVisible: External visibility flag triggering the animation.
    ///   - staggerInterval: Seconds between each item's entrance (default 0.05).
    /// - Returns: Modified view with staggered entrance animation.
    func staggeredIgnition(
        index: Int,
        isVisible: Bool,
        staggerInterval: Double = 0.05
    ) -> some View {
        modifier(StaggeredIgnitionModifier(
            index: index,
            isVisible: isVisible,
            staggerInterval: staggerInterval
        ))
    }
}
