import AppIntents
import SwiftUI
import Charts

// MARK: - Get Productivity Correlation Intent

struct GetProductivityCorrelationIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Productivity Correlation"
    static var description = IntentDescription("Analyze the correlation between sleep/activity and task completion")

    static var openAppWhenRun: Bool = true

    @Parameter(title: "Time Period", default: CorrelationPeriodEntity.lastWeek)
    var period: CorrelationPeriodEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Show productivity correlation for \(\.$period)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let healthService = HealthService.shared; if false {
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Health service is not available."])
        }

        // Request Health access
        let hasAccess = await healthService.requestHealthAccess()
        guard hasAccess else {
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Health access is required. Please enable it in Settings → Privacy → Health."])
        }

        // Fetch historical data
        let startDate = period.startDate
        let endDate = Date()

        // Fetch sleep data for period
        var dailyCorrelations: [DailyCorrelation] = []
        let calendar = Calendar.current
        var currentDate = startDate

        while currentDate <= endDate {
            // Fetch sleep data
            let sleepData = try? await healthService.fetchSleepData(for: currentDate)

            // Fetch activity data
            let activityData = try? await healthService.fetchActivityData(for: currentDate)

            // Fetch tasks completed that day
            let api = APIService.shared
            let tasksCompleted = try? await fetchTasksCompleted(for: currentDate, api: api)

            if let sleep = sleepData, let activity = activityData, let tasks = tasksCompleted {
                dailyCorrelations.append(DailyCorrelation(
                    date: currentDate,
                    sleepHours: sleep.totalHours,
                    sleepQuality: sleep.quality,
                    steps: activity.steps,
                    tasksCompleted: tasks
                ))
            }

            currentDate = calendar.date(byAdding: .day, value: 1, to: currentDate)!
        }

        // Calculate correlations
        let insights = calculateCorrelations(dailyCorrelations)

        // Generate spoken summary
        let spokenSummary = generateSpokenSummary(insights)

        return .result(
            dialog: IntentDialog(stringLiteral: spokenSummary),
            view: ProductivityCorrelationSnippetView(
                correlations: dailyCorrelations,
                insights: insights,
                period: period
            )
        )
    }

    private func fetchTasksCompleted(for date: Date, api: APIService) async throws -> Int {
        // This would need a new API endpoint to fetch completed tasks by date
        // For now, return stub data
        return 0
    }

    private func calculateCorrelations(_ data: [DailyCorrelation]) -> CorrelationInsights {
        guard !data.isEmpty else {
            return CorrelationInsights(
                sleepCorrelation: 0,
                activityCorrelation: 0,
                optimalSleep: 0,
                optimalSteps: 0,
                recommendation: "Not enough data to analyze."
            )
        }

        // Calculate correlation coefficients (simplified Pearson)
        let sleepCorr = calculatePearsonCorrelation(
            data.map { $0.sleepHours },
            data.map { Double($0.tasksCompleted) }
        )

        let activityCorr = calculatePearsonCorrelation(
            data.map { Double($0.steps) },
            data.map { Double($0.tasksCompleted) }
        )

        // Find optimal values (when productivity is highest)
        let sortedByProductivity = data.sorted { $0.tasksCompleted > $1.tasksCompleted }
        let topPerformingDays = sortedByProductivity.prefix(max(3, data.count / 3))

        let optimalSleep = topPerformingDays.map { $0.sleepHours }.reduce(0, +) / Double(topPerformingDays.count)
        let optimalSteps = topPerformingDays.map { $0.steps }.reduce(0, +) / topPerformingDays.count

        // Generate recommendation
        let recommendation = generateRecommendation(
            sleepCorr: sleepCorr,
            activityCorr: activityCorr,
            optimalSleep: optimalSleep,
            optimalSteps: optimalSteps
        )

        return CorrelationInsights(
            sleepCorrelation: sleepCorr,
            activityCorrelation: activityCorr,
            optimalSleep: optimalSleep,
            optimalSteps: Int(optimalSteps),
            recommendation: recommendation
        )
    }

    private func calculatePearsonCorrelation(_ x: [Double], _ y: [Double]) -> Double {
        guard x.count == y.count && x.count > 1 else { return 0 }

        let n = Double(x.count)
        let sumX = x.reduce(0, +)
        let sumY = y.reduce(0, +)
        let sumXY = zip(x, y).map(*).reduce(0, +)
        let sumX2 = x.map { $0 * $0 }.reduce(0, +)
        let sumY2 = y.map { $0 * $0 }.reduce(0, +)

        let numerator = n * sumXY - sumX * sumY
        let denominator = sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

        guard denominator != 0 else { return 0 }
        return numerator / denominator
    }

    private func generateRecommendation(
        sleepCorr: Double,
        activityCorr: Double,
        optimalSleep: Double,
        optimalSteps: Int
    ) -> String {
        var rec = ""

        if sleepCorr > 0.5 {
            rec += "Sleep strongly affects your productivity. Aim for \(String(format: "%.1f", optimalSleep)) hours nightly. "
        }

        if activityCorr > 0.5 {
            rec += "Physical activity boosts your productivity. Target \(optimalSteps) steps daily. "
        }

        if sleepCorr < 0.3 && activityCorr < 0.3 {
            rec = "No strong correlation found. Keep tracking for better insights."
        }

        return rec.trimmingCharacters(in: .whitespaces)
    }

    private func generateSpokenSummary(_ insights: CorrelationInsights) -> String {
        if insights.sleepCorrelation > 0.5 {
            return "Your sleep significantly impacts productivity. You perform best with around \(String(format: "%.1f", insights.optimalSleep)) hours of sleep."
        } else if insights.activityCorrelation > 0.5 {
            return "Physical activity correlates with your productivity. You're most productive when hitting around \(insights.optimalSteps) steps."
        } else {
            return "No strong correlation found yet. Keep tracking for better insights over time."
        }
    }
}

// MARK: - Correlation Period Entity

enum CorrelationPeriodEntity: String, AppEnum {
    case lastWeek = "last week"
    case lastTwoWeeks = "last two weeks"
    case lastMonth = "last month"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Time Period")

    static var caseDisplayRepresentations: [CorrelationPeriodEntity: DisplayRepresentation] = [
        .lastWeek: DisplayRepresentation(title: "Last Week"),
        .lastTwoWeeks: DisplayRepresentation(title: "Last 2 Weeks"),
        .lastMonth: DisplayRepresentation(title: "Last Month")
    ]

    var startDate: Date {
        let calendar = Calendar.current
        let now = Date()

        switch self {
        case .lastWeek:
            return calendar.date(byAdding: .day, value: -7, to: now)!
        case .lastTwoWeeks:
            return calendar.date(byAdding: .day, value: -14, to: now)!
        case .lastMonth:
            return calendar.date(byAdding: .month, value: -1, to: now)!
        }
    }
}

// MARK: - Daily Correlation Model

struct DailyCorrelation: Identifiable {
    let id = UUID()
    let date: Date
    let sleepHours: Double
    let sleepQuality: Double
    let steps: Int
    let tasksCompleted: Int
}

// MARK: - Correlation Insights Model

struct CorrelationInsights {
    let sleepCorrelation: Double // -1 to 1
    let activityCorrelation: Double // -1 to 1
    let optimalSleep: Double
    let optimalSteps: Int
    let recommendation: String

    var sleepCorrelationStrength: String {
        let abs = abs(sleepCorrelation)
        if abs > 0.7 { return "Strong" }
        if abs > 0.4 { return "Moderate" }
        if abs > 0.2 { return "Weak" }
        return "None"
    }

    var activityCorrelationStrength: String {
        let abs = abs(activityCorrelation)
        if abs > 0.7 { return "Strong" }
        if abs > 0.4 { return "Moderate" }
        if abs > 0.2 { return "Weak" }
        return "None"
    }
}

// MARK: - Productivity Correlation Snippet View

struct ProductivityCorrelationSnippetView: View {
    let correlations: [DailyCorrelation]
    let insights: CorrelationInsights
    let period: CorrelationPeriodEntity

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .foregroundColor(.purple)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Productivity Correlation")
                        .font(.headline)
                    Text(period.rawValue.capitalized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Correlation strength indicators
            VStack(spacing: 12) {
                CorrelationRow(
                    icon: "bed.double.fill",
                    label: "Sleep Impact",
                    strength: insights.sleepCorrelationStrength,
                    value: insights.sleepCorrelation,
                    color: .indigo
                )

                CorrelationRow(
                    icon: "figure.walk",
                    label: "Activity Impact",
                    strength: insights.activityCorrelationStrength,
                    value: insights.activityCorrelation,
                    color: .green
                )
            }

            Divider()

            // Optimal values
            VStack(alignment: .leading, spacing: 8) {
                Text("Your Peak Performance")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.secondary)

                HStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Sleep")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        Text(String(format: "%.1f hours", insights.optimalSleep))
                            .font(.subheadline)
                            .fontWeight(.semibold)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Steps")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        Text("\(insights.optimalSteps)")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                    }
                }
            }

            // Recommendation
            if !insights.recommendation.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Image(systemName: "lightbulb.fill")
                            .foregroundColor(.yellow)
                            .font(.caption)
                        Text("Recommendation")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                    }

                    Text(insights.recommendation)
                        .font(.caption)
                        .foregroundColor(.primary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding()
                .background(Color.yellow.opacity(0.1))
                .cornerRadius(8)
            }
        }
        .padding()
    }
}

// MARK: - Correlation Row Component

struct CorrelationRow: View {
    let icon: String
    let label: String
    let strength: String
    let value: Double
    let color: Color

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text(strength)
                    .font(.subheadline)
                    .fontWeight(.semibold)
            }

            Spacer()

            Text(String(format: "%.2f", value))
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(strengthColor.opacity(0.15))
                .cornerRadius(6)
        }
    }

    private var strengthColor: Color {
        let abs = abs(value)
        if abs > 0.7 { return .green }
        if abs > 0.4 { return .blue }
        if abs > 0.2 { return .orange }
        return .gray
    }
}
