import AppIntents
import SwiftUI

// MARK: - Get Activity Insight Intent

struct GetActivityInsightIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Activity Insight"
    static var description = IntentDescription("View your daily activity data from Apple Health")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Date", default: ActivityDateEntity.today)
    var date: ActivityDateEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Show activity for \(\.$date)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let healthService = HealthService.shared

        guard healthService.isHealthDataAvailable else {
            HapticManager.shared.notification(.warning)
            return .result(
                dialog: "Health data isn't available on this device.",
                view: ActivityUnavailableSnippetView()
            )
        }

        let hasAccess = await healthService.requestHealthAccess()
        guard hasAccess else {
            HapticManager.shared.notification(.warning)
            return .result(
                dialog: "I need access to your health data. Please enable it in Settings.",
                view: ActivityUnavailableSnippetView()
            )
        }

        do {
            let activityData = try await healthService.fetchActivityData(for: date.actualDate)

            HapticManager.shared.notification(.success)

            // PRIVACY: Vague spoken response
            let spoken = activityData.spokenSummary

            return .result(
                dialog: IntentDialog(stringLiteral: spoken),
                view: ActivityInsightSnippetView(data: activityData, dateLabel: date.rawValue.capitalized)
            )
        } catch {
            HapticManager.shared.notification(.error)
            return .result(
                dialog: "I couldn't retrieve activity data right now.",
                view: ActivityUnavailableSnippetView()
            )
        }
    }
}

// MARK: - Activity Date Entity

enum ActivityDateEntity: String, AppEnum {
    case today = "today"
    case yesterday = "yesterday"
    case thisWeek = "this week"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Activity Date")

    static var caseDisplayRepresentations: [ActivityDateEntity: DisplayRepresentation] = [
        .today: DisplayRepresentation(title: "Today"),
        .yesterday: DisplayRepresentation(title: "Yesterday"),
        .thisWeek: DisplayRepresentation(title: "This Week")
    ]

    var actualDate: Date {
        let calendar = Calendar.current
        let now = Date()
        switch self {
        case .today:
            return calendar.startOfDay(for: now)
        case .yesterday:
            return calendar.date(byAdding: .day, value: -1, to: calendar.startOfDay(for: now))!
        case .thisWeek:
            return calendar.dateComponents([.calendar, .yearForWeekOfYear, .weekOfYear], from: now).date!
        }
    }
}

// MARK: - Activity Snippet View

struct ActivityInsightSnippetView: View {
    let data: ActivityData
    let dateLabel: String

    private let stepGoal = 10_000
    private let activeMinGoal = 60

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "figure.walk")
                    .foregroundColor(.green)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Activity Insight")
                        .font(.headline)
                    Text(dateLabel)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text(data.activityLevel.emoji)
                    .font(.title2)
            }

            // Metrics grid
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ActivityMetricCard(
                    icon: "figure.walk",
                    label: "Steps",
                    value: data.steps.formatted(),
                    progress: Double(data.steps) / Double(stepGoal),
                    color: .green
                )
                ActivityMetricCard(
                    icon: "flame.fill",
                    label: "Calories",
                    value: "\(Int(data.activeEnergyBurned)) kcal",
                    progress: nil,
                    color: .orange
                )
                ActivityMetricCard(
                    icon: "timer",
                    label: "Active Min",
                    value: "\(data.activeMinutes) min",
                    progress: Double(data.activeMinutes) / Double(activeMinGoal),
                    color: .cyan
                )
                ActivityMetricCard(
                    icon: "sportscourt",
                    label: "Workouts",
                    value: "\(data.workouts.count)",
                    progress: nil,
                    color: .purple
                )
            }

            // Workout list
            if !data.workouts.isEmpty {
                Divider()
                VStack(alignment: .leading, spacing: 6) {
                    Text("Workouts")
                        .font(.caption.bold())
                        .foregroundColor(.secondary)
                    ForEach(data.workouts) { workout in
                        HStack {
                            Text(workout.displayName)
                                .font(.caption)
                            Spacer()
                            Text("\(workout.durationMinutes)m")
                                .font(.caption.monospacedDigit())
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
        }
        .padding()
    }
}

struct ActivityMetricCard: View {
    let icon: String
    let label: String
    let value: String
    let progress: Double?
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption2)
                    .foregroundColor(color)
                Text(label)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            Text(value)
                .font(.subheadline.bold())
            if let progress {
                ProgressView(value: min(progress, 1.0))
                    .tint(color)
            }
        }
        .padding(8)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

struct ActivityUnavailableSnippetView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "figure.walk")
                .font(.largeTitle)
                .foregroundColor(.secondary)
            Text("Activity data unavailable")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}
