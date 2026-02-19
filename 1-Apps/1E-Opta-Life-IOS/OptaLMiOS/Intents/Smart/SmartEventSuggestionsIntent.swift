import AppIntents
import SwiftUI

// MARK: - Smart Event Suggestions Intent

struct SmartEventSuggestionsIntent: AppIntent {
    static var title: LocalizedStringResource = "Smart Event Suggestions"
    static var description = IntentDescription("Get AI-suggested events based on your schedule and tasks")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Period", default: .thisWeek)
    var period: SuggestionPeriodEntity

    @Parameter(title: "Type", default: .all)
    var suggestionType: SuggestionTypeEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Suggest \(\.$suggestionType) events for \(\.$period)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        // Fetch tasks and calendar events
        let tasks: [OptaTask]
        let events: [CalendarEvent]

        do {
            tasks = try await APIService.shared.fetchTodayTasks()
            events = try await APIService.shared.fetchCalendarEvents()
        } catch {
            HapticManager.shared.notification(.error)
            return .result(
                dialog: "I couldn't fetch your schedule to generate suggestions.",
                view: NoSuggestionsSnippetView()
            )
        }

        let suggestions = generateSuggestions(tasks: tasks, events: events, type: suggestionType)

        if suggestions.isEmpty {
            HapticManager.shared.notification(.success)
            return .result(
                dialog: "Your schedule looks well-organized! No suggestions right now.",
                view: NoSuggestionsSnippetView()
            )
        }

        HapticManager.shared.notification(.success)

        let count = suggestions.count
        let spoken = "I have \(count) suggestion\(count == 1 ? "" : "s") for your schedule."

        return .result(
            dialog: IntentDialog(stringLiteral: spoken),
            view: SmartEventSuggestionsSnippetView(suggestions: suggestions, periodLabel: period.rawValue.capitalized)
        )
    }

    // MARK: - Suggestion Generation

    private func generateSuggestions(tasks: [OptaTask], events: [CalendarEvent], type: SuggestionTypeEntity) -> [EventSuggestion] {
        var suggestions: [EventSuggestion] = []
        let calendar = Calendar.current
        let now = Date()

        // 1. Planning sessions before deadlines
        if type == .all || type == .planning {
            let urgentTasks = tasks.filter { !$0.isCompleted && ($0.priority == .urgent || $0.priority == .high) }
            for task in urgentTasks {
                if let dueDate = task.due?.displayDate,
                   dueDate > now,
                   dueDate < calendar.date(byAdding: .day, value: 7, to: now)! {
                    let planDate = calendar.date(byAdding: .day, value: -2, to: dueDate) ?? now
                    if planDate > now {
                        suggestions.append(EventSuggestion(
                            title: "Plan: \(task.content)",
                            suggestedDate: planDate,
                            duration: 45,
                            type: .planning,
                            reason: "Deadline in \(calendar.dateComponents([.day], from: now, to: dueDate).day ?? 0) days",
                            confidence: task.priority == .urgent ? 0.9 : 0.7
                        ))
                    }
                }
            }
        }

        // 2. Break suggestions between consecutive events
        if type == .all || type == .breaks {
            let sortedEvents = events
                .filter { $0.startDate != nil && !$0.isAllDay }
                .sorted { ($0.startDate ?? .distantPast) < ($1.startDate ?? .distantPast) }

            for i in 0..<(sortedEvents.count - 1) {
                if let end1 = sortedEvents[i].endDate,
                   let start2 = sortedEvents[i + 1].startDate {
                    let gap = start2.timeIntervalSince(end1)
                    // If back-to-back (< 15 min gap) after a long meeting (> 1h)
                    if gap < 900, let start1 = sortedEvents[i].startDate {
                        let meetingDuration = end1.timeIntervalSince(start1)
                        if meetingDuration >= 3600 {
                            suggestions.append(EventSuggestion(
                                title: "Break after \(sortedEvents[i].summary)",
                                suggestedDate: end1,
                                duration: 15,
                                type: .breaks,
                                reason: "Back-to-back meetings detected",
                                confidence: 0.8
                            ))
                        }
                    }
                }
            }
        }

        // 3. Weekly review
        if type == .all || type == .review {
            let weekday = calendar.component(.weekday, from: now)
            // Suggest Friday review if not already scheduled
            if weekday <= 6 { // Before Saturday
                let friday = calendar.nextDate(after: now, matching: DateComponents(weekday: 6, hour: 16), matchingPolicy: .nextTime)
                if let friday, !events.contains(where: { $0.summary.lowercased().contains("review") }) {
                    suggestions.append(EventSuggestion(
                        title: "Weekly Review",
                        suggestedDate: friday,
                        duration: 30,
                        type: .review,
                        reason: "Regular weekly review keeps you on track",
                        confidence: 0.6
                    ))
                }
            }
        }

        // 4. Wellness / exercise
        if type == .all || type == .wellness {
            let hasExercise = events.contains { event in
                let title = event.summary.lowercased()
                return title.contains("gym") || title.contains("workout") || title.contains("run") ||
                       title.contains("yoga") || title.contains("exercise") || title.contains("walk")
            }
            if !hasExercise {
                let tomorrow9am = calendar.nextDate(after: now, matching: DateComponents(hour: 9), matchingPolicy: .nextTime)
                if let date = tomorrow9am {
                    suggestions.append(EventSuggestion(
                        title: "Exercise Session",
                        suggestedDate: date,
                        duration: 30,
                        type: .wellness,
                        reason: "No exercise found in your schedule",
                        confidence: 0.5
                    ))
                }
            }
        }

        return suggestions.sorted { $0.confidence > $1.confidence }
    }
}

// MARK: - Entities

enum SuggestionPeriodEntity: String, AppEnum {
    case today = "today"
    case thisWeek = "this week"
    case nextWeek = "next week"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Suggestion Period")

    static var caseDisplayRepresentations: [SuggestionPeriodEntity: DisplayRepresentation] = [
        .today: DisplayRepresentation(title: "Today"),
        .thisWeek: DisplayRepresentation(title: "This Week"),
        .nextWeek: DisplayRepresentation(title: "Next Week")
    ]
}

enum SuggestionTypeEntity: String, AppEnum {
    case all = "all"
    case planning = "planning"
    case breaks = "breaks"
    case review = "review"
    case wellness = "wellness"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Suggestion Type")

    static var caseDisplayRepresentations: [SuggestionTypeEntity: DisplayRepresentation] = [
        .all: DisplayRepresentation(title: "All"),
        .planning: DisplayRepresentation(title: "Planning Sessions"),
        .breaks: DisplayRepresentation(title: "Break Times"),
        .review: DisplayRepresentation(title: "Reviews"),
        .wellness: DisplayRepresentation(title: "Wellness")
    ]

    var icon: String {
        switch self {
        case .all: return "sparkles"
        case .planning: return "calendar.badge.clock"
        case .breaks: return "cup.and.saucer.fill"
        case .review: return "checklist"
        case .wellness: return "heart.fill"
        }
    }

    var color: Color {
        switch self {
        case .all: return .purple
        case .planning: return .blue
        case .breaks: return .mint
        case .review: return .orange
        case .wellness: return .green
        }
    }
}

// MARK: - Models

struct EventSuggestion: Identifiable {
    let id = UUID()
    let title: String
    let suggestedDate: Date
    let duration: Int // minutes
    let type: SuggestionTypeEntity
    let reason: String
    let confidence: Double // 0-1
}

// MARK: - Snippet Views

struct SmartEventSuggestionsSnippetView: View {
    let suggestions: [EventSuggestion]
    let periodLabel: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "sparkles")
                    .foregroundColor(.purple)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Smart Suggestions")
                        .font(.headline)
                    Text(periodLabel)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text("\(suggestions.count)")
                    .font(.title3.bold())
                    .foregroundColor(.purple)
            }

            ForEach(suggestions.prefix(5)) { suggestion in
                HStack(spacing: 8) {
                    Image(systemName: suggestion.type.icon)
                        .foregroundColor(suggestion.type.color)
                        .font(.caption)
                        .frame(width: 20)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(suggestion.title)
                            .font(.caption.bold())
                        Text(suggestion.reason)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    // Confidence dots
                    HStack(spacing: 1) {
                        ForEach(0..<3, id: \.self) { i in
                            Circle()
                                .fill(Double(i) / 3.0 < suggestion.confidence ? suggestion.type.color : Color.gray.opacity(0.3))
                                .frame(width: 4, height: 4)
                        }
                    }
                }
            }
        }
        .padding()
    }
}

struct NoSuggestionsSnippetView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "sparkles")
                .font(.largeTitle)
                .foregroundColor(.secondary)
            Text("No suggestions right now")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}
