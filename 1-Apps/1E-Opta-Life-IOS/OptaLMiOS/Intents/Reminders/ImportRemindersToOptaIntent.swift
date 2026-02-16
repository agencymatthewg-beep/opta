import AppIntents
import SwiftUI

// MARK: - Import Reminders To Opta Intent

struct ImportRemindersToOptaIntent: AppIntent {
    static var title: LocalizedStringResource = "Import Reminders to Opta"
    static var description = IntentDescription("Import all reminders from iOS Reminders app to Opta as tasks")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Filter", default: .incompleteOnly)
    var filter: ImportFilterEntity

    @Parameter(title: "List Name")
    var listName: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Import \(\.$filter) reminders to Opta") {
            \.$listName
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        // TODO: Full implementation in Phase 2
        return .result(dialog: "This feature is coming soon. Please use the app directly.")
    }

    private func applyFilter(to reminders: [ReminderEntity]) -> [ReminderEntity] {
        switch filter {
        case .all:
            return reminders
        case .incompleteOnly:
            return reminders.filter { !$0.isCompleted }
        case .dueThisWeek:
            return reminders.filter { reminder in
                guard let dueDate = reminder.dueDate else { return false }
                let weekFromNow = Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
                return dueDate <= weekFromNow && !reminder.isCompleted
            }
        }
    }

    private func convertPriority(_ reminderPriority: Int) -> Int {
        // EventKit uses 0-9, Todoist uses 1-4
        // Map: 0 -> 1 (normal), 1-3 -> 2 (medium), 4-6 -> 3 (high), 7-9 -> 4 (urgent)
        switch reminderPriority {
        case 0: return 1
        case 1...3: return 2
        case 4...6: return 3
        case 7...9: return 4
        default: return 1
        }
    }
}

// MARK: - Import Filter Entity

enum ImportFilterEntity: String, AppEnum {
    case all = "all"
    case incompleteOnly = "incomplete only"
    case dueThisWeek = "due this week"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Import Filter")

    static var caseDisplayRepresentations: [ImportFilterEntity: DisplayRepresentation] = [
        .all: DisplayRepresentation(title: "All Reminders"),
        .incompleteOnly: DisplayRepresentation(title: "Incomplete Only"),
        .dueThisWeek: DisplayRepresentation(title: "Due This Week")
    ]
}

// MARK: - Import Result Snippet View

struct ImportResultSnippetView: View {
    let imported: Int
    let skipped: Int
    let failed: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: statusIcon)
                    .foregroundColor(statusColor)
                    .font(.title2)
                Text("Import Complete")
                    .font(.headline)
            }

            // Statistics
            VStack(spacing: 8) {
                if imported > 0 {
                    StatRow(
                        icon: "checkmark.circle.fill",
                        label: "Imported",
                        value: "\(imported)",
                        color: .green
                    )
                }
                if skipped > 0 {
                    StatRow(
                        icon: "arrow.uturn.right.circle.fill",
                        label: "Skipped (duplicates)",
                        value: "\(skipped)",
                        color: .blue
                    )
                }
                if failed > 0 {
                    StatRow(
                        icon: "xmark.circle.fill",
                        label: "Failed",
                        value: "\(failed)",
                        color: .red
                    )
                }
            }

            // Summary message
            Text(summaryMessage)
                .font(.caption)
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding()
    }

    private var statusIcon: String {
        if failed == 0 {
            return "checkmark.circle.fill"
        } else if imported > 0 {
            return "exclamationmark.triangle.fill"
        } else {
            return "xmark.circle.fill"
        }
    }

    private var statusColor: Color {
        if failed == 0 {
            return .green
        } else if imported > 0 {
            return .orange
        } else {
            return .red
        }
    }

    private var summaryMessage: String {
        let total = imported + skipped + failed
        if total == 0 {
            return "No reminders found to import."
        } else if failed == 0 {
            return "Successfully imported \(imported) reminder\(imported == 1 ? "" : "s") to Opta."
        } else {
            return "Imported \(imported) of \(total) reminders. \(failed) failed due to errors."
        }
    }
}

// MARK: - Date Extension

// todoistDateString extension is defined in Date+Extensions.swift
