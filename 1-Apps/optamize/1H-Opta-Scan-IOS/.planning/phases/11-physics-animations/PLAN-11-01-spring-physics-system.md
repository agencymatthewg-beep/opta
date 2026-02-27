# Plan 11-01: Spring Physics System

## Goal

Extend the spring animation system with customizable physics parameters, gesture-driven springs, and interruptible animations that feel natural and responsive.

## Context

The existing OptaAnimations.swift has basic spring presets. This plan adds:
- Physics-based spring configuration with real-world parameters
- Gesture-driven spring animations
- Interruptible animations that blend smoothly
- Custom spring interpolator for complex animations

## Implementation

### Step 1: Create PhysicsSpring Configuration

Create `Opta Scan/Design/PhysicsSpring.swift`:

```swift
//
//  PhysicsSpring.swift
//  Opta Scan
//
//  Configurable spring physics for natural motion
//  Part of Phase 11: Physics Animations
//

import SwiftUI

/// Spring physics configuration with real-world parameters
struct PhysicsSpring {
    /// Mass affects momentum and settling time (default: 1.0)
    let mass: Double
    /// Stiffness affects speed and responsiveness (default: 100)
    let stiffness: Double
    /// Damping affects oscillation decay (default: 10)
    let damping: Double

    /// Calculate response time from physics parameters
    var response: Double {
        2 * .pi / sqrt(stiffness / mass)
    }

    /// Calculate damping fraction from physics parameters
    var dampingFraction: Double {
        damping / (2 * sqrt(stiffness * mass))
    }

    /// Convert to SwiftUI Animation
    var animation: Animation {
        .spring(response: response, dampingFraction: dampingFraction)
    }

    // MARK: - Presets

    /// Quick, snappy response for buttons/toggles
    static let snappy = PhysicsSpring(mass: 1.0, stiffness: 400, damping: 25)

    /// Natural motion for cards/panels
    static let natural = PhysicsSpring(mass: 1.0, stiffness: 200, damping: 20)

    /// Bouncy, playful motion for celebrations
    static let bouncy = PhysicsSpring(mass: 1.0, stiffness: 300, damping: 12)

    /// Slow, gentle motion for large elements
    static let gentle = PhysicsSpring(mass: 1.5, stiffness: 100, damping: 20)

    /// Critically damped - no oscillation
    static let smooth = PhysicsSpring(mass: 1.0, stiffness: 200, damping: 28.28)
}
```

### Step 2: Create Spring-Driven Gesture Modifier

Add to PhysicsSpring.swift:

```swift
// MARK: - Spring-Driven Gesture State

/// Manages spring physics for gesture interactions
@Observable
class SpringGestureState {
    var offset: CGSize = .zero
    var velocity: CGSize = .zero
    var isActive = false

    private var spring: PhysicsSpring

    init(spring: PhysicsSpring = .natural) {
        self.spring = spring
    }

    /// Update during gesture
    func update(translation: CGSize, velocity: CGSize) {
        self.offset = translation
        self.velocity = velocity
        self.isActive = true
    }

    /// Release with velocity
    func release(targetOffset: CGSize = .zero) {
        self.isActive = false
        withAnimation(spring.animation) {
            self.offset = targetOffset
        }
    }

    /// Spring animation for current state
    var animation: Animation? {
        isActive ? nil : spring.animation
    }
}

// MARK: - View Extension

extension View {
    /// Apply spring-driven offset from gesture state
    func springOffset(_ state: SpringGestureState) -> some View {
        self.offset(state.offset)
            .animation(state.animation, value: state.offset)
    }
}
```

### Step 3: Create Interruptible Spring Animation

Create `Opta Scan/Design/InterruptibleSpring.swift`:

```swift
//
//  InterruptibleSpring.swift
//  Opta Scan
//
//  Interruptible spring animations that blend smoothly
//  Part of Phase 11: Physics Animations
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

struct InterruptibleSpringModifier: ViewModifier {
    @Bindable var springValue: InterruptibleSpringValue
    let transform: (CGFloat) -> some ViewModifier

    func body(content: Content) -> some View {
        content
            .modifier(transform(springValue.currentValue))
    }
}
```

### Step 4: Add Spring Animation Helpers

Add to OptaAnimations.swift:

```swift
// MARK: - Physics Spring Extensions

extension Animation {
    /// Create animation from PhysicsSpring configuration
    static func physicsSpring(_ spring: PhysicsSpring) -> Animation {
        spring.animation
    }

    /// Snappy spring for immediate feedback
    static let optaSnappy = PhysicsSpring.snappy.animation

    /// Bouncy spring for playful effects
    static let optaBouncy = PhysicsSpring.bouncy.animation

    /// Smooth spring with no oscillation
    static let optaSmooth = PhysicsSpring.smooth.animation
}

// MARK: - Spring Gesture Modifiers

extension View {
    /// Apply spring scale effect during press
    func springScale(isPressed: Bool, scale: CGFloat = 0.95) -> some View {
        self.scaleEffect(isPressed ? scale : 1.0)
            .animation(.optaSnappy, value: isPressed)
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
```

### Step 5: Update ShaderDemoView with Physics Demo

Add physics demo section to ShaderDemoView.swift for testing.

## Files to Create/Modify

| File | Action |
|------|--------|
| `Opta Scan/Design/PhysicsSpring.swift` | Create |
| `Opta Scan/Design/InterruptibleSpring.swift` | Create |
| `Opta Scan/Design/OptaAnimations.swift` | Modify - add physics extensions |
| `Opta Scan.xcodeproj/project.pbxproj` | Modify - add new files |

## Verification

1. Build succeeds
2. Spring presets produce smooth, natural motion
3. Gesture-driven springs respond fluidly
4. Interrupted animations blend without jarring

## Dependencies

- Phase 10 complete
- SwiftUI Animation system
