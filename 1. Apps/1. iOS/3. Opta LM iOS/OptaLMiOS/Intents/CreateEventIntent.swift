import AppIntents

// MARK: - Create Event Intent

struct CreateEventIntent: AppIntent {
    static var title: LocalizedStringResource = "Create Event in Opta"
    static var description = IntentDescription("Schedule a new event on your calendar")
    
    static var openAppWhenRun: Bool = false
    
    @Parameter(title: "Event Title")
    var eventTitle: String
    
    @Parameter(title: "Start Time")
    var startTime: Date
    
    @Parameter(title: "Duration", default: 60)
    var durationMinutes: Int
    
    static var parameterSummary: some ParameterSummary {
        Summary("Schedule \(\.$eventTitle) at \(\.$startTime)") {
            \.$durationMinutes
        }
    }
    
    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let api = APIService.shared
        
        let formatter = ISO8601DateFormatter()
        let startString = formatter.string(from: startTime)
        let endTime = startTime.addingTimeInterval(TimeInterval(durationMinutes * 60))
        let endString = formatter.string(from: endTime)
        
        do {
            try await api.createCalendarEvent(
                summary: eventTitle,
                startTime: startString,
                endTime: endString
            )
            
            let timeString = startTime.formatted(date: .abbreviated, time: .shortened)
            return .result(dialog: "Scheduled '\(eventTitle)' for \(timeString).")
            
        } catch {
            return .result(dialog: "Sorry, I couldn't create that event. Please try again.")
        }
    }
}

// MARK: - Delete Event Intent

struct DeleteEventIntent: AppIntent {
    static var title: LocalizedStringResource = "Delete Event from Opta"
    static var description = IntentDescription("Remove an event from your calendar")
    
    static var openAppWhenRun: Bool = false
    
    @Parameter(title: "Event")
    var event: CalendarEventEntity?
    
    @Parameter(title: "Search Query")
    var searchQuery: String?
    
    static var parameterSummary: some ParameterSummary {
        When(\.$event, .hasAnyValue) {
            Summary("Delete \(\.$event)")
        } otherwise: {
            Summary("Delete event matching \(\.$searchQuery)")
        }
    }
    
    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let api = APIService.shared
        
        // If specific event provided
        if let event = event {
            do {
                try await api.deleteCalendarEvent(eventId: event.id)
                return .result(dialog: "Deleted '\(event.name)' from your calendar.")
            } catch {
                return .result(dialog: "Sorry, I couldn't delete that event.")
            }
        }
        
        // If search query provided, we'd need to search first
        // For now, return an error
        return .result(dialog: "Please specify which event to delete.")
    }
}

// MARK: - Calendar Event Entity

struct CalendarEventEntity: AppEntity {
    var id: String
    var name: String
    var startTime: Date?
    
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Calendar Event")
    static var defaultQuery = CalendarEventEntityQuery()
    
    var displayRepresentation: DisplayRepresentation {
        var subtitle: String? = nil
        if let time = startTime {
            subtitle = time.formatted(date: .abbreviated, time: .shortened)
        }
        return DisplayRepresentation(title: LocalizedStringResource(stringLiteral: name), subtitle: subtitle.map { LocalizedStringResource(stringLiteral: $0) })
    }
}

struct CalendarEventEntityQuery: EntityQuery {
    @MainActor
    func entities(for identifiers: [String]) async throws -> [CalendarEventEntity] {
        let api = APIService.shared
        let events = try await api.fetchCalendarEvents(range: "week")
        
        return events
            .filter { identifiers.contains($0.id) }
            .map { CalendarEventEntity(id: $0.id, name: $0.summary, startTime: $0.startDate) }
    }
    
    @MainActor
    func suggestedEntities() async throws -> [CalendarEventEntity] {
        let api = APIService.shared
        let events = try await api.fetchCalendarEvents(range: "today")
        
        return events.prefix(5).map { CalendarEventEntity(id: $0.id, name: $0.summary, startTime: $0.startDate) }
    }
}
