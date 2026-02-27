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
        let eventKitService = EventKitService.shared
        let hasAccess = await eventKitService.requestRemindersAccess()

        guard hasAccess else {
            throw NSError(
                domain: "OptaIntents",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Reminders access was denied. Please enable it in Settings."]
            )
        }

        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else {
            throw NSError(
                domain: "OptaIntents",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Reminder title cannot be empty."]
            )
        }

        let requestedListName = listName?.trimmingCharacters(in: .whitespacesAndNewlines)
        let targetCalendar = requestedListName.flatMap { requested in
            eventKitService.getReminderCalendars()
                .first(where: { $0.title.compare(requested, options: .caseInsensitive) == .orderedSame })
        }
        let normalizedNotes = notes?.trimmingCharacters(in: .whitespacesAndNewlines)
        let sanitizedNotes = (normalizedNotes?.isEmpty == false) ? normalizedNotes : nil

        do {
            _ = try eventKitService.createReminder(
                title: trimmedTitle,
                notes: sanitizedNotes,
                dueDate: dueDate,
                priority: priority.rawPriority,
                calendar: targetCalendar
            )

            var response = "Added '\(trimmedTitle)' to Reminders."
            if let dueDate {
                response += " Due \(dueDate.formatted(date: .abbreviated, time: .shortened))."
            }
            if let calendarName = targetCalendar?.title {
                response += " List: \(calendarName)."
            } else if let requestedListName, !requestedListName.isEmpty {
                response += " List '\(requestedListName)' was not found, so it was added to your default list."
            }

            return .result(dialog: IntentDialog(stringLiteral: response))
        } catch {
            throw NSError(
                domain: "OptaIntents",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Failed to add reminder: \(error.localizedDescription)"]
            )
        }
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
