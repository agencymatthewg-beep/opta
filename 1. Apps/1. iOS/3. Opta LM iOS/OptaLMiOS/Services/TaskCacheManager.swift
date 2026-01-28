import Foundation
import SwiftUI

// MARK: - Task Cache Manager

/// Manages offline caching and pending changes queue for task operations
@MainActor
final class TaskCacheManager: ObservableObject {
    static let shared = TaskCacheManager()

    // MARK: - Published State

    @Published var cachedTasks: [OptaTask] = []
    @Published var pendingChanges: [PendingTaskChange] = []
    @Published var isSyncing = false
    @Published var lastSyncDate: Date?

    // MARK: - UserDefaults Keys

    private let cachedTasksKey = "opta_cached_tasks"
    private let pendingChangesKey = "opta_pending_changes"
    private let lastSyncKey = "opta_last_sync"

    // MARK: - Constants

    private let maxRetries = 3
    private let retryDelay: TimeInterval = 5 // seconds

    // MARK: - Initialization

    private init() {
        loadFromDisk()
    }

    // MARK: - Cache Operations

    /// Update the task cache
    /// - Parameter tasks: Array of tasks to cache
    func updateCache(tasks: [OptaTask]) {
        cachedTasks = tasks
        saveToDisk()
    }

    /// Get cached tasks
    /// - Returns: Array of cached tasks
    func getCachedTasks() -> [OptaTask] {
        return cachedTasks
    }

    /// Clear the cache
    func clearCache() {
        cachedTasks = []
        saveToDisk()
    }

    // MARK: - Offline Queue Operations

    /// Queue a task creation for offline processing
    /// - Parameters:
    ///   - content: Task content
    ///   - dueString: Optional due date string
    ///   - priority: Optional task priority
    func queueTaskCreation(content: String, dueString: String?, priority: TaskPriority?) {
        let change = PendingTaskChange(
            type: .create,
            content: content,
            dueString: dueString,
            priority: priority
        )

        pendingChanges.append(change)
        saveToDisk()

        HapticManager.shared.notification(.warning)

        // Try to sync immediately if online
        Task {
            await processPendingChanges()
        }
    }

    /// Queue a task completion for offline processing
    /// - Parameter taskId: ID of task to complete
    func queueTaskCompletion(taskId: String) {
        let change = PendingTaskChange(
            type: .complete,
            taskId: taskId
        )

        pendingChanges.append(change)
        saveToDisk()

        // Optimistically update cache
        if let index = cachedTasks.firstIndex(where: { $0.id == taskId }) {
            cachedTasks.remove(at: index)
            saveToDisk()
        }

        HapticManager.shared.notification(.warning)

        // Try to sync immediately if online
        Task {
            await processPendingChanges()
        }
    }

    /// Queue a task deletion for offline processing
    /// - Parameter taskId: ID of task to delete
    func queueTaskDeletion(taskId: String) {
        let change = PendingTaskChange(
            type: .delete,
            taskId: taskId
        )

        pendingChanges.append(change)
        saveToDisk()

        // Optimistically update cache
        if let index = cachedTasks.firstIndex(where: { $0.id == taskId }) {
            cachedTasks.remove(at: index)
            saveToDisk()
        }

        HapticManager.shared.notification(.warning)

        // Try to sync immediately if online
        Task {
            await processPendingChanges()
        }
    }

    /// Queue a task update for offline processing
    /// - Parameters:
    ///   - taskId: ID of task to update
    ///   - content: Updated content
    ///   - dueString: Updated due date string
    ///   - priority: Updated priority
    func queueTaskUpdate(taskId: String, content: String?, dueString: String?, priority: TaskPriority?) {
        let change = PendingTaskChange(
            type: .update,
            taskId: taskId,
            content: content,
            dueString: dueString,
            priority: priority
        )

        pendingChanges.append(change)
        saveToDisk()

        HapticManager.shared.notification(.warning)

        // Try to sync immediately if online
        Task {
            await processPendingChanges()
        }
    }

    /// Process all pending changes (sync to server)
    func processPendingChanges() async {
        guard !isSyncing, !pendingChanges.isEmpty else { return }

        isSyncing = true
        defer { isSyncing = false }

        var processedIndices: [Int] = []
        var failedChanges: [(Int, PendingTaskChange)] = []

        for (index, change) in pendingChanges.enumerated() {
            do {
                try await processChange(change)
                processedIndices.append(index)
            } catch {
                // Check if we should retry
                if change.retryCount < maxRetries {
                    var updatedChange = change
                    updatedChange = PendingTaskChange(
                        id: updatedChange.id,
                        type: updatedChange.type,
                        taskId: updatedChange.taskId,
                        content: updatedChange.content,
                        dueString: updatedChange.dueString,
                        priority: updatedChange.priority,
                        timestamp: updatedChange.timestamp,
                        retryCount: updatedChange.retryCount + 1
                    )
                    failedChanges.append((index, updatedChange))
                } else {
                    // Max retries reached, discard change
                    processedIndices.append(index)
                    print("⚠️ TaskCacheManager: Discarding change after \(maxRetries) retries: \(change)")
                }
            }
        }

        // Remove processed changes
        for index in processedIndices.sorted().reversed() {
            pendingChanges.remove(at: index)
        }

        // Update failed changes with new retry count
        for (index, updatedChange) in failedChanges {
            if index < pendingChanges.count {
                pendingChanges[index] = updatedChange
            }
        }

        saveToDisk()

        if pendingChanges.isEmpty {
            lastSyncDate = Date()
            UserDefaults.standard.set(lastSyncDate, forKey: lastSyncKey)
            HapticManager.shared.notification(.success)
        }
    }

    /// Process a single pending change
    private func processChange(_ change: PendingTaskChange) async throws {
        // Check which service to use based on what's authenticated
        let todoistService = TodoistService.shared
        let apiService = APIService.shared

        let useTodoist = todoistService.isAuthenticated
        let useBackend = AuthManager.shared.sessionToken != nil

        switch change.type {
        case .create:
            guard let content = change.content else {
                throw CacheError.invalidChangeData
            }

            if useTodoist {
                let request = TodoistTaskRequest(
                    content: content,
                    dueString: change.dueString,
                    priority: change.priority
                )
                _ = try await todoistService.createTask(request)
            }

            if useBackend {
                _ = try await apiService.createTask(
                    content: content,
                    dueString: change.dueString,
                    priority: change.priority?.rawValue
                )
            }

        case .complete:
            guard let taskId = change.taskId else {
                throw CacheError.invalidChangeData
            }

            if useTodoist {
                try await todoistService.completeTask(id: taskId)
            }

            if useBackend {
                try await apiService.completeTask(taskId: taskId)
            }

        case .delete:
            guard let taskId = change.taskId else {
                throw CacheError.invalidChangeData
            }

            if useTodoist {
                try await todoistService.deleteTask(id: taskId)
            }

            // Backend doesn't support delete yet
            // Add when available

        case .update:
            guard let taskId = change.taskId,
                  let content = change.content else {
                throw CacheError.invalidChangeData
            }

            if useTodoist {
                let request = TodoistTaskRequest(
                    content: content,
                    dueString: change.dueString,
                    priority: change.priority
                )
                _ = try await todoistService.updateTask(taskId: taskId, request)
            }

            // Backend doesn't support update yet
            // Add when available
        }
    }

    /// Clear all pending changes
    func clearPendingChanges() {
        pendingChanges = []
        saveToDisk()
    }

    // MARK: - Persistence

    /// Save cache and pending changes to disk
    private func saveToDisk() {
        // Save cached tasks
        if let tasksData = try? JSONEncoder().encode(cachedTasks) {
            UserDefaults.standard.set(tasksData, forKey: cachedTasksKey)
        }

        // Save pending changes
        if let changesData = try? JSONEncoder().encode(pendingChanges) {
            UserDefaults.standard.set(changesData, forKey: pendingChangesKey)
        }
    }

    /// Load cache and pending changes from disk
    private func loadFromDisk() {
        // Load cached tasks
        if let tasksData = UserDefaults.standard.data(forKey: cachedTasksKey),
           let tasks = try? JSONDecoder().decode([OptaTask].self, from: tasksData) {
            cachedTasks = tasks
        }

        // Load pending changes
        if let changesData = UserDefaults.standard.data(forKey: pendingChangesKey),
           let changes = try? JSONDecoder().decode([PendingTaskChange].self, from: changesData) {
            pendingChanges = changes
        }

        // Load last sync date
        lastSyncDate = UserDefaults.standard.object(forKey: lastSyncKey) as? Date
    }

    // MARK: - Status

    /// Check if there are pending changes
    var hasPendingChanges: Bool {
        !pendingChanges.isEmpty
    }

    /// Get count of pending changes
    var pendingChangesCount: Int {
        pendingChanges.count
    }
}

// MARK: - Cache Error

enum CacheError: LocalizedError {
    case invalidChangeData
    case syncFailed
    case maxRetriesExceeded

    var errorDescription: String? {
        switch self {
        case .invalidChangeData:
            return "Invalid change data in offline queue"
        case .syncFailed:
            return "Failed to sync offline changes"
        case .maxRetriesExceeded:
            return "Maximum retry attempts exceeded"
        }
    }
}
