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

        // Create reminder
        do {
            let reminderId = try await remindersService.createReminder(
                title: title,
                notes: notes,
                dueDate: dueDate,
                priority: priority.rawPriority
            )

            // Haptic feedback
            HapticManager.shared.notification(.success)

            // Generate response
            var response = "Added '\(title)' to Reminders"

            if let dueDate = dueDate {
                let dateFormatter = DateFormatter()
                dateFormatter.dateStyle = .medium
                dateFormatter.timeStyle = .short
                response += " due \(dateFormatter.string(from: dueDate))"
            }

            if let listName = listName {
                response += " in '\(listName)'"
            }

            response += "."

            return .result(dialog: IntentDialog(stringLiteral: response))

        } catch {
            HapticManager.shared.notification(.error)
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to create reminder: \(error.localizedDescription)"])
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
