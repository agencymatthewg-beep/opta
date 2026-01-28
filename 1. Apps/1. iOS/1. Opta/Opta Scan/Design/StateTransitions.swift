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
