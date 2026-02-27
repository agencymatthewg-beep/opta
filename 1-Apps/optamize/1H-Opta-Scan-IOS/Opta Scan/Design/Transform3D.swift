//
//  Transform3D.swift
//  Opta Scan
//
//  3D transformation utilities for perspective effects
//  Part of Phase 13: 3D Transforms
//

import SwiftUI

// MARK: - Perspective Configuration

/// Configuration for 3D perspective effects
struct PerspectiveConfig {
    let focalLength: CGFloat
    let vanishingPointX: CGFloat
    let vanishingPointY: CGFloat

    static let standard = PerspectiveConfig(
        focalLength: 1000,
        vanishingPointX: 0.5,
        vanishingPointY: 0.5
    )

    static let dramatic = PerspectiveConfig(
        focalLength: 500,
        vanishingPointX: 0.5,
        vanishingPointY: 0.5
    )

    static let subtle = PerspectiveConfig(
        focalLength: 2000,
        vanishingPointX: 0.5,
        vanishingPointY: 0.5
    )
}

// MARK: - 3D Rotation State

/// Observable state for 3D rotation gestures
@Observable
class Rotation3DState {
    var rotationX: Double = 0
    var rotationY: Double = 0
    var rotationZ: Double = 0

    /// Reset all rotations
    func reset() {
        rotationX = 0
        rotationY = 0
        rotationZ = 0
    }

    /// Apply gesture translation to rotation
    func applyGesture(translation: CGSize, sensitivity: Double = 0.5) {
        rotationY = translation.width * sensitivity
        rotationX = -translation.height * sensitivity
    }
}

// MARK: - 3D Rotation Modifier

/// Apply 3D rotation with perspective
struct Rotation3DModifier: ViewModifier {
    let rotationX: Double
    let rotationY: Double
    let rotationZ: Double
    let perspective: PerspectiveConfig
    let anchor: UnitPoint

    func body(content: Content) -> some View {
        content
            .rotation3DEffect(
                .degrees(rotationX),
                axis: (x: 1, y: 0, z: 0),
                anchor: anchor,
                anchorZ: 0,
                perspective: 1 / perspective.focalLength
            )
            .rotation3DEffect(
                .degrees(rotationY),
                axis: (x: 0, y: 1, z: 0),
                anchor: anchor,
                anchorZ: 0,
                perspective: 1 / perspective.focalLength
            )
            .rotation3DEffect(
                .degrees(rotationZ),
                axis: (x: 0, y: 0, z: 1),
                anchor: anchor,
                anchorZ: 0,
                perspective: 1 / perspective.focalLength
            )
    }
}

extension View {
    /// Apply 3D rotation with perspective
    func rotation3D(
        x: Double = 0,
        y: Double = 0,
        z: Double = 0,
        perspective: PerspectiveConfig = .standard,
        anchor: UnitPoint = .center
    ) -> some View {
        modifier(Rotation3DModifier(
            rotationX: x,
            rotationY: y,
            rotationZ: z,
            perspective: perspective,
            anchor: anchor
        ))
    }

    /// Apply 3D rotation from state
    func rotation3D(
        _ state: Rotation3DState,
        perspective: PerspectiveConfig = .standard,
        anchor: UnitPoint = .center
    ) -> some View {
        modifier(Rotation3DModifier(
            rotationX: state.rotationX,
            rotationY: state.rotationY,
            rotationZ: state.rotationZ,
            perspective: perspective,
            anchor: anchor
        ))
    }
}
