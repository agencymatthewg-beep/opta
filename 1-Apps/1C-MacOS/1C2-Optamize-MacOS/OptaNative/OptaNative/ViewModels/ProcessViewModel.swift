//
//  ProcessViewModel.swift
//  OptaNative
//
//  View model for process list management with filtering and search.
//  Created for Opta Native macOS - Plan 19-07
//

import SwiftUI

/// Filter options for the process list.
enum ProcessFilter: String, CaseIterable {
    case all = "All"
    case user = "User"
    case bloatware = "Bloatware"

    /// Corresponding process category for filtering
    var category: ProcessCategory? {
        switch self {
        case .all:
            return nil
        case .user:
            return .user
        case .bloatware:
            return .bloatware
        }
    }
}

/// View model managing process list, filtering, searching, and termination.
@Observable
@MainActor
class ProcessViewModel {

    // MARK: - Published Properties

    /// All processes from the service
    private(set) var allProcesses: [ProcessInfo] = []

    /// Currently selected filter
    var filter: ProcessFilter = .all

    /// Search text for filtering by name
    var searchText: String = ""

    /// Whether a termination confirmation is shown
    var showTerminationConfirmation: Bool = false

    /// Process pending termination confirmation
    var processToTerminate: ProcessInfo?

    /// Whether processes are being loaded
    var isLoading: Bool = false

    /// Error message if operation failed
    var errorMessage: String?

    // MARK: - Services

    private let processService = ProcessService()
    private let helperManager = HelperManager()

    // MARK: - Computed Properties

    /// Filtered and searched processes
    var filteredProcesses: [ProcessInfo] {
        var processes = allProcesses

        // Apply category filter
        if let category = filter.category {
            processes = processes.filter { $0.category == category }
        }

        // Apply search filter
        if !searchText.isEmpty {
            let lowercasedSearch = searchText.lowercased()
            processes = processes.filter {
                $0.name.lowercased().contains(lowercasedSearch)
            }
        }

        return processes
    }

    /// Count of processes in current filter
    var processCount: Int {
        filteredProcesses.count
    }

    /// Whether helper is installed (needed for termination)
    var isHelperInstalled: Bool {
        helperManager.isHelperInstalled
    }

    // MARK: - Initialization

    init() {
        helperManager.checkHelperStatus()
    }

    // MARK: - Process Management

    /// Refreshes the process list from the service.
    func refreshProcesses() {
        isLoading = true
        errorMessage = nil

        // Fetch processes asynchronously (ProcessService is an actor)
        Task { [weak self] in
            guard let self = self else { return }
            let processes = await self.processService.getRunningProcesses()
            self.allProcesses = processes
            self.isLoading = false
        }
    }

    /// Requests termination of a process.
    /// Shows confirmation for system processes.
    /// - Parameter process: The process to terminate
    func requestTermination(of process: ProcessInfo) {
        // Always show confirmation for system processes
        if process.isSystem || process.category == .essential {
            processToTerminate = process
            showTerminationConfirmation = true
        } else {
            // For non-system processes, terminate directly
            terminateProcess(process)
        }
    }

    /// Confirms termination of the pending process.
    func confirmTermination() {
        guard let process = processToTerminate else { return }
        terminateProcess(process)
        showTerminationConfirmation = false
        processToTerminate = nil
    }

    /// Cancels the termination confirmation.
    func cancelTermination() {
        showTerminationConfirmation = false
        processToTerminate = nil
    }

    /// Terminates a process using the helper manager.
    /// - Parameter process: The process to terminate
    private func terminateProcess(_ process: ProcessInfo) {
        Task {
            let result = await helperManager.terminateProcess(pid: process.pid)

            if result.success {
                // Remove from local list
                allProcesses.removeAll { $0.id == process.id }
            } else {
                errorMessage = result.error ?? "Failed to terminate process"
            }
        }
    }

    // MARK: - Helper Management

    /// Installs the privileged helper tool.
    func installHelper() async {
        do {
            try await helperManager.installHelper()
        } catch {
            errorMessage = "Failed to install helper: \(error.localizedDescription)"
        }
    }

    // MARK: - Sorting

    /// Sorts processes by CPU usage (descending)
    func sortByCPU() {
        allProcesses.sort { $0.cpuUsage > $1.cpuUsage }
    }

    /// Sorts processes by memory usage (descending)
    func sortByMemory() {
        allProcesses.sort { $0.memoryMB > $1.memoryMB }
    }

    /// Sorts processes by name (alphabetical)
    func sortByName() {
        allProcesses.sort { $0.name.lowercased() < $1.name.lowercased() }
    }
}

// MARK: - Preview Support

#if DEBUG
extension ProcessViewModel {
    /// Creates a view model with mock data for SwiftUI previews
    static var preview: ProcessViewModel {
        let vm = ProcessViewModel()
        vm.allProcesses = [
            ProcessInfo(
                id: 1,
                name: "Safari",
                user: "user",
                cpuUsage: 12.5,
                memoryMB: 450.0,
                isSystem: false,
                path: "/Applications/Safari.app",
                category: .user
            ),
            ProcessInfo(
                id: 2,
                name: "Xcode",
                user: "user",
                cpuUsage: 35.2,
                memoryMB: 2100.0,
                isSystem: false,
                path: "/Applications/Xcode.app",
                category: .user
            ),
            ProcessInfo(
                id: 3,
                name: "WindowServer",
                user: "root",
                cpuUsage: 5.0,
                memoryMB: 180.0,
                isSystem: true,
                path: "/System/Library/PrivateFrameworks/",
                category: .essential
            ),
            ProcessInfo(
                id: 4,
                name: "Spotify",
                user: "user",
                cpuUsage: 3.5,
                memoryMB: 380.0,
                isSystem: false,
                path: "/Applications/Spotify.app",
                category: .bloatware
            ),
            ProcessInfo(
                id: 5,
                name: "Adobe CEF Helper",
                user: "user",
                cpuUsage: 8.0,
                memoryMB: 520.0,
                isSystem: false,
                path: "/Applications/Adobe/",
                category: .bloatware
            )
        ]
        return vm
    }
}
#endif
