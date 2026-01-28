//
//  ScoreHistoryChart.swift
//  OptaApp
//
//  SwiftUI Charts-based line chart showing score history over time.
//  Features area gradient fill, optimization markers, and obsidian styling.
//

import SwiftUI
import Charts

// MARK: - ScoreHistoryChart

/// A line chart showing score history over the last 30 entries.
///
/// Features:
/// - Line + area gradient fill in violet
/// - Optimization event markers (green dots)
/// - Empty state when no history
/// - Obsidian card background
///
/// # Usage
///
/// ```swift
/// ScoreHistoryChart(history: historyManager.history, colorTemp: colorTemp)
/// ```
struct ScoreHistoryChart: View {

    // MARK: - Properties

    /// Score snapshots (most recent first)
    let history: [ScoreSnapshot]

    /// Color temperature state
    let colorTemp: ColorTemperatureState

    /// Obsidian base color
    private let obsidianBase = Color(hex: "0A0A0F")

    /// Electric Violet accent
    private let electricViolet = Color(hex: "8B5CF6")

    /// Maximum entries to display
    private let maxDisplayEntries = 30

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if chartData.isEmpty {
                emptyState
            } else {
                chartView
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(obsidianBase)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(colorTemp.violetColor.opacity(colorTemp.glowOpacity * 0.2), lineWidth: 1)
                )
        )
    }

    // MARK: - Chart View

    private var chartView: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Stats header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Last \(chartData.count) readings")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.45))

                    if let latest = chartData.last {
                        Text("\(latest.score)")
                            .font(.system(size: 24, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                    }
                }

                Spacer()

                if let trend = trendIndicator {
                    HStack(spacing: 4) {
                        Image(systemName: trend.icon)
                            .font(.system(size: 12))
                        Text(trend.text)
                            .font(.system(size: 12, weight: .medium))
                    }
                    .foregroundStyle(trend.color)
                }
            }

            // Chart
            Chart(chartData) { entry in
                // Area fill
                AreaMark(
                    x: .value("Date", entry.date),
                    y: .value("Score", entry.score)
                )
                .foregroundStyle(
                    .linearGradient(
                        colors: [
                            electricViolet.opacity(0.3),
                            electricViolet.opacity(0.05)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

                // Line
                LineMark(
                    x: .value("Date", entry.date),
                    y: .value("Score", entry.score)
                )
                .foregroundStyle(electricViolet)
                .lineStyle(StrokeStyle(lineWidth: 2))

                // Optimization markers
                if entry.afterOptimization {
                    PointMark(
                        x: .value("Date", entry.date),
                        y: .value("Score", entry.score)
                    )
                    .foregroundStyle(Color(hex: "22C55E"))
                    .symbolSize(40)
                }
            }
            .chartYScale(domain: yAxisRange)
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 4)) { _ in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [3, 3]))
                        .foregroundStyle(.white.opacity(0.1))
                    AxisValueLabel()
                        .foregroundStyle(.white.opacity(0.4))
                        .font(.system(size: 9))
                }
            }
            .chartYAxis {
                AxisMarks(position: .trailing, values: .automatic(desiredCount: 4)) { _ in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [3, 3]))
                        .foregroundStyle(.white.opacity(0.1))
                    AxisValueLabel()
                        .foregroundStyle(.white.opacity(0.4))
                        .font(.system(size: 10))
                }
            }
            .frame(height: 160)

            // Legend
            HStack(spacing: 16) {
                legendItem(color: electricViolet, text: "Score")
                legendItem(color: Color(hex: "22C55E"), text: "After Optimize")
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 32))
                .foregroundStyle(.white.opacity(0.2))

            Text("No history yet")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.white.opacity(0.5))

            Text("Score will be recorded each time you visit this page")
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.35))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 160)
    }

    // MARK: - Chart Data

    /// Processed chart data (oldest first for proper x-axis ordering)
    private var chartData: [ChartEntry] {
        let entries = Array(history.prefix(maxDisplayEntries).reversed())
        return entries.map { snapshot in
            ChartEntry(
                date: snapshot.date,
                score: snapshot.totalScore,
                afterOptimization: snapshot.afterOptimization
            )
        }
    }

    /// Y-axis range with some padding
    private var yAxisRange: ClosedRange<Int> {
        let scores = chartData.map(\.score)
        let minScore = max(0, (scores.min() ?? 0) - 10)
        let maxScore = min(100, (scores.max() ?? 100) + 10)
        return minScore...maxScore
    }

    /// Trend indicator comparing last vs second-to-last entry
    private var trendIndicator: TrendInfo? {
        guard chartData.count >= 2 else { return nil }
        let latest = chartData[chartData.count - 1].score
        let previous = chartData[chartData.count - 2].score
        let delta = latest - previous
        if delta > 0 {
            return TrendInfo(
                icon: "arrow.up.right",
                text: "+\(delta)",
                color: Color(hex: "22C55E")
            )
        } else if delta < 0 {
            return TrendInfo(
                icon: "arrow.down.right",
                text: "\(delta)",
                color: Color(hex: "EF4444")
            )
        }
        return nil
    }

    // MARK: - Legend

    private func legendItem(color: Color, text: String) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)

            Text(text)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.white.opacity(0.5))
        }
    }
}

// MARK: - Chart Entry

/// A single entry for the chart
private struct ChartEntry: Identifiable {
    var id: Date { date }
    let date: Date
    let score: Int
    let afterOptimization: Bool
}

// MARK: - Trend Info

/// Trend indicator metadata
private struct TrendInfo {
    let icon: String
    let text: String
    let color: Color
}

// MARK: - Preview

#if DEBUG
#Preview {
    ScoreHistoryChart(
        history: [
            ScoreSnapshot(date: Date().addingTimeInterval(-86400 * 5), totalScore: 62, categoryScores: [:], afterOptimization: false),
            ScoreSnapshot(date: Date().addingTimeInterval(-86400 * 4), totalScore: 65, categoryScores: [:], afterOptimization: false),
            ScoreSnapshot(date: Date().addingTimeInterval(-86400 * 3), totalScore: 70, categoryScores: [:], afterOptimization: true),
            ScoreSnapshot(date: Date().addingTimeInterval(-86400 * 2), totalScore: 68, categoryScores: [:], afterOptimization: false),
            ScoreSnapshot(date: Date().addingTimeInterval(-86400 * 1), totalScore: 75, categoryScores: [:], afterOptimization: false),
            ScoreSnapshot(date: Date(), totalScore: 78, categoryScores: [:], afterOptimization: false)
        ],
        colorTemp: .idle
    )
    .padding()
    .background(Color(hex: "09090B"))
    .preferredColorScheme(.dark)
}
#endif
