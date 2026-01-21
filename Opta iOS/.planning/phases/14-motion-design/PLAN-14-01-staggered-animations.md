# Plan 14-01: Staggered Animations and Choreography

## Goal

Create staggered list animations with precise timing and choreographed multi-element transitions.

## Context

Building on physics and 3D effects, this adds:
- Staggered appearance animations for lists
- Choreographed multi-element transitions
- Precise timing control
- Coordinated animation sequences

## Implementation

### Step 1: Create Staggered Animation System

Create `Opta Scan/Design/StaggeredAnimations.swift`:

```swift
//
//  StaggeredAnimations.swift
//  Opta Scan
//
//  Staggered and choreographed animation utilities
//  Part of Phase 14: Motion Design
//

import SwiftUI

// MARK: - Stagger Configuration

/// Configuration for staggered animations
struct StaggerConfig {
    let baseDelay: Double
    let delayIncrement: Double
    let animation: Animation

    static let fast = StaggerConfig(
        baseDelay: 0,
        delayIncrement: 0.03,
        animation: .optaSpring
    )

    static let standard = StaggerConfig(
        baseDelay: 0,
        delayIncrement: 0.05,
        animation: .optaSpring
    )

    static let relaxed = StaggerConfig(
        baseDelay: 0.1,
        delayIncrement: 0.08,
        animation: .easeOut(duration: 0.4)
    )

    /// Calculate delay for item at index
    func delay(for index: Int) -> Double {
        baseDelay + (Double(index) * delayIncrement)
    }
}

// MARK: - Staggered Appearance State

/// Observable state for managing staggered appearance
@Observable
class StaggeredAppearanceState {
    var isVisible: Bool = false
    var itemCount: Int = 0

    func trigger(itemCount: Int) {
        self.itemCount = itemCount
        isVisible = true
    }

    func reset() {
        isVisible = false
    }
}

// MARK: - Staggered Item Modifier

/// Apply staggered appearance to individual items
struct StaggeredItemModifier: ViewModifier {
    let index: Int
    let isVisible: Bool
    let config: StaggerConfig

    @State private var hasAppeared = false

    func body(content: Content) -> some View {
        content
            .opacity(hasAppeared ? 1 : 0)
            .offset(y: hasAppeared ? 0 : 20)
            .scaleEffect(hasAppeared ? 1 : 0.95)
            .onChange(of: isVisible) { _, newValue in
                if newValue {
                    withAnimation(config.animation.delay(config.delay(for: index))) {
                        hasAppeared = true
                    }
                } else {
                    hasAppeared = false
                }
            }
            .onAppear {
                if isVisible {
                    withAnimation(config.animation.delay(config.delay(for: index))) {
                        hasAppeared = true
                    }
                }
            }
    }
}

extension View {
    /// Apply staggered appearance animation
    func staggeredAppearance(
        index: Int,
        isVisible: Bool,
        config: StaggerConfig = .standard
    ) -> some View {
        modifier(StaggeredItemModifier(index: index, isVisible: isVisible, config: config))
    }
}

// MARK: - Choreographed Sequence

/// Define a sequence of choreographed animations
struct AnimationSequence {
    var steps: [AnimationStep]

    struct AnimationStep {
        let id: String
        let delay: Double
        let duration: Double
        let animation: Animation

        init(id: String, delay: Double = 0, duration: Double = 0.3, animation: Animation = .optaSpring) {
            self.id = id
            self.delay = delay
            self.duration = duration
            self.animation = animation
        }
    }

    static let cardReveal = AnimationSequence(steps: [
        AnimationStep(id: "background", delay: 0, duration: 0.2),
        AnimationStep(id: "icon", delay: 0.1, duration: 0.3),
        AnimationStep(id: "title", delay: 0.15, duration: 0.25),
        AnimationStep(id: "content", delay: 0.2, duration: 0.3),
        AnimationStep(id: "actions", delay: 0.3, duration: 0.25)
    ])

    static let listAppear = AnimationSequence(steps: [
        AnimationStep(id: "header", delay: 0, duration: 0.2),
        AnimationStep(id: "items", delay: 0.1, duration: 0.4),
        AnimationStep(id: "footer", delay: 0.3, duration: 0.2)
    ])

    func step(for id: String) -> AnimationStep? {
        steps.first { $0.id == id }
    }
}

// MARK: - Choreography State

/// Observable state for choreographed animations
@Observable
class ChoreographyState {
    private var activeSteps: Set<String> = []
    var sequence: AnimationSequence

    init(sequence: AnimationSequence) {
        self.sequence = sequence
    }

    func isActive(_ stepId: String) -> Bool {
        activeSteps.contains(stepId)
    }

    func start() {
        for step in sequence.steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + step.delay) {
                withAnimation(step.animation) {
                    self.activeSteps.insert(step.id)
                }
            }
        }
    }

    func reset() {
        activeSteps.removeAll()
    }
}

// MARK: - Choreographed Element Modifier

/// Apply choreographed animation to an element
struct ChoreographedModifier: ViewModifier {
    let stepId: String
    @Bindable var state: ChoreographyState

    func body(content: Content) -> some View {
        let isActive = state.isActive(stepId)

        content
            .opacity(isActive ? 1 : 0)
            .offset(y: isActive ? 0 : 15)
            .scaleEffect(isActive ? 1 : 0.98)
    }
}

extension View {
    /// Apply choreographed animation
    func choreographed(_ stepId: String, state: ChoreographyState) -> some View {
        modifier(ChoreographedModifier(stepId: stepId, state: state))
    }
}
```

### Step 2: Create List Animation Container

Create `Opta Scan/Views/Effects/AnimatedListView.swift`:

```swift
//
//  AnimatedListView.swift
//  Opta Scan
//
//  Animated list container with staggered items
//  Part of Phase 14: Motion Design
//

import SwiftUI

/// Container that animates list items with staggered appearance
struct AnimatedList<Data: RandomAccessCollection, Content: View>: View where Data.Element: Identifiable {
    let data: Data
    let config: StaggerConfig
    let content: (Data.Element) -> Content

    @State private var isVisible = false

    init(
        _ data: Data,
        config: StaggerConfig = .standard,
        @ViewBuilder content: @escaping (Data.Element) -> Content
    ) {
        self.data = data
        self.config = config
        self.content = content
    }

    var body: some View {
        LazyVStack(spacing: 12) {
            ForEach(Array(data.enumerated()), id: \.element.id) { index, item in
                content(item)
                    .staggeredAppearance(index: index, isVisible: isVisible, config: config)
            }
        }
        .onAppear {
            isVisible = true
        }
    }
}

/// Animated ForEach with staggered appearance
struct StaggeredForEach<Data: RandomAccessCollection, Content: View>: View where Data.Element: Identifiable {
    let data: Data
    let config: StaggerConfig
    @Binding var isTriggered: Bool
    let content: (Data.Element) -> Content

    init(
        _ data: Data,
        isTriggered: Binding<Bool>,
        config: StaggerConfig = .standard,
        @ViewBuilder content: @escaping (Data.Element) -> Content
    ) {
        self.data = data
        self._isTriggered = isTriggered
        self.config = config
        self.content = content
    }

    var body: some View {
        ForEach(Array(data.enumerated()), id: \.element.id) { index, item in
            content(item)
                .staggeredAppearance(index: index, isVisible: isTriggered, config: config)
        }
    }
}

// MARK: - Wave Animation

/// Creates a wave effect across items
struct WaveAnimationModifier: ViewModifier {
    let index: Int
    let totalItems: Int
    let isActive: Bool
    let amplitude: CGFloat
    let frequency: Double

    @State private var phase: Double = 0

    func body(content: Content) -> some View {
        let normalizedIndex = Double(index) / Double(max(totalItems - 1, 1))
        let waveOffset = isActive ? sin((phase + normalizedIndex * .pi * 2) * frequency) * amplitude : 0

        content
            .offset(y: waveOffset)
            .onAppear {
                if isActive {
                    withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                        phase = .pi * 2
                    }
                }
            }
    }
}

extension View {
    /// Apply wave animation effect
    func waveAnimation(
        index: Int,
        totalItems: Int,
        isActive: Bool,
        amplitude: CGFloat = 5,
        frequency: Double = 1
    ) -> some View {
        modifier(WaveAnimationModifier(
            index: index,
            totalItems: totalItems,
            isActive: isActive,
            amplitude: amplitude,
            frequency: frequency
        ))
    }
}
```

### Step 3: Add Files to Xcode Project

Add:
- StaggeredAnimations.swift to Design group
- AnimatedListView.swift to Views/Effects group

## Files to Create/Modify

| File | Action |
|------|--------|
| `Opta Scan/Design/StaggeredAnimations.swift` | Create |
| `Opta Scan/Views/Effects/AnimatedListView.swift` | Create |
| `Opta Scan.xcodeproj/project.pbxproj` | Modify - add new files |

## Verification

1. Build succeeds
2. Staggered items appear with cascading delay
3. Choreographed sequences trigger in order
4. Wave animation creates smooth ripple effect

## Dependencies

- Phase 13 complete
- SwiftUI animation system
