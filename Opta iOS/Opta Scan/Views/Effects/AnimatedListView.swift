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
