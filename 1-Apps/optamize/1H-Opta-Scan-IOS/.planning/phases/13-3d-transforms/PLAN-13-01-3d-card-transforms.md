# Plan 13-01: 3D Card Transforms

## Goal

Create card flip animations with perspective and 3D rotation effects for interactive depth.

## Context

Building on physics animations and visual effects, this adds:
- Card flip animations with 3D perspective
- Interactive 3D rotation on drag
- Perspective-based view transformations
- Smooth transition between front/back states

## Implementation

### Step 1: Create 3D Transform Utilities

Create `Opta Scan/Design/Transform3D.swift`:

```swift
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
```

### Step 2: Create Card Flip Component

Create `Opta Scan/Views/Effects/CardFlipView.swift`:

```swift
//
//  CardFlipView.swift
//  Opta Scan
//
//  Card flip animation with 3D perspective
//  Part of Phase 13: 3D Transforms
//

import SwiftUI

/// A view that flips between front and back content
struct CardFlipView<Front: View, Back: View>: View {
    @Binding var isFlipped: Bool
    let perspective: PerspectiveConfig
    let duration: Double
    let front: Front
    let back: Back

    @State private var rotation: Double = 0

    init(
        isFlipped: Binding<Bool>,
        perspective: PerspectiveConfig = .standard,
        duration: Double = 0.6,
        @ViewBuilder front: () -> Front,
        @ViewBuilder back: () -> Back
    ) {
        self._isFlipped = isFlipped
        self.perspective = perspective
        self.duration = duration
        self.front = front()
        self.back = back()
    }

    var body: some View {
        ZStack {
            front
                .opacity(rotation < 90 ? 1 : 0)
                .rotation3DEffect(
                    .degrees(rotation),
                    axis: (x: 0, y: 1, z: 0),
                    perspective: 1 / perspective.focalLength
                )

            back
                .opacity(rotation >= 90 ? 1 : 0)
                .rotation3DEffect(
                    .degrees(rotation - 180),
                    axis: (x: 0, y: 1, z: 0),
                    perspective: 1 / perspective.focalLength
                )
        }
        .onChange(of: isFlipped) { _, newValue in
            withAnimation(.optaSpring) {
                rotation = newValue ? 180 : 0
            }
        }
    }
}

// MARK: - Interactive 3D Card

/// Card that responds to drag with 3D rotation
struct Interactive3DCard<Content: View>: View {
    let maxRotation: Double
    let perspective: PerspectiveConfig
    let content: Content

    @State private var rotationState = Rotation3DState()
    @GestureState private var isDragging = false

    init(
        maxRotation: Double = 15,
        perspective: PerspectiveConfig = .standard,
        @ViewBuilder content: () -> Content
    ) {
        self.maxRotation = maxRotation
        self.perspective = perspective
        self.content = content()
    }

    var body: some View {
        content
            .rotation3D(rotationState, perspective: perspective)
            .gesture(
                DragGesture()
                    .updating($isDragging) { _, state, _ in
                        state = true
                    }
                    .onChanged { value in
                        let normalizedX = value.translation.width / 100
                        let normalizedY = value.translation.height / 100

                        rotationState.rotationY = min(max(normalizedX * maxRotation, -maxRotation), maxRotation)
                        rotationState.rotationX = min(max(-normalizedY * maxRotation, -maxRotation), maxRotation)
                    }
                    .onEnded { _ in
                        withAnimation(.optaSpring) {
                            rotationState.reset()
                        }
                    }
            )
            .animation(.optaSpring, value: isDragging)
    }
}

// MARK: - View Extension

extension View {
    /// Make view respond to drag with 3D tilt effect
    func interactive3DTilt(
        maxRotation: Double = 10,
        perspective: PerspectiveConfig = .standard
    ) -> some View {
        Interactive3DTiltModifier(
            maxRotation: maxRotation,
            perspective: perspective
        ) {
            self
        }
    }
}

/// Modifier for 3D tilt effect
struct Interactive3DTiltModifier<Content: View>: View {
    let maxRotation: Double
    let perspective: PerspectiveConfig
    let content: () -> Content

    @State private var rotationX: Double = 0
    @State private var rotationY: Double = 0

    var body: some View {
        content()
            .rotation3D(
                x: rotationX,
                y: rotationY,
                perspective: perspective
            )
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let normalizedX = value.translation.width / 100
                        let normalizedY = value.translation.height / 100

                        rotationY = min(max(normalizedX * maxRotation, -maxRotation), maxRotation)
                        rotationX = min(max(-normalizedY * maxRotation, -maxRotation), maxRotation)
                    }
                    .onEnded { _ in
                        withAnimation(.optaSpring) {
                            rotationX = 0
                            rotationY = 0
                        }
                    }
            )
    }
}
```

### Step 3: Add Files to Xcode Project

Add:
- Transform3D.swift to Design group
- CardFlipView.swift to Views/Effects group

## Files to Create/Modify

| File | Action |
|------|--------|
| `Opta Scan/Design/Transform3D.swift` | Create |
| `Opta Scan/Views/Effects/CardFlipView.swift` | Create |
| `Opta Scan.xcodeproj/project.pbxproj` | Modify - add new files |

## Verification

1. Build succeeds
2. Card flip animates smoothly with perspective
3. Interactive 3D tilt responds to drag
4. Rotation resets with spring animation

## Dependencies

- Phase 12 complete
- SwiftUI 3D rotation effects
