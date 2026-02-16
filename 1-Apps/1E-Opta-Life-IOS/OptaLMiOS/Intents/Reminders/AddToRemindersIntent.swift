import AppIntents
import SwiftUI

// MARK: - Add To Reminders Intent

struct AddToRemindersIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Reminder to iOS"
    static var description = IntentDescription("Create a reminder directly in the iOS Reminders app")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Reminder")
    var title: String

    @Parameter(title: "Notes")
    var notes: String?

    @Parameter(title: "Due Date")
    var dueDate: Date?

    @Parameter(title: "Priority", default: .medium)
    var priority: ReminderPriorityEntity

    @Parameter(title: "List")
    var listName: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Add reminder \(\.$title)") {
            \.$notes
            \.$dueDate
            \.$priority
            \.$listName
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        // TODO: Full implementation in Phase 2
        return .result(dialog: "This feature is coming soon. Please use the app directly.")
    }
}

// MARK: - Reminder Priority Entity

enum ReminderPriorityEntity: String, AppEnum {
    case none
    case low
    case medium
    case high

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Priority")

    static var caseDisplayRepresentations: [ReminderPriorityEntity: DisplayRepresentation] = [
        .none: DisplayRepresentation(title: "None"),
        .low: DisplayRepresentation(title: "Low"),
        .medium: DisplayRepresentation(title: "Medium"),
        .high: DisplayRepresentation(title: "High")
    ]

    var rawPriority: Int {
        switch self {
        case .none: return 0
        case .low: return 3
        case .medium: return 5
        case .high: return 9
        }
    }
}
