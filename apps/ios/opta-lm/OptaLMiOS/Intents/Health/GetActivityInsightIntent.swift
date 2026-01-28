import AppIntents
import SwiftUI

// MARK: - Get Activity Insight Intent

struct GetActivityInsightIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Activity Insight"
    static var description = IntentDescription("View activity data and insights from Apple Health")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Date", default: ActivityDateEntity.today)
    var date: ActivityDateEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Show my activity for \(\.$date)")
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

        // Fetch activity data
        do {
            let activityData = try await healthService.fetchActivityData(for: date.actualDate)

            // Generate spoken summary
            let spokenSummary = generateSpokenSummary(activityData)

            return .result(
                dialog: IntentDialog(stringLiteral: spokenSummary),
                view: ActivityInsightSnippetView(data: activityData, date: date)
            )

        } catch {
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to fetch activity data: \(error.localizedDescription)"])
        }
    }

    private func generateSpokenSummary(_ data: ActivityData) -> String {
        var summary = "Today you've taken \(formatNumber(data.steps)) steps"

        if data.distance > 0 {
            let distanceKm = String(format: "%.1f", data.distance)
            summary += ", walked \(distanceKm) kilometers"
        }

        if data.activeMinutes > 0 {
            summary += ", and been active for \(data.activeMinutes) minutes"
        }

        summary += "."

        // Add goal status if applicable
        if data.steps >= 10000 {
            summary += " You've reached your step goal!"
        }

        return summary
    }

    private func formatNumber(_ number: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: number)) ?? "\(number)"
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

// MARK: - Activity Insight Snippet View

struct ActivityInsightSnippetView: View {
    let data: ActivityData
    let date: ActivityDateEntity

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "figure.walk")
                    .foregroundColor(.green)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Activity Insight")
                        .font(.headline)
                    Text(date.rawValue.capitalized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Main metrics grid
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                ActivityMetricCard(
                    icon: "figure.walk",
                    title: "Steps",
                    value: formatNumber(data.steps),
                    subtitle: "of 10,000 goal",
                    color: .green,
                    progress: Double(data.steps) / 10000.0
                )

                ActivityMetricCard(
                    icon: "flame.fill",
                    title: "Calories",
                    value: "\(Int(data.calories))",
                    subtitle: "kcal burned",
                    color: .red,
                    progress: nil
                )

                ActivityMetricCard(
                    icon: "location.fill",
                    title: "Distance",
                    value: String(format: "%.1f", data.distance),
                    subtitle: "kilometers",
                    color: .blue,
                    progress: nil
                )

                ActivityMetricCard(
                    icon: "clock.fill",
                    title: "Active Time",
                    value: "\(data.activeMinutes)",
                    subtitle: "minutes",
                    color: .orange,
                    progress: Double(data.activeMinutes) / 60.0
                )
            }

            // Stand hours (Apple Watch metric)
            if data.standHours > 0 {
                HStack {
                    Image(systemName: "figure.stand")
                        .foregroundColor(.purple)
                    Text("Stand Hours")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("\(data.standHours)/12")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 8)
                .background(Color.purple.opacity(0.1))
                .cornerRadius(8)
            }

            // Achievement status
            if data.steps >= 10000 {
                HStack {
                    Image(systemName: "trophy.fill")
                        .foregroundColor(.yellow)
                    Text("Step goal achieved!")
                        .font(.caption)
                        .fontWeight(.medium)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(Color.yellow.opacity(0.15))
                .cornerRadius(6)
            }
        }
        .padding()
    }

    private func formatNumber(_ number: Int) -> String {
        if number >= 1000 {
            let thousands = Double(number) / 1000.0
            return String(format: "%.1fK", thousands)
        }
        return "\(number)"
    }
}

// MARK: - Activity Metric Card Component

struct ActivityMetricCard: View {
    let icon: String
    let title: String
    let value: String
    let subtitle: String
    let color: Color
    let progress: Double?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                    .font(.title3)
                Spacer()
            }

            Text(value)
                .font(.title2)
                .fontWeight(.bold)

            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)

            Text(subtitle)
                .font(.caption2)
                .foregroundColor(.secondary)

            // Progress bar if available
            if let progress = progress {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Rectangle()
                            .fill(Color.gray.opacity(0.2))
                            .frame(height: 4)
                            .cornerRadius(2)

                        Rectangle()
                            .fill(color)
                            .frame(width: geometry.size.width * min(progress, 1.0), height: 4)
                            .cornerRadius(2)
                    }
                }
                .frame(height: 4)
            }
        }
        .padding()
        .background(color.opacity(0.1))
        .cornerRadius(12)
    }
}
