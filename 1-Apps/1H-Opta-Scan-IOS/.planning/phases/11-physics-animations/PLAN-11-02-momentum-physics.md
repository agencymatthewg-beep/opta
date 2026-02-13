# Plan 11-02: Momentum & Scroll Physics

## Goal

Implement momentum-based animations for scroll effects, rubber-band bounce at boundaries, and velocity-driven throw gestures.

## Context

Building on the PhysicsSpring system from Plan 11-01, this adds:
- Momentum deceleration curves
- Rubber-band boundary effects
- Velocity-based throw gestures
- Custom scroll physics

## Implementation

### Step 1: Create Momentum Physics

Create `Opta Scan/Design/MomentumPhysics.swift`:

```swift
//
//  MomentumPhysics.swift
//  Opta Scan
//
//  Momentum and deceleration physics for natural motion
//  Part of Phase 11: Physics Animations
//

import SwiftUI

/// Momentum physics configuration
struct MomentumConfig {
    /// Deceleration rate (points/second²)
    let deceleration: CGFloat
    /// Minimum velocity to continue animating
    let minimumVelocity: CGFloat
    /// Velocity multiplier for initial throw
    let velocityMultiplier: CGFloat

    static let `default` = MomentumConfig(
        deceleration: 1000,
        minimumVelocity: 10,
        velocityMultiplier: 1.0
    )

    static let fast = MomentumConfig(
        deceleration: 800,
        minimumVelocity: 5,
        velocityMultiplier: 1.2
    )

    static let heavy = MomentumConfig(
        deceleration: 1500,
        minimumVelocity: 20,
        velocityMultiplier: 0.8
    )

    /// Calculate final position from velocity
    func projectedEndPosition(from position: CGFloat, velocity: CGFloat) -> CGFloat {
        let adjustedVelocity = velocity * velocityMultiplier
        let direction: CGFloat = adjustedVelocity >= 0 ? 1 : -1
        let distance = (adjustedVelocity * adjustedVelocity) / (2 * deceleration)
        return position + (distance * direction)
    }

    /// Calculate duration to decelerate to stop
    func decelerationDuration(from velocity: CGFloat) -> TimeInterval {
        let adjustedVelocity = abs(velocity * velocityMultiplier)
        return TimeInterval(adjustedVelocity / deceleration)
    }
}
```

### Step 2: Create Rubber Band Effect

Add to MomentumPhysics.swift:

```swift
// MARK: - Rubber Band Effect

/// Rubber band stretch at boundaries
struct RubberBandConfig {
    /// Maximum stretch distance
    let maxStretch: CGFloat
    /// Resistance factor (0-1, lower = more resistance)
    let resistance: CGFloat
    /// Spring to return to boundary
    let returnSpring: PhysicsSpring

    static let `default` = RubberBandConfig(
        maxStretch: 100,
        resistance: 0.55,
        returnSpring: .snappy
    )

    static let tight = RubberBandConfig(
        maxStretch: 50,
        resistance: 0.3,
        returnSpring: .smooth
    )

    /// Calculate stretched position with rubber band resistance
    func stretchedPosition(offset: CGFloat) -> CGFloat {
        guard offset != 0 else { return 0 }

        let sign: CGFloat = offset >= 0 ? 1 : -1
        let absOffset = abs(offset)

        // Asymptotic approach to maxStretch
        let stretched = maxStretch * (1 - exp(-absOffset * resistance / maxStretch))
        return stretched * sign
    }
}

// MARK: - View Modifier

extension View {
    /// Apply rubber band effect beyond boundaries
    func rubberBand(
        offset: CGFloat,
        config: RubberBandConfig = .default
    ) -> some View {
        let stretchedOffset = config.stretchedPosition(offset: offset)
        return self.offset(y: stretchedOffset)
    }
}
```

### Step 3: Create Throw Gesture Handler

Create `Opta Scan/Gestures/ThrowGestureHandler.swift`:

```swift
//
//  ThrowGestureHandler.swift
//  Opta Scan
//
//  Handles velocity-based throw gestures with momentum
//  Part of Phase 11: Physics Animations
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
```

### Step 4: Create ScrollView Bounce Enhancement

Add to MomentumPhysics.swift:

```swift
// MARK: - Scroll Bounce Modifier

/// Enhanced bounce effect for scroll boundaries
struct ScrollBounceModifier: ViewModifier {
    let bounceFactor: CGFloat
    let isEnabled: Bool

    func body(content: Content) -> some View {
        content
            .scrollBounceBehavior(isEnabled ? .always : .basedOnSize)
    }
}

extension View {
    /// Apply enhanced scroll bounce
    func enhancedScrollBounce(_ isEnabled: Bool = true) -> some View {
        modifier(ScrollBounceModifier(bounceFactor: 1.0, isEnabled: isEnabled))
    }
}
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `Opta Scan/Design/MomentumPhysics.swift` | Create |
| `Opta Scan/Gestures/ThrowGestureHandler.swift` | Create |
| `Opta Scan.xcodeproj/project.pbxproj` | Modify - add new files |

## Verification

1. Build succeeds
2. Throw gestures feel natural with momentum
3. Rubber band effect at boundaries
4. Velocity correctly influences throw distance

## Dependencies

- Plan 11-01 complete (PhysicsSpring)
