import AppIntents
import SwiftUI

// MARK: - Get Unified Todo List Intent

struct GetUnifiedTodoListIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Unified Todo List"
    static var description = IntentDescription("View all tasks from Opta, Todoist, and Apple Reminders in one unified list")

    static var openAppWhenRun: Bool = true

    @Parameter(title: "Filter", default: UnifiedTodoFilterEntity.today)
    var filter: UnifiedTodoFilterEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Show \(\.$filter) tasks from all sources")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        var allTasks: [UnifiedTask] = []

        // Fetch from Opta backend
        let api = APIService.shared
        do {
            let optaTasks = try await api.fetchTodayTasks()
            allTasks.append(contentsOf: optaTasks.map { UnifiedTask(from: $0, source: .opta) })
        } catch {
            print("Failed to fetch Opta tasks: \(error)")
        }

        // Fetch from Todoist if authenticated
        if let todoistService = TodoistService.shared, todoistService.isAuthenticated {
            do {
                let todoistTasks = try await todoistService.fetchTasks()
                allTasks.append(contentsOf: todoistTasks.map { UnifiedTask(from: $0, source: .todoist) })
            } catch {
                print("Failed to fetch Todoist tasks: \(error)")
            }
        }

        // Fetch from Apple Reminders if access granted
        if let remindersService = try? RemindersSyncService() {
            if let eventKitService = EventKitService.shared {
                let hasAccess = await eventKitService.requestRemindersAccess()
                if hasAccess {
                    do {
                        let reminders = try await remindersService.fetchReminders()
                        allTasks.append(contentsOf: reminders.map { UnifiedTask(from: $0, source: .appleReminders) })
                    } catch {
                        print("Failed to fetch Apple Reminders: \(error)")
                    }
                }
            }
        }

        // Deduplicate tasks (same title + due date within 5 minutes)
        let deduplicatedTasks = deduplicateTasks(allTasks)

        // Apply filter
        let filteredTasks = applyFilter(to: deduplicatedTasks)

        // Sort by priority and due date
        let sortedTasks = filteredTasks.sorted { task1, task2 in
            // First by completion status
            if task1.isCompleted != task2.isCompleted {
                return !task1.isCompleted
            }

            // Then by priority
            if task1.priority != task2.priority {
                return task1.priority > task2.priority
            }

            // Finally by due date
            guard let date1 = task1.dueDate else { return false }
            guard let date2 = task2.dueDate else { return true }
            return date1 < date2
        }

        // Generate spoken summary
        let totalCount = sortedTasks.count
        let incompleteCount = sortedTasks.filter { !$0.isCompleted }.count
        let summary = incompleteCount == 0
            ? "You have no incomplete tasks \(filter.spokenDescription)."
            : "You have \(incompleteCount) task\(incompleteCount == 1 ? "" : "s") \(filter.spokenDescription) across all your apps."

        return .result(
            dialog: IntentDialog(stringLiteral: summary),
            view: UnifiedTodoListSnippetView(
                tasks: Array(sortedTasks.prefix(10)),
                filter: filter,
                totalCount: totalCount
            )
        )
    }

    private func deduplicateTasks(_ tasks: [UnifiedTask]) -> [UnifiedTask] {
        var uniqueTasks: [UnifiedTask] = []
        var seenKeys: Set<String> = []

        for task in tasks {
            // Create a key based on title and due date
            let titleKey = task.title.lowercased().trimmingCharacters(in: .whitespaces)
            let dateKey = task.dueDate?.timeIntervalSince1970.rounded(.toNearestOrEven) ?? 0
            let key = "\(titleKey)_\(dateKey)"

            if !seenKeys.contains(key) {
                seenKeys.insert(key)
                uniqueTasks.append(task)
            }
        }

        return uniqueTasks
    }

    private func applyFilter(to tasks: [UnifiedTask]) -> [UnifiedTask] {
        let now = Date()
        let calendar = Calendar.current

        switch filter {
        case .all:
            return tasks
        case .today:
            return tasks.filter { task in
                guard let dueDate = task.dueDate else { return false }
                return calendar.isDateInToday(dueDate) && !task.isCompleted
            }
        case .thisWeek:
            let weekFromNow = calendar.date(byAdding: .day, value: 7, to: now)!
            return tasks.filter { task in
                guard let dueDate = task.dueDate else { return false }
                return dueDate <= weekFromNow && !task.isCompleted
            }
        case .overdue:
            return tasks.filter { task in
                guard let dueDate = task.dueDate else { return false }
                return dueDate < now && !task.isCompleted
            }
        case .incomplete:
            return tasks.filter { !$0.isCompleted }
        }
    }
}

// MARK: - Unified Todo Filter Entity

enum UnifiedTodoFilterEntity: String, AppEnum {
    case all = "all"
    case today = "today"
    case thisWeek = "this week"
    case overdue = "overdue"
    case incomplete = "incomplete"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Filter")

    static var caseDisplayRepresentations: [UnifiedTodoFilterEntity: DisplayRepresentation] = [
        .all: DisplayRepresentation(title: "All Tasks"),
        .today: DisplayRepresentation(title: "Due Today"),
        .thisWeek: DisplayRepresentation(title: "This Week"),
        .overdue: DisplayRepresentation(title: "Overdue"),
        .incomplete: DisplayRepresentation(title: "Incomplete")
    ]

    var spokenDescription: String {
        switch self {
        case .all: return "in total"
        case .today: return "due today"
        case .thisWeek: return "due this week"
        case .overdue: return "overdue"
        case .incomplete: return "to complete"
        }
    }
}

// MARK: - Unified Task Model

struct UnifiedTask: Identifiable {
    let id: String
    let title: String
    let dueDate: Date?
    let priority: Int
    let isCompleted: Bool
    let source: TaskSource

    init(from optaTask: OptaTask, source: TaskSource) {
        self.id = optaTask.id
        self.title = optaTask.content
        self.dueDate = optaTask.due?.date
        self.priority = optaTask.priority
        self.isCompleted = optaTask.isCompleted
        self.source = source
    }

    init(from todoistTask: TodoistTaskModel, source: TaskSource) {
        self.id = todoistTask.id
        self.title = todoistTask.content
        self.dueDate = todoistTask.due?.date
        self.priority = todoistTask.priority
        self.isCompleted = todoistTask.isCompleted
        self.source = source
    }

    init(from reminder: ReminderEntity, source: TaskSource) {
        self.id = reminder.id
        self.title = reminder.title
        self.dueDate = reminder.dueDate
        self.priority = reminder.priority
        self.isCompleted = reminder.isCompleted
        self.source = source
    }
}

// MARK: - Task Source Enum

enum TaskSource: String {
    case opta = "Opta"
    case todoist = "Todoist"
    case appleReminders = "Reminders"

    var color: Color {
        switch self {
        case .opta: return .blue
        case .todoist: return .red
        case .appleReminders: return .orange
        }
    }

    var icon: String {
        switch self {
        case .opta: return "sparkles"
        case .todoist: return "checkmark.circle"
        case .appleReminders: return "checklist"
        }
    }
}

// MARK: - Unified Todo List Snippet View

struct UnifiedTodoListSnippetView: View {
    let tasks: [UnifiedTask]
    let filter: UnifiedTodoFilterEntity
    let totalCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "checklist.checked")
                    .foregroundColor(.purple)
                Text("Unified Todo List")
                    .font(.headline)
                Spacer()
                Text(filter.rawValue.capitalized)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Source counts
            let sourceCounts = getSourceCounts()
            if sourceCounts.count > 1 {
                HStack(spacing: 8) {
                    ForEach(Array(sourceCounts.keys.sorted(by: { $0.rawValue < $1.rawValue })), id: \.self) { source in
                        if let count = sourceCounts[source], count > 0 {
                            SourceBadge(source: source, count: count)
                        }
                    }
                }
            }

            if tasks.isEmpty {
                Text("No tasks found")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 20)
            } else {
                // Tasks list
                ForEach(tasks) { task in
                    HStack(alignment: .top, spacing: 12) {
                        // Completion indicator
                        Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(task.isCompleted ? .green : priorityColor(task.priority))
                            .font(.body)

                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(task.title)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                    .strikethrough(task.isCompleted)
                                    .foregroundColor(task.isCompleted ? .secondary : .primary)
                                    .lineLimit(2)
                                Spacer()
                                Image(systemName: task.source.icon)
                                    .font(.caption2)
                                    .foregroundColor(task.source.color)
                            }

                            HStack(spacing: 8) {
                                if let dueDate = task.dueDate {
                                    HStack(spacing: 4) {
                                        Image(systemName: isOverdue(dueDate) ? "exclamationmark.triangle.fill" : "calendar")
                                            .font(.caption2)
                                            .foregroundColor(isOverdue(dueDate) ? .red : .secondary)
                                        Text(formatDueDate(dueDate))
                                            .font(.caption)
                                            .foregroundColor(isOverdue(dueDate) ? .red : .secondary)
                                    }
                                }

                                if task.priority > 1 {
                                    HStack(spacing: 2) {
                                        Image(systemName: "exclamationmark")
                                            .font(.caption2)
                                        Text("P\(task.priority)")
                                            .font(.caption2)
                                    }
                                    .foregroundColor(priorityColor(task.priority))
                                }
                            }
                        }
                    }
                    .padding(.vertical, 4)

                    if task.id != tasks.last?.id {
                        Divider()
                    }
                }

                if totalCount > 10 {
                    Text("+ \(totalCount - 10) more tasks")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.top, 4)
                }
            }
        }
        .padding()
    }

    private func getSourceCounts() -> [TaskSource: Int] {
        var counts: [TaskSource: Int] = [:]
        for task in tasks {
            counts[task.source, default: 0] += 1
        }
        return counts
    }

    private func isOverdue(_ date: Date) -> Bool {
        return date < Date()
    }

    private func formatDueDate(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInTomorrow(date) {
            return "Tomorrow"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            return date.formatted(date: .abbreviated, time: .omitted)
        }
    }

    private func priorityColor(_ priority: Int) -> Color {
        switch priority {
        case 4: return .red
        case 3: return .orange
        case 2: return .yellow
        default: return .gray
        }
    }
}

// MARK: - Source Badge Component

struct SourceBadge: View {
    let source: TaskSource
    let count: Int

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: source.icon)
                .font(.caption2)
            Text("\(count)")
                .font(.caption2)
                .fontWeight(.medium)
        }
        .foregroundColor(source.color)
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(source.color.opacity(0.15))
        .cornerRadius(4)
    }
}

// MARK: - Stub TodoistService

// This is a stub - Phase 2 will implement full Todoist API integration
@MainActor
class TodoistService {
    static let shared: TodoistService? = TodoistService()

    var isAuthenticated: Bool = false

    private init() {}

    func fetchTasks(filter: String? = nil) async throws -> [TodoistTaskModel] {
        // Stub implementation
        // Phase 2 will implement: REST API v2 calls
        return []
    }

    func createTask(content: String, dueString: String?, priority: Int) async throws -> TodoistTaskModel {
        // Stub implementation
        throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Todoist integration not yet implemented"])
    }

    func completeTask(id: String) async throws {
        // Stub implementation
        throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Todoist integration not yet implemented"])
    }
}

// MARK: - Todoist Task Model

struct TodoistTaskModel {
    let id: String
    let content: String
    let priority: Int
    let isCompleted: Bool
    let due: TodoistDue?
}

struct TodoistDue {
    let date: Date
    let string: String
}
