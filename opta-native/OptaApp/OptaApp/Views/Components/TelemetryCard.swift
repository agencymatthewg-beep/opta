//
//  TelemetryCard.swift
//  OptaApp
//
//  Reusable telemetry card component for CPU, Memory, GPU displays.
//  Features glass styling, sparkline chart, and animated value transitions.
//

import SwiftUI

// MARK: - TelemetryCard

/// A reusable card displaying telemetry metrics with sparkline history.
///
/// Features:
/// - Title with SF Symbol icon
/// - Large animated percentage value
/// - Mini sparkline showing history
/// - Color-coded indicator based on usage level
/// - Glass card styling with OLED optimization
///
/// # Usage
///
/// ```swift
/// TelemetryCard(
///     title: "CPU",
///     value: coreManager.viewModel.cpuUsage,
///     icon: "cpu",
///     color: .blue,
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

    /// Accent color for the card
    let color: Color

    /// History of values for sparkline (last 30 values)
    let history: [Float]

    /// Whether to reduce motion for accessibility
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Animation state for the value
    @State private var animatedValue: Float = 0

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header: Icon + Title
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(color)

                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.9))

                Spacer()

                // Status indicator
                statusIndicator
            }

            // Value display
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

            // Sparkline chart
            SparklineView(data: history, color: indicatorColor)
                .frame(height: 40)
        }
        .padding(16)
        .background(glassBackground)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.2), radius: 10, x: 0, y: 5)
        .onChange(of: value) { _, newValue in
            if reduceMotion {
                animatedValue = newValue
            } else {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    animatedValue = newValue
                }
            }
        }
        .onAppear {
            animatedValue = value
        }
    }

    // MARK: - Subviews

    /// Glass background effect
    private var glassBackground: some View {
        ZStack {
            // Base dark color (OLED optimized)
            Color(hex: "09090B")

            // Glass overlay
            Rectangle()
                .fill(.ultraThinMaterial)
                .opacity(0.5)
        }
    }

    /// Status indicator circle
    private var statusIndicator: some View {
        Circle()
            .fill(indicatorColor)
            .frame(width: 8, height: 8)
            .shadow(color: indicatorColor.opacity(0.5), radius: 4, x: 0, y: 0)
    }

    // MARK: - Computed Properties

    /// Color based on usage level
    private var indicatorColor: Color {
        if value < 60 {
            return .green
        } else if value < 85 {
            return .yellow
        } else {
            return .red
        }
    }
}

// MARK: - SparklineView

/// A mini sparkline chart for displaying telemetry history.
struct SparklineView: View {

    /// Data points for the chart
    let data: [Float]

    /// Line color
    let color: Color

    /// Padding for the chart
    private let padding: CGFloat = 2

    var body: some View {
        GeometryReader { geometry in
            if data.count >= 2 {
                let points = calculatePoints(in: geometry.size)

                ZStack {
                    // Gradient fill below the line
                    Path { path in
                        guard let firstPoint = points.first else { return }

                        path.move(to: CGPoint(x: firstPoint.x, y: geometry.size.height))
                        path.addLine(to: firstPoint)

                        for point in points.dropFirst() {
                            path.addLine(to: point)
                        }

                        if let lastPoint = points.last {
                            path.addLine(to: CGPoint(x: lastPoint.x, y: geometry.size.height))
                        }

                        path.closeSubpath()
                    }
                    .fill(
                        LinearGradient(
                            colors: [color.opacity(0.3), color.opacity(0.0)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )

                    // Line path
                    Path { path in
                        guard let firstPoint = points.first else { return }
                        path.move(to: firstPoint)

                        for point in points.dropFirst() {
                            path.addLine(to: point)
                        }
                    }
                    .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                }
            } else {
                // Empty state
                Rectangle()
                    .fill(Color.white.opacity(0.05))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
        }
    }

    /// Calculate points for the chart based on data and size
    private func calculatePoints(in size: CGSize) -> [CGPoint] {
        guard !data.isEmpty else { return [] }

        let maxValue = max(data.max() ?? 100, 100) // At least 100 for percentage
        let minValue = min(data.min() ?? 0, 0)
        let range = maxValue - minValue

        let effectiveWidth = size.width - (padding * 2)
        let effectiveHeight = size.height - (padding * 2)

        let xStep = data.count > 1 ? effectiveWidth / CGFloat(data.count - 1) : 0

        return data.enumerated().map { index, value in
            let x = padding + CGFloat(index) * xStep
            let normalizedValue = range > 0 ? (value - minValue) / range : 0.5
            let y = padding + effectiveHeight * (1 - CGFloat(normalizedValue))
            return CGPoint(x: x, y: y)
        }
    }
}

// MARK: - Color Extension

extension Color {
    /// Initialize Color from hex string
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
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
                color: .blue,
                history: [30, 35, 45, 50, 45, 40, 55, 60, 45, 42, 45]
            )

            TelemetryCard(
                title: "Memory",
                value: 72,
                icon: "memorychip",
                color: .purple,
                history: [65, 68, 70, 72, 71, 70, 72, 74, 72, 70, 72]
            )

            TelemetryCard(
                title: "GPU",
                value: 88,
                icon: "gpu",
                color: .orange,
                history: [80, 82, 85, 88, 90, 88, 86, 88, 90, 92, 88]
            )
        }
        .padding()
        .background(Color(hex: "09090B"))
        .preferredColorScheme(.dark)
    }
}
#endif
