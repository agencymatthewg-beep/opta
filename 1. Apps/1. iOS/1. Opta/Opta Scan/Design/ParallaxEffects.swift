//
//  ParallaxEffects.swift
//  Opta Scan
//
//  Parallax scrolling and depth effects
//  Part of Phase 13: 3D Transforms
//

import SwiftUI

// MARK: - Parallax Configuration

/// Configuration for parallax layers
struct ParallaxConfig {
    let speedMultiplier: CGFloat
    let maxOffset: CGFloat
    let direction: ParallaxDirection

    enum ParallaxDirection {
        case horizontal
        case vertical
        case both
    }

    static let foreground = ParallaxConfig(
        speedMultiplier: 1.2,
        maxOffset: 50,
        direction: .vertical
    )

    static let background = ParallaxConfig(
        speedMultiplier: 0.5,
        maxOffset: 100,
        direction: .vertical
    )

    static let subtle = ParallaxConfig(
        speedMultiplier: 0.8,
        maxOffset: 30,
        direction: .vertical
    )
}

// MARK: - Parallax State

/// Observable state for parallax tracking
@Observable
class ParallaxState {
    var scrollOffset: CGFloat = 0
    var viewportHeight: CGFloat = 0

    /// Calculate parallax offset for a given config
    func offset(for config: ParallaxConfig) -> CGSize {
        let normalizedScroll = scrollOffset / max(viewportHeight, 1)
        let parallaxOffset = normalizedScroll * config.maxOffset * config.speedMultiplier

        switch config.direction {
        case .horizontal:
            return CGSize(width: parallaxOffset, height: 0)
        case .vertical:
            return CGSize(width: 0, height: parallaxOffset)
        case .both:
            return CGSize(width: parallaxOffset * 0.5, height: parallaxOffset)
        }
    }
}

// MARK: - Parallax Modifier

/// Apply parallax effect based on scroll
struct ParallaxModifier: ViewModifier {
    @Bindable var state: ParallaxState
    let config: ParallaxConfig

    func body(content: Content) -> some View {
        content
            .offset(state.offset(for: config))
    }
}

extension View {
    /// Apply parallax scroll effect
    func parallax(_ state: ParallaxState, config: ParallaxConfig = .subtle) -> some View {
        modifier(ParallaxModifier(state: state, config: config))
    }

    /// Track scroll for parallax
    func trackParallax(_ state: ParallaxState) -> some View {
        self.background(
            GeometryReader { geometry in
                Color.clear
                    .preference(
                        key: ParallaxScrollPreferenceKey.self,
                        value: geometry.frame(in: .global).minY
                    )
                    .onAppear {
                        state.viewportHeight = geometry.size.height
                    }
            }
        )
        .onPreferenceChange(ParallaxScrollPreferenceKey.self) { offset in
            state.scrollOffset = offset
        }
    }
}

struct ParallaxScrollPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

// MARK: - Depth Shadow

/// Dynamic shadow based on elevation/depth
struct DepthShadowConfig {
    let baseRadius: CGFloat
    let maxRadius: CGFloat
    let baseOpacity: Double
    let color: Color
    let yOffset: CGFloat

    static let subtle = DepthShadowConfig(
        baseRadius: 4,
        maxRadius: 20,
        baseOpacity: 0.15,
        color: .black,
        yOffset: 2
    )

    static let elevated = DepthShadowConfig(
        baseRadius: 8,
        maxRadius: 40,
        baseOpacity: 0.25,
        color: .black,
        yOffset: 4
    )

    static let floating = DepthShadowConfig(
        baseRadius: 15,
        maxRadius: 60,
        baseOpacity: 0.3,
        color: .black,
        yOffset: 8
    )
}

/// Modifier for depth-based shadows
struct DepthShadowModifier: ViewModifier {
    let depth: CGFloat // 0 to 1
    let config: DepthShadowConfig

    func body(content: Content) -> some View {
        let radius = config.baseRadius + (config.maxRadius - config.baseRadius) * depth
        let opacity = config.baseOpacity * (0.5 + depth * 0.5)
        let yOffset = config.yOffset * (1 + depth)

        content
            .shadow(
                color: config.color.opacity(opacity),
                radius: radius,
                x: 0,
                y: yOffset
            )
    }
}

extension View {
    /// Apply depth-based shadow
    func depthShadow(_ depth: CGFloat, config: DepthShadowConfig = .subtle) -> some View {
        modifier(DepthShadowModifier(depth: min(max(depth, 0), 1), config: config))
    }
}

// MARK: - Layer Separation

/// Configuration for layer separation effect
struct LayerSeparationConfig {
    let maxSeparation: CGFloat
    let perspective: CGFloat
    let scaleRange: ClosedRange<CGFloat>

    static let subtle = LayerSeparationConfig(
        maxSeparation: 20,
        perspective: 0.001,
        scaleRange: 0.95...1.0
    )

    static let dramatic = LayerSeparationConfig(
        maxSeparation: 50,
        perspective: 0.002,
        scaleRange: 0.9...1.0
    )
}

/// Apply layer separation based on depth index
struct LayerSeparationModifier: ViewModifier {
    let layerIndex: Int
    let totalLayers: Int
    let isExpanded: Bool
    let config: LayerSeparationConfig

    func body(content: Content) -> some View {
        let normalizedDepth = CGFloat(layerIndex) / CGFloat(max(totalLayers - 1, 1))
        let separation = isExpanded ? config.maxSeparation * normalizedDepth : 0
        let scale = isExpanded
            ? config.scaleRange.lowerBound + (config.scaleRange.upperBound - config.scaleRange.lowerBound) * (1 - normalizedDepth)
            : 1.0

        content
            .scaleEffect(scale)
            .offset(y: separation)
            .zIndex(Double(totalLayers - layerIndex))
    }
}

extension View {
    /// Apply layer separation effect
    func layerSeparation(
        index: Int,
        total: Int,
        isExpanded: Bool,
        config: LayerSeparationConfig = .subtle
    ) -> some View {
        modifier(LayerSeparationModifier(
            layerIndex: index,
            totalLayers: total,
            isExpanded: isExpanded,
            config: config
        ))
    }
}

// MARK: - Scroll Depth Transition

/// Modifier for scroll-driven depth effect
struct ScrollDepthModifier: ViewModifier {
    let scrollOffset: CGFloat
    let threshold: CGFloat
    let maxDepth: CGFloat

    func body(content: Content) -> some View {
        let normalizedScroll = min(max(-scrollOffset / threshold, 0), 1)
        let depth = normalizedScroll * maxDepth

        content
            .scaleEffect(1 - depth * 0.1)
            .opacity(Double(1 - depth * 0.3))
            .blur(radius: depth * 5)
    }
}

extension View {
    /// Apply scroll-driven depth transition
    func scrollDepth(offset: CGFloat, threshold: CGFloat = 100, maxDepth: CGFloat = 1) -> some View {
        modifier(ScrollDepthModifier(scrollOffset: offset, threshold: threshold, maxDepth: maxDepth))
    }
}
