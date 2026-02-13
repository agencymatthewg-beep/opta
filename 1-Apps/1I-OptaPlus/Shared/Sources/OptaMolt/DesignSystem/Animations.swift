//
//  Animations.swift
//  OptaMolt
//
//  Opta design system animation tokens.
//  Standardised spring and timing curves for consistent motion language.
//
//  Usage:
//  ```swift
//  withAnimation(.optaSpring) {
//      isExpanded.toggle()
//  }
//  ```
//

import SwiftUI

// MARK: - Opta Animation Tokens

public extension Animation {

    /// Standard Opta spring animation.
    ///
    /// A responsive spring with moderate bounce — used for toggles, expansion,
    /// copy confirmations, and interactive transitions throughout the design system.
    ///
    /// Parameters: response 0.3s, dampingFraction 0.7 (slight bounce).
    static let optaSpring: Animation = .spring(response: 0.3, dampingFraction: 0.7)

    /// Snappy Opta spring — slightly faster with more damping.
    ///
    /// Good for small state changes like button presses and icon swaps.
    ///
    /// Parameters: response 0.2, dampingFraction 0.8.
    static let optaSnap: Animation = .spring(response: 0.2, dampingFraction: 0.8)

    /// Gentle Opta spring — slower with less bounce.
    ///
    /// Suited for large-scale layout shifts and full-screen transitions.
    ///
    /// Parameters: response 0.5, dampingFraction 0.85.
    static let optaGentle: Animation = .spring(response: 0.5, dampingFraction: 0.85)
}
