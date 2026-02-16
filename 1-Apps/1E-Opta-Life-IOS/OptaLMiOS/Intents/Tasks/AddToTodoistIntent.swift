import AppIntents
import SwiftUI

// MARK: - Add To Todoist Intent

struct AddToTodoistIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Task to Todoist"
    static var description = IntentDescription("Create a task directly in Todoist via Opta")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Task")
    var taskContent: String

    @Parameter(title: "Due Date")
    var dueDate: Date?

    @Parameter(title: "Priority", default: .medium)
    var priority: TodoistPriorityEntity

    @Parameter(title: "Project")
    var projectName: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Add \(\.$taskContent) to Todoist") {
            \.$dueDate
            \.$priority
            \.$projectName
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        // TODO: Full Todoist implementation in Phase 2
        return .result(dialog: "Todoist integration is coming soon. Please use the app directly.")
    }
}

// MARK: - Todoist Priority Entity

enum TodoistPriorityEntity: String, AppEnum {
    case normal = "normal"
    case medium = "medium"
    case high = "high"
    case urgent = "urgent"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Priority")

    static var caseDisplayRepresentations: [TodoistPriorityEntity: DisplayRepresentation] = [
        .normal: DisplayRepresentation(
            title: "Normal",
            subtitle: "P4",
            image: .init(systemName: "circle")
        ),
        .medium: DisplayRepresentation(
            title: "Medium",
            subtitle: "P3",
            image: .init(systemName: "exclamationmark")
        ),
        .high: DisplayRepresentation(
            title: "High",
            subtitle: "P2",
            image: .init(systemName: "exclamationmark.2")
        ),
        .urgent: DisplayRepresentation(
            title: "Urgent",
            subtitle: "P1",
            image: .init(systemName: "exclamationmark.3")
        )
    ]

    var rawPriority: Int {
        // Todoist priority: 1 = urgent, 2 = high, 3 = medium, 4 = normal
        switch self {
        case .normal: return 4
        case .medium: return 3
        case .high: return 2
        case .urgent: return 1
        }
    }
}
