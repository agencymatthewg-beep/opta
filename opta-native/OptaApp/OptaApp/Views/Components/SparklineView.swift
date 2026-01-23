//
//  SparklineView.swift
//  OptaApp
//
//  Reusable mini sparkline chart for displaying telemetry history.
//  Features branch-energy violet as default accent color.
//

import SwiftUI

// MARK: - SparklineView

/// A mini sparkline chart for displaying telemetry history.
///
/// Renders a smooth line chart with gradient fill. Uses branch-energy violet
/// as the default color, but accepts an override for per-card customization.
///
/// # Usage
///
/// ```swift
/// // Default branch-energy violet
/// SparklineView(data: cpuHistory)
///     .frame(height: 20)
///
/// // Custom color override
/// SparklineView(data: memoryHistory, color: .green)
///     .frame(height: 40)
/// ```
struct SparklineView: View {

    // MARK: - Environment

    @Environment(\.colorTemperature) private var colorTemp

    // MARK: - Properties

    /// Data points for the chart
    let data: [Float]

    /// Optional line and gradient color override (nil = use colorTemp.violetColor)
    let color: Color?

    /// Padding for the chart
    private let padding: CGFloat = 2

    /// Resolved color using environment temperature or explicit override
    private var resolvedColor: Color {
        color ?? colorTemp.violetColor
    }

    // MARK: - Initialization

    /// Create a sparkline with color temperature violet as default color.
    /// - Parameters:
    ///   - data: Array of Float values to plot
    ///   - color: Line color override (nil = uses color temperature violet)
    init(data: [Float], color: Color? = nil) {
        self.data = data
        self.color = color
    }

    // MARK: - Body

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
                            colors: [resolvedColor.opacity(0.3), resolvedColor.opacity(0.0)],
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
                    .stroke(resolvedColor, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                }
            } else {
                // Empty state
                Rectangle()
                    .fill(Color.white.opacity(0.05))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
        }
    }

    // MARK: - Helpers

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

// MARK: - Preview

#if DEBUG
struct SparklineView_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            // Default violet
            SparklineView(data: [30, 35, 45, 50, 45, 40, 55, 60, 45, 42, 45])
                .frame(height: 40)

            // Custom color override
            SparklineView(data: [65, 68, 70, 72, 71, 70, 72, 74, 72, 70, 72], color: .green)
                .frame(height: 40)

            // Compact height (as used in TelemetryCard)
            SparklineView(data: [80, 82, 85, 88, 90, 88, 86, 88, 90, 92, 88])
                .frame(height: 20)

            // Empty state
            SparklineView(data: [42])
                .frame(height: 20)
        }
        .padding()
        .background(Color(hex: "0A0A0F"))
        .preferredColorScheme(.dark)
    }
}
#endif
