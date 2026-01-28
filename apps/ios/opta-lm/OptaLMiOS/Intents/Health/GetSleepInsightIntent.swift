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

        // Request Health access
        let hasAccess = await healthService.requestHealthAccess()
        guard hasAccess else {
            throw NSError(domain: "OptaHealth", code: 1, userInfo: [NSLocalizedDescriptionKey: "Health access is required. Please enable it in Settings → Privacy → Health."])
        }

        // Fetch sleep data
        do {
            let sleepData = try await healthService.fetchSleepData(for: date.actualDate)

            // PRIVACY: Generate vague spoken response (no specific times/numbers)
            let spokenSummary = generateVagueSpokenSummary(sleepData)

            return .result(
                dialog: IntentDialog(stringLiteral: spokenSummary),
                view: SleepInsightSnippetView(data: sleepData, date: date)
            )

        } catch {
            throw NSError(domain: "OptaHealth", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to fetch sleep data: \(error.localizedDescription)"])
        }
    }

    // PRIVACY: Return vague descriptions without specific numbers
    private func generateVagueSpokenSummary(_ data: SleepData) -> String {
        if data.totalHours == 0 {
            return "No sleep data available for this period."
        }

        // Use qualitative descriptions instead of exact numbers
        let qualityDescription: String
        if data.quality >= 85 {
            qualityDescription = "excellent"
        } else if data.quality >= 70 {
            qualityDescription = "good"
        } else if data.quality >= 50 {
            qualityDescription = "moderate"
        } else {
            qualityDescription = "poor"
        }

        let durationDescription: String
        if data.totalHours >= 7.5 {
            durationDescription = "well"
        } else if data.totalHours >= 6 {
            durationDescription = "adequately"
        } else {
            durationDescription = "less than ideal"
        }

        return "You slept \(durationDescription) \(date.spokenPhrase). Your sleep quality was \(qualityDescription)."
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
            let startOfWeek = calendar.dateComponents([.calendar, .yearForWeekOfYear, .weekOfYear], from: now).date!
            return startOfWeek
        case .lastWeek:
            let startOfThisWeek = calendar.dateComponents([.calendar, .yearForWeekOfYear, .weekOfYear], from: now).date!
            return calendar.date(byAdding: .weekOfYear, value: -1, to: startOfThisWeek)!
        }
    }

    var spokenPhrase: String {
        return self.rawValue
    }
}

// MARK: - Sleep Insight Snippet View

struct SleepInsightSnippetView: View {
    let data: SleepData
    let date: SleepDateEntity

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "bed.double.fill")
                    .foregroundColor(.indigo)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Sleep Insight")
                        .font(.headline)
                    Text(date.rawValue.capitalized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                // Quality badge
                VStack {
                    Text(data.qualityDescription)
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(data.qualityColor)
                    Text("\(Int(data.quality))%")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }

            // Total sleep duration
            HStack {
                Image(systemName: "moon.stars.fill")
                    .foregroundColor(.indigo)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Total Sleep")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(formatHours(data.totalHours))
                        .font(.title3)
                        .fontWeight(.semibold)
                }
            }

            // Sleep stages breakdown
            VStack(alignment: .leading, spacing: 8) {
                Text("Sleep Stages")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.secondary)

                SleepStageRow(
                    label: "Deep",
                    hours: data.deepSleepHours,
                    color: .purple,
                    percentage: data.deepSleepHours / data.totalHours
                )
                SleepStageRow(
                    label: "REM",
                    hours: data.remSleepHours,
                    color: .blue,
                    percentage: data.remSleepHours / data.totalHours
                )
                SleepStageRow(
                    label: "Light",
                    hours: data.lightSleepHours,
                    color: .cyan,
                    percentage: data.lightSleepHours / data.totalHours
                )
                if data.awakeHours > 0 {
                    SleepStageRow(
                        label: "Awake",
                        hours: data.awakeHours,
                        color: .orange,
                        percentage: data.awakeHours / data.totalHours
                    )
                }
            }

            // Bed and wake times
            if let bedTime = data.bedTime, let wakeTime = data.wakeTime {
                HStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Bed Time")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        Text(bedTime, style: .time)
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Wake Time")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        Text(wakeTime, style: .time)
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                }
            }

            // Heart rate data if available
            if let avgHR = data.heartRateAvg, let minHR = data.heartRateMin {
                HStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Avg Heart Rate")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        Text("\(Int(avgHR)) bpm")
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Min Heart Rate")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        Text("\(Int(minHR)) bpm")
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                }
            }
        }
        .padding()
    }

    private func formatHours(_ hours: Double) -> String {
        let totalMinutes = Int(hours * 60)
        let h = totalMinutes / 60
        let m = totalMinutes % 60
        return "\(h)h \(m)m"
    }
}

// MARK: - Sleep Stage Row Component

struct SleepStageRow: View {
    let label: String
    let hours: Double
    let color: Color
    let percentage: Double

    var body: some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 50, alignment: .leading)

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 6)
                        .cornerRadius(3)

                    Rectangle()
                        .fill(color)
                        .frame(width: geometry.size.width * percentage, height: 6)
                        .cornerRadius(3)
                }
            }
            .frame(height: 6)

            Text(formatTime(hours))
                .font(.caption)
                .fontWeight(.medium)
                .frame(width: 50, alignment: .trailing)
        }
    }

    private func formatTime(_ hours: Double) -> String {
        let totalMinutes = Int(hours * 60)
        let h = totalMinutes / 60
        let m = totalMinutes % 60
        if h > 0 {
            return "\(h)h \(m)m"
        } else {
            return "\(m)m"
        }
    }
}

// Real implementations in HealthService.swift and HealthModels.swift
