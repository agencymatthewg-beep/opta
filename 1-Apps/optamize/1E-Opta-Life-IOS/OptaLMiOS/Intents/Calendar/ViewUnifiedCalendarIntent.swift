import AppIntents
import SwiftUI

// MARK: - View Unified Calendar Intent

struct ViewUnifiedCalendarIntent: AppIntent {
    static var title: LocalizedStringResource = "View Unified Calendar"
    static var description: IntentDescription = "View calendar events from all sources in a unified view."

    @Parameter(title: "Filter")
    var filter: CalendarViewFilterEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Show \(\.$filter) calendar events")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let apiService = APIService.shared
        let eventKitService = EventKitService.shared

        let range = dateRange(for: filter)
        var backendEvents: [CalendarEvent] = []
        var appleEvents: [UnifiedIntentEvent] = []
        var warnings: [String] = []

        do {
            backendEvents = try await apiService.fetchCalendarEvents(range: backendRange(for: filter))
        } catch {
            warnings.append("Opta calendar is unavailable right now.")
        }

        let hasCalendarAccess = await eventKitService.requestCalendarAccess()
        if hasCalendarAccess {
            let fetchedAppleEvents = eventKitService.fetchEvents(from: range.start, to: range.end)
            appleEvents = fetchedAppleEvents.map {
                UnifiedIntentEvent(
                    title: $0.title ?? "Untitled",
                    startDate: $0.startDate,
                    source: .apple
                )
            }
        } else {
            warnings.append("Apple Calendar access is not enabled.")
        }

        let backendUnified = backendEvents.compactMap { event -> UnifiedIntentEvent? in
            guard let startDate = event.startDate else { return nil }
            return UnifiedIntentEvent(
                title: event.summary,
                startDate: startDate,
                source: .backend
            )
        }

        let allEvents = deduplicateEvents(backendUnified + appleEvents)
            .filter { $0.startDate >= range.start && $0.startDate <= range.end }
            .sorted { $0.startDate < $1.startDate }

        if allEvents.isEmpty {
            let warningSuffix = warnings.isEmpty ? "" : " \(warnings.joined(separator: " "))"
            return .result(dialog: IntentDialog(stringLiteral: "No events found for \(filter.spokenDescription)." + warningSuffix))
        }

        let preview = allEvents.prefix(3).map { event in
            "\(event.title) at \(event.startDate.formatted(date: .omitted, time: .shortened))"
        }.joined(separator: ", ")

        let warningSuffix = warnings.isEmpty ? "" : " \(warnings.joined(separator: " "))"
        let summary = "You have \(allEvents.count) event\(allEvents.count == 1 ? "" : "s") \(filter.spokenDescription). Next: \(preview)." + warningSuffix

        HapticManager.shared.notification(.success)
        return .result(dialog: IntentDialog(stringLiteral: summary))
    }

    private func backendRange(for filter: CalendarViewFilterEntity) -> String {
        switch filter {
        case .today:
            return "today"
        case .tomorrow, .thisWeek:
            return "week"
        case .thisMonth:
            return "month"
        }
    }

    private func dateRange(for filter: CalendarViewFilterEntity) -> (start: Date, end: Date) {
        let calendar = Calendar.current
        let now = Date()

        switch filter {
        case .today:
            let start = calendar.startOfDay(for: now)
            let end = calendar.date(byAdding: DateComponents(day: 1, second: -1), to: start) ?? now
            return (start, end)
        case .tomorrow:
            let tomorrowStart = calendar.startOfDay(for: calendar.date(byAdding: .day, value: 1, to: now) ?? now)
            let tomorrowEnd = calendar.date(byAdding: DateComponents(day: 1, second: -1), to: tomorrowStart) ?? now
            return (tomorrowStart, tomorrowEnd)
        case .thisWeek:
            let start = calendar.startOfDay(for: now)
            let end = calendar.date(byAdding: .day, value: 7, to: start) ?? now
            return (start, end)
        case .thisMonth:
            let start = calendar.startOfDay(for: now)
            let end = calendar.date(byAdding: .day, value: 30, to: start) ?? now
            return (start, end)
        }
    }

    private func deduplicateEvents(_ events: [UnifiedIntentEvent]) -> [UnifiedIntentEvent] {
        var deduped: [UnifiedIntentEvent] = []

        for event in events {
            let alreadyExists = deduped.contains { existing in
                let titleMatch = existing.title.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
                    == event.title.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
                let timeDiff = abs(existing.startDate.timeIntervalSince(event.startDate))
                return titleMatch && timeDiff <= 300
            }

            if !alreadyExists {
                deduped.append(event)
            }
        }

        return deduped
    }
}

// MARK: - Calendar View Filter

enum CalendarViewFilterEntity: String, AppEnum {
    case today = "today"
    case tomorrow = "tomorrow"
    case thisWeek = "thisWeek"
    case thisMonth = "thisMonth"

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Calendar Filter"
    static var caseDisplayRepresentations: [Self: DisplayRepresentation] = [
        .today: "Today",
        .tomorrow: "Tomorrow",
        .thisWeek: "This Week",
        .thisMonth: "This Month",
    ]

    var spokenDescription: String {
        switch self {
        case .today:
            return "for today"
        case .tomorrow:
            return "for tomorrow"
        case .thisWeek:
            return "for this week"
        case .thisMonth:
            return "for this month"
        }
    }
}

private struct UnifiedIntentEvent {
    enum Source {
        case backend
        case apple
    }

    let title: String
    let startDate: Date
    let source: Source
}
