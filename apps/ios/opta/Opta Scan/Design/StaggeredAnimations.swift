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
                    _ = self.activeSteps.insert(step.id)
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
