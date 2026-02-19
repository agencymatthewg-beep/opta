import AppIntents
import SwiftUI

// MARK: - Get Productivity Correlation Intent

struct GetProductivityCorrelationIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Productivity Correlation"
    static var description = IntentDescription("Analyze how your sleep and activity correlate with task completion")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Period", default: CorrelationPeriodEntity.lastWeek)
    var period: CorrelationPeriodEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Analyze productivity correlation for \(\.$period)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let healthService = HealthService.shared

        guard healthService.isHealthDataAvailable else {
            HapticManager.shared.notification(.warning)
            return .result(
                dialog: "Health data isn't available on this device.",
                view: CorrelationUnavailableSnippetView()
            )
        }

        let hasAccess = await healthService.requestHealthAccess()
        guard hasAccess else {
            HapticManager.shared.notification(.warning)
            return .result(
                dialog: "I need health data access to analyze correlations. Please enable in Settings.",
                view: CorrelationUnavailableSnippetView()
            )
        }

        do {
            let tasks = try await APIService.shared.fetchTodayTasks()
            let insights = try await healthService.analyzeProductivityCorrelation(
                tasks: tasks,
                days: period.days
            )

            HapticManager.shared.notification(.success)

            let spoken = insights.summary

            return .result(
                dialog: IntentDialog(stringLiteral: spoken),
                view: ProductivityCorrelationSnippetView(insights: insights, periodLabel: period.rawValue.capitalized)
            )
        } catch {
            HapticManager.shared.notification(.error)
            return .result(
                dialog: "I couldn't analyze productivity data right now.",
                view: CorrelationUnavailableSnippetView()
            )
        }
    }
}

// MARK: - Correlation Period Entity

enum CorrelationPeriodEntity: String, AppEnum {
    case lastWeek = "last week"
    case lastTwoWeeks = "last 2 weeks"
    case lastMonth = "last month"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Correlation Period")

    static var caseDisplayRepresentations: [CorrelationPeriodEntity: DisplayRepresentation] = [
        .lastWeek: DisplayRepresentation(title: "Last Week"),
        .lastTwoWeeks: DisplayRepresentation(title: "Last 2 Weeks"),
        .lastMonth: DisplayRepresentation(title: "Last Month")
    ]

    var days: Int {
        switch self {
        case .lastWeek: return 7
        case .lastTwoWeeks: return 14
        case .lastMonth: return 30
        }
    }
}

// MARK: - Snippet Views

struct ProductivityCorrelationSnippetView: View {
    let insights: ProductivityInsights
    let periodLabel: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .foregroundColor(.purple)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Productivity Correlation")
                        .font(.headline)
                    Text(periodLabel)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
            }

            // Correlation strength badge
            HStack {
                Text("Correlation:")
                    .font(.subheadline)
                Text(insights.correlationStrength.displayName)
                    .font(.subheadline.bold())
                    .foregroundColor(Color(insights.correlationStrength.color))

                Spacer()

                // Confidence dots
                HStack(spacing: 2) {
                    ForEach(0..<3, id: \.self) { i in
                        Circle()
                            .fill(i < confidenceDots ? Color(insights.correlationStrength.color) : Color.gray.opacity(0.3))
                            .frame(width: 6, height: 6)
                    }
                }
            }

            Divider()

            // Key stats
            VStack(alignment: .leading, spacing: 8) {
                CorrelationStatRow(
                    icon: "moon.fill",
                    label: "Avg Sleep",
                    value: String(format: "%.1fh", insights.averageSleepHours),
                    color: .indigo
                )
                CorrelationStatRow(
                    icon: "checkmark.circle",
                    label: "Avg Completion",
                    value: "\(Int(insights.averageTaskCompletionRate))%",
                    color: .green
                )
                CorrelationStatRow(
                    icon: "star.fill",
                    label: "Optimal Sleep",
                    value: String(format: "%.0f-%.0fh", insights.optimalSleepRange.lowerBound, insights.optimalSleepRange.upperBound),
                    color: .yellow
                )
            }

            // Recommendations
            if !insights.recommendations.isEmpty {
                Divider()
                VStack(alignment: .leading, spacing: 4) {
                    Text("Recommendations")
                        .font(.caption.bold())
                        .foregroundColor(.secondary)
                    ForEach(Array(insights.recommendations.prefix(3).enumerated()), id: \.offset) { _, rec in
                        HStack(alignment: .top, spacing: 4) {
                            Text("•")
                                .font(.caption)
                                .foregroundColor(.purple)
                            Text(rec)
                                .font(.caption)
                        }
                    }
                }
            }
        }
        .padding()
    }

    private var confidenceDots: Int {
        switch insights.correlationStrength {
        case .strong: return 3
        case .moderate: return 2
        case .weak: return 1
        case .negligible: return 0
        }
    }
}

struct CorrelationStatRow: View {
    let icon: String
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.caption)
                .frame(width: 20)
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.caption.bold())
        }
    }
}

struct CorrelationUnavailableSnippetView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.largeTitle)
                .foregroundColor(.secondary)
            Text("Productivity analysis unavailable")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}
