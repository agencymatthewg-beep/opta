//
//  ChartView.swift
//  OptaMolt
//
//  Interactive chart component using Swift Charts.
//  Supports bar charts, line charts, and pie charts with Opta styling.
//

import SwiftUI
import Charts

// MARK: - ChartView

/// Renders interactive charts from ChartData
///
/// Usage:
/// ```swift
/// ChartView(data: ChartData(
///     type: .bar,
///     title: "Monthly Sales",
///     data: [
///         .init(label: "Jan", value: 100),
///         .init(label: "Feb", value: 150)
///     ]
/// ))
/// ```
public struct ChartView: View {
    /// The chart data to render
    let data: ChartData

    /// Selected data point for tooltip display
    @State private var selectedPoint: ChartData.ChartDataPoint?

    /// Animation state for chart entrance
    @State private var isAnimated: Bool = false

    /// Animation progress for individual elements
    @State private var animationProgress: Double = 0

    /// Initialize with chart data
    /// - Parameter data: The chart data to render
    public init(data: ChartData) {
        self.data = data
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Title
            if let title = data.title {
                Text(title)
                    .font(.sora(15, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                    .padding(.horizontal, 4)
            }

            // Chart content
            chartContent
                .frame(minHeight: 200, maxHeight: 300)
        }
        .padding(16)
        .glassSubtle()
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .onAppear {
            // Animate chart entrance
            withAnimation(.easeOut(duration: 0.8)) {
                isAnimated = true
                animationProgress = 1.0
            }
        }
    }

    // MARK: - Chart Content

    @ViewBuilder
    private var chartContent: some View {
        switch data.type {
        case .bar:
            barChart
        case .line:
            lineChart
        case .pie:
            pieChart
        }
    }

    // MARK: - Bar Chart

    private var barChart: some View {
        Chart(data.data, id: \.label) { point in
            BarMark(
                x: .value("Category", point.label),
                y: .value("Value", isAnimated ? point.value : 0)
            )
            .foregroundStyle(colorForPoint(point, index: data.data.firstIndex(where: { $0.label == point.label }) ?? 0))
            .cornerRadius(4)
        }
        .chartXAxis {
            AxisMarks { _ in
                AxisGridLine()
                    .foregroundStyle(Color.optaBorder.opacity(0.3))
                AxisValueLabel()
                    .font(.sora(13, weight: .regular))
                    .foregroundStyle(Color.optaTextSecondary)
            }
        }
        .chartYAxis {
            AxisMarks { _ in
                AxisGridLine()
                    .foregroundStyle(Color.optaBorder.opacity(0.3))
                AxisValueLabel()
                    .font(.sora(13, weight: .regular))
                    .foregroundStyle(Color.optaTextSecondary)
            }
        }
        .chartOverlay { proxy in
            GeometryReader { geometry in
                Rectangle()
                    .fill(Color.clear)
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                handleChartTouch(at: value.location, proxy: proxy, geometry: geometry)
                            }
                            .onEnded { _ in
                                selectedPoint = nil
                            }
                    )
            }
        }
        .overlay(alignment: .top) {
            tooltipView
        }
    }

    // MARK: - Line Chart

    private var lineChart: some View {
        Chart(data.data, id: \.label) { point in
            LineMark(
                x: .value("Category", point.label),
                y: .value("Value", isAnimated ? point.value : 0)
            )
            .foregroundStyle(Color.optaCyan)
            .interpolationMethod(.catmullRom)

            AreaMark(
                x: .value("Category", point.label),
                y: .value("Value", isAnimated ? point.value : 0)
            )
            .foregroundStyle(
                LinearGradient(
                    colors: [Color.optaCyan.opacity(0.3), Color.optaCyan.opacity(0.0)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .interpolationMethod(.catmullRom)

            PointMark(
                x: .value("Category", point.label),
                y: .value("Value", isAnimated ? point.value : 0)
            )
            .foregroundStyle(Color.optaCyan)
            .symbolSize(selectedPoint?.label == point.label ? 100 : 50)
        }
        .chartXAxis {
            AxisMarks { _ in
                AxisGridLine()
                    .foregroundStyle(Color.optaBorder.opacity(0.3))
                AxisValueLabel()
                    .font(.sora(13, weight: .regular))
                    .foregroundStyle(Color.optaTextSecondary)
            }
        }
        .chartYAxis {
            AxisMarks { _ in
                AxisGridLine()
                    .foregroundStyle(Color.optaBorder.opacity(0.3))
                AxisValueLabel()
                    .font(.sora(13, weight: .regular))
                    .foregroundStyle(Color.optaTextSecondary)
            }
        }
        .chartOverlay { proxy in
            GeometryReader { geometry in
                Rectangle()
                    .fill(Color.clear)
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                handleChartTouch(at: value.location, proxy: proxy, geometry: geometry)
                            }
                            .onEnded { _ in
                                selectedPoint = nil
                            }
                    )
            }
        }
        .overlay(alignment: .top) {
            tooltipView
        }
    }

    // MARK: - Pie Chart

    private var pieChart: some View {
        let total = data.data.reduce(0) { $0 + $1.value }

        return VStack(spacing: 16) {
            Chart(data.data, id: \.label) { point in
                SectorMark(
                    angle: .value("Value", isAnimated ? point.value : 0),
                    innerRadius: .ratio(0.4),
                    angularInset: 2
                )
                .foregroundStyle(colorForPoint(point, index: data.data.firstIndex(where: { $0.label == point.label }) ?? 0))
                .cornerRadius(4)
                .opacity(selectedPoint == nil || selectedPoint?.label == point.label ? 1.0 : 0.5)
            }
            .chartOverlay { _ in
                GeometryReader { geometry in
                    Rectangle()
                        .fill(Color.clear)
                        .contentShape(Rectangle())
                        .onTapGesture { location in
                            handlePieTap(at: location, in: geometry.size)
                        }
                }
            }

            // Legend
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))], spacing: 8) {
                ForEach(Array(data.data.enumerated()), id: \.element.label) { index, point in
                    HStack(spacing: 6) {
                        Circle()
                            .fill(colorForPoint(point, index: index))
                            .frame(width: 10, height: 10)

                        Text(point.label)
                            .font(.sora(13, weight: .regular))
                            .foregroundColor(.optaTextSecondary)
                            .lineLimit(1)

                        Spacer()

                        Text(formatPercentage(point.value, total: total))
                            .font(.sora(13, weight: .medium))
                            .foregroundColor(.optaTextPrimary)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        selectedPoint?.label == point.label
                            ? Color.optaPurple.opacity(0.1)
                            : Color.clear
                    )
                    .cornerRadius(6)
                    .onTapGesture {
                        withAnimation(.optaSpring) {
                            selectedPoint = selectedPoint?.label == point.label ? nil : point
                        }
                    }
                }
            }
        }
    }

    // MARK: - Tooltip

    @ViewBuilder
    private var tooltipView: some View {
        if let point = selectedPoint {
            HStack(spacing: 8) {
                Circle()
                    .fill(colorForPoint(point, index: data.data.firstIndex(where: { $0.label == point.label }) ?? 0))
                    .frame(width: 8, height: 8)

                Text(point.label)
                    .font(.sora(13, weight: .medium))
                    .foregroundColor(.optaTextPrimary)

                Text(formatValue(point.value))
                    .font(.sora(13, weight: .semibold))
                    .foregroundColor(.optaPurple)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.optaSurface)
            .cornerRadius(8)
            .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
            .transition(.opacity.combined(with: .scale(scale: 0.95)))
        }
    }

    // MARK: - Touch Handling

    private func handleChartTouch(at location: CGPoint, proxy: ChartProxy, geometry: GeometryProxy) {
        guard let plotFrame = proxy.plotFrame else { return }

        let plotOrigin = geometry[plotFrame].origin
        let plotLocation = CGPoint(
            x: location.x - plotOrigin.x,
            y: location.y - plotOrigin.y
        )

        if let category: String = proxy.value(atX: plotLocation.x) {
            withAnimation(.easeInOut(duration: 0.15)) {
                selectedPoint = data.data.first { $0.label == category }
            }
        }
    }

    private func handlePieTap(at location: CGPoint, in size: CGSize) {
        // Simple tap handling - cycle through points on tap
        if selectedPoint == nil {
            selectedPoint = data.data.first
        } else if let current = selectedPoint,
                  let currentIndex = data.data.firstIndex(where: { $0.label == current.label }) {
            let nextIndex = (currentIndex + 1) % data.data.count
            withAnimation(.optaSpring) {
                selectedPoint = data.data[nextIndex]
            }
        }
    }

    // MARK: - Color Helpers

    private func colorForPoint(_ point: ChartData.ChartDataPoint, index: Int) -> Color {
        // If point has custom color, use it
        if let hexColor = point.color {
            return Color(hex: hexColor)
        }
        return defaultColors[index % defaultColors.count]
    }

    private var defaultColors: [Color] {
        [.optaPurple, .optaCyan, .optaGreen, .optaIndigo, .optaPink, .optaCoral]
    }

    // MARK: - Formatting Helpers

    private func formatValue(_ value: Double) -> String {
        if value == floor(value) && value < 10000 {
            return String(format: "%.0f", value)
        } else if value >= 1_000_000 {
            return String(format: "%.1fM", value / 1_000_000)
        } else if value >= 1000 {
            return String(format: "%.1fK", value / 1000)
        } else {
            return String(format: "%.1f", value)
        }
    }

    private func formatPercentage(_ value: Double, total: Double) -> String {
        guard total > 0 else { return "0%" }
        return String(format: "%.1f%%", (value / total) * 100)
    }
}

// MARK: - Preview

#if DEBUG
struct ChartView_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Bar Chart
                ChartView(data: ChartData(
                    type: .bar,
                    title: "Monthly Sales",
                    data: [
                        .init(label: "Jan", value: 120),
                        .init(label: "Feb", value: 180),
                        .init(label: "Mar", value: 150),
                        .init(label: "Apr", value: 220),
                        .init(label: "May", value: 190)
                    ]
                ))

                // Line Chart
                ChartView(data: ChartData(
                    type: .line,
                    title: "User Growth",
                    data: [
                        .init(label: "Week 1", value: 50),
                        .init(label: "Week 2", value: 80),
                        .init(label: "Week 3", value: 65),
                        .init(label: "Week 4", value: 120),
                        .init(label: "Week 5", value: 150)
                    ]
                ))

                // Pie Chart
                ChartView(data: ChartData(
                    type: .pie,
                    title: "Market Share",
                    data: [
                        .init(label: "Product A", value: 40),
                        .init(label: "Product B", value: 30),
                        .init(label: "Product C", value: 20),
                        .init(label: "Other", value: 10)
                    ]
                ))

                // Custom Colors
                ChartView(data: ChartData(
                    type: .bar,
                    title: "Custom Colors",
                    data: [
                        .init(label: "Red", value: 100, color: "#FF5733"),
                        .init(label: "Green", value: 150, color: "#33FF57"),
                        .init(label: "Blue", value: 120, color: "#3357FF")
                    ]
                ))
            }
            .padding()
        }
        .background(Color.optaBackground)
    }
}
#endif
