//
//  AnimationSystem.swift
//  OptaPlusMacOS
//
//  Centralized animation system with configurable intensity levels.
//  Controls all motion: micro-animations, ambient effects, transitions.
//  Users can dial from minimal (accessibility) to rich (full cinematic).
//

import SwiftUI
import Combine
import OptaMolt

// MARK: - Animation Level

/// User-configurable animation intensity.
enum AnimationLevel: String, CaseIterable, Codable {
    /// Accessibility-friendly — no ambient motion, instant transitions
    case minimal
    /// Clean defaults — smooth transitions, no ambient effects
    case standard
    /// Full cinematic — breathing, floating, glow, particles
    case rich
    /// Maximum expression — all effects at full intensity
    case cinematic
    
    var label: String {
        switch self {
        case .minimal: return "Minimal"
        case .standard: return "Standard"
        case .rich: return "Rich"
        case .cinematic: return "Cinematic"
        }
    }
    
    var icon: String {
        switch self {
        case .minimal: return "tortoise"
        case .standard: return "hare"
        case .rich: return "sparkles"
        case .cinematic: return "wand.and.stars"
        }
    }
    
    var description: String {
        switch self {
        case .minimal: return "No ambient motion, instant transitions"
        case .standard: return "Smooth transitions, clean feel"
        case .rich: return "Breathing, floating, glow effects"
        case .cinematic: return "Full cinematic with particles"
        }
    }
    
    // MARK: - Animation Parameters
    
    /// Whether ambient breathing/floating effects are enabled
    var ambientEnabled: Bool { self >= .rich }
    
    /// Whether particle/background effects are enabled
    var particlesEnabled: Bool { self == .cinematic }
    
    /// Whether glow effects are enabled
    var glowEnabled: Bool { self >= .rich }
    
    /// Whether micro-interactions (hover, press) are animated
    var microEnabled: Bool { self >= .standard }
    
    /// Transition spring response (faster = snappier)
    var springResponse: Double {
        switch self {
        case .minimal: return 0.01
        case .standard: return 0.3
        case .rich: return 0.4
        case .cinematic: return 0.5
        }
    }
    
    /// Transition spring damping
    var springDamping: Double {
        switch self {
        case .minimal: return 1.0
        case .standard: return 0.85
        case .rich: return 0.75
        case .cinematic: return 0.7
        }
    }
    
    /// Ambient breathing amplitude (0 = none)
    var breatheAmplitude: CGFloat {
        switch self {
        case .minimal: return 0
        case .standard: return 0
        case .rich: return 0.5
        case .cinematic: return 1.0
        }
    }
    
    /// Glow intensity multiplier (0 = no glow)
    var glowMultiplier: CGFloat {
        switch self {
        case .minimal: return 0
        case .standard: return 0.3
        case .rich: return 0.7
        case .cinematic: return 1.0
        }
    }
    
    /// Message entrance stagger delay
    var messageStagger: Double {
        switch self {
        case .minimal: return 0
        case .standard: return 0.02
        case .rich: return 0.04
        case .cinematic: return 0.06
        }
    }
    
    /// Standard spring animation for this level
    var spring: Animation {
        if self == .minimal { return .linear(duration: 0.01) }
        return .spring(response: springResponse, dampingFraction: springDamping)
    }
    
    /// Gentle spring for larger transitions
    var gentleSpring: Animation {
        if self == .minimal { return .linear(duration: 0.01) }
        return .spring(response: springResponse * 1.3, dampingFraction: springDamping * 1.05)
    }
}

extension AnimationLevel: Comparable {
    static func < (lhs: AnimationLevel, rhs: AnimationLevel) -> Bool {
        let order: [AnimationLevel] = [.minimal, .standard, .rich, .cinematic]
        let li = order.firstIndex(of: lhs) ?? 0
        let ri = order.firstIndex(of: rhs) ?? 0
        return li < ri
    }
}

// MARK: - Animation Preferences (Observable)

@MainActor
final class AnimationPreferences: ObservableObject {
    @Published var level: AnimationLevel {
        didSet { UserDefaults.standard.set(level.rawValue, forKey: "optaplus.animationLevel") }
    }
    
    static let shared = AnimationPreferences()
    
    private init() {
        let saved = UserDefaults.standard.string(forKey: "optaplus.animationLevel") ?? "rich"
        self.level = AnimationLevel(rawValue: saved) ?? .rich
    }
}

// MARK: - Environment Key

private struct AnimationLevelKey: EnvironmentKey {
    static let defaultValue: AnimationLevel = .rich
}

extension EnvironmentValues {
    var animationLevel: AnimationLevel {
        get { self[AnimationLevelKey.self] }
        set { self[AnimationLevelKey.self] = newValue }
    }
}

// MARK: - Ambient Background (moved to AmbientBackground.swift)

// MARK: - Shimmer Loading Effect

struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0
    @Environment(\.animationLevel) var animLevel
    
    func body(content: Content) -> some View {
        if animLevel.microEnabled {
            content
                .overlay(
                    LinearGradient(
                        colors: [.clear, Color.optaGlassHighlight, .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .offset(x: phase * 400 - 200)
                    .mask(content)
                )
                .onAppear {
                    withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                        phase = 1
                    }
                }
        } else {
            content
        }
    }
}

extension View {
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}

// MARK: - Hover Scale Modifier

struct HoverScaleModifier: ViewModifier {
    let scale: CGFloat
    @State private var isHovered = false
    @Environment(\.animationLevel) var animLevel
    
    func body(content: Content) -> some View {
        content
            .scaleEffect(isHovered && animLevel.microEnabled ? scale : 1.0)
            .animation(animLevel.spring, value: isHovered)
            .onHover { isHovered = $0 }
    }
}

extension View {
    func hoverScale(_ scale: CGFloat = 1.03) -> some View {
        modifier(HoverScaleModifier(scale: scale))
    }
}

// MARK: - Press Effect Modifier

struct PressEffectModifier: ViewModifier {
    @State private var isPressed = false
    @Environment(\.animationLevel) var animLevel
    
    func body(content: Content) -> some View {
        content
            .scaleEffect(isPressed && animLevel.microEnabled ? 0.96 : 1.0)
            .opacity(isPressed && animLevel.microEnabled ? 0.9 : 1.0)
            .animation(.spring(response: 0.15, dampingFraction: 0.6), value: isPressed)
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in isPressed = true }
                    .onEnded { _ in isPressed = false }
            )
    }
}

extension View {
    func pressEffect() -> some View {
        modifier(PressEffectModifier())
    }
}

// MARK: - Breathing Modifier

struct BreathingModifier: ViewModifier {
    let intensity: CGFloat
    let duration: Double
    @State private var phase: CGFloat = 0
    @Environment(\.animationLevel) var animLevel
    
    func body(content: Content) -> some View {
        let amp: CGFloat = intensity * animLevel.breatheAmplitude
        let scaleVal: CGFloat = 1 + 0.02 * amp * phase
        let opacityVal: Double = Double(1 - 0.02 * amp * (1 - phase))
        content
            .scaleEffect(scaleVal)
            .opacity(opacityVal)
            .onAppear {
                if animLevel.ambientEnabled {
                    withAnimation(.spring(response: 1.2, dampingFraction: 0.5).repeatForever(autoreverses: true)) {
                        phase = 1
                    }
                }
            }
    }
}

extension View {
    func breathing(intensity: CGFloat = 1, duration: Double = 3) -> some View {
        modifier(BreathingModifier(intensity: intensity, duration: duration))
    }
}

// MARK: - Animation Level Picker (for Settings)

struct AnimationLevelPicker: View {
    @ObservedObject var prefs: AnimationPreferences
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Animation Intensity")
                .font(.sora(13, weight: .semibold))
                .foregroundColor(.optaTextPrimary)
            
            ForEach(AnimationLevel.allCases, id: \.self) { level in
                AnimationLevelOption(
                    level: level,
                    isSelected: prefs.level == level,
                    onTap: { prefs.level = level }
                )
            }
        }
    }
}

struct AnimationLevelOption: View {
    let level: AnimationLevel
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                Image(systemName: level.icon)
                    .font(.system(size: 14))
                    .foregroundColor(isSelected ? .optaPrimary : .optaTextSecondary)
                    .frame(width: 20)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(level.label)
                        .font(.sora(13, weight: .medium))
                        .foregroundColor(isSelected ? .optaTextPrimary : .optaTextSecondary)
                    
                    Text(level.description)
                        .font(.sora(10))
                        .foregroundColor(.optaTextMuted)
                }
                
                Spacer()
                
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.optaPrimary)
                }
            }
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isSelected ? Color.optaPrimary.opacity(0.1) : Color.optaElevated.opacity(0.5))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? Color.optaPrimary.opacity(0.3) : Color.optaBorder.opacity(0.1), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
