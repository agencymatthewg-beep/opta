//
//  OptaAnimations.swift
//  Opta Scan
//
//  Spring physics presets following IOS_AESTHETIC_GUIDE.md
//  CRITICAL: Never use duration-based animations. All motion uses spring physics.
//
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Spring Animation Presets

extension Animation {
    /// Quick, responsive interactions (buttons, toggles)
    /// response: 0.3, dampingFraction: 0.7
    static let optaSpring = Animation.spring(
        response: 0.3,
        dampingFraction: 0.7,
        blendDuration: 0
    )

    /// Gentle transitions (page changes, reveals)
    /// response: 0.5, dampingFraction: 0.8
    static let optaSpringGentle = Animation.spring(
        response: 0.5,
        dampingFraction: 0.8,
        blendDuration: 0
    )

    /// Large movements (sheets, full-screen transitions)
    /// response: 0.6, dampingFraction: 0.85
    static let optaSpringPage = Animation.spring(
        response: 0.6,
        dampingFraction: 0.85,
        blendDuration: 0
    )

    /// Bouncy feedback (success states, celebrations)
    /// response: 0.4, dampingFraction: 0.5
    static let optaSpringBounce = Animation.spring(
        response: 0.4,
        dampingFraction: 0.5,
        blendDuration: 0
    )
}

// MARK: - Staggered Animation Modifier

/// ViewModifier for staggered appearance animations
struct StaggeredAppear: ViewModifier {
    let index: Int
    let isVisible: Bool

    func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .offset(y: isVisible ? 0 : 16)
            .animation(
                .optaSpringGentle.delay(Double(index) * 0.04),
                value: isVisible
            )
    }
}

extension View {
    /// Apply staggered appearance animation based on index
    /// - Parameters:
    ///   - index: Position in sequence for delay calculation
    ///   - isVisible: Whether the content should be visible
    func staggeredAppear(index: Int, isVisible: Bool) -> some View {
        modifier(StaggeredAppear(index: index, isVisible: isVisible))
    }
}

// MARK: - Usage Examples Reference
/*
 // Button press
 Button(action: capture) {
     CaptureButton(isActive: isCapturing)
 }
 .scaleEffect(isPressed ? 0.95 : 1.0)
 .animation(.optaSpring, value: isPressed)

 // Card appearance
 ResultCard(result: result)
     .opacity(isVisible ? 1 : 0)
     .offset(y: isVisible ? 0 : 20)
     .animation(.optaSpringGentle.delay(Double(index) * 0.05), value: isVisible)

 // Sheet presentation
 .sheet(isPresented: $showResults) {
     ResultsView()
         .transition(.move(edge: .bottom).combined(with: .opacity))
 }
 .animation(.optaSpringPage, value: showResults)
 */
