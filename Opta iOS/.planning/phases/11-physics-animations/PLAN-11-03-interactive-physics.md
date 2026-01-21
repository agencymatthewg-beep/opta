# Plan 11-03: Interactive Physics Animations

## Goal

Create interactive physics-driven animations for card dismiss, gravity effects, and settling animations that enhance the premium feel.

## Context

Building on Plans 11-01 and 11-02, this adds:
- Interactive card throw/dismiss
- Gravity-based transitions
- Settling and snap animations
- Physics-driven card stack

## Implementation

### Step 1: Create Interactive Card Physics

Create `Opta Scan/Design/CardPhysics.swift`:

```swift
//
//  CardPhysics.swift
//  Opta Scan
//
//  Interactive card physics for drag and dismiss
//  Part of Phase 11: Physics Animations
//

import SwiftUI

/// Configuration for card dismiss physics
struct CardDismissConfig {
    /// Velocity threshold to trigger dismiss
    let dismissVelocityThreshold: CGFloat
    /// Distance threshold to trigger dismiss
    let dismissDistanceThreshold: CGFloat
    /// Rotation factor based on horizontal offset
    let rotationFactor: CGFloat
    /// Spring for return animation
    let returnSpring: PhysicsSpring
    /// Spring for dismiss animation
    let dismissSpring: PhysicsSpring

    static let `default` = CardDismissConfig(
        dismissVelocityThreshold: 500,
        dismissDistanceThreshold: 150,
        rotationFactor: 0.1,
        returnSpring: .snappy,
        dismissSpring: .natural
    )
}

/// Manages interactive card drag and dismiss
@Observable
class CardDismissHandler {
    var offset: CGSize = .zero
    var rotation: Double = 0
    var scale: CGFloat = 1.0
    var isDragging = false

    private let config: CardDismissConfig
    private let onDismiss: ((CardDismissDirection) -> Void)?

    enum CardDismissDirection {
        case left, right, up, down
    }

    init(
        config: CardDismissConfig = .default,
        onDismiss: ((CardDismissDirection) -> Void)? = nil
    ) {
        self.config = config
        self.onDismiss = onDismiss
    }

    func onDrag(translation: CGSize) {
        isDragging = true
        offset = translation
        rotation = Double(translation.width) * config.rotationFactor

        // Subtle scale down while dragging
        let dragDistance = sqrt(translation.width * translation.width + translation.height * translation.height)
        scale = max(0.95, 1.0 - dragDistance / 1000)
    }

    func onRelease(velocity: CGSize) {
        isDragging = false

        let shouldDismiss = shouldDismissCard(velocity: velocity)

        if let direction = shouldDismiss {
            dismissCard(direction: direction, velocity: velocity)
        } else {
            returnToCenter()
        }
    }

    private func shouldDismissCard(velocity: CGSize) -> CardDismissDirection? {
        let horizontalVelocity = abs(velocity.width)
        let verticalVelocity = abs(velocity.height)
        let horizontalDistance = abs(offset.width)
        let verticalDistance = abs(offset.height)

        // Check velocity threshold
        if horizontalVelocity > config.dismissVelocityThreshold {
            return velocity.width > 0 ? .right : .left
        }
        if verticalVelocity > config.dismissVelocityThreshold {
            return velocity.height > 0 ? .down : .up
        }

        // Check distance threshold
        if horizontalDistance > config.dismissDistanceThreshold {
            return offset.width > 0 ? .right : .left
        }
        if verticalDistance > config.dismissDistanceThreshold {
            return offset.height > 0 ? .down : .up
        }

        return nil
    }

    private func dismissCard(direction: CardDismissDirection, velocity: CGSize) {
        let dismissOffset: CGSize
        switch direction {
        case .left:
            dismissOffset = CGSize(width: -500, height: offset.height)
        case .right:
            dismissOffset = CGSize(width: 500, height: offset.height)
        case .up:
            dismissOffset = CGSize(width: offset.width, height: -500)
        case .down:
            dismissOffset = CGSize(width: offset.width, height: 500)
        }

        withAnimation(config.dismissSpring.animation) {
            offset = dismissOffset
            scale = 0.8
        }

        // Notify dismiss after animation
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.onDismiss?(direction)
        }
    }

    private func returnToCenter() {
        withAnimation(config.returnSpring.animation) {
            offset = .zero
            rotation = 0
            scale = 1.0
        }
    }

    func reset() {
        offset = .zero
        rotation = 0
        scale = 1.0
    }
}
```

### Step 2: Create Card Physics View Modifier

Add to CardPhysics.swift:

```swift
// MARK: - Card Dismiss Gesture Modifier

struct CardDismissModifier: ViewModifier {
    @Bindable var handler: CardDismissHandler

    func body(content: Content) -> some View {
        content
            .offset(handler.offset)
            .rotationEffect(.degrees(handler.rotation))
            .scaleEffect(handler.scale)
            .gesture(
                DragGesture()
                    .onChanged { value in
                        handler.onDrag(translation: value.translation)
                    }
                    .onEnded { value in
                        let velocity = CGSize(
                            width: value.predictedEndTranslation.width - value.translation.width,
                            height: value.predictedEndTranslation.height - value.translation.height
                        )
                        handler.onRelease(velocity: velocity)
                    }
            )
    }
}

extension View {
    /// Add card dismiss gesture with physics
    func cardDismissGesture(_ handler: CardDismissHandler) -> some View {
        modifier(CardDismissModifier(handler: handler))
    }
}
```

### Step 3: Create Gravity-Based Transition

Create `Opta Scan/Design/GravityTransition.swift`:

```swift
//
//  GravityTransition.swift
//  Opta Scan
//
//  Gravity-based transition effects
//  Part of Phase 11: Physics Animations
//

import SwiftUI

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
```

### Step 4: Create Snap Point System

Add to CardPhysics.swift:

```swift
// MARK: - Snap Points

/// Manages snapping to defined points with spring physics
struct SnapPointConfig {
    let points: [CGFloat]
    let snapThreshold: CGFloat
    let spring: PhysicsSpring

    static func vertical(
        points: [CGFloat],
        threshold: CGFloat = 50
    ) -> SnapPointConfig {
        SnapPointConfig(points: points, snapThreshold: threshold, spring: .snappy)
    }
}

extension SnapPointConfig {
    /// Find nearest snap point from current position and velocity
    func nearestSnapPoint(from position: CGFloat, velocity: CGFloat) -> CGFloat {
        let momentum = MomentumConfig.default
        let projectedPosition = momentum.projectedEndPosition(from: position, velocity: velocity)

        // Find nearest snap point
        return points.min(by: { abs($0 - projectedPosition) < abs($1 - projectedPosition) }) ?? position
    }
}

/// Handler for snapping drag gestures
@Observable
class SnapDragHandler {
    var offset: CGFloat = 0
    var isDragging = false

    private let config: SnapPointConfig

    init(config: SnapPointConfig) {
        self.config = config
    }

    func onDrag(translation: CGFloat) {
        isDragging = true
        offset = translation
    }

    func onRelease(velocity: CGFloat) {
        isDragging = false
        let snapPoint = config.nearestSnapPoint(from: offset, velocity: velocity)

        withAnimation(config.spring.animation) {
            offset = snapPoint
        }
    }
}
```

### Step 5: Create Demo View for Testing

Update or create PhysicsDemoView for testing all physics features.

## Files to Create/Modify

| File | Action |
|------|--------|
| `Opta Scan/Design/CardPhysics.swift` | Create |
| `Opta Scan/Design/GravityTransition.swift` | Create |
| `Opta Scan.xcodeproj/project.pbxproj` | Modify - add new files |

## Verification

1. Build succeeds
2. Card dismiss feels natural with velocity-based decisions
3. Gravity transitions have weight and bounce
4. Snap points work intuitively with momentum

## Dependencies

- Plan 11-01 complete (PhysicsSpring)
- Plan 11-02 complete (MomentumPhysics)
