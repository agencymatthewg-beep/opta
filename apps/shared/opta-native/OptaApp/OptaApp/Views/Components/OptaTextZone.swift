//
//  OptaTextZone.swift
//  OptaApp
//
//  Contextual messaging component with state-based styling.
//  Displays system status messages with animated values and trend indicators.
//

import SwiftUI

// MARK: - TextZoneState

/// Semantic states for text zone styling.
///
/// Each state has associated colors for text and glow effects.
enum TextZoneState {
    /// Default state - white/gray text, no glow
    case neutral
    /// Success state - green tint, green glow
    case positive
    /// Caution state - amber tint, amber glow
    case warning
    /// Problem state - red tint, red glow
    case error

    /// Foreground color for this state
    var foregroundColor: Color {
        switch self {
        case .neutral:
            return .white
        case .positive:
            return OptaTextStyle.glowGreen
        case .warning:
            return OptaTextStyle.glowAmber
        case .error:
            return OptaTextStyle.glowRed
        }
    }

    /// Glow color for this state
    var glowColor: Color {
        switch self {
        case .neutral:
            return .white.opacity(0.3)
        case .positive:
            return OptaTextStyle.glowGreen
        case .warning:
            return OptaTextStyle.glowAmber
        case .error:
            return OptaTextStyle.glowRed
        }
    }

    /// Border color for this state
    var borderColor: Color {
        switch self {
        case .neutral:
            return Color.white.opacity(0.1)
        case .positive:
            return OptaTextStyle.glowGreen.opacity(0.3)
        case .warning:
            return OptaTextStyle.glowAmber.opacity(0.3)
        case .error:
            return OptaTextStyle.glowRed.opacity(0.3)
        }
    }

    /// Glow intensity for this state
    var glowIntensity: Double {
        switch self {
        case .neutral:
            return 0.0
        case .positive, .warning, .error:
            return 0.4
        }
    }
}

// MARK: - Trend

/// Trend direction for value indicators.
enum Trend {
    case up
    case down
    case none

    /// SF Symbol for this trend
    var symbol: String {
        switch self {
        case .up:
            return "arrow.up"
        case .down:
            return "arrow.down"
        case .none:
            return ""
        }
    }

    /// Color for this trend direction
    var color: Color {
        switch self {
        case .up:
            return OptaTextStyle.glowGreen
        case .down:
            return OptaTextStyle.glowRed
        case .none:
            return .clear
        }
    }
}

// MARK: - TextZoneMessage

/// A message to display in the text zone.
struct TextZoneMessage: Equatable {
    /// The message text
    let text: String

    /// Semantic state for styling
    let state: TextZoneState

    /// Optional numeric value to animate
    let value: Double?

    /// Optional trend indicator
    let trend: Trend?

    /// Value suffix (e.g., "%", "MB")
    let valueSuffix: String

    /// Decimal places for value display
    let decimals: Int

    /// Creates a text zone message.
    /// - Parameters:
    ///   - text: The message text
    ///   - state: Semantic state for styling
    ///   - value: Optional numeric value to animate
    ///   - trend: Optional trend indicator
    ///   - valueSuffix: Suffix for value (default: "")
    ///   - decimals: Decimal places for value (default: 0)
    init(
        text: String,
        state: TextZoneState = .neutral,
        value: Double? = nil,
        trend: Trend? = nil,
        valueSuffix: String = "",
        decimals: Int = 0
    ) {
        self.text = text
        self.state = state
        self.value = value
        self.trend = trend
        self.valueSuffix = valueSuffix
        self.decimals = decimals
    }

    static func == (lhs: TextZoneMessage, rhs: TextZoneMessage) -> Bool {
        lhs.text == rhs.text &&
        lhs.value == rhs.value &&
        lhs.valueSuffix == rhs.valueSuffix
    }
}

// MARK: - CountUpText

/// Animates a numeric value from 0 to the target.
private struct CountUpText: View {

    // MARK: - Properties

    /// Target value to count up to
    let targetValue: Double

    /// Suffix to display after the value
    let suffix: String

    /// Number of decimal places
    let decimals: Int

    /// Text color
    let color: Color

    /// Current display value
    @State private var displayValue: Double = 0

    /// Animation timer
    @State private var timer: Timer?

    // MARK: - Constants

    private let animationDuration: Double = 1.0
    private let updateInterval: Double = 0.05 // 20 updates per second

    // MARK: - Body

    var body: some View {
        Text(formattedValue)
            .font(.system(size: 16, weight: .semibold, design: .monospaced))
            .foregroundStyle(color)
            .contentTransition(.numericText())
            .onAppear {
                startAnimation()
            }
            .onDisappear {
                timer?.invalidate()
            }
            .onChange(of: targetValue) { _, newValue in
                // Reset and animate to new value
                displayValue = 0
                startAnimation()
            }
    }

    // MARK: - Computed Properties

    private var formattedValue: String {
        let format = decimals > 0 ? "%.\(decimals)f" : "%.0f"
        return String(format: format, displayValue) + suffix
    }

    // MARK: - Methods

    private func startAnimation() {
        timer?.invalidate()

        let steps = Int(animationDuration / updateInterval)
        let increment = targetValue / Double(steps)
        var currentStep = 0

        timer = Timer.scheduledTimer(withTimeInterval: updateInterval, repeats: true) { timer in
            currentStep += 1

            if currentStep >= steps {
                displayValue = targetValue
                timer.invalidate()
            } else {
                // Ease-out interpolation
                let progress = Double(currentStep) / Double(steps)
                let easeOut = 1 - pow(1 - progress, 3)
                displayValue = targetValue * easeOut
            }
        }
    }
}

// MARK: - TrendIndicator

/// Shows a trend direction arrow with bounce animation.
private struct TrendIndicator: View {

    // MARK: - Properties

    /// The trend to display
    let trend: Trend

    /// Whether animation is complete
    @State private var animated: Bool = false

    // MARK: - Body

    var body: some View {
        if trend != .none {
            Image(systemName: trend.symbol)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(trend.color)
                .offset(y: animated ? 0 : -4)
                .opacity(animated ? 1 : 0)
                .onAppear {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) {
                        animated = true
                    }
                }
        }
    }
}

// MARK: - OptaTextZone

/// Contextual messaging component with state-based styling.
///
/// Displays system status messages with:
/// - Glass background with state-colored border
/// - Main text with glow effect
/// - Optional animated value display
/// - Optional trend indicator
///
/// # Usage
///
/// ```swift
/// // Simple neutral message
/// OptaTextZone(text: "System ready")
///
/// // Success message with value
/// OptaTextZone.success(text: "Optimization complete", value: 95, trend: .up)
///
/// // Warning message
/// OptaTextZone.warning(text: "High memory usage")
///
/// // Error message
/// OptaTextZone.error(text: "Critical temperature")
/// ```
struct OptaTextZone: View {

    // MARK: - Properties

    /// The message to display
    let message: TextZoneMessage

    /// Reduce motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // MARK: - Body

    var body: some View {
        HStack(spacing: 12) {
            // Main text
            Text(message.text)
                .font(OptaTextStyle.body)
                .foregroundStyle(message.state.foregroundColor)
                .textGlow(color: message.state.glowColor, intensity: message.state.glowIntensity)

            Spacer()

            // Value and trend (if present)
            if let value = message.value {
                HStack(spacing: 6) {
                    if reduceMotion {
                        // Static value for reduced motion
                        Text(formattedValue(value))
                            .font(.system(size: 16, weight: .semibold, design: .monospaced))
                            .foregroundStyle(message.state.foregroundColor)
                    } else {
                        // Animated count-up
                        CountUpText(
                            targetValue: value,
                            suffix: message.valueSuffix,
                            decimals: message.decimals,
                            color: message.state.foregroundColor
                        )
                    }

                    // Trend indicator
                    if let trend = message.trend, trend != .none {
                        TrendIndicator(trend: trend)
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(glassBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(message.state.borderColor, lineWidth: 1)
        )
        .transition(.opacity)
    }

    // MARK: - Subviews

    private var glassBackground: some View {
        ZStack {
            // Base dark color
            Color(hex: "09090B")

            // Glass effect
            Rectangle()
                .fill(.ultraThinMaterial)
                .opacity(0.5)
        }
    }

    // MARK: - Helpers

    private func formattedValue(_ value: Double) -> String {
        let format = message.decimals > 0 ? "%.\(message.decimals)f" : "%.0f"
        return String(format: format, value) + message.valueSuffix
    }
}

// MARK: - Convenience Initializers

extension OptaTextZone {
    /// Creates a text zone with a simple neutral message.
    /// - Parameter text: The message text
    init(text: String) {
        self.message = TextZoneMessage(text: text, state: .neutral)
    }

    /// Creates a success/positive text zone.
    /// - Parameters:
    ///   - text: The message text
    ///   - value: Optional numeric value
    ///   - trend: Optional trend indicator
    ///   - valueSuffix: Suffix for value (default: "%")
    static func success(
        text: String,
        value: Double? = nil,
        trend: Trend? = nil,
        valueSuffix: String = "%"
    ) -> OptaTextZone {
        OptaTextZone(message: TextZoneMessage(
            text: text,
            state: .positive,
            value: value,
            trend: trend,
            valueSuffix: valueSuffix
        ))
    }

    /// Creates a warning text zone.
    /// - Parameters:
    ///   - text: The message text
    ///   - value: Optional numeric value
    ///   - valueSuffix: Suffix for value (default: "%")
    static func warning(
        text: String,
        value: Double? = nil,
        valueSuffix: String = "%"
    ) -> OptaTextZone {
        OptaTextZone(message: TextZoneMessage(
            text: text,
            state: .warning,
            value: value,
            valueSuffix: valueSuffix
        ))
    }

    /// Creates an error text zone.
    /// - Parameters:
    ///   - text: The message text
    ///   - value: Optional numeric value
    ///   - valueSuffix: Suffix for value (default: "%")
    static func error(
        text: String,
        value: Double? = nil,
        valueSuffix: String = "%"
    ) -> OptaTextZone {
        OptaTextZone(message: TextZoneMessage(
            text: text,
            state: .error,
            value: value,
            valueSuffix: valueSuffix
        ))
    }
}

// MARK: - Preview

#if DEBUG
struct OptaTextZone_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            // All state types
            VStack(spacing: 12) {
                Text("State Types")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))

                OptaTextZone(text: "System ready")

                OptaTextZone.success(text: "Optimization complete", value: 95, trend: .up)

                OptaTextZone.warning(text: "High memory usage", value: 87)

                OptaTextZone.error(text: "Critical temperature")
            }

            Divider()
                .background(Color.white.opacity(0.2))

            // Value variations
            VStack(spacing: 12) {
                Text("Value Variations")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))

                OptaTextZone.success(text: "CPU Usage", value: 42, valueSuffix: "%")

                OptaTextZone.success(text: "Memory freed", value: 1.5, valueSuffix: "GB")

                OptaTextZone.success(text: "FPS improved", value: 60, trend: .up, valueSuffix: " FPS")
            }

            Divider()
                .background(Color.white.opacity(0.2))

            // Trend indicators
            VStack(spacing: 12) {
                Text("Trend Indicators")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))

                HStack(spacing: 16) {
                    OptaTextZone.success(text: "Performance", value: 85, trend: .up)
                    OptaTextZone.warning(text: "High thermals", value: 78)
                }
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: "09090B"))
        .preferredColorScheme(.dark)
    }
}
#endif
