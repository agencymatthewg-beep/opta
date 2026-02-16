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
        // TODO: Full implementation in Phase 2
        return .result(dialog: "This feature is coming soon. Please use the app directly.")
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
}
