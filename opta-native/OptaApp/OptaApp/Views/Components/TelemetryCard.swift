//
//  TelemetryCard.swift
//  OptaApp
//
//  Reusable telemetry card component for CPU, Memory, GPU displays.
//  Features obsidian panel background, branch-energy violet meter,
//  and animated value transitions.
//

import SwiftUI

// MARK: - TelemetryCard

/// A reusable card displaying telemetry metrics with obsidian styling.
///
/// Features:
/// - Title with SF Symbol icon and branch-energy status indicator
/// - Large animated percentage value
/// - Branch-energy-inspired horizontal meter bar
/// - Mini sparkline showing history below the meter
/// - Obsidian background with violet border glow
/// - OLED-optimized deep black base
///
/// # Usage
///
/// ```swift
/// TelemetryCard(
///     title: "CPU",
///     value: coreManager.viewModel.cpuUsage,
///     icon: "cpu",
///     history: coreManager.viewModel.cpuHistory
/// )
/// ```
struct TelemetryCard: View {

    // MARK: - Properties

    /// Title displayed at the top
    let title: String

    /// Current value (0-100 percentage)
    let value: Float

    /// SF Symbol name for the icon
    let icon: String

    /// Accent color for the card (unused in obsidian mode; kept for API compat)
    var color: Color = Color(hex: "8B5CF6")

    /// History of values for sparkline (last 30 values)
    let history: [Float]

    /// Whether to reduce motion for accessibility
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Color temperature state from environment
    @Environment(\.colorTemperature) private var colorTemp

    /// Animation state for the value
    @State private var animatedValue: Float = 0

    // MARK: - Constants

    /// Obsidian background base color
    private static let obsidianBase = Color(hex: "0A0A0F")

    // MARK: - Computed Properties

    /// Normalized energy level [0, 1] derived from value
    private var energyLevel: Float {
        max(0, min(1, value / 100.0))
    }

    /// Status color based on usage thresholds
    private var statusColor: Color {
        if value < 60 {
            return .green
        } else if value < 85 {
            return .yellow
        } else {
            return .red
        }
    }

    /// Branch indicator energy based on status tier
    private var indicatorEnergy: Float {
        if value < 60 {
            return 0.3
        } else if value < 85 {
            return 0.6
        } else {
            return 1.0
        }
    }

    /// Border glow opacity based on energy
    private var borderGlowOpacity: Double {
        Double(energyLevel) * 0.5
    }

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header: Icon + Title + Status Indicator
            headerRow

            // Value display
            valueDisplay

            // Branch-energy meter bar
            branchMeterBar
                .frame(height: 32)

            // Mini sparkline (compact, below meter)
            SparklineView(data: history, color: colorTemp.violetColor)
                .frame(height: 20)
        }
        .padding(16)
        .background(obsidianBackground)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(
                    colorTemp.tintColor.opacity(borderGlowOpacity),
                    lineWidth: 1.5
                )
        )
        .shadow(color: colorTemp.tintColor.opacity(Double(energyLevel) * colorTemp.glowOpacity * 0.25), radius: 12, x: 0, y: 4)
        .organicPulse(id: title, intensity: .subtle)
        .onChange(of: value) { _, newValue in
            if reduceMotion {
                animatedValue = newValue
            } else {
                withAnimation(OrganicMotion.organicSpring(for: title, intensity: .medium)) {
                    animatedValue = newValue
                }
            }
        }
        .onAppear {
            animatedValue = value
        }
    }

    // MARK: - Subviews

    /// Header row with icon, title, and branch-energy status indicator
    private var headerRow: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(colorTemp.violetColor.opacity(Double(0.6 + energyLevel * 0.4)))

            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white.opacity(0.9))

            Spacer()

            // Branch-energy status indicator (SwiftUI approximation of BranchIndicator)
            branchStatusIndicator
        }
    }

    /// Value display with large percentage number
    private var valueDisplay: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text("\(Int(animatedValue))")
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .contentTransition(.numericText())
                .animation(reduceMotion ? .none : .spring(response: 0.3, dampingFraction: 0.7), value: animatedValue)

            Text("%")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(.white.opacity(0.6))
        }
    }

    /// Obsidian background with depth gradient (no glass/ultraThinMaterial)
    private var obsidianBackground: some View {
        ZStack {
            // Deep obsidian base (OLED optimized)
            Self.obsidianBase

            // Subtle depth gradient from top-left to bottom-right
            LinearGradient(
                colors: [
                    colorTemp.tintColor.opacity(Double(energyLevel) * colorTemp.ambientBrightness),
                    Color.clear
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    /// Branch-energy status indicator (SwiftUI approximation)
    private var branchStatusIndicator: some View {
        ZStack {
            // Outer glow ring
            Circle()
                .stroke(
                    colorTemp.violetColor.opacity(Double(indicatorEnergy) * 0.6),
                    lineWidth: 1.5
                )
                .frame(width: 12, height: 12)

            // Inner core
            Circle()
                .fill(statusColor)
                .frame(width: 6, height: 6)
                .shadow(color: statusColor.opacity(0.6), radius: 3, x: 0, y: 0)
        }
    }

    /// Branch-energy meter bar (SwiftUI approximation of BranchMeter)
    private var branchMeterBar: some View {
        GeometryReader { geometry in
            let fillWidth = geometry.size.width * CGFloat(max(0, min(1, animatedValue / 100.0)))

            ZStack(alignment: .leading) {
                // Track background
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(Color.white.opacity(0.06))

                // Fill bar with branch-energy violet gradient
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                colorTemp.violetColor.opacity(0.7),
                                colorTemp.violetColor.opacity(Double(energyLevel) * 0.9 + 0.1)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: fillWidth)
                    .animation(reduceMotion ? .none : .spring(response: 0.4, dampingFraction: 0.8), value: animatedValue)

                // Branch vein overlay (subtle texture lines along the fill)
                if energyLevel > 0.3 {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(Double(energyLevel) * 0.08),
                                    Color.clear,
                                    Color.white.opacity(Double(energyLevel) * 0.05),
                                    Color.clear
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: fillWidth)
                        .animation(reduceMotion ? .none : .spring(response: 0.4, dampingFraction: 0.8), value: animatedValue)
                }
            }
        }
    }
}

// MARK: - Preview

#if DEBUG
struct TelemetryCard_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            TelemetryCard(
                title: "CPU",
                value: 45,
                icon: "cpu",
                history: [30, 35, 45, 50, 45, 40, 55, 60, 45, 42, 45]
            )

            TelemetryCard(
                title: "Memory",
                value: 72,
                icon: "memorychip",
                history: [65, 68, 70, 72, 71, 70, 72, 74, 72, 70, 72]
            )

            TelemetryCard(
                title: "GPU",
                value: 88,
                icon: "gpu",
                history: [80, 82, 85, 88, 90, 88, 86, 88, 90, 92, 88]
            )
        }
        .padding()
        .background(Color(hex: "0A0A0F"))
        .preferredColorScheme(.dark)
    }
}
#endif
