import Foundation
import SwiftUI

// MARK: - Task Sync Coordinator

/// Orchestrates task synchronization between backend API, Todoist, and EventKit
@MainActor
final class TaskSyncCoordinator: ObservableObject {
    static let shared = TaskSyncCoordinator()

    // MARK: - Dependencies

    private let apiService = APIService.shared
    private let todoistService = TodoistService.shared
    private let cacheManager = TaskCacheManager.shared

    // MARK: - Published State

    @Published var tasks: [OptaTask] = []
    @Published var syncState: SyncState = .idle
    @Published var lastSyncDate: Date?
    @Published var error: String?

    // MARK: - Sync Strategy

    enum TaskSyncStrategy {
        case direct      // Direct Todoist API only
        case backend     // Backend proxy only
        case hybrid      // Both (merge results)
    }

    var strategy: TaskSyncStrategy {
        let hasTodoist = todoistService.isAuthenticated
        let hasBackend = AuthManager.shared.sessionToken != nil

        if hasTodoist && hasBackend { return .hybrid }
        if hasTodoist { return .direct }
        return .backend
    }

    // MARK: - Initialization

    private init() {}

    // MARK: - Fetch Dashboard

    /// Fetch task dashboard using the current sync strategy
    /// - Returns: TaskDashboardData with merged tasks from all sources
    func fetchDashboard() async throws -> TaskDashboardData {
        syncState = .syncing
        error = nil

        defer {
            Task { @MainActor in
                syncState = .idle
            }
        }

        do {
            let dashboard: TaskDashboardData

            switch strategy {
            case .backend:
                dashboard = try await fetchFromBackend()

            case .direct:
                dashboard = try await fetchFromTodoist()

            case .hybrid:
                dashboard = try await fetchHybrid()
            }

            // Update cache
            let allTasks = dashboard.todayTasks + dashboard.overdueTasks + dashboard.upcomingTasks
            cacheManager.updateCache(tasks: allTasks)

            // Process pending offline changes
            await cacheManager.processPendingChanges()

            tasks = allTasks
            lastSyncDate = Date()
            syncState = .success

            return dashboard

        } catch {
            syncState = .error
            self.error = error.localizedDescription

            // Return cached data if available
            if !cacheManager.cachedTasks.isEmpty {
                return TaskDashboardData(
                    todayTasks: filterTodayTasks(cacheManager.cachedTasks),
                    overdueTasks: filterOverdueTasks(cacheManager.cachedTasks),
                    upcomingTasks: filterUpcomingTasks(cacheManager.cachedTasks),
                    stats: calculateStats(from: cacheManager.cachedTasks)
                )
            }

            throw error
        }
    }

    /// Fetch tasks from backend only
    private func fetchFromBackend() async throws -> TaskDashboardData {
        return try await apiService.fetchTasksDashboard()
    }

    /// Fetch tasks from Todoist only
    private func fetchFromTodoist() async throws -> TaskDashboardData {
        let todoistTasks = try await todoistService.fetchTasks()
        let optaTasks = todoistTasks.map { $0.toOptaTask(source: .todoist) }

        return TaskDashboardData(
            todayTasks: filterTodayTasks(optaTasks),
            overdueTasks: filterOverdueTasks(optaTasks),
            upcomingTasks: filterUpcomingTasks(optaTasks),
            stats: calculateStats(from: optaTasks)
        )
    }

    /// Fetch tasks from both sources and merge
    private func fetchHybrid() async throws -> TaskDashboardData {
        async let backendDashboard = apiService.fetchTasksDashboard()
        async let todoistTasks = todoistService.fetchTasks()

        let (backend, todoist) = try await (backendDashboard, todoistTasks)

        // Convert Todoist tasks to OptaTask
        let todoistOptaTasks = todoist.map { $0.toOptaTask(source: .todoist) }

        // Merge and deduplicate
        let backendTasks = backend.todayTasks + backend.overdueTasks + backend.upcomingTasks
        let mergedTasks = deduplicateTasks(backend: backendTasks, todoist: todoistOptaTasks)

        return TaskDashboardData(
            todayTasks: filterTodayTasks(mergedTasks),
            overdueTasks: filterOverdueTasks(mergedTasks),
            upcomingTasks: filterUpcomingTasks(mergedTasks),
            stats: calculateStats(from: mergedTasks)
        )
    }

    // MARK: - Create Task

    /// Create a new task using the current sync strategy
    /// - Parameters:
    ///   - content: Task content
    ///   - dueString: Optional natural language due date
    ///   - priority: Optional task priority
    /// - Returns: Created OptaTask
    func createTask(_ content: String, dueString: String? = nil, priority: TaskPriority = .normal) async throws -> OptaTask {
        syncState = .syncing
        error = nil

        defer {
            Task { @MainActor in
                syncState = .idle
            }
        }

        do {
            let task: OptaTask

            switch strategy {
            case .backend:
                task = try await apiService.createTask(
                    content: content,
                    dueString: dueString,
                    priority: priority.rawValue
                )

            case .direct:
                let request = TodoistTaskRequest(
                    content: content,
                    dueString: dueString,
                    priority: priority
                )
                let todoistTask = try await todoistService.createTask(request)
                task = todoistTask.toOptaTask(source: .todoist)

            case .hybrid:
                // Create in both services
                async let backendTask = apiService.createTask(
                    content: content,
                    dueString: dueString,
                    priority: priority.rawValue
                )

                let request = TodoistTaskRequest(
                    content: content,
                    dueString: dueString,
                    priority: priority
                )
                async let todoistTask = todoistService.createTask(request)

                let (backend, todoist) = try await (backendTask, todoistTask)

                // Return backend task as primary, mark as hybrid
                task = backend
            }

            syncState = .success
            return task

        } catch {
            syncState = .error
            self.error = error.localizedDescription
            throw error
        }
    }

    /// Create task offline (queued for later sync)
    /// - Parameters:
    ///   - content: Task content
    ///   - dueString: Optional due date string
    ///   - priority: Optional task priority
    func createTaskOffline(_ content: String, dueString: String? = nil, priority: TaskPriority = .normal) {
        cacheManager.queueTaskCreation(
            content: content,
            dueString: dueString,
            priority: priority
        )

        // Create optimistic local task
        let optimisticTask = OptaTask(
            id: UUID().uuidString,
            content: content,
            description: nil,
            projectId: nil,
            priority: priority,
            due: nil,
            labels: [],
            isCompleted: false,
            createdAt: Date(),
            source: .backend
        )

        tasks.insert(optimisticTask, at: 0)
    }

    // MARK: - Complete Task

    /// Complete a task using the current sync strategy
    /// - Parameter taskId: Task ID to complete
    func completeTask(taskId: String) async throws {
        syncState = .syncing
        error = nil

        defer {
            Task { @MainActor in
                syncState = .idle
            }
        }

        do {
            switch strategy {
            case .backend:
                try await apiService.completeTask(taskId: taskId)

            case .direct:
                try await todoistService.completeTask(id: taskId)

            case .hybrid:
                // Complete in both services
                async let backendComplete = apiService.completeTask(taskId: taskId)
                async let todoistComplete = todoistService.completeTask(id: taskId)

                try await backendComplete
                try await todoistComplete
            }

            // Remove from local state
            tasks.removeAll { $0.id == taskId }

            syncState = .success

        } catch {
            syncState = .error
            self.error = error.localizedDescription
            throw error
        }
    }

    /// Complete task offline (queued for later sync)
    /// - Parameter taskId: Task ID to complete
    func completeTaskOffline(taskId: String) {
        cacheManager.queueTaskCompletion(taskId: taskId)

        // Optimistically remove from UI
        tasks.removeAll { $0.id == taskId }
    }

    // MARK: - Delete Task

    /// Delete a task (Todoist only - backend doesn't support delete yet)
    /// - Parameter taskId: Task ID to delete
    func deleteTask(taskId: String) async throws {
        guard todoistService.isAuthenticated else {
            throw TaskSyncError.operationNotSupported
        }

        syncState = .syncing
        error = nil

        defer {
            Task { @MainActor in
                syncState = .idle
            }
        }

        do {
            try await todoistService.deleteTask(id: taskId)

            // Remove from local state
            tasks.removeAll { $0.id == taskId }

            syncState = .success

        } catch {
            syncState = .error
            self.error = error.localizedDescription
            throw error
        }
    }

    // MARK: - Process Pending Changes

    /// Process all pending offline changes
    func processPendingChanges() async {
        await cacheManager.processPendingChanges()
    }

    // MARK: - Deduplication

    /// Deduplicate tasks from backend and Todoist
    /// Uses content similarity + timestamp tolerance (5 minutes)
    private func deduplicateTasks(backend: [OptaTask], todoist: [OptaTask]) -> [OptaTask] {
        var mergedTasks: [OptaTask] = []
        var processedTodoistIDs: Set<String> = []

        // Start with backend tasks
        for backendTask in backend {
            // Check if there's a matching Todoist task
            if let matchingTodoist = findMatchingTask(
                backendTask,
                in: todoist,
                tolerance: 5 * 60 // 5 minutes
            ) {
                // Mark as hybrid and use backend version as primary
                var hybridTask = backendTask
                // Store both IDs for cross-reference if needed
                mergedTasks.append(hybridTask)
                processedTodoistIDs.insert(matchingTodoist.id)
            } else {
                // No match, add backend task
                mergedTasks.append(backendTask)
            }
        }

        // Add remaining Todoist tasks that weren't matched
        for todoistTask in todoist {
            if !processedTodoistIDs.contains(todoistTask.id) {
                mergedTasks.append(todoistTask)
            }
        }

        return mergedTasks
    }

    /// Find matching task based on content similarity and timestamp
    private func findMatchingTask(_ task: OptaTask, in tasks: [OptaTask], tolerance: TimeInterval) -> OptaTask? {
        for candidate in tasks {
            // Check content similarity (normalize and compare)
            let normalizedTask = task.content.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
            let normalizedCandidate = candidate.content.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)

            if normalizedTask == normalizedCandidate {
                // Check timestamp tolerance if both have creation dates
                if let taskDate = task.createdAt,
                   let candidateDate = candidate.createdAt {
                    let timeDiff = abs(taskDate.timeIntervalSince(candidateDate))
                    if timeDiff <= tolerance {
                        return candidate
                    }
                } else {
                    // One or both missing timestamps, consider it a match based on content alone
                    return candidate
                }
            }
        }

        return nil
    }

    // MARK: - Filtering Helpers

    private func filterTodayTasks(_ tasks: [OptaTask]) -> [OptaTask] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())

        return tasks.filter { task in
            guard let dueDate = task.due?.displayDate else { return false }
            return calendar.isDate(dueDate, inSameDayAs: today)
        }
    }

    private func filterOverdueTasks(_ tasks: [OptaTask]) -> [OptaTask] {
        let now = Date()

        return tasks.filter { task in
            guard let dueDate = task.due?.displayDate else { return false }
            return dueDate < now && !Calendar.current.isDateInToday(dueDate)
        }
    }

    private func filterUpcomingTasks(_ tasks: [OptaTask]) -> [OptaTask] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let weekFromNow = calendar.date(byAdding: .day, value: 7, to: today)!

        return tasks.filter { task in
            guard let dueDate = task.due?.displayDate else { return false }
            return dueDate > today && dueDate <= weekFromNow
        }
    }

    private func calculateStats(from tasks: [OptaTask]) -> TaskStats {
        let todayCount = filterTodayTasks(tasks).count
        let overdueCount = filterOverdueTasks(tasks).count
        let upcomingCount = filterUpcomingTasks(tasks).count
        let totalActive = tasks.filter { !$0.isCompleted }.count

        return TaskStats(
            todayCount: todayCount,
            overdueCount: overdueCount,
            upcomingCount: upcomingCount,
            totalActive: totalActive
        )
    }
}

// SyncState is defined in SyncState.swift

// MARK: - Task Sync Error

enum TaskSyncError: LocalizedError {
    case operationNotSupported
    case syncFailed
    case conflictDetected

    var errorDescription: String? {
        switch self {
        case .operationNotSupported:
            return "This operation is not supported with the current authentication"
        case .syncFailed:
            return "Failed to sync tasks"
        case .conflictDetected:
            return "Conflicting changes detected"
        }
    }
}
