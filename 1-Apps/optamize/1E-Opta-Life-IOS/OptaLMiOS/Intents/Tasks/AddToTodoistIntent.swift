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
        let todoistService = TodoistService.shared

        guard todoistService.isAuthenticated else {
            throw NSError(
                domain: "OptaIntents",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Please connect your Todoist account in Opta settings first."]
            )
        }

        let trimmedTask = taskContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTask.isEmpty else {
            throw NSError(
                domain: "OptaIntents",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Task content cannot be empty."]
            )
        }

        var selectedProjectId: String?
        var selectedProjectName: String?
        var projectWarning: String?

        if let requestedProject = projectName?.trimmingCharacters(in: .whitespacesAndNewlines), !requestedProject.isEmpty {
            do {
                let projects = try await todoistService.fetchProjects()
                if let exact = projects.first(where: { $0.name.compare(requestedProject, options: .caseInsensitive) == .orderedSame }) {
                    selectedProjectId = exact.id
                    selectedProjectName = exact.name
                } else if let partial = projects.first(where: { $0.name.localizedCaseInsensitiveContains(requestedProject) }) {
                    selectedProjectId = partial.id
                    selectedProjectName = partial.name
                } else {
                    projectWarning = "Project '\(requestedProject)' was not found, so the task was added to your default Todoist project."
                }
            } catch {
                projectWarning = "Could not load Todoist projects, so the task was added to your default Todoist project."
            }
        }

        let request = TodoistTaskRequest(
            content: trimmedTask,
            dueString: dueString(from: dueDate),
            priority: priority.taskPriority,
            description: nil,
            projectId: selectedProjectId
        )

        do {
            let createdTask = try await todoistService.createTask(request)

            var response = "Added '\(createdTask.content)' to Todoist."
            if let dueLabel = createdTask.due?.string, !dueLabel.isEmpty {
                response += " Due \(dueLabel)."
            }
            if let selectedProjectName {
                response += " Project: \(selectedProjectName)."
            }
            if let projectWarning {
                response += " \(projectWarning)"
            }

            return .result(dialog: IntentDialog(stringLiteral: response))
        } catch {
            throw NSError(
                domain: "OptaIntents",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Failed to create Todoist task: \(error.localizedDescription)"]
            )
        }
    }

    private func dueString(from date: Date?) -> String? {
        guard let date else { return nil }

        if Calendar.current.isDateInToday(date) {
            return "today"
        }
        if Calendar.current.isDateInTomorrow(date) {
            return "tomorrow"
        }
        return date.todoistDateString
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

    var taskPriority: TaskPriority {
        switch self {
        case .normal:
            return .normal
        case .medium:
            return .medium
        case .high:
            return .high
        case .urgent:
            return .urgent
        }
    }
}
