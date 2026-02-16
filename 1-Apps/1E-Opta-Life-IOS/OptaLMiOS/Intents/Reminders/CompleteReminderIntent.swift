import AppIntents
import SwiftUI

// MARK: - Complete Reminder Intent

struct CompleteReminderIntent: AppIntent {
    static var title: LocalizedStringResource = "Complete Reminder"
    static var description = IntentDescription("Mark a reminder as complete in the iOS Reminders app")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Reminder")
    var reminder: RemindersAppEntity?

    @Parameter(title: "Reminder Title")
    var reminderTitle: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Complete \(\.$reminder)") {
            \.$reminderTitle
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        // TODO: Full implementation in Phase 2
        return .result(dialog: "This feature is coming soon. Please use the app directly.")
    }
}

// MARK: - Reminders App Entity

struct RemindersAppEntity: AppEntity {
    let id: String
    let title: String

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Reminder")
    static var defaultQuery = RemindersAppEntityQuery()

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: LocalizedStringResource(stringLiteral: title))
    }
}

// MARK: - Reminders App Entity Query

struct RemindersAppEntityQuery: EntityQuery {
    @MainActor
    func entities(for identifiers: [String]) async throws -> [RemindersAppEntity] {
        guard let remindersService = try? RemindersSyncService() else {
            return []
        }

        let allReminders = try await remindersService.fetchReminders()
        return allReminders
            .filter { identifiers.contains($0.id) }
            .map { RemindersAppEntity(id: $0.id, title: $0.title) }
    }

    @MainActor
    func suggestedEntities() async throws -> [RemindersAppEntity] {
        guard let remindersService = try? RemindersSyncService() else {
            return []
        }

        let allReminders = try await remindersService.fetchReminders()

        // Return incomplete reminders, prioritizing those due today or overdue
        let today = Date()
        let incomplete = allReminders.filter { !$0.isCompleted }

        let sorted = incomplete.sorted { reminder1, reminder2 in
            // Prioritize overdue and due today
            let isOverdue1 = reminder1.dueDate.map { $0 < today } ?? false
            let isOverdue2 = reminder2.dueDate.map { $0 < today } ?? false

            if isOverdue1 != isOverdue2 {
                return isOverdue1
            }

            let isDueToday1 = reminder1.dueDate.map { Calendar.current.isDateInToday($0) } ?? false
            let isDueToday2 = reminder2.dueDate.map { Calendar.current.isDateInToday($0) } ?? false

            if isDueToday1 != isDueToday2 {
                return isDueToday1
            }

            // Then by priority
            if reminder1.priority != reminder2.priority {
                return reminder1.priority > reminder2.priority
            }

            // Finally by due date
            guard let date1 = reminder1.dueDate else { return false }
            guard let date2 = reminder2.dueDate else { return true }
            return date1 < date2
        }

        return sorted.prefix(10).map { RemindersAppEntity(id: $0.id, title: $0.title) }
    }
}
