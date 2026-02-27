import AppIntents
import SwiftUI

// MARK: - Get Sleep Insight Intent

struct GetSleepInsightIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Sleep Insight"
    static var description = IntentDescription("View sleep data and insights from Apple Health")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Date", default: SleepDateEntity.lastNight)
    var date: SleepDateEntity

    static var parameterSummary: some ParameterSummary {
        Summary("How did I sleep \(\.$date)?")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let healthService = HealthService.shared

        guard healthService.isHealthDataAvailable else {
            HapticManager.shared.notification(.warning)
            return .result(
                dialog: "Health data isn't available on this device.",
                view: SleepUnavailableSnippetView()
            )
        }

        let hasAccess = await healthService.requestHealthAccess()
        guard hasAccess else {
            HapticManager.shared.notification(.warning)
            return .result(
                dialog: "I need access to your health data. Please enable it in Settings → Privacy → Health.",
                view: SleepUnavailableSnippetView()
            )
        }

        do {
            let sleepData = try await healthService.fetchSleepData(for: date.actualDate)

            HapticManager.shared.notification(.success)

            // PRIVACY: Vague spoken response
            let spoken = sleepData.spokenSummary

            return .result(
                dialog: IntentDialog(stringLiteral: spoken),
                view: SleepInsightSnippetView(data: sleepData, dateLabel: date.rawValue.capitalized)
            )
        } catch {
            HapticManager.shared.notification(.error)
            return .result(
                dialog: "I couldn't retrieve sleep data right now.",
                view: SleepUnavailableSnippetView()
            )
        }
    }
}

// MARK: - Sleep Date Entity

enum SleepDateEntity: String, AppEnum {
    case lastNight = "last night"
    case twoDaysAgo = "two days ago"
    case thisWeek = "this week"
    case lastWeek = "last week"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Sleep Date")

    static var caseDisplayRepresentations: [SleepDateEntity: DisplayRepresentation] = [
        .lastNight: DisplayRepresentation(title: "Last Night"),
        .twoDaysAgo: DisplayRepresentation(title: "Two Days Ago"),
        .thisWeek: DisplayRepresentation(title: "This Week"),
        .lastWeek: DisplayRepresentation(title: "Last Week")
    ]

    var actualDate: Date {
        let calendar = Calendar.current
        let now = Date()
        switch self {
        case .lastNight:
            return calendar.date(byAdding: .day, value: -1, to: calendar.startOfDay(for: now))!
        case .twoDaysAgo:
            return calendar.date(byAdding: .day, value: -2, to: calendar.startOfDay(for: now))!
        case .thisWeek:
            return calendar.dateComponents([.calendar, .yearForWeekOfYear, .weekOfYear], from: now).date!
        case .lastWeek:
            let startOfThisWeek = calendar.dateComponents([.calendar, .yearForWeekOfYear, .weekOfYear], from: now).date!
            return calendar.date(byAdding: .weekOfYear, value: -1, to: startOfThisWeek)!
        }
    }
}

// MARK: - Snippet Views

struct SleepInsightSnippetView: View {
    let data: SleepData
    let dateLabel: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "bed.double.fill")
                    .foregroundColor(.indigo)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Sleep Insight")
                        .font(.headline)
                    Text(dateLabel)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text(data.quality.emoji)
                    .font(.title2)
            }

            // Total + quality
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Total Sleep")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(data.detailedSummary)
                        .font(.subheadline.bold())
                }
                Spacer()
                Text(data.quality.displayName)
                    .font(.caption.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color(data.quality.color).opacity(0.2))
                    .cornerRadius(8)
            }

            Divider()

            // Sleep stages
            VStack(alignment: .leading, spacing: 6) {
                Text("Sleep Stages")
                    .font(.caption.bold())
                    .foregroundColor(.secondary)

                SleepStageBar(label: "Deep", hours: data.stages.deep, total: data.totalHours, color: .purple)
                SleepStageBar(label: "REM", hours: data.stages.rem, total: data.totalHours, color: .blue)
                SleepStageBar(label: "Light", hours: data.stages.light, total: data.totalHours, color: .cyan)
                if data.stages.awake > 0 {
                    SleepStageBar(label: "Awake", hours: data.stages.awake, total: data.totalHours, color: .orange)
                }
            }

            // Bed/wake times
            if let bedTime = data.bedTime, let wakeTime = data.wakeTime {
                HStack(spacing: 16) {
                    Label {
                        Text(bedTime, style: .time)
                            .font(.caption.bold())
                    } icon: {
                        Image(systemName: "moon.fill")
                            .font(.caption2)
                            .foregroundColor(.indigo)
                    }
                    Label {
                        Text(wakeTime, style: .time)
                            .font(.caption.bold())
                    } icon: {
                        Image(systemName: "sun.max.fill")
                            .font(.caption2)
                            .foregroundColor(.yellow)
                    }
                }
            }
        }
        .padding()
    }
}

struct SleepStageBar: View {
    let label: String
    let hours: Double
    let total: Double
    let color: Color

    var body: some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 44, alignment: .leading)

            ProgressView(value: total > 0 ? hours / total : 0)
                .tint(color)

            Text(formatTime(hours))
                .font(.caption.monospacedDigit())
                .frame(width: 44, alignment: .trailing)
        }
    }

    private func formatTime(_ hours: Double) -> String {
        let mins = Int(hours * 60)
        let h = mins / 60
        let m = mins % 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m"
    }
}

struct SleepUnavailableSnippetView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "moon.zzz")
                .font(.largeTitle)
                .foregroundColor(.secondary)
            Text("Sleep data unavailable")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}
