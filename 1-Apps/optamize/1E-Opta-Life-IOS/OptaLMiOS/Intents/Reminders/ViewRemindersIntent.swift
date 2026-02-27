import AppIntents
import SwiftUI

// MARK: - View Reminders Intent

struct ViewRemindersIntent: AppIntent {
    static var title: LocalizedStringResource = "View Apple Reminders"
    static var description = IntentDescription("View your reminders from the iOS Reminders app")

    static var openAppWhenRun: Bool = true

    @Parameter(title: "Filter", default: .all)
    var filter: ReminderFilterEntity

    @Parameter(title: "List Name")
    var listName: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Show \(\.$filter) reminders") {
            \.$listName
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let remindersService = RemindersSyncService.shared

        // Request reminders access
        do {
            let eventKitService = EventKitService.shared
            let hasAccess = await eventKitService.requestRemindersAccess()
            guard hasAccess else {
                throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Reminders access is required. Please enable it in Settings."])
            }
        }

        // Fetch reminders based on filter
        do {
            let allReminders = try await remindersService.fetchReminders(listName: listName)
            let filteredReminders = applyFilter(to: allReminders)

            // Sort by due date
            let sortedReminders = filteredReminders.sorted { reminder1, reminder2 in
                guard let date1 = reminder1.dueDate else { return false }
                guard let date2 = reminder2.dueDate else { return true }
                return date1 < date2
            }

            // Generate spoken summary
            let count = sortedReminders.count
            let filterText = filter.spokenDescription
            let listText = listName.map { " in '\($0)'" } ?? ""
            let summary = count == 0
                ? "You have no \(filterText) reminders\(listText)."
                : "You have \(count) \(filterText) reminder\(count == 1 ? "" : "s")\(listText)."

            return .result(
                dialog: IntentDialog(stringLiteral: summary),
                view: RemindersSnippetView(
                    reminders: Array(sortedReminders.prefix(10)),
                    filter: filter,
                    listName: listName
                )
            )

        } catch {
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to fetch reminders: \(error.localizedDescription)"])
        }
    }

    private func applyFilter(to reminders: [ReminderEntity]) -> [ReminderEntity] {
        switch filter {
        case .all:
            return reminders
        case .incomplete:
            return reminders.filter { !$0.isCompleted }
        case .completed:
            return reminders.filter { $0.isCompleted }
        case .today:
            return reminders.filter { reminder in
                guard let dueDate = reminder.dueDate else { return false }
                return Calendar.current.isDateInToday(dueDate) && !reminder.isCompleted
            }
        case .overdue:
            return reminders.filter { reminder in
                guard let dueDate = reminder.dueDate else { return false }
                return dueDate < Date() && !reminder.isCompleted
            }
        }
    }
}

// MARK: - Reminder Filter Entity

enum ReminderFilterEntity: String, AppEnum {
    case all
    case incomplete
    case completed
    case today
    case overdue

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Reminder Filter")

    static var caseDisplayRepresentations: [ReminderFilterEntity: DisplayRepresentation] = [
        .all: DisplayRepresentation(title: "All"),
        .incomplete: DisplayRepresentation(title: "Incomplete"),
        .completed: DisplayRepresentation(title: "Completed"),
        .today: DisplayRepresentation(title: "Due Today"),
        .overdue: DisplayRepresentation(title: "Overdue")
    ]

    var spokenDescription: String {
        switch self {
        case .all: return "all"
        case .incomplete: return "incomplete"
        case .completed: return "completed"
        case .today: return "today"
        case .overdue: return "overdue"
        }
    }
}

// MARK: - Reminder Entity

struct ReminderEntity: Identifiable {
    let id: String
    let title: String
    let notes: String?
    let dueDate: Date?
    let isCompleted: Bool
    let priority: Int
    let listName: String?

    var priorityLevel: PriorityLevel {
        switch priority {
        case 0: return .none
        case 1...3: return .low
        case 4...6: return .medium
        case 7...9: return .high
        default: return .none
        }
    }

    enum PriorityLevel: String {
        case none = "None"
        case low = "Low"
        case medium = "Medium"
        case high = "High"

        var color: Color {
            switch self {
            case .none: return .gray
            case .low: return .blue
            case .medium: return .orange
            case .high: return .red
            }
        }
    }
}

// MARK: - Reminders Snippet View

struct RemindersSnippetView: View {
    let reminders: [ReminderEntity]
    let filter: ReminderFilterEntity
    let listName: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "checklist")
                    .foregroundColor(.orange)
                Text("Apple Reminders")
                    .font(.headline)
                Spacer()
                Text(filter.rawValue.capitalized)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if let listName = listName {
                Text("List: \(listName)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if reminders.isEmpty {
                Text("No reminders found")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 20)
            } else {
                // Reminders list
                ForEach(reminders) { reminder in
                    HStack(alignment: .top, spacing: 12) {
                        // Completion indicator
                        Image(systemName: reminder.isCompleted ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(reminder.isCompleted ? .green : .gray)
                            .font(.body)

                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(reminder.title)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                    .strikethrough(reminder.isCompleted)
                                    .foregroundColor(reminder.isCompleted ? .secondary : .primary)
                                Spacer()

                                if reminder.priorityLevel != .none {
                                    Circle()
                                        .fill(reminder.priorityLevel.color)
                                        .frame(width: 8, height: 8)
                                }
                            }

                            if let dueDate = reminder.dueDate {
                                HStack(spacing: 4) {
                                    Image(systemName: isOverdue(dueDate) ? "exclamationmark.triangle.fill" : "calendar")
                                        .font(.caption2)
                                        .foregroundColor(isOverdue(dueDate) ? .red : .secondary)
                                    Text(formatDueDate(dueDate))
                                        .font(.caption)
                                        .foregroundColor(isOverdue(dueDate) ? .red : .secondary)
                                }
                            }

                            if let notes = reminder.notes, !notes.isEmpty {
                                Text(notes)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                    .padding(.vertical, 4)

                    if reminder.id != reminders.last?.id {
                        Divider()
                    }
                }
            }
        }
        .padding()
    }

    private func isOverdue(_ date: Date) -> Bool {
        return date < Date()
    }

    private func formatDueDate(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return "Today at \(date.formatted(date: .omitted, time: .shortened))"
        } else if calendar.isDateInTomorrow(date) {
            return "Tomorrow at \(date.formatted(date: .omitted, time: .shortened))"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            return date.formatted(date: .abbreviated, time: .shortened)
        }
    }
}
