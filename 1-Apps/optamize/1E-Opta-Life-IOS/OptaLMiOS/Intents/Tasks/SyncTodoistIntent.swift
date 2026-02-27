import AppIntents
import SwiftUI

// MARK: - Sync Todoist Intent

struct SyncTodoistIntent: AppIntent {
    static var title: LocalizedStringResource = "Sync Todoist Tasks"
    static var description = IntentDescription("Synchronize tasks between Todoist and Opta")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Sync Direction", default: .bidirectional)
    var syncDirection: TodoistSyncDirectionEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Sync Todoist tasks \(\.$syncDirection)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let taskSyncCoordinator = TaskSyncCoordinator.shared
        let apiService = APIService.shared
        let todoistService = TodoistService.shared

        // Check authentication
        guard todoistService.isAuthenticated else {
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Please connect your Todoist account in Opta settings first."])
        }

        do {
            let backendDashboard = try await apiService.fetchTasksDashboard()
            let backendTasks = backendDashboard.todayTasks + backendDashboard.overdueTasks + backendDashboard.upcomingTasks
            let todoistTasks = try await todoistService.fetchTasks()

            var backendKeys = Set(backendTasks.map(taskKey))
            var todoistKeys = Set(todoistTasks.map(taskKey))

            var tasksAdded = 0
            var errors: [SyncError] = []
            let conflicts = detectConflicts(backendTasks: backendTasks, todoistTasks: todoistTasks)

            if syncDirection == .bidirectional || syncDirection == .importFromTodoist {
                for todoistTask in todoistTasks where !backendKeys.contains(taskKey(todoistTask)) {
                    do {
                        _ = try await apiService.createTask(
                            content: todoistTask.content,
                            dueString: todoistTask.due?.string ?? todoistTask.due?.date,
                            priority: optaPriority(for: todoistTask.priority)
                        )
                        backendKeys.insert(taskKey(todoistTask))
                        tasksAdded += 1
                    } catch {
                        errors.append(
                            SyncError(
                                taskTitle: todoistTask.content,
                                errorMessage: "Import failed: \(error.localizedDescription)"
                            )
                        )
                    }
                }
            }

            if syncDirection == .bidirectional || syncDirection == .exportToTodoist {
                for backendTask in backendTasks where !todoistKeys.contains(taskKey(backendTask)) {
                    do {
                        let request = TodoistTaskRequest(
                            content: backendTask.content,
                            dueString: backendTask.due?.string ?? backendTask.due?.date,
                            priority: backendTask.priority
                        )
                        _ = try await todoistService.createTask(request)
                        todoistKeys.insert(taskKey(backendTask))
                        tasksAdded += 1
                    } catch {
                        errors.append(
                            SyncError(
                                taskTitle: backendTask.content,
                                errorMessage: "Export failed: \(error.localizedDescription)"
                            )
                        )
                    }
                }
            }

            // Refresh merged state after sync operations.
            _ = try? await taskSyncCoordinator.fetchDashboard()

            let result = TodoistSyncResult(
                tasksAdded: tasksAdded,
                tasksUpdated: 0,
                tasksCompleted: 0,
                conflicts: conflicts,
                errors: errors
            )

            // Haptic feedback
            if result.conflicts.isEmpty && result.errors.isEmpty {
                HapticManager.shared.notification(.success)
            } else if !result.errors.isEmpty {
                HapticManager.shared.notification(.warning)
            } else {
                HapticManager.shared.notification(.success)
            }

            // Generate spoken response
            var spokenMessage = "Todoist sync complete. "
            if result.tasksAdded > 0 {
                spokenMessage += "Added \(result.tasksAdded) task\(result.tasksAdded == 1 ? "" : "s"). "
            }
            if result.tasksUpdated > 0 {
                spokenMessage += "Updated \(result.tasksUpdated) task\(result.tasksUpdated == 1 ? "" : "s"). "
            }
            if result.tasksCompleted > 0 {
                spokenMessage += "Completed \(result.tasksCompleted) task\(result.tasksCompleted == 1 ? "" : "s"). "
            }
            if result.conflicts.count > 0 {
                spokenMessage += "Found \(result.conflicts.count) conflict\(result.conflicts.count == 1 ? "" : "s"). "
            }
            if result.errors.count > 0 {
                spokenMessage += "\(result.errors.count) error\(result.errors.count == 1 ? "" : "s") occurred. "
            }

            return .result(
                dialog: IntentDialog(stringLiteral: spokenMessage.trimmingCharacters(in: .whitespaces)),
                view: TodoistSyncResultSnippetView(result: result, direction: syncDirection)
            )

        } catch {
            HapticManager.shared.notification(.error)
            throw NSError(domain: "OptaIntents", code: 1, userInfo: [NSLocalizedDescriptionKey: "Sync failed: \(error.localizedDescription)"])
        }
    }

    private func taskKey(_ task: OptaTask) -> String {
        let normalizedContent = task.content.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let due = task.due?.date ?? ""
        return "\(normalizedContent)|\(due)"
    }

    private func taskKey(_ task: TodoistTask) -> String {
        let normalizedContent = task.content.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let due = task.due?.date ?? ""
        return "\(normalizedContent)|\(due)"
    }

    private func detectConflicts(backendTasks: [OptaTask], todoistTasks: [TodoistTask]) -> [TaskConflict] {
        var conflicts: [TaskConflict] = []
        let now = Date()

        for backendTask in backendTasks {
            let normalizedBackend = backendTask.content.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
            guard let matchingTodoist = todoistTasks.first(where: {
                $0.content.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) == normalizedBackend
            }) else {
                continue
            }

            if matchingTodoist.priority != todoistPriority(for: backendTask.priority) {
                conflicts.append(
                    TaskConflict(
                        taskTitle: backendTask.content,
                        optaVersion: backendTask.lastSyncedAt ?? backendTask.createdAt ?? now,
                        todoistVersion: matchingTodoist.createdDate ?? now,
                        conflictType: .priorityConflict
                    )
                )
            } else if (backendTask.due?.date ?? "") != (matchingTodoist.due?.date ?? "") {
                conflicts.append(
                    TaskConflict(
                        taskTitle: backendTask.content,
                        optaVersion: backendTask.lastSyncedAt ?? backendTask.createdAt ?? now,
                        todoistVersion: matchingTodoist.createdDate ?? now,
                        conflictType: .contentConflict
                    )
                )
            }
        }

        return conflicts
    }

    private func optaPriority(for todoistPriority: Int) -> Int {
        // Todoist: 1 normal, 2 medium, 3 high, 4 urgent
        switch todoistPriority {
        case 4:
            return TaskPriority.urgent.rawValue
        case 3:
            return TaskPriority.high.rawValue
        case 2:
            return TaskPriority.medium.rawValue
        default:
            return TaskPriority.normal.rawValue
        }
    }

    private func todoistPriority(for taskPriority: TaskPriority) -> Int {
        switch taskPriority {
        case .urgent:
            return 4
        case .high:
            return 3
        case .medium:
            return 2
        case .normal:
            return 1
        }
    }
}

// MARK: - Todoist Sync Direction Entity

enum TodoistSyncDirectionEntity: String, AppEnum {
    case bidirectional = "both ways"
    case importFromTodoist = "from Todoist to Opta"
    case exportToTodoist = "from Opta to Todoist"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Sync Direction")

    static var caseDisplayRepresentations: [TodoistSyncDirectionEntity: DisplayRepresentation] = [
        .bidirectional: DisplayRepresentation(
            title: "Both Ways",
            subtitle: "Sync in both directions"
        ),
        .importFromTodoist: DisplayRepresentation(
            title: "Import from Todoist",
            subtitle: "Todoist → Opta"
        ),
        .exportToTodoist: DisplayRepresentation(
            title: "Export to Todoist",
            subtitle: "Opta → Todoist"
        )
    ]
}

// MARK: - Todoist Sync Result

struct TodoistSyncResult {
    let tasksAdded: Int
    let tasksUpdated: Int
    let tasksCompleted: Int
    let conflicts: [TaskConflict]
    let errors: [SyncError]
    let syncDate: Date

    init(
        tasksAdded: Int = 0,
        tasksUpdated: Int = 0,
        tasksCompleted: Int = 0,
        conflicts: [TaskConflict] = [],
        errors: [SyncError] = [],
        syncDate: Date = Date()
    ) {
        self.tasksAdded = tasksAdded
        self.tasksUpdated = tasksUpdated
        self.tasksCompleted = tasksCompleted
        self.conflicts = conflicts
        self.errors = errors
        self.syncDate = syncDate
    }
}

// MARK: - Task Conflict

struct TaskConflict: Identifiable {
    let id = UUID()
    let taskTitle: String
    let optaVersion: Date
    let todoistVersion: Date
    let conflictType: ConflictType

    enum ConflictType {
        case contentConflict
        case completionConflict
        case priorityConflict
    }
}

// MARK: - Sync Error

struct SyncError: Identifiable {
    let id = UUID()
    let taskTitle: String
    let errorMessage: String
}

// MARK: - Todoist Sync Result Snippet View

struct TodoistSyncResultSnippetView: View {
    let result: TodoistSyncResult
    let direction: TodoistSyncDirectionEntity

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .foregroundColor(.red)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Todoist Sync")
                        .font(.headline)
                    Text(directionDescription)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text(result.syncDate, style: .time)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Statistics
            VStack(spacing: 8) {
                if result.tasksAdded > 0 {
                    StatRow(
                        icon: "plus.circle.fill",
                        label: "Added",
                        value: "\(result.tasksAdded)",
                        color: .green
                    )
                }
                if result.tasksUpdated > 0 {
                    StatRow(
                        icon: "pencil.circle.fill",
                        label: "Updated",
                        value: "\(result.tasksUpdated)",
                        color: .blue
                    )
                }
                if result.tasksCompleted > 0 {
                    StatRow(
                        icon: "checkmark.circle.fill",
                        label: "Completed",
                        value: "\(result.tasksCompleted)",
                        color: .purple
                    )
                }
                if result.conflicts.count > 0 {
                    StatRow(
                        icon: "exclamationmark.triangle.fill",
                        label: "Conflicts",
                        value: "\(result.conflicts.count)",
                        color: .orange
                    )
                }
                if result.errors.count > 0 {
                    StatRow(
                        icon: "xmark.circle.fill",
                        label: "Errors",
                        value: "\(result.errors.count)",
                        color: .red
                    )
                }
            }

            // Conflicts section
            if !result.conflicts.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Conflicts Detected")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.orange)

                    ForEach(result.conflicts.prefix(3)) { conflict in
                        Text("• \(conflict.taskTitle)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    if result.conflicts.count > 3 {
                        Text("+ \(result.conflicts.count - 3) more conflicts")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Text("Open app to resolve conflicts")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .italic()
                }
                .padding(.top, 4)
            }

            // Errors section
            if !result.errors.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Errors")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.red)

                    ForEach(result.errors.prefix(2)) { error in
                        VStack(alignment: .leading, spacing: 2) {
                            Text("• \(error.taskTitle)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(error.errorMessage)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                                .padding(.leading, 8)
                        }
                    }

                    if result.errors.count > 2 {
                        Text("+ \(result.errors.count - 2) more errors")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.top, 4)
            }

            // Summary
            if result.tasksAdded == 0 && result.tasksUpdated == 0 && result.tasksCompleted == 0
                && result.conflicts.isEmpty && result.errors.isEmpty {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                    Text("Todoist and Opta are already in sync")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
    }

    private var directionDescription: String {
        switch direction {
        case .bidirectional:
            return "Synced both Opta and Todoist"
        case .importFromTodoist:
            return "Imported from Todoist to Opta"
        case .exportToTodoist:
            return "Exported from Opta to Todoist"
        }
    }
}
