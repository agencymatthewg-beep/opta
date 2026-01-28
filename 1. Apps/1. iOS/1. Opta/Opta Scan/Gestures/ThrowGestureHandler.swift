//
//  ThrowGestureHandler.swift
//  Opta Scan
//
//  Handles velocity-based throw gestures with momentum
//  Part of Phase 11: Physics Animations
//
//  Created by Matthew Byrden
//

import SwiftUI

/// Manages throw gesture with momentum physics
@Observable
class ThrowGestureHandler {
    var offset: CGFloat = 0
    var isDragging = false

    private let momentum: MomentumConfig
    private let rubberBand: RubberBandConfig
    private let bounds: ClosedRange<CGFloat>?

    init(
        momentum: MomentumConfig = .default,
        rubberBand: RubberBandConfig = .default,
        bounds: ClosedRange<CGFloat>? = nil
    ) {
        self.momentum = momentum
        self.rubberBand = rubberBand
        self.bounds = bounds
    }

    /// Update during drag
    func onDrag(translation: CGFloat) {
        isDragging = true

        if let bounds = bounds {
            // Apply rubber band at boundaries
            if translation < bounds.lowerBound {
                let overshoot = bounds.lowerBound - translation
                offset = bounds.lowerBound - rubberBand.stretchedPosition(offset: overshoot)
            } else if translation > bounds.upperBound {
                let overshoot = translation - bounds.upperBound
                offset = bounds.upperBound + rubberBand.stretchedPosition(offset: overshoot)
            } else {
                offset = translation
            }
        } else {
            offset = translation
        }
    }

    /// Release with velocity
    func onRelease(velocity: CGFloat, onSettle: ((CGFloat) -> Void)? = nil) {
        isDragging = false

        let projectedEnd = momentum.projectedEndPosition(from: offset, velocity: velocity)

        // Clamp to bounds if set
        let targetOffset: CGFloat
        if let bounds = bounds {
            targetOffset = min(max(projectedEnd, bounds.lowerBound), bounds.upperBound)
        } else {
            targetOffset = projectedEnd
        }

        // Animate to target with spring
        withAnimation(rubberBand.returnSpring.animation) {
            offset = targetOffset
        }

        onSettle?(targetOffset)
    }

    /// Reset to initial position
    func reset() {
        withAnimation(rubberBand.returnSpring.animation) {
            offset = 0
        }
    }
}

// MARK: - Throw Gesture Modifier

struct ThrowGestureModifier: ViewModifier {
    @Bindable var handler: ThrowGestureHandler
    let axis: Axis

    func body(content: Content) -> some View {
        content
            .offset(
                x: axis == .horizontal ? handler.offset : 0,
                y: axis == .vertical ? handler.offset : 0
            )
            .gesture(
                DragGesture()
                    .onChanged { value in
                        let translation = axis == .horizontal
                            ? value.translation.width
                            : value.translation.height
                        handler.onDrag(translation: translation)
                    }
                    .onEnded { value in
                        let velocity = axis == .horizontal
                            ? value.predictedEndTranslation.width - value.translation.width
                            : value.predictedEndTranslation.height - value.translation.height
                        handler.onRelease(velocity: velocity)
                    }
            )
    }
}

extension View {
    /// Add throw gesture with momentum physics
    func throwGesture(
        _ handler: ThrowGestureHandler,
        axis: Axis = .vertical
    ) -> some View {
        modifier(ThrowGestureModifier(handler: handler, axis: axis))
    }
}
