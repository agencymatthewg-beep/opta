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
        let eventKitService = EventKitService.shared
        let hasAccess = await eventKitService.requestRemindersAccess()

        guard hasAccess else {
            throw NSError(
                domain: "OptaIntents",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Reminders access was denied. Please enable it in Settings."]
            )
        }

        let targetId: String
        let targetTitle: String

        if let reminder {
            targetId = reminder.id
            targetTitle = reminder.title
        } else {
            let requestedTitle = reminderTitle?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !requestedTitle.isEmpty else {
                throw NSError(
                    domain: "OptaIntents",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Please select a reminder or provide a reminder title."]
                )
            }

            let remindersService = RemindersSyncService.shared
            let allReminders = try await remindersService.fetchReminders()
            let unresolvedReminders = allReminders.filter { !$0.isCompleted }

            if let resolved = resolveReminder(from: unresolvedReminders, requestedTitle: requestedTitle) {
                targetId = resolved.id
                targetTitle = resolved.title
            } else {
                throw NSError(
                    domain: "OptaIntents",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "No incomplete reminder matched '\(requestedTitle)'."]
                )
            }
        }

        do {
            try eventKitService.completeReminder(identifier: targetId)
            return .result(dialog: IntentDialog(stringLiteral: "Completed '\(targetTitle)'."))
        } catch {
            throw NSError(
                domain: "OptaIntents",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Failed to complete reminder: \(error.localizedDescription)"]
            )
        }
    }

    private func resolveReminder(from reminders: [ReminderEntity], requestedTitle: String) -> ReminderEntity? {
        let exactMatches = reminders.filter {
            $0.title.compare(requestedTitle, options: .caseInsensitive) == .orderedSame
        }

        if exactMatches.count == 1 {
            return exactMatches[0]
        }

        if exactMatches.count > 1 {
            return nil
        }

        let fuzzyMatches = reminders.filter {
            $0.title.localizedCaseInsensitiveContains(requestedTitle)
        }

        if fuzzyMatches.count == 1 {
            return fuzzyMatches[0]
        }

        return nil
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
        let remindersService = RemindersSyncService.shared

        let allReminders = try await remindersService.fetchReminders()
        return allReminders
            .filter { identifiers.contains($0.id) }
            .map { RemindersAppEntity(id: $0.id, title: $0.title) }
    }

    @MainActor
    func suggestedEntities() async throws -> [RemindersAppEntity] {
        let remindersService = RemindersSyncService.shared

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
