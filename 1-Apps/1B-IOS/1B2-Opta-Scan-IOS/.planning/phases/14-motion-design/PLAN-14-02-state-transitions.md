# Plan 14-02: State Transitions and Micro-Interactions

## Goal

Create loading state animations, success/error celebrations, and polished navigation transitions.

## Context

Building on staggered animations, this adds:
- Loading state micro-interactions
- Success/error celebration animations
- Smooth state transition effects
- Navigation transition polish

## Implementation

### Step 1: Create State Transition System

Create `Opta Scan/Design/StateTransitions.swift`:

```swift
//
//  StateTransitions.swift
//  Opta Scan
//
//  State transition animations and micro-interactions
//  Part of Phase 14: Motion Design
//

import SwiftUI

// MARK: - Loading State

/// Configuration for loading animations
struct LoadingConfig {
    let dotCount: Int
    let dotSize: CGFloat
    let spacing: CGFloat
    let animationDuration: Double
    let color: Color

    static let standard = LoadingConfig(
        dotCount: 3,
        dotSize: 8,
        spacing: 6,
        animationDuration: 0.6,
        color: .optaPurple
    )

    static let compact = LoadingConfig(
        dotCount: 3,
        dotSize: 6,
        spacing: 4,
        animationDuration: 0.5,
        color: .optaPurple
    )
}

/// Animated loading dots
struct LoadingDotsView: View {
    let config: LoadingConfig
    let isAnimating: Bool

    @State private var scales: [CGFloat]

    init(config: LoadingConfig = .standard, isAnimating: Bool = true) {
        self.config = config
        self.isAnimating = isAnimating
        self._scales = State(initialValue: Array(repeating: 1.0, count: config.dotCount))
    }

    var body: some View {
        HStack(spacing: config.spacing) {
            ForEach(0..<config.dotCount, id: \.self) { index in
                Circle()
                    .fill(config.color)
                    .frame(width: config.dotSize, height: config.dotSize)
                    .scaleEffect(scales[index])
            }
        }
        .onAppear {
            guard isAnimating else { return }
            animateDots()
        }
        .onChange(of: isAnimating) { _, newValue in
            if newValue {
                animateDots()
            }
        }
    }

    private func animateDots() {
        for index in 0..<config.dotCount {
            let delay = Double(index) * (config.animationDuration / Double(config.dotCount))
            withAnimation(
                .easeInOut(duration: config.animationDuration / 2)
                .repeatForever(autoreverses: true)
                .delay(delay)
            ) {
                scales[index] = 1.5
            }
        }
    }
}

/// Pulsing loading indicator
struct PulsingLoadingView: View {
    let size: CGFloat
    let color: Color
    let isAnimating: Bool

    @State private var scale: CGFloat = 1
    @State private var opacity: Double = 1

    init(size: CGFloat = 40, color: Color = .optaPurple, isAnimating: Bool = true) {
        self.size = size
        self.color = color
        self.isAnimating = isAnimating
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.3), lineWidth: 3)
                .frame(width: size, height: size)

            Circle()
                .stroke(color, lineWidth: 3)
                .frame(width: size, height: size)
                .scaleEffect(scale)
                .opacity(opacity)
        }
        .onAppear {
            guard isAnimating else { return }
            animate()
        }
        .onChange(of: isAnimating) { _, newValue in
            if newValue {
                animate()
            }
        }
    }

    private func animate() {
        withAnimation(.easeOut(duration: 1.2).repeatForever(autoreverses: false)) {
            scale = 2
            opacity = 0
        }
    }
}

// MARK: - Success/Error States

/// Success checkmark animation
struct SuccessCheckmarkView: View {
    let size: CGFloat
    let color: Color
    @Binding var isShowing: Bool

    @State private var trimEnd: CGFloat = 0
    @State private var scale: CGFloat = 0.8
    @State private var circleOpacity: Double = 0

    init(size: CGFloat = 60, color: Color = .optaGreen, isShowing: Binding<Bool>) {
        self.size = size
        self.color = color
        self._isShowing = isShowing
    }

    var body: some View {
        ZStack {
            // Background circle
            Circle()
                .fill(color.opacity(0.15))
                .frame(width: size, height: size)
                .scaleEffect(scale)
                .opacity(circleOpacity)

            // Checkmark
            Path { path in
                let width = size * 0.5
                let height = size * 0.35
                let startX = size * 0.25
                let startY = size * 0.5

                path.move(to: CGPoint(x: startX, y: startY))
                path.addLine(to: CGPoint(x: startX + width * 0.35, y: startY + height * 0.5))
                path.addLine(to: CGPoint(x: startX + width, y: startY - height * 0.3))
            }
            .trim(from: 0, to: trimEnd)
            .stroke(color, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
            .frame(width: size, height: size)
        }
        .onChange(of: isShowing) { _, newValue in
            if newValue {
                animateIn()
            } else {
                reset()
            }
        }
    }

    private func animateIn() {
        withAnimation(.easeOut(duration: 0.2)) {
            circleOpacity = 1
            scale = 1
        }
        withAnimation(.easeOut(duration: 0.4).delay(0.1)) {
            trimEnd = 1
        }
    }

    private func reset() {
        trimEnd = 0
        scale = 0.8
        circleOpacity = 0
    }
}

/// Error X animation
struct ErrorXView: View {
    let size: CGFloat
    let color: Color
    @Binding var isShowing: Bool

    @State private var rotation: Double = -90
    @State private var scale: CGFloat = 0.5
    @State private var opacity: Double = 0

    init(size: CGFloat = 60, color: Color = .red, isShowing: Binding<Bool>) {
        self.size = size
        self.color = color
        self._isShowing = isShowing
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(color.opacity(0.15))
                .frame(width: size, height: size)

            Image(systemName: "xmark")
                .font(.system(size: size * 0.4, weight: .bold))
                .foregroundStyle(color)
        }
        .scaleEffect(scale)
        .rotationEffect(.degrees(rotation))
        .opacity(opacity)
        .onChange(of: isShowing) { _, newValue in
            if newValue {
                animateIn()
            } else {
                reset()
            }
        }
    }

    private func animateIn() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) {
            rotation = 0
            scale = 1
            opacity = 1
        }
    }

    private func reset() {
        rotation = -90
        scale = 0.5
        opacity = 0
    }
}

// MARK: - State Transition Modifier

/// Modifier for smooth state transitions
struct StateTransitionModifier<T: Equatable>: ViewModifier {
    let state: T
    let animation: Animation

    func body(content: Content) -> some View {
        content
            .animation(animation, value: state)
    }
}

extension View {
    /// Apply smooth state transition animation
    func stateTransition<T: Equatable>(_ state: T, animation: Animation = .optaSpring) -> some View {
        modifier(StateTransitionModifier(state: state, animation: animation))
    }
}
```

### Step 2: Create Celebration Effects

Create `Opta Scan/Views/Effects/CelebrationEffects.swift`:

```swift
//
//  CelebrationEffects.swift
//  Opta Scan
//
//  Celebration and feedback animations
//  Part of Phase 14: Motion Design
//

import SwiftUI

// MARK: - Confetti Effect

/// Simple confetti burst effect
struct ConfettiBurst: View {
    let isActive: Bool
    let particleCount: Int
    let colors: [Color]

    @State private var particles: [ConfettiParticle] = []

    struct ConfettiParticle: Identifiable {
        let id = UUID()
        var x: CGFloat
        var y: CGFloat
        var rotation: Double
        var scale: CGFloat
        var color: Color
        var opacity: Double
    }

    init(isActive: Bool, particleCount: Int = 30, colors: [Color] = [.optaPurple, .optaGreen, .blue, .orange]) {
        self.isActive = isActive
        self.particleCount = particleCount
        self.colors = colors
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ForEach(particles) { particle in
                    Rectangle()
                        .fill(particle.color)
                        .frame(width: 8, height: 8)
                        .scaleEffect(particle.scale)
                        .rotationEffect(.degrees(particle.rotation))
                        .position(x: particle.x, y: particle.y)
                        .opacity(particle.opacity)
                }
            }
            .onChange(of: isActive) { _, newValue in
                if newValue {
                    burst(in: geometry.size)
                }
            }
        }
        .allowsHitTesting(false)
    }

    private func burst(in size: CGSize) {
        particles = (0..<particleCount).map { _ in
            ConfettiParticle(
                x: size.width / 2,
                y: size.height / 2,
                rotation: Double.random(in: 0...360),
                scale: CGFloat.random(in: 0.5...1.5),
                color: colors.randomElement() ?? .optaPurple,
                opacity: 1
            )
        }

        for index in particles.indices {
            let angle = Double.random(in: 0...(2 * .pi))
            let distance = CGFloat.random(in: 100...200)
            let endX = size.width / 2 + cos(angle) * distance
            let endY = size.height / 2 + sin(angle) * distance - 50

            withAnimation(.easeOut(duration: Double.random(in: 0.8...1.2))) {
                particles[index].x = endX
                particles[index].y = endY
                particles[index].rotation += Double.random(in: 180...540)
                particles[index].opacity = 0
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            particles.removeAll()
        }
    }
}

// MARK: - Shimmer Effect

/// Shimmer loading effect
struct ShimmerModifier: ViewModifier {
    let isActive: Bool
    let color: Color

    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay {
                if isActive {
                    GeometryReader { geometry in
                        LinearGradient(
                            colors: [
                                color.opacity(0),
                                color.opacity(0.3),
                                color.opacity(0)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: geometry.size.width * 2)
                        .offset(x: phase * geometry.size.width * 3 - geometry.size.width)
                    }
                    .mask(content)
                }
            }
            .onAppear {
                guard isActive else { return }
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

extension View {
    /// Apply shimmer loading effect
    func shimmer(isActive: Bool = true, color: Color = .white) -> some View {
        modifier(ShimmerModifier(isActive: isActive, color: color))
    }
}

// MARK: - Bounce Feedback

/// Bounce effect for tap feedback
struct BounceFeedbackModifier: ViewModifier {
    @State private var isPressed = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPressed ? 0.95 : 1)
            .animation(.spring(response: 0.2, dampingFraction: 0.5), value: isPressed)
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in isPressed = true }
                    .onEnded { _ in isPressed = false }
            )
    }
}

extension View {
    /// Apply bounce feedback on tap
    func bounceFeedback() -> some View {
        modifier(BounceFeedbackModifier())
    }
}

// MARK: - Pulse Effect

/// Attention-grabbing pulse effect
struct PulseEffectModifier: ViewModifier {
    let isActive: Bool
    let color: Color

    @State private var isPulsing = false

    func body(content: Content) -> some View {
        content
            .background {
                if isActive {
                    content
                        .foregroundStyle(color)
                        .scaleEffect(isPulsing ? 1.2 : 1)
                        .opacity(isPulsing ? 0 : 0.5)
                }
            }
            .onAppear {
                guard isActive else { return }
                withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: false)) {
                    isPulsing = true
                }
            }
    }
}

extension View {
    /// Apply pulse attention effect
    func pulseEffect(isActive: Bool = true, color: Color = .optaPurple) -> some View {
        modifier(PulseEffectModifier(isActive: isActive, color: color))
    }
}
```

### Step 3: Add Files to Xcode Project

Add:
- StateTransitions.swift to Design group
- CelebrationEffects.swift to Views/Effects group

## Files to Create/Modify

| File | Action |
|------|--------|
| `Opta Scan/Design/StateTransitions.swift` | Create |
| `Opta Scan/Views/Effects/CelebrationEffects.swift` | Create |
| `Opta Scan.xcodeproj/project.pbxproj` | Modify - add new files |

## Verification

1. Build succeeds
2. Loading dots animate with staggered timing
3. Success checkmark draws smoothly
4. Confetti burst creates celebration effect
5. Shimmer effect animates across content

## Dependencies

- Plan 14-01 complete
- SwiftUI animation and Path drawing
