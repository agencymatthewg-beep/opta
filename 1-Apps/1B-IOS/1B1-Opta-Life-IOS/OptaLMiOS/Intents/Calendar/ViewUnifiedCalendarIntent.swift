import AppIntents
import SwiftUI

// MARK: - View Unified Calendar Intent

struct ViewUnifiedCalendarIntent: AppIntent {
    static var title: LocalizedStringResource = "View Unified Calendar"
    static var description = IntentDescription("View events from both Opta backend and Apple Calendar in one unified view")

    static var openAppWhenRun: Bool = true

    @Parameter(title: "Date Range", default: DateRangeEntity.nextSevenDays)
    var dateRange: DateRangeEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Show unified calendar for \(\.$dateRange)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        // Fetch from backend
        let api = APIService.shared
        let backendEvents = try await api.fetchCalendarEvents()

        // Fetch from Apple Calendar if available
        var appleEvents: [CalendarEventEntity] = []
        if let calendarService = try? CalendarSyncService() {
            let ekEvents = try await calendarService.fetchEvents(
                from: dateRange.startDate,
                to: dateRange.endDate
            )
            appleEvents = ekEvents.map { CalendarEventEntity(from: $0) }
        }

        // Merge and deduplicate
        let allEvents = mergeEvents(backend: backendEvents, apple: appleEvents)

        // Sort by date
        let sortedEvents = allEvents.sorted { $0.startTime < $1.startTime }

        // Generate spoken summary
        let eventCount = sortedEvents.count
        let dateRangeText = dateRange.spokenDescription
        let summary = eventCount == 0
            ? "You have no events \(dateRangeText)."
            : "You have \(eventCount) event\(eventCount == 1 ? "" : "s") \(dateRangeText)."

        return .result(
            dialog: IntentDialog(stringLiteral: summary),
            view: UnifiedCalendarSnippetView(events: sortedEvents, dateRange: dateRange)
        )
    }

    private func mergeEvents(backend: [CalendarEvent], apple: [CalendarEventEntity]) -> [CalendarEventEntity] {
        var merged: [CalendarEventEntity] = []

        // Add backend events
        merged.append(contentsOf: backend.map { CalendarEventEntity(from: $0, source: .backend) })

        // Add Apple events that don't duplicate backend events
        for appleEvent in apple {
            let isDuplicate = backend.contains { backendEvent in
                // Consider events duplicate if they have similar title and same time (within 5 minutes)
                let titleMatch = backendEvent.title.lowercased() == appleEvent.title.lowercased()
                let timeMatch = abs(backendEvent.startTime.timeIntervalSince(appleEvent.startTime)) < 300
                return titleMatch && timeMatch
            }

            if !isDuplicate {
                merged.append(appleEvent)
            }
        }

        return merged
    }
}

// MARK: - Date Range Entity

enum DateRangeEntity: String, AppEnum {
    case today
    case tomorrow
    case nextSevenDays
    case nextThirtyDays
    case thisWeek
    case nextWeek

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Date Range")

    static var caseDisplayRepresentations: [DateRangeEntity: DisplayRepresentation] = [
        .today: DisplayRepresentation(title: "Today"),
        .tomorrow: DisplayRepresentation(title: "Tomorrow"),
        .nextSevenDays: DisplayRepresentation(title: "Next 7 Days"),
        .nextThirtyDays: DisplayRepresentation(title: "Next 30 Days"),
        .thisWeek: DisplayRepresentation(title: "This Week"),
        .nextWeek: DisplayRepresentation(title: "Next Week")
    ]

    var startDate: Date {
        let calendar = Calendar.current
        let now = Date()

        switch self {
        case .today:
            return calendar.startOfDay(for: now)
        case .tomorrow:
            return calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
        case .nextSevenDays, .nextThirtyDays:
            return calendar.startOfDay(for: now)
        case .thisWeek:
            return calendar.dateComponents([.calendar, .yearForWeekOfYear, .weekOfYear], from: now).date!
        case .nextWeek:
            let nextWeekDate = calendar.date(byAdding: .weekOfYear, value: 1, to: now)!
            return calendar.dateComponents([.calendar, .yearForWeekOfYear, .weekOfYear], from: nextWeekDate).date!
        }
    }

    var endDate: Date {
        let calendar = Calendar.current

        switch self {
        case .today:
            return calendar.date(byAdding: .day, value: 1, to: startDate)!
        case .tomorrow:
            return calendar.date(byAdding: .day, value: 1, to: startDate)!
        case .nextSevenDays:
            return calendar.date(byAdding: .day, value: 7, to: startDate)!
        case .nextThirtyDays:
            return calendar.date(byAdding: .day, value: 30, to: startDate)!
        case .thisWeek:
            return calendar.date(byAdding: .weekOfYear, value: 1, to: startDate)!
        case .nextWeek:
            return calendar.date(byAdding: .weekOfYear, value: 1, to: startDate)!
        }
    }

    var spokenDescription: String {
        switch self {
        case .today: return "today"
        case .tomorrow: return "tomorrow"
        case .nextSevenDays: return "in the next 7 days"
        case .nextThirtyDays: return "in the next 30 days"
        case .thisWeek: return "this week"
        case .nextWeek: return "next week"
        }
    }
}

// MARK: - Calendar Event Entity

struct CalendarEventEntity: Identifiable {
    let id: String
    let title: String
    let startTime: Date
    let endTime: Date
    let location: String?
    let source: EventSource

    init(from event: CalendarEvent, source: EventSource = .backend) {
        self.id = event.id
        self.title = event.title
        self.startTime = event.startTime
        self.endTime = event.endTime
        self.location = event.location
        self.source = source
    }

    init(from ekEvent: AppleCalendarEvent) {
        self.id = ekEvent.eventIdentifier
        self.title = ekEvent.title
        self.startTime = ekEvent.startDate
        self.endTime = ekEvent.endDate
        self.location = ekEvent.location
        self.source = .appleCalendar
    }
}

// MARK: - Event Source Enum

enum EventSource: String, Codable {
    case backend = "Backend"
    case appleCalendar = "Apple Calendar"
    case both = "Both"
}

// MARK: - Unified Calendar Snippet View

struct UnifiedCalendarSnippetView: View {
    let events: [CalendarEventEntity]
    let dateRange: DateRangeEntity

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "calendar")
                    .foregroundColor(.blue)
                Text("Unified Calendar")
                    .font(.headline)
                Spacer()
                Text(dateRange.rawValue.capitalized)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if events.isEmpty {
                Text("No events scheduled")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 20)
            } else {
                // Events list
                ForEach(events.prefix(5)) { event in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(event.title)
                                .font(.subheadline)
                                .fontWeight(.medium)
                            Spacer()
                            Text(event.source.rawValue)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(sourceColor(for: event.source).opacity(0.2))
                                .cornerRadius(4)
                        }

                        HStack(spacing: 8) {
                            Text(event.startTime, style: .time)
                                .font(.caption)
                                .foregroundColor(.secondary)

                            if let location = event.location {
                                Text("•")
                                    .foregroundColor(.secondary)
                                Text(location)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                    .padding(.vertical, 6)

                    if event.id != events.prefix(5).last?.id {
                        Divider()
                    }
                }

                if events.count > 5 {
                    Text("+ \(events.count - 5) more events")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.top, 4)
                }
            }
        }
        .padding()
    }

    private func sourceColor(for source: EventSource) -> Color {
        switch source {
        case .backend: return .blue
        case .appleCalendar: return .green
        case .both: return .purple
        }
    }
}

// MARK: - Stub Service Classes

// Stub for CalendarSyncService (will be replaced by Phase 1 implementation)
@MainActor
class CalendarSyncService {
    func fetchEvents(from: Date, to: Date) async throws -> [AppleCalendarEvent] {
        // This is a stub - Phase 1 will implement full EventKit integration
        return []
    }
}

// Stub for AppleCalendarEvent
struct AppleCalendarEvent {
    let eventIdentifier: String
    let title: String
    let startDate: Date
    let endDate: Date
    let location: String?
}
