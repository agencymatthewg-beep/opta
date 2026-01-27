//
//  QualityAdaptive.swift
//  Opta Scan
//
//  Quality-adaptive view modifiers and components
//  Part of Phase 15: Performance Tuning
//

import SwiftUI

// MARK: - Quality-Adaptive Blur

/// Blur that adapts to quality tier
struct AdaptiveBlurModifier: ViewModifier {
    @Environment(\.performanceManager) var performance
    let baseRadius: CGFloat

    func body(content: Content) -> some View {
        let radius = baseRadius * (CGFloat(performance.currentQuality.rawValue + 1) / 4.0)
        content
            .blur(radius: radius)
    }
}

extension View {
    /// Apply quality-adaptive blur
    func adaptiveBlur(radius: CGFloat = 10) -> some View {
        modifier(AdaptiveBlurModifier(baseRadius: radius))
    }
}

// MARK: - Quality-Adaptive Shadow

/// Shadow that adapts to quality tier
struct AdaptiveShadowModifier: ViewModifier {
    @Environment(\.performanceManager) var performance
    let color: Color
    let baseRadius: CGFloat

    func body(content: Content) -> some View {
        let layers = performance.currentQuality.shadowLayers
        let radius = baseRadius * (CGFloat(performance.currentQuality.rawValue + 1) / 4.0)

        content
            .background {
                ForEach(0..<layers, id: \.self) { layer in
                    content
                        .blur(radius: radius * CGFloat(layer + 1) / CGFloat(layers))
                        .opacity(0.3 / Double(layer + 1))
                }
            }
    }
}

extension View {
    /// Apply quality-adaptive shadow
    func adaptiveShadow(color: Color = .black, radius: CGFloat = 10) -> some View {
        modifier(AdaptiveShadowModifier(color: color, baseRadius: radius))
    }
}

// MARK: - Quality-Adaptive Animation

/// Animation that respects quality tier and reduce motion
struct AdaptiveAnimationModifier: ViewModifier {
    @Environment(\.performanceManager) var performance
    let animation: Animation

    func body(content: Content) -> some View {
        content
            .animation(
                performance.currentQuality.animationEnabled ? animation : .none,
                value: performance.currentQuality
            )
    }
}

extension View {
    /// Apply quality-adaptive animation
    func adaptiveAnimation(_ animation: Animation = .optaSpring) -> some View {
        modifier(AdaptiveAnimationModifier(animation: animation))
    }
}

// MARK: - Conditional Effect

/// Apply effect only if quality allows
struct ConditionalEffectModifier<Effect: ViewModifier>: ViewModifier {
    @Environment(\.performanceManager) var performance
    let minimumQuality: QualityTier
    let effect: Effect

    func body(content: Content) -> some View {
        if performance.currentQuality >= minimumQuality {
            content.modifier(effect)
        } else {
            content
        }
    }
}

extension View {
    /// Apply effect only if quality tier is met
    func conditionalEffect<Effect: ViewModifier>(
        _ effect: Effect,
        minimumQuality: QualityTier
    ) -> some View {
        modifier(ConditionalEffectModifier(minimumQuality: minimumQuality, effect: effect))
    }
}

// MARK: - Performance Debug Overlay

/// Debug overlay showing current performance state
struct PerformanceDebugView: View {
    @Environment(\.performanceManager) var performance

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Quality: \(String(describing: performance.currentQuality))")
            Text("Thermal: \(String(describing: performance.thermalLevel))")
            Text("Low Power: \(performance.isLowPowerMode ? "Yes" : "No")")
            Text("Battery: \(Int(performance.batteryLevel * 100))%")
            Text("Charging: \(performance.isCharging ? "Yes" : "No")")
            Text("Target FPS: \(performance.recommendedFrameRate)")
        }
        .font(.caption.monospaced())
        .padding(8)
        .background(.ultraThinMaterial)
        .cornerRadius(8)
    }
}
