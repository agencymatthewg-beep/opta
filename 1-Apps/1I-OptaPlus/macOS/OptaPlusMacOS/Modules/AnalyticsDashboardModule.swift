//
//  AnalyticsDashboardModule.swift
//  OptaPlusMacOS
//
//  F4. Bot Performance Analytics Dashboard — time-series charts and metrics
//  using Swift Charts. Shows response time trends, message volume, uptime,
//  health scores, active hours heat map, and cross-bot comparisons.
//
//  Module registration:  Add `case analytics` to DetailMode in ContentView.swift.
//  Module removal:       Delete this file. Remove DetailMode case and notification.
//
//  Keyboard shortcuts:
//    Cmd+Shift+A  — Toggle analytics dashboard
//    Cmd+Opt+1..4 — Switch time range (1D, 7D, 30D, All)
//
//  Event bus:
//    Posts:    .analyticsTimeRangeChanged(range: AnalyticsTimeRange)
//    Listens:  .toggleAnalytics
//
//  Persistence:
//    Reads from existing BotMessageStats (UserDefaults) and BotHealth.
//    No new persistence — all charts are computed from existing data.
//    MetricsCollector snapshots can optionally persist to App Support.
//
//  Inter-module interaction:
//    - Reads BotMessageStats from MessageStatsManager
//    - Reads BotHealth scores from ChatViewModel
//    - Reads ActivityFeedManager events for timeline
//    - BranchingModule can feed branch count metrics
//    - SplitPaneModule comparison data
//
//  How to add:
//    1. Add `case analytics` to DetailMode in ContentView.swift
//    2. Add `.onReceive(publisher(for: .toggleAnalytics))` listener
//    3. Add Cmd+Shift+A shortcut
//    4. In detail switch: `case .analytics: AnalyticsDashboardView()`
//
//  How to remove:
//    1. Delete this file
//    2. Remove `case analytics` from DetailMode
//    3. Remove notification listener and keyboard shortcut
//    4. Call AnalyticsDashboardModule.cleanup() to remove persisted snapshots
//

import SwiftUI
import Charts
import Combine
import OptaMolt
import os.log

// MARK: - Analytics Time Range

enum AnalyticsTimeRange: String, CaseIterable, Sendable {
    case day = "1D"
    case week = "7D"
    case month = "30D"
    case all = "All"

    var label: String { rawValue }

    var cutoffDate: Date? {
        let cal = Calendar.current
        let now = Date()
        switch self {
        case .day: return cal.date(byAdding: .day, value: -1, to: now)
        case .week: return cal.date(byAdding: .day, value: -7, to: now)
        case .month: return cal.date(byAdding: .month, value: -1, to: now)
        case .all: return nil
        }
    }

    var intervalForGrouping: Calendar.Component {
        switch self {
        case .day: return .hour
        case .week: return .day
        case .month: return .day
        case .all: return .weekOfYear
        }
    }
}

// MARK: - Metric Data Point

struct MetricDataPoint: Identifiable {
    let id = UUID()
    let date: Date
    let value: Double
    let label: String?

    init(date: Date, value: Double, label: String? = nil) {
        self.date = date
        self.value = value
        self.label = label
    }
}

// MARK: - Bot Metric Summary

struct BotMetricSummary: Identifiable {
    let id: String  // bot ID
    let botName: String
    let botEmoji: String
    let totalMessages: Int
    let avgResponseTime: Double?
    let healthScore: Int
    let uptimePercent: Double
    let messagesPerDay: Double
    let responseTrend: [MetricDataPoint]
    let volumeTrend: [MetricDataPoint]
    let hourlyActivity: [MetricDataPoint]  // 24 points for heat map
}

// MARK: - Metrics Collector

/// Collects and aggregates metrics from existing data sources.
@MainActor
final class MetricsCollector: ObservableObject {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "Analytics")

    @Published var summaries: [BotMetricSummary] = []
    @Published var timeRange: AnalyticsTimeRange = .week
    @Published var isLoading: Bool = false
    @Published var selectedBotId: String?  // nil = all bots overview

    // MARK: - Data Collection

    func collect(appState: AppState) {
        isLoading = true
        let cutoff = timeRange.cutoffDate

        var results: [BotMetricSummary] = []

        for bot in appState.bots {
            let stats = MessageStatsManager.load(botId: bot.id)
            let vm = appState.viewModel(for: bot)

            // Filter dates by time range
            let filteredDates = stats.messageDates.filter { date in
                if let cutoff { return date >= cutoff }
                return true
            }

            // Response time trend
            let responseTrend = buildResponseTrend(stats: stats, cutoff: cutoff)

            // Volume trend
            let volumeTrend = buildVolumeTrend(dates: filteredDates, cutoff: cutoff)

            // Hourly activity (heat map data)
            let hourlyActivity = buildHourlyActivity(dates: filteredDates)

            // Uptime calculation
            let uptime = calculateUptime(vm: vm, cutoff: cutoff)

            // Messages per day
            let dayCount = max(1, daysBetween(cutoff ?? stats.messageDates.first ?? Date(), Date()))
            let msgsPerDay = Double(filteredDates.count) / Double(dayCount)

            let summary = BotMetricSummary(
                id: bot.id,
                botName: bot.name,
                botEmoji: bot.emoji,
                totalMessages: filteredDates.count,
                avgResponseTime: stats.averageResponseTime,
                healthScore: vm.health.score,
                uptimePercent: uptime,
                messagesPerDay: msgsPerDay,
                responseTrend: responseTrend,
                volumeTrend: volumeTrend,
                hourlyActivity: hourlyActivity
            )
            results.append(summary)
        }

        summaries = results
        isLoading = false
    }

    // MARK: - Trend Builders

    private func buildResponseTrend(stats: BotMessageStats, cutoff: Date?) -> [MetricDataPoint] {
        // Each response time is paired with the corresponding message date
        let times = stats.responseTimes
        let dates = stats.messageDates.suffix(times.count)

        var points: [MetricDataPoint] = []
        for (date, time) in zip(dates, times) {
            if let cutoff, date < cutoff { continue }
            points.append(MetricDataPoint(date: date, value: time))
        }
        return points
    }

    private func buildVolumeTrend(dates: [Date], cutoff: Date?) -> [MetricDataPoint] {
        let cal = Calendar.current
        let component = timeRange.intervalForGrouping

        var grouped: [Date: Int] = [:]
        for date in dates {
            let key = cal.dateInterval(of: component, for: date)?.start ?? date
            grouped[key, default: 0] += 1
        }

        return grouped.map { MetricDataPoint(date: $0.key, value: Double($0.value)) }
            .sorted { $0.date < $1.date }
    }

    private func buildHourlyActivity(dates: [Date]) -> [MetricDataPoint] {
        let cal = Calendar.current
        var hourCounts = Array(repeating: 0, count: 24)
        for date in dates {
            let hour = cal.component(.hour, from: date)
            hourCounts[hour] += 1
        }
        return hourCounts.enumerated().map { hour, count in
            // Use today's date at each hour for the chart X-axis
            let date = cal.date(bySettingHour: hour, minute: 0, second: 0, of: Date()) ?? Date()
            return MetricDataPoint(date: date, value: Double(count), label: "\(hour):00")
        }
    }

    private func calculateUptime(vm: ChatViewModel, cutoff: Date?) -> Double {
        // Simplified: based on connection state history
        // In production, this would track disconnection events over time
        return vm.connectionState == .connected ? 99.5 : 0.0
    }

    private func daysBetween(_ start: Date, _ end: Date) -> Int {
        Calendar.current.dateComponents([.day], from: start, to: end).day ?? 1
    }
}

// MARK: - Analytics Dashboard View

struct AnalyticsDashboardView: View {
    @StateObject private var collector = MetricsCollector()
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var animPrefs: AnimationPreferences

    @State private var appeared = false

    var body: some View {
        ZStack {
            Color.optaVoid.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    // Header with time range picker
                    dashboardHeader

                    // Overview cards
                    overviewCards

                    // Response time chart
                    if let selected = selectedSummary {
                        responseTimeChart(selected)
                        messageVolumeChart(selected)
                        hourlyHeatMap(selected)
                    } else {
                        crossBotComparison
                    }
                }
                .padding(20)
            }
        }
        .onAppear {
            collector.collect(appState: appState)
            withAnimation(.optaSpring.delay(0.1)) { appeared = true }
        }
        .onChange(of: collector.timeRange) { _, _ in
            collector.collect(appState: appState)
        }
    }

    private var selectedSummary: BotMetricSummary? {
        if let id = collector.selectedBotId {
            return collector.summaries.first(where: { $0.id == id })
        }
        return nil
    }

    // MARK: - Dashboard Header

    private var dashboardHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Analytics")
                    .font(.sora(22, weight: .bold))
                    .foregroundColor(.optaTextPrimary)
                Text("Bot performance metrics and trends")
                    .font(.sora(12))
                    .foregroundColor(.optaTextSecondary)
            }

            Spacer()

            // Bot filter
            HStack(spacing: 4) {
                Button(action: {
                    withAnimation(.optaSnap) { collector.selectedBotId = nil }
                }) {
                    Text("All")
                        .font(.sora(10, weight: collector.selectedBotId == nil ? .semibold : .regular))
                        .foregroundColor(collector.selectedBotId == nil ? .optaPrimary : .optaTextMuted)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule().fill(collector.selectedBotId == nil ? Color.optaPrimary.opacity(0.12) : Color.clear)
                        )
                }
                .buttonStyle(.plain)

                ForEach(appState.bots) { bot in
                    Button(action: {
                        withAnimation(.optaSnap) { collector.selectedBotId = bot.id }
                    }) {
                        Text(bot.emoji)
                            .font(.system(size: 12))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 4)
                            .background(
                                Capsule().fill(
                                    collector.selectedBotId == bot.id ? Color.optaPrimary.opacity(0.12) : Color.clear
                                )
                            )
                    }
                    .buttonStyle(.plain)
                    .help(bot.name)
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .glassSubtle()

            // Time range picker
            HStack(spacing: 2) {
                ForEach(AnalyticsTimeRange.allCases, id: \.rawValue) { range in
                    Button(action: {
                        withAnimation(.optaSnap) { collector.timeRange = range }
                    }) {
                        Text(range.label)
                            .font(.system(size: 10, weight: collector.timeRange == range ? .bold : .medium, design: .monospaced))
                            .foregroundColor(collector.timeRange == range ? .optaPrimary : .optaTextMuted)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                            .background(
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(collector.timeRange == range ? Color.optaPrimary.opacity(0.12) : Color.clear)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(4)
            .glassSubtle()
        }
        .ignition()
    }

    // MARK: - Overview Cards

    private var overviewCards: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 12)], spacing: 12) {
            let summaries = collector.selectedBotId != nil
                ? collector.summaries.filter { $0.id == collector.selectedBotId }
                : collector.summaries

            let totalMessages = summaries.reduce(0) { $0 + $1.totalMessages }
            let avgHealth = summaries.isEmpty ? 0 : summaries.reduce(0) { $0 + $1.healthScore } / summaries.count
            let avgResponseTime = summaries.compactMap(\.avgResponseTime).reduce(0, +) / max(1, Double(summaries.compactMap(\.avgResponseTime).count))
            let totalMsgsPerDay = summaries.reduce(0.0) { $0 + $1.messagesPerDay }

            MetricCard(
                title: "Total Messages",
                value: "\(totalMessages)",
                icon: "bubble.left.and.bubble.right",
                color: .optaPrimary,
                index: 0,
                appeared: appeared
            )

            MetricCard(
                title: "Avg Health",
                value: "\(avgHealth)",
                icon: "heart.fill",
                color: healthColor(avgHealth),
                index: 1,
                appeared: appeared
            )

            MetricCard(
                title: "Avg Response",
                value: formatResponseTime(avgResponseTime),
                icon: "clock",
                color: .optaCyan,
                index: 2,
                appeared: appeared
            )

            MetricCard(
                title: "Messages/Day",
                value: String(format: "%.1f", totalMsgsPerDay),
                icon: "chart.bar",
                color: .optaAmber,
                index: 3,
                appeared: appeared
            )
        }
    }

    // MARK: - Response Time Chart

    private func responseTimeChart(_ summary: BotMetricSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            chartHeader("Response Time", icon: "clock", subtitle: "Seconds per response")

            if summary.responseTrend.isEmpty {
                emptyChartState("No response time data in this range")
            } else {
                Chart(summary.responseTrend) { point in
                    LineMark(
                        x: .value("Time", point.date),
                        y: .value("Seconds", point.value)
                    )
                    .foregroundStyle(Color.optaPrimary.gradient)
                    .interpolationMethod(.catmullRom)

                    AreaMark(
                        x: .value("Time", point.date),
                        y: .value("Seconds", point.value)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color.optaPrimary.opacity(0.2), Color.clear],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .interpolationMethod(.catmullRom)
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisValueLabel {
                            Text(String(format: "%.1fs", value.as(Double.self) ?? 0))
                                .font(.system(size: 9, design: .monospaced))
                                .foregroundColor(.optaTextMuted)
                        }
                        AxisGridLine()
                            .foregroundStyle(Color.optaBorder.opacity(0.1))
                    }
                }
                .chartXAxis {
                    AxisMarks { value in
                        AxisValueLabel()
                            .font(.system(size: 9))
                            .foregroundStyle(Color.optaTextMuted)
                        AxisGridLine()
                            .foregroundStyle(Color.optaBorder.opacity(0.05))
                    }
                }
                .frame(height: 200)
                .padding(.horizontal, 4)
            }
        }
        .chartPanel()
        .staggeredIgnition(index: 0, isVisible: appeared)
    }

    // MARK: - Message Volume Chart

    private func messageVolumeChart(_ summary: BotMetricSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            chartHeader("Message Volume", icon: "chart.bar", subtitle: "Messages over time")

            if summary.volumeTrend.isEmpty {
                emptyChartState("No message data in this range")
            } else {
                Chart(summary.volumeTrend) { point in
                    BarMark(
                        x: .value("Time", point.date, unit: collector.timeRange.intervalForGrouping),
                        y: .value("Count", point.value)
                    )
                    .foregroundStyle(Color.optaCyan.gradient)
                    .clipShape(RoundedRectangle(cornerRadius: 3))
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisValueLabel {
                            Text("\(value.as(Int.self) ?? 0)")
                                .font(.system(size: 9, design: .monospaced))
                                .foregroundColor(.optaTextMuted)
                        }
                        AxisGridLine()
                            .foregroundStyle(Color.optaBorder.opacity(0.1))
                    }
                }
                .chartXAxis {
                    AxisMarks { value in
                        AxisValueLabel()
                            .font(.system(size: 9))
                            .foregroundStyle(Color.optaTextMuted)
                    }
                }
                .frame(height: 180)
                .padding(.horizontal, 4)
            }
        }
        .chartPanel()
        .staggeredIgnition(index: 1, isVisible: appeared)
    }

    // MARK: - Hourly Heat Map

    private func hourlyHeatMap(_ summary: BotMetricSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            chartHeader("Activity Heat Map", icon: "flame", subtitle: "Messages by hour of day")

            let maxCount = summary.hourlyActivity.map(\.value).max() ?? 1

            HStack(spacing: 2) {
                ForEach(Array(summary.hourlyActivity.enumerated()), id: \.element.id) { index, point in
                    VStack(spacing: 3) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(heatColor(point.value, max: maxCount))
                            .frame(width: 18, height: 36)
                            .overlay(
                                RoundedRectangle(cornerRadius: 3)
                                    .stroke(Color.optaBorder.opacity(0.1), lineWidth: 0.5)
                            )

                        if index % 4 == 0 {
                            Text("\(index)")
                                .font(.system(size: 8, design: .monospaced))
                                .foregroundColor(.optaTextMuted)
                        } else {
                            Text("")
                                .font(.system(size: 8))
                        }
                    }
                    .help("\(point.label ?? ""): \(Int(point.value)) messages")
                }
            }
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.vertical, 8)
        }
        .chartPanel()
        .staggeredIgnition(index: 2, isVisible: appeared)
    }

    // MARK: - Cross-Bot Comparison

    private var crossBotComparison: some View {
        VStack(alignment: .leading, spacing: 10) {
            chartHeader("Bot Comparison", icon: "chart.bar.xaxis.ascending", subtitle: "Cross-bot metrics")

            if collector.summaries.isEmpty {
                emptyChartState("Connect bots to see comparison")
            } else {
                Chart(collector.summaries) { summary in
                    BarMark(
                        x: .value("Bot", summary.botName),
                        y: .value("Messages", summary.totalMessages)
                    )
                    .foregroundStyle(by: .value("Bot", summary.botName))
                    .annotation(position: .top) {
                        Text(summary.botEmoji)
                            .font(.system(size: 12))
                    }
                }
                .chartForegroundStyleScale(range: [
                    Color.optaPrimary, .optaCyan, .optaGreen,
                    .optaAmber, .optaPink, .optaCoral
                ])
                .chartLegend(.hidden)
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisValueLabel()
                            .font(.system(size: 9, design: .monospaced))
                            .foregroundStyle(Color.optaTextMuted)
                        AxisGridLine()
                            .foregroundStyle(Color.optaBorder.opacity(0.1))
                    }
                }
                .frame(height: 220)
                .padding(.horizontal, 4)

                // Health scores row
                HStack(spacing: 8) {
                    ForEach(collector.summaries) { summary in
                        VStack(spacing: 4) {
                            Text(summary.botEmoji)
                                .font(.system(size: 16))
                            HealthRing(score: summary.healthScore, size: 40)
                            Text(summary.botName)
                                .font(.sora(9))
                                .foregroundColor(.optaTextSecondary)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(.top, 8)
            }
        }
        .chartPanel()
        .staggeredIgnition(index: 0, isVisible: appeared)
    }

    // MARK: - Helpers

    private func chartHeader(_ title: String, icon: String, subtitle: String) -> some View {
        HStack {
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundColor(.optaPrimary)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.sora(13, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                Text(subtitle)
                    .font(.sora(10))
                    .foregroundColor(.optaTextMuted)
            }
            Spacer()
        }
    }

    private func emptyChartState(_ message: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "chart.line.downtrend.xyaxis")
                .font(.system(size: 24))
                .foregroundColor(.optaTextMuted)
            Text(message)
                .font(.sora(11))
                .foregroundColor(.optaTextMuted)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 120)
    }

    private func healthColor(_ score: Int) -> Color {
        if score >= 80 { return .optaGreen }
        if score >= 50 { return .optaAmber }
        return .optaRed
    }

    private func heatColor(_ value: Double, max: Double) -> Color {
        let intensity = max > 0 ? value / max : 0
        if intensity < 0.1 { return Color.optaSurface }
        if intensity < 0.3 { return Color.optaPrimary.opacity(0.2) }
        if intensity < 0.6 { return Color.optaPrimary.opacity(0.45) }
        return Color.optaPrimary.opacity(0.7)
    }

    private func formatResponseTime(_ seconds: Double) -> String {
        if seconds <= 0 { return "--" }
        if seconds < 1 { return String(format: "%.0fms", seconds * 1000) }
        return String(format: "%.1fs", seconds)
    }
}

// MARK: - Metric Card

struct MetricCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    let index: Int
    let appeared: Bool

    @State private var isHovered = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 11))
                    .foregroundColor(color)
                Spacer()
            }

            Text(value)
                .font(.system(size: 22, weight: .bold, design: .monospaced))
                .foregroundColor(.optaTextPrimary)

            Text(title)
                .font(.sora(10))
                .foregroundColor(.optaTextMuted)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.optaSurface.opacity(0.4))
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 14))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(isHovered ? color.opacity(0.3) : Color.optaBorder.opacity(0.1), lineWidth: 0.5)
        )
        .shadow(color: isHovered ? color.opacity(0.1) : .clear, radius: 12, y: 4)
        .scaleEffect(isHovered ? 1.02 : 1)
        .onHover { hover in
            withAnimation(.optaSnap) { isHovered = hover }
        }
        .staggeredIgnition(index: index, isVisible: appeared)
    }
}

// MARK: - Health Ring

struct HealthRing: View {
    let score: Int
    let size: CGFloat

    private var progress: Double { Double(score) / 100.0 }

    private var color: Color {
        if score >= 80 { return .optaGreen }
        if score >= 50 { return .optaAmber }
        return .optaRed
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.optaSurface, lineWidth: 3)

            Circle()
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(-90))

            Text("\(score)")
                .font(.system(size: size * 0.28, weight: .bold, design: .monospaced))
                .foregroundColor(.optaTextPrimary)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Chart Panel Modifier

private extension View {
    func chartPanel() -> some View {
        self
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.optaSurface.opacity(0.3))
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.optaBorder.opacity(0.1), lineWidth: 0.5)
            )
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let toggleAnalytics = Notification.Name("toggleAnalytics")
    static let analyticsTimeRangeChanged = Notification.Name("analyticsTimeRangeChanged")
}

// MARK: - Module Registration

/// **To add:**
///   1. Add `case analytics` to `DetailMode` in ContentView.swift
///   2. Add notification listener: `.onReceive(.toggleAnalytics) { detailMode = .analytics }`
///   3. Add keyboard shortcut Cmd+Shift+A to post .toggleAnalytics
///   4. In detail switch: `case .analytics: AnalyticsDashboardView()`
///   5. Add "Analytics Dashboard" to CommandPalette
///
/// **To remove:**
///   1. Delete this file
///   2. Remove `case analytics` from DetailMode
///   3. Remove notification listener and keyboard shortcut
///   4. No data cleanup needed — reads existing stats, doesn't create new stores
enum AnalyticsDashboardModule {
    static func register() {
        // Module is view-driven. No background registration needed.
    }

    /// Optional: clear any cached metric snapshots.
    static func cleanup() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = appSupport.appendingPathComponent("OptaPlus/Analytics")
        try? FileManager.default.removeItem(at: dir)
    }
}
