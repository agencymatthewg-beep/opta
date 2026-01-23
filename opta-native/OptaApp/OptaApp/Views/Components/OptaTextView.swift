//
//  OptaTextView.swift
//  OptaApp
//
//  The main branded "OPTA" text display component with ring energy integration.
//  Features character-by-character animation and energy-reactive glow effects.
//

import SwiftUI

// MARK: - OptaTextDisplayStyle

/// Display styles for the OptaTextView component.
///
/// Each style is optimized for its context:
/// - `hero`: Large dashboard display with full animation
/// - `ambient`: Sidebar/secondary display with subtle effects
/// - `compact`: Menu bar/minimal display, static
enum OptaTextDisplayStyle {
    /// Large dashboard display (32pt, full animation)
    case hero
    /// Sidebar/secondary display (18pt, subtle)
    case ambient
    /// Menu bar/minimal display (12pt, no animation)
    case compact

    /// Font for this style
    var font: Font {
        switch self {
        case .hero:
            return .system(size: 32, weight: .bold, design: .default)
        case .ambient:
            return .system(size: 18, weight: .semibold, design: .default)
        case .compact:
            return .system(size: 12, weight: .medium, design: .default)
        }
    }

    /// Letter spacing for this style
    var tracking: CGFloat {
        switch self {
        case .hero:
            return 4
        case .ambient:
            return 2
        case .compact:
            return 1
        }
    }

    /// Whether to animate on appear
    var animatesOnAppear: Bool {
        switch self {
        case .hero:
            return true
        case .ambient:
            return true
        case .compact:
            return false
        }
    }

    /// Whether to use full ignition animation
    var fullIgnition: Bool {
        switch self {
        case .hero:
            return true
        case .ambient:
            return false
        case .compact:
            return false
        }
    }
}

// MARK: - OptaTextView

/// The main branded "OPTA" text display with energy-reactive glow.
///
/// The component displays the "OPTA" brand name with:
/// - Character-by-character ignition animation (hero style)
/// - Energy-level-based glow intensity
/// - Smooth transitions when energy level changes
///
/// # Energy Level Mapping
///
/// - `< 0.2`: Dormant violet with minimal glow (0.2 intensity)
/// - `0.2-0.7`: Active violet with medium glow (0.5 intensity)
/// - `> 0.7`: Glow purple with strong glow (0.8 intensity)
///
/// # Usage
///
/// ```swift
/// // Hero style on dashboard
/// OptaTextView(style: .hero, energyLevel: ringEnergy)
///
/// // With binding to ring state
/// OptaTextView(style: .hero, ringEnergy: $viewModel.ring.energy)
///
/// // Ambient in sidebar
/// OptaTextView(style: .ambient, energyLevel: 0.5)
///
/// // Compact in menu bar
/// OptaTextView(style: .compact)
/// ```
struct OptaTextView: View {

    // MARK: - Properties

    /// Display style for the text
    var style: OptaTextDisplayStyle = .hero

    /// Current energy level (0.0-1.0)
    var energyLevel: Double = 0.5

    /// Optional binding to ring energy for reactive updates
    var ringEnergy: Binding<Float>? = nil

    /// Reduce motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Animated energy for smooth transitions
    @State private var animatedEnergy: Double = 0.5

    // MARK: - Computed Properties

    /// The effective energy level (from binding or static value)
    private var effectiveEnergy: Double {
        if let binding = ringEnergy {
            return Double(binding.wrappedValue)
        }
        return energyLevel
    }

    /// Text color based on energy level
    private var textColor: Color {
        if effectiveEnergy < 0.2 {
            return OptaTextStyle.dormantViolet
        } else if effectiveEnergy <= 0.7 {
            return OptaTextStyle.activeViolet
        } else {
            return OptaTextStyle.glowPurple
        }
    }

    /// Glow color based on energy level
    private var glowColor: Color {
        if effectiveEnergy < 0.2 {
            return OptaTextStyle.dormantViolet
        } else if effectiveEnergy <= 0.7 {
            return OptaTextStyle.activeViolet
        } else {
            return OptaTextStyle.glowPurple
        }
    }

    /// Glow intensity based on energy level
    private var glowIntensity: Double {
        if effectiveEnergy < 0.2 {
            return 0.2
        } else if effectiveEnergy <= 0.7 {
            return 0.5
        } else {
            return 0.8
        }
    }

    // MARK: - Body

    var body: some View {
        Group {
            switch style {
            case .hero:
                heroTextView
            case .ambient:
                ambientTextView
            case .compact:
                compactTextView
            }
        }
        .onChange(of: effectiveEnergy) { _, newValue in
            withAnimation(.easeInOut(duration: 0.3)) {
                animatedEnergy = newValue
            }
        }
        .onAppear {
            animatedEnergy = effectiveEnergy
        }
    }

    // MARK: - Style Views

    /// Hero style: full ignition animation
    private var heroTextView: some View {
        AnimatedTextView(
            text: "OPTA",
            style: style.font,
            color: textColor,
            glowColor: glowColor,
            glowIntensity: glowIntensity
        )
        .tracking(style.tracking)
        .autoAnimate(style.animatesOnAppear && !reduceMotion)
    }

    /// Ambient style: subtle fade-in
    private var ambientTextView: some View {
        AnimatedTextView(
            text: "OPTA",
            style: style.font,
            color: textColor,
            glowColor: glowColor,
            glowIntensity: glowIntensity * 0.6
        )
        .tracking(style.tracking)
        .autoAnimate(style.animatesOnAppear && !reduceMotion)
        .springConfig(.gentle)
    }

    /// Compact style: static, no animation
    private var compactTextView: some View {
        Text("OPTA")
            .font(style.font)
            .tracking(style.tracking)
            .foregroundStyle(textColor)
            .textGlow(color: glowColor, intensity: glowIntensity * 0.4)
    }
}

// MARK: - AnimatedTextView Extensions

extension AnimatedTextView {
    /// Sets whether to auto-animate on appear
    func autoAnimate(_ value: Bool) -> AnimatedTextView {
        var view = self
        view.autoAnimate = value
        return view
    }

    /// Sets the spring configuration
    func springConfig(_ config: SpringConfiguration) -> AnimatedTextView {
        var view = self
        view.springConfig = config
        return view
    }

    /// Sets letter tracking
    func tracking(_ value: CGFloat) -> some View {
        self.kerning(value)
    }
}

// MARK: - Convenience Initializers

extension OptaTextView {
    /// Creates an OptaTextView with optional ring energy binding.
    ///
    /// When bound, glow intensity animates with ring state changes.
    ///
    /// - Parameters:
    ///   - style: Display style
    ///   - ringEnergy: Binding to ring energy value
    init(style: OptaTextDisplayStyle = .hero, ringEnergy: Binding<Float>) {
        self.style = style
        self.energyLevel = Double(ringEnergy.wrappedValue)
        self.ringEnergy = ringEnergy
    }
}

// MARK: - Preview

#if DEBUG
struct OptaTextView_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 48) {
            // All three styles
            VStack(spacing: 24) {
                Text("Hero Style")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))
                OptaTextView(style: .hero, energyLevel: 0.8)

                Text("Ambient Style")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))
                OptaTextView(style: .ambient, energyLevel: 0.5)

                Text("Compact Style")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))
                OptaTextView(style: .compact, energyLevel: 0.3)
            }

            Divider()
                .background(Color.white.opacity(0.2))

            // Energy level variations
            VStack(spacing: 16) {
                Text("Energy Levels")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))

                HStack(spacing: 32) {
                    VStack {
                        OptaTextView(style: .hero, energyLevel: 0.1)
                        Text("0.1 (Dormant)")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.4))
                    }

                    VStack {
                        OptaTextView(style: .hero, energyLevel: 0.5)
                        Text("0.5 (Active)")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.4))
                    }

                    VStack {
                        OptaTextView(style: .hero, energyLevel: 0.9)
                        Text("0.9 (High)")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.4))
                    }
                }
            }
        }
        .padding(48)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: "09090B"))
        .preferredColorScheme(.dark)
    }
}
#endif
