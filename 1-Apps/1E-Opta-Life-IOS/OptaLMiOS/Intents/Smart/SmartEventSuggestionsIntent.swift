import AppIntents
import SwiftUI

// MARK: - Smart Event Suggestions Intent

struct SmartEventSuggestionsIntent: AppIntent {
    static var title: LocalizedStringResource = "Smart Event Suggestions"
    static var description = IntentDescription("Get AI-suggested events based on your schedule and tasks")

    static var openAppWhenRun: Bool = true

    @Parameter(title: "Time Period", default: SuggestionPeriodEntity.nextWeek)
    var period: SuggestionPeriodEntity

    @Parameter(title: "Suggestion Type", default: .all)
    var suggestionType: SuggestionTypeEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Suggest \(\.$suggestionType) for \(\.$period)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let api = APIService.shared

        // Fetch current calendar events
        let events = try await api.fetchCalendarEvents()

        // Fetch current tasks
        let dashboard = try await api.fetchTasksDashboard()
        let tasks = dashboard.todayTasks + dashboard.upcomingTasks

        // Generate smart suggestions using AI
        let suggestions = await generateSmartSuggestions(
            existingEvents: events,
            tasks: tasks,
            period: period,
            type: suggestionType
        )

        // Generate spoken summary
        let count = suggestions.count
        let spokenSummary = count == 0
            ? "No suggestions available for \(period.spokenDescription)."
            : "I have \(count) suggestion\(count == 1 ? "" : "s") for \(period.spokenDescription)."

        return .result(
            dialog: IntentDialog(stringLiteral: spokenSummary),
            view: SmartEventSuggestionsSnippetView(
                suggestions: suggestions,
                period: period,
                suggestionType: suggestionType
            )
        )
    }

    private func generateSmartSuggestions(
        existingEvents: [CalendarEvent],
        tasks: [OptaTask],
        period: SuggestionPeriodEntity,
        type: SuggestionTypeEntity
    ) async -> [EventSuggestion] {
        var suggestions: [EventSuggestion] = []

        // Analyze task deadlines and suggest planning sessions
        if type == .all || type == .planning {
            let upcomingDeadlines = tasks.filter { task in
                guard let dueDate = task.due?.date else { return false }
                let daysUntil = Calendar.current.dateComponents([.day], from: Date(), to: dueDate).day ?? 0
                return daysUntil >= 0 && daysUntil <= 7
            }

            for task in upcomingDeadlines.prefix(3) {
                guard let dueDate = task.due?.date else { continue }

                // Suggest planning session 2 days before deadline
                let suggestedDate = Calendar.current.date(byAdding: .day, value: -2, to: dueDate)!
                let suggestedTime = findAvailableTimeSlot(on: suggestedDate, events: existingEvents)

                suggestions.append(EventSuggestion(
                    id: UUID().uuidString,
                    title: "Plan: \(task.content)",
                    suggestedDate: suggestedTime,
                    duration: 60,
                    reason: "Deadline approaching (\(daysUntil(dueDate)) days)",
                    type: .planning,
                    relatedTaskId: task.id,
                    confidence: 0.85
                ))
            }
        }

        // Suggest break times if there are long work sessions
        if type == .all || type == .breaks {
            let workEvents = existingEvents.filter { event in
                event.title.lowercased().contains("meeting") ||
                event.title.lowercased().contains("work") ||
                event.title.lowercased().contains("call")
            }

            // Find consecutive work blocks > 3 hours
            for i in 0..<workEvents.count - 1 {
                let event1 = workEvents[i]
                let event2 = workEvents[i + 1]

                if event2.startTime.timeIntervalSince(event1.endTime) < 300 { // Less than 5 min gap
                    let totalDuration = event2.endTime.timeIntervalSince(event1.startTime)
                    if totalDuration > 3 * 3600 { // More than 3 hours
                        // Suggest a break between them
                        suggestions.append(EventSuggestion(
                            id: UUID().uuidString,
                            title: "Take a Break",
                            suggestedDate: event1.endTime,
                            duration: 15,
                            reason: "Long work session detected",
                            type: .break,
                            relatedTaskId: nil,
                            confidence: 0.9
                        ))
                    }
                }
            }
        }

        // Suggest review sessions at end of week
        if type == .all || type == .review {
            let calendar = Calendar.current
            let friday = nextWeekday(.friday, from: Date())

            if !existingEvents.contains(where: {
                $0.title.lowercased().contains("review") &&
                calendar.isDate($0.startTime, inSameDayAs: friday)
            }) {
                suggestions.append(EventSuggestion(
                    id: UUID().uuidString,
                    title: "Weekly Review",
                    suggestedDate: calendar.date(bySettingHour: 16, minute: 0, second: 0, of: friday)!,
                    duration: 30,
                    reason: "Weekly reflection and planning",
                    type: .review,
                    relatedTaskId: nil,
                    confidence: 0.7
                ))
            }
        }

        // Suggest exercise if no recent activity events
        if type == .all || type == .wellness {
            let hasRecentExercise = existingEvents.contains { event in
                event.title.lowercased().contains("workout") ||
                event.title.lowercased().contains("gym") ||
                event.title.lowercased().contains("run") ||
                event.title.lowercased().contains("exercise")
            }

            if !hasRecentExercise {
                let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
                let morningTime = Calendar.current.date(bySettingHour: 7, minute: 0, second: 0, of: tomorrow)!

                suggestions.append(EventSuggestion(
                    id: UUID().uuidString,
                    title: "Morning Workout",
                    suggestedDate: morningTime,
                    duration: 45,
                    reason: "No exercise scheduled this week",
                    type: .wellness,
                    relatedTaskId: nil,
                    confidence: 0.65
                ))
            }
        }

        return suggestions.sorted { $0.confidence > $1.confidence }
    }

    private func findAvailableTimeSlot(on date: Date, events: [CalendarEvent]) -> Date {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)

        // Try to find free slot between 9 AM - 5 PM
        for hour in 9...17 {
            let potentialTime = calendar.date(bySettingHour: hour, minute: 0, second: 0, of: startOfDay)!

            let hasConflict = events.contains { event in
                calendar.isDate(event.startTime, inSameDayAs: date) &&
                event.startTime <= potentialTime &&
                event.endTime > potentialTime
            }

            if !hasConflict {
                return potentialTime
            }
        }

        // Default to 2 PM if no free slot found
        return calendar.date(bySettingHour: 14, minute: 0, second: 0, of: startOfDay)!
    }

    private func nextWeekday(_ weekday: Weekday, from date: Date) -> Date {
        let calendar = Calendar.current
        var components = DateComponents()
        components.weekday = weekday.rawValue

        return calendar.nextDate(after: date, matching: components, matchingPolicy: .nextTime)!
    }

    private func daysUntil(_ date: Date) -> Int {
        let days = Calendar.current.dateComponents([.day], from: Date(), to: date).day ?? 0
        return max(0, days)
    }

    enum Weekday: Int {
        case sunday = 1, monday, tuesday, wednesday, thursday, friday, saturday
    }
}

// MARK: - Suggestion Period Entity

enum SuggestionPeriodEntity: String, AppEnum {
    case tomorrow = "tomorrow"
    case nextThreeDays = "next 3 days"
    case nextWeek = "next week"
    case nextTwoWeeks = "next 2 weeks"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Time Period")

    static var caseDisplayRepresentations: [SuggestionPeriodEntity: DisplayRepresentation] = [
        .tomorrow: DisplayRepresentation(title: "Tomorrow"),
        .nextThreeDays: DisplayRepresentation(title: "Next 3 Days"),
        .nextWeek: DisplayRepresentation(title: "Next Week"),
        .nextTwoWeeks: DisplayRepresentation(title: "Next 2 Weeks")
    ]

    var spokenDescription: String {
        return self.rawValue
    }
}

// MARK: - Suggestion Type Entity

enum SuggestionTypeEntity: String, AppEnum {
    case all = "all types"
    case planning = "planning sessions"
    case breaks = "break times"
    case review = "review sessions"
    case wellness = "wellness activities"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Suggestion Type")

    static var caseDisplayRepresentations: [SuggestionTypeEntity: DisplayRepresentation] = [
        .all: DisplayRepresentation(title: "All Types"),
        .planning: DisplayRepresentation(title: "Planning Sessions"),
        .breaks: DisplayRepresentation(title: "Break Times"),
        .review: DisplayRepresentation(title: "Review Sessions"),
        .wellness: DisplayRepresentation(title: "Wellness Activities")
    ]
}

// MARK: - Event Suggestion Model

struct EventSuggestion: Identifiable {
    let id: String
    let title: String
    let suggestedDate: Date
    let duration: Int // minutes
    let reason: String
    let type: EventType
    let relatedTaskId: String?
    let confidence: Double // 0-1

    enum EventType {
        case planning
        case `break`
        case review
        case wellness
        case social
        case learning

        var icon: String {
            switch self {
            case .planning: return "calendar.badge.clock"
            case .break: return "cup.and.saucer"
            case .review: return "checkmark.circle"
            case .wellness: return "heart.fill"
            case .social: return "person.2.fill"
            case .learning: return "book.fill"
            }
        }

        var color: Color {
            switch self {
            case .planning: return .blue
            case .break: return .orange
            case .review: return .purple
            case .wellness: return .pink
            case .social: return .green
            case .learning: return .indigo
            }
        }
    }
}

// MARK: - Smart Event Suggestions Snippet View

struct SmartEventSuggestionsSnippetView: View {
    let suggestions: [EventSuggestion]
    let period: SuggestionPeriodEntity
    let suggestionType: SuggestionTypeEntity

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "sparkles")
                    .foregroundColor(.purple)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Smart Suggestions")
                        .font(.headline)
                    Text(period.rawValue.capitalized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            if suggestions.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title)
                        .foregroundColor(.green)
                    Text("Your schedule looks balanced!")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            } else {
                // Suggestions list
                ForEach(suggestions.prefix(5)) { suggestion in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .top) {
                            Image(systemName: suggestion.type.icon)
                                .foregroundColor(suggestion.type.color)
                                .frame(width: 24)

                            VStack(alignment: .leading, spacing: 4) {
                                Text(suggestion.title)
                                    .font(.subheadline)
                                    .fontWeight(.semibold)

                                HStack(spacing: 8) {
                                    Text(suggestion.suggestedDate, style: .date)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Text("•")
                                        .foregroundColor(.secondary)
                                    Text(suggestion.suggestedDate, style: .time)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Text("•")
                                        .foregroundColor(.secondary)
                                    Text("\(suggestion.duration)m")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }

                                Text(suggestion.reason)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .italic()
                            }

                            Spacer()

                            // Confidence indicator
                            ConfidenceBadge(confidence: suggestion.confidence)
                        }

                        if suggestion.id != suggestions.prefix(5).last?.id {
                            Divider()
                        }
                    }
                    .padding(.vertical, 4)
                }

                if suggestions.count > 5 {
                    Text("+ \(suggestions.count - 5) more suggestions")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.top, 4)
                }
            }
        }
        .padding()
    }
}

// MARK: - Confidence Badge Component

struct ConfidenceBadge: View {
    let confidence: Double

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<3) { index in
                Circle()
                    .fill(index < confidenceLevel ? color : Color.gray.opacity(0.3))
                    .frame(width: 6, height: 6)
            }
        }
    }

    private var confidenceLevel: Int {
        if confidence >= 0.8 { return 3 }
        if confidence >= 0.6 { return 2 }
        return 1
    }

    private var color: Color {
        if confidence >= 0.8 { return .green }
        if confidence >= 0.6 { return .blue }
        return .orange
    }
}
