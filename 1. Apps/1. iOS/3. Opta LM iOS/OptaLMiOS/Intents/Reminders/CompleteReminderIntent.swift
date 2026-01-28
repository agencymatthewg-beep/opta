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
        guard let remindersService = try? RemindersSyncService() else {
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Reminders service is not available."])
        }

        // Request reminders access
        if let eventKitService = EventKitService.shared {
            let hasAccess = await eventKitService.requestRemindersAccess()
            guard hasAccess else {
                throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Reminders access is required. Please enable it in Settings."])
            }
        }

        // Determine which reminder to complete
        let reminderToComplete: RemindersAppEntity

        if let reminder = reminder {
            reminderToComplete = reminder
        } else if let title = reminderTitle {
            // Search for reminder by title
            let allReminders = try await remindersService.fetchReminders()
            guard let foundReminder = allReminders.first(where: {
                $0.title.lowercased() == title.lowercased() && !$0.isCompleted
            }) else {
                throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not find an incomplete reminder named '\(title)'."])
            }
            reminderToComplete = RemindersAppEntity(
                id: foundReminder.id,
                title: foundReminder.title
            )
        } else {
            // Complete the first incomplete reminder
            let allReminders = try await remindersService.fetchReminders()
            guard let firstIncomplete = allReminders.first(where: { !$0.isCompleted }) else {
                return .result(dialog: "You have no incomplete reminders.")
            }
            reminderToComplete = RemindersAppEntity(
                id: firstIncomplete.id,
                title: firstIncomplete.title
            )
        }

        // Complete the reminder
        do {
            try await remindersService.completeReminder(identifier: reminderToComplete.id)

            // Haptic feedback
            HapticManager.shared.notification(.success)

            let response = "Completed '\(reminderToComplete.title)'."
            return .result(dialog: IntentDialog(stringLiteral: response))

        } catch {
            HapticManager.shared.notification(.error)
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to complete reminder: \(error.localizedDescription)"])
        }
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
