import AppIntents
import SwiftUI

// MARK: - Optimize Day Intent

struct OptimizeDayIntent: AppIntent {
    static var title: LocalizedStringResource = "Optimize Day"
    static var description = IntentDescription("Optimize your schedule based on sleep data, energy levels, and task priorities")

    static var openAppWhenRun: Bool = true

    @Parameter(title: "Date", default: OptimizeDateEntity.today)
    var date: OptimizeDateEntity

    @Parameter(title: "Apply Changes", default: false)
    var applyChanges: Bool

    static var parameterSummary: some ParameterSummary {
        Summary("Optimize schedule for \(\.$date)") {
            \.$applyChanges
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        // Fetch sleep data if available
        var sleepData: SleepData?
        if let healthService = HealthService.shared {
            let hasAccess = await healthService.requestHealthAccess()
            if hasAccess {
                sleepData = try? await healthService.fetchSleepData(for: date.actualDate)
            }
        }

        // Fetch current schedule
        let api = APIService.shared
        let events = try await api.fetchCalendarEvents()
        let dashboard = try await api.fetchTasksDashboard()
        let tasks = dashboard.todayTasks + dashboard.upcomingTasks

        // Generate optimization suggestions
        let optimization = generateOptimization(
            sleepData: sleepData,
            existingEvents: events,
            tasks: tasks,
            targetDate: date.actualDate
        )

        // Apply changes if requested
        var appliedCount = 0
        if applyChanges {
            for suggestion in optimization.suggestions {
                if suggestion.shouldAutoApply {
                    do {
                        try await applySuggestion(suggestion, api: api)
                        appliedCount += 1
                    } catch {
                        print("Failed to apply suggestion: \(error)")
                    }
                }
            }

            if appliedCount > 0 {
                HapticManager.shared.notification(.success)
            }
        }

        // Generate spoken response
        let spokenSummary: String
        if applyChanges {
            spokenSummary = appliedCount > 0
                ? "Applied \(appliedCount) optimization\(appliedCount == 1 ? "" : "s") to your schedule."
                : "No automatic optimizations applied. Review suggestions in the app."
        } else {
            spokenSummary = optimization.suggestions.isEmpty
                ? "Your schedule looks optimal for \(date.spokenDescription)."
                : "Found \(optimization.suggestions.count) suggestion\(optimization.suggestions.count == 1 ? "" : "s") to optimize your \(date.spokenDescription)."
        }

        return .result(
            dialog: IntentDialog(stringLiteral: spokenSummary),
            view: OptimizeDaySnippetView(
                optimization: optimization,
                date: date,
                changesApplied: applyChanges
            )
        )
    }

    private func generateOptimization(
        sleepData: SleepData?,
        existingEvents: [CalendarEvent],
        tasks: [OptaTask],
        targetDate: Date
    ) -> DayOptimization {
        var suggestions: [OptimizationSuggestion] = []
        let calendar = Calendar.current

        // Energy level estimation based on sleep
        let energyLevel: EnergyLevel
        if let sleep = sleepData {
            if sleep.quality >= 80 && sleep.totalHours >= 7 {
                energyLevel = .high
            } else if sleep.quality >= 60 && sleep.totalHours >= 6 {
                energyLevel = .medium
            } else {
                energyLevel = .low
            }
        } else {
            energyLevel = .medium // Default assumption
        }

        // Analyze current schedule
        let targetEvents = existingEvents.filter { calendar.isDate($0.startTime, inSameDayAs: targetDate) }
        let targetTasks = tasks.filter { task in
            guard let dueDate = task.due?.date else { return false }
            return calendar.isDate(dueDate, inSameDayAs: targetDate) && !task.isCompleted
        }

        // Suggestion 1: Schedule high-priority tasks during peak energy
        let highPriorityTasks = targetTasks.filter { $0.priority >= 3 }
        if !highPriorityTasks.isEmpty {
            let peakHours = energyLevel == .high ? (9, 12) : (10, 12) // Peak hours vary by energy level

            for task in highPriorityTasks.prefix(2) {
                let alreadyScheduled = targetEvents.contains { event in
                    event.title.lowercased().contains(task.content.lowercased())
                }

                if !alreadyScheduled {
                    let startHour = peakHours.0
                    let suggestedTime = calendar.date(bySettingHour: startHour, minute: 0, second: 0, of: targetDate)!

                    suggestions.append(OptimizationSuggestion(
                        id: UUID().uuidString,
                        title: "Schedule '\(task.content)' during peak energy",
                        description: "Based on your sleep quality, you'll be most productive between \(peakHours.0):00-\(peakHours.1):00",
                        type: .scheduleTask,
                        suggestedTime: suggestedTime,
                        relatedTaskId: task.id,
                        impact: .high,
                        shouldAutoApply: false
                    ))
                }
            }
        }

        // Suggestion 2: Add breaks between long meetings
        let consecutiveMeetings = findConsecutiveMeetings(targetEvents)
        for (meeting1, meeting2) in consecutiveMeetings {
            if meeting2.startTime.timeIntervalSince(meeting1.endTime) < 600 { // Less than 10 min gap
                suggestions.append(OptimizationSuggestion(
                    id: UUID().uuidString,
                    title: "Add break between meetings",
                    description: "Schedule a 15-minute break between '\(meeting1.title)' and '\(meeting2.title)'",
                    type: .addBreak,
                    suggestedTime: meeting1.endTime,
                    relatedTaskId: nil,
                    impact: .medium,
                    shouldAutoApply: true
                ))
            }
        }

        // Suggestion 3: Move low-energy tasks to afternoon if low sleep quality
        if energyLevel == .low {
            let lowPriorityTasks = targetTasks.filter { $0.priority <= 2 }
            for task in lowPriorityTasks.prefix(2) {
                let afternoonTime = calendar.date(bySettingHour: 14, minute: 0, second: 0, of: targetDate)!

                suggestions.append(OptimizationSuggestion(
                    id: UUID().uuidString,
                    title: "Schedule '\(task.content)' for afternoon",
                    description: "Based on low sleep quality, save easier tasks for when energy is lower",
                    type: .rescheduleTask,
                    suggestedTime: afternoonTime,
                    relatedTaskId: task.id,
                    impact: .medium,
                    shouldAutoApply: false
                ))
            }
        }

        // Suggestion 4: Add buffer time before important meetings
        let importantMeetings = targetEvents.filter { event in
            event.title.lowercased().contains("interview") ||
            event.title.lowercased().contains("presentation") ||
            event.title.lowercased().contains("demo")
        }

        for meeting in importantMeetings {
            let bufferTime = calendar.date(byAdding: .minute, value: -30, to: meeting.startTime)!

            suggestions.append(OptimizationSuggestion(
                id: UUID().uuidString,
                title: "Add prep time before '\(meeting.title)'",
                description: "Schedule 30 minutes before important meeting to prepare and review",
                type: .addPrep,
                suggestedTime: bufferTime,
                relatedTaskId: nil,
                impact: .high,
                shouldAutoApply: true
            ))
        }

        // Suggestion 5: Recommend earlier bedtime if sleep quality was poor
        if let sleep = sleepData, sleep.quality < 70 {
            suggestions.append(OptimizationSuggestion(
                id: UUID().uuidString,
                title: "Earlier bedtime tonight",
                description: "Your sleep quality was \(Int(sleep.quality))%. Try sleeping 30 minutes earlier tonight.",
                type: .sleepRecommendation,
                suggestedTime: nil,
                relatedTaskId: nil,
                impact: .high,
                shouldAutoApply: false
            ))
        }

        return DayOptimization(
            energyLevel: energyLevel,
            suggestions: suggestions.sorted { $0.impact.rawValue > $1.impact.rawValue },
            sleepQuality: sleepData?.quality,
            optimizationScore: calculateOptimizationScore(suggestions: suggestions)
        )
    }

    private func findConsecutiveMeetings(_ events: [CalendarEvent]) -> [(CalendarEvent, CalendarEvent)] {
        var pairs: [(CalendarEvent, CalendarEvent)] = []
        let sortedEvents = events.sorted { $0.startTime < $1.startTime }

        for i in 0..<sortedEvents.count - 1 {
            let event1 = sortedEvents[i]
            let event2 = sortedEvents[i + 1]

            if event2.startTime <= event1.endTime.addingTimeInterval(600) { // Within 10 min
                pairs.append((event1, event2))
            }
        }

        return pairs
    }

    private func calculateOptimizationScore(suggestions: [OptimizationSuggestion]) -> Double {
        guard !suggestions.isEmpty else { return 1.0 }

        // Lower score = more room for optimization
        let totalImpact = suggestions.reduce(0.0) { $0 + $1.impact.numericValue }
        let maxPossibleImpact = Double(suggestions.count) * OptimizationImpact.high.numericValue

        return 1.0 - (totalImpact / maxPossibleImpact)
    }

    private func applySuggestion(_ suggestion: OptimizationSuggestion, api: APIService) async throws {
        switch suggestion.type {
        case .addBreak:
            if let time = suggestion.suggestedTime {
                _ = try await api.createCalendarEvent(
                    title: "☕️ Break",
                    startTime: time,
                    endTime: time.addingTimeInterval(900), // 15 minutes
                    location: nil,
                    description: "Scheduled by Opta optimization",
                    isAllDay: false
                )
            }

        case .addPrep:
            if let time = suggestion.suggestedTime {
                _ = try await api.createCalendarEvent(
                    title: "📝 Prep Time",
                    startTime: time,
                    endTime: time.addingTimeInterval(1800), // 30 minutes
                    location: nil,
                    description: "Scheduled by Opta optimization",
                    isAllDay: false
                )
            }

        default:
            // Other types require user confirmation
            break
        }
    }
}

// MARK: - Optimize Date Entity

enum OptimizeDateEntity: String, AppEnum {
    case today = "today"
    case tomorrow = "tomorrow"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Date")

    static var caseDisplayRepresentations: [OptimizeDateEntity: DisplayRepresentation] = [
        .today: DisplayRepresentation(title: "Today"),
        .tomorrow: DisplayRepresentation(title: "Tomorrow")
    ]

    var actualDate: Date {
        let calendar = Calendar.current
        switch self {
        case .today:
            return Date()
        case .tomorrow:
            return calendar.date(byAdding: .day, value: 1, to: Date())!
        }
    }

    var spokenDescription: String {
        return self.rawValue
    }
}

// MARK: - Energy Level Enum

enum EnergyLevel: String {
    case low = "Low"
    case medium = "Medium"
    case high = "High"

    var color: Color {
        switch self {
        case .low: return .red
        case .medium: return .orange
        case .high: return .green
        }
    }

    var icon: String {
        switch self {
        case .low: return "battery.25"
        case .medium: return "battery.50"
        case .high: return "battery.100"
        }
    }
}

// MARK: - Optimization Suggestion Model

struct OptimizationSuggestion: Identifiable {
    let id: String
    let title: String
    let description: String
    let type: OptimizationType
    let suggestedTime: Date?
    let relatedTaskId: String?
    let impact: OptimizationImpact
    let shouldAutoApply: Bool

    enum OptimizationType {
        case scheduleTask
        case rescheduleTask
        case addBreak
        case addPrep
        case sleepRecommendation
        case exerciseRecommendation

        var icon: String {
            switch self {
            case .scheduleTask: return "calendar.badge.plus"
            case .rescheduleTask: return "arrow.right.circle"
            case .addBreak: return "cup.and.saucer"
            case .addPrep: return "note.text"
            case .sleepRecommendation: return "bed.double"
            case .exerciseRecommendation: return "figure.run"
            }
        }
    }
}

// MARK: - Optimization Impact Enum

enum OptimizationImpact: Int {
    case low = 1
    case medium = 2
    case high = 3

    var color: Color {
        switch self {
        case .low: return .blue
        case .medium: return .orange
        case .high: return .red
        }
    }

    var numericValue: Double {
        return Double(self.rawValue)
    }
}

// MARK: - Day Optimization Model

struct DayOptimization {
    let energyLevel: EnergyLevel
    let suggestions: [OptimizationSuggestion]
    let sleepQuality: Double?
    let optimizationScore: Double // 0-1 (1 = already optimal)
}

// MARK: - Optimize Day Snippet View

struct OptimizeDaySnippetView: View {
    let optimization: DayOptimization
    let date: OptimizeDateEntity
    let changesApplied: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "wand.and.stars")
                    .foregroundColor(.purple)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Day Optimization")
                        .font(.headline)
                    Text(date.rawValue.capitalized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                if changesApplied {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                }
            }

            // Energy and optimization score
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Energy Level")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    HStack {
                        Image(systemName: optimization.energyLevel.icon)
                            .foregroundColor(optimization.energyLevel.color)
                        Text(optimization.energyLevel.rawValue)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Schedule Score")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(String(format: "%.0f%%", optimization.optimizationScore * 100))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(scoreColor(optimization.optimizationScore))
                }
            }

            if let sleepQuality = optimization.sleepQuality {
                HStack {
                    Image(systemName: "moon.stars.fill")
                        .foregroundColor(.indigo)
                        .font(.caption)
                    Text("Sleep Quality: \(Int(sleepQuality))%")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Divider()

            // Suggestions
            if optimization.suggestions.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title)
                        .foregroundColor(.green)
                    Text("Your schedule is already optimized!")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            } else {
                Text("Suggestions")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.secondary)

                ForEach(optimization.suggestions.prefix(5)) { suggestion in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .top) {
                            Image(systemName: suggestion.type.icon)
                                .foregroundColor(suggestion.impact.color)
                                .frame(width: 20)

                            VStack(alignment: .leading, spacing: 3) {
                                Text(suggestion.title)
                                    .font(.caption)
                                    .fontWeight(.semibold)

                                Text(suggestion.description)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .fixedSize(horizontal: false, vertical: true)

                                if let time = suggestion.suggestedTime {
                                    Text(time, style: .time)
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                            }

                            Spacer()

                            if suggestion.shouldAutoApply && changesApplied {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.caption)
                                    .foregroundColor(.green)
                            }
                        }
                    }
                    .padding(.vertical, 4)

                    if suggestion.id != optimization.suggestions.prefix(5).last?.id {
                        Divider()
                    }
                }

                if optimization.suggestions.count > 5 {
                    Text("+ \(optimization.suggestions.count - 5) more suggestions")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.top, 4)
                }
            }
        }
        .padding()
    }

    private func scoreColor(_ score: Double) -> Color {
        if score >= 0.8 { return .green }
        if score >= 0.6 { return .blue }
        if score >= 0.4 { return .orange }
        return .red
    }
}
